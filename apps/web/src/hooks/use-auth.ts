import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { User } from '@supabase/supabase-js'

type AuthState = {
  user: User | null
  loading: boolean
  isAdmin: boolean
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    let isMounted = true
    // 🔢 Pelacak Versi Permintaan: Menjamin data lama tidak akan pernah menindih data segar (Race Condition Fix)
    let currentRequestId = 0 

    // 🎭 HELPER SAMARAN CACHE (Obfuscated Session Storage)
    const getCachedAdminStatus = (userId: string): boolean => {
      try {
        const raw = sessionStorage.getItem('__kb_adm_session')
        if (!raw) return false
        
        // Bongkar samaran Base64
        const decoded = JSON.parse(atob(raw))
        
        // Validasi: Harus milik User ID aktif, status TRUE, dan usia cache di bawah 4 jam (14.400.000 ms)
        const isUidMatch = decoded.uid === userId
        const isVerified = decoded.verified === true
        const isFresh = (Date.now() - decoded.ts) < 14400000 
        
        return isUidMatch && isVerified && isFresh
      } catch {
        return false
      }
    }

    const saveAdminStatusToCache = (userId: string) => {
      try {
        const payload = {
          uid: userId,
          verified: true,
          ts: Date.now()
        }
        // Bungkus dengan sandi Base64 agar aman dari tangan-tangan iseng di browser F12
        sessionStorage.setItem('__kb_adm_session', btoa(JSON.stringify(payload)))
      } catch (err) {
        console.error('[Auth] Gagal menyimpan cache aman:', err)
      }
    }

    const checkAdminStatus = async (userId: string, requestId: number) => {
      try {
        // 🚀 CHECK CACHE FIRST: Jika sesi tab ini sudah lolos sensor, jangan ganggu database lagi!
        if (getCachedAdminStatus(userId)) {
          console.log(`[Auth] Request #${requestId} menggunakan cache memori terverifikasi. Bebas hambatan!`)
          setIsAdmin(true)
          return
        }

        // ⏳ HYDRO-LOCK: Berikan jeda 150ms agar Supabase selesai menyuntikkan token auth ke header
        await new Promise(resolve => setTimeout(resolve, 150))

        const dbPromise = supabase
          .from('admin_users')
          .select('role')
          .eq('id', userId)
          .maybeSingle()

        // ⏳ COLD-START TOLERANT: Perpanjang batas waktu ke 8 detik untuk toleransi bangunnya server database
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('TIMEOUT_COLD_START')), 8000)
        })

        // Balapan kueri vs timeout
        const response = await Promise.race([
          dbPromise,
          timeoutPromise as unknown as Awaited<typeof dbPromise>
        ])
        
        // 🛡️ ANTI-STALE GUARD
        if (!isMounted || requestId !== currentRequestId) {
          console.log(`[Auth] Mengabaikan respon kueri #${requestId} karena ada kueri lebih baru.`)
          return 
        }

        // Periksa apakah server Supabase mengembalikan objek error kueri (misal: masalah RLS)
        if (response.error) {
          console.error(`[Auth] Kueri DB mengembalikan error pada Request #${requestId}:`, response.error)
          setIsAdmin(false)
          return
        }

        const hasAccess = !!response.data
        console.log(`[Auth] Request #${requestId} sukses. Akses: ${hasAccess}, Role:`, response.data?.role)
        
        if (hasAccess) {
          // Simpan ke dalam Bunker Memori Terproteksi
          saveAdminStatusToCache(userId)
        }

        setIsAdmin(hasAccess)
        
      } catch (err) {
        if (!isMounted || requestId !== currentRequestId) return

        if (err instanceof Error && err.message === 'TIMEOUT_COLD_START') {
          console.warn(`[Auth] Batas waktu 8 detik terlampaui pada Request #${requestId}. Kemungkinan database sedang cold-start.`)
        } else {
          console.error(`[Auth] Kegagalan sistem autentikasi pada Request #${requestId}:`, err)
        }
        
        setIsAdmin(false)
      }
    }

    // ============================================================
    // 🚨 PUSAT KONTROL TUNGGAL DENGAN SERIALISASI VERSI REQUEST
    // ============================================================
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!isMounted) return

        // Naikkan versi permintaan setiap kali ada event baru dari Supabase
        const nextRequestId = ++currentRequestId
        console.log(`[Auth] Menangkap event "${event}". Menerbitkan Request ID #${nextRequestId}`)

        const currentUser = session?.user ?? null
        setUser(currentUser)

        if (currentUser) {
          // Jalankan verifikasi tertib dengan menyertakan tag versi unik
          await checkAdminStatus(currentUser.id, nextRequestId)
        } else {
          // Reset instan jika tidak ada user di event ini
          if (isMounted && nextRequestId === currentRequestId) {
            setIsAdmin(false)
          }
        }

        // Matikan loader global HANYA jika ini adalah arus request terakhir yang sah
        if (isMounted && nextRequestId === currentRequestId) {
          setLoading(false)
        }
      }
    )

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  // ============================================================
  // 💓 DETAK JANTUNG KEAMANAN (Background Security Heartbeat)
  // Menjamin jika hak akses dicabut di database, sistem akan merespons dalam 15 menit
  // ============================================================
  useEffect(() => {
    if (!user || !isAdmin) return

    const checkInterval = setInterval(async () => {
      try {
        console.log('[Auth] 💓 Memulai detak jantung verifikasi keamanan latar belakang...')
        
        const { data, error } = await supabase
          .from('admin_users')
          .select('role')
          .eq('id', user.id)
          .maybeSingle()

        // 🚨 CRITICAL ACT: Hanya bertindak jika database SUKSES merespon DAN mengonfirmasi data KOSONG.
        // Jika ada network error (glitch), abaikan saja untuk kenyamanan pengguna.
        if (!error && !data) {
          console.warn('[Auth] 🚫 AKSES ADMINISTRATOR TELEH DICABUT DARI DATABASE! Memaksa keluar otomatis.')
          sessionStorage.removeItem('__kb_adm_session')
          setIsAdmin(false)
        } else if (!error && data) {
          console.log('[Auth] 💓 Detak jantung sukses: Sesi admin Anda terverifikasi segar.')
          // Perbarui timestamp cache agar tetap hidup
          try {
            const payload = { uid: user.id, verified: true, ts: Date.now() }
            sessionStorage.setItem('__kb_adm_session', btoa(JSON.stringify(payload)))
          } catch {}
        }
      } catch (err) {
        // Diam saja jika gagal koneksi, biarkan cache lokal menjaga kenyamanan user
        console.warn('[Auth] Gagal menjalankan detak jantung latar belakang:', err)
      }
    }, 900000) // 🕒 Detak setiap 15 menit sekali (900.000 ms)

    return () => clearInterval(checkInterval)
  }, [user, isAdmin])

  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
  }

  const signOut = async () => {
    try {
      await supabase.auth.signOut()
    } catch (err) {
      console.error('API SignOut gagal, memaksa pembersihan sesi lokal...', err)
    } finally {
      // 🧹 Sapu bersih cache memori demi keamanan absolut
      sessionStorage.removeItem('__kb_adm_session')
      setUser(null)
      setIsAdmin(false)
    }
  }

  return { user, loading, isAdmin, signInWithGoogle, signOut }
}
