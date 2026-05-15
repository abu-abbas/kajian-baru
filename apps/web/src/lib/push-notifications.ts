// ============================================================
// KajianBaru — Web Push Client Helper Utilities
// ============================================================

import { supabase } from './supabase'

/**
 * Helper: Mengonversi VAPID public key base64 menjadi Uint8Array yang dibutuhkan browser pushManager
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')

  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

/**
 * 🚀 Mendaftarkan Service Worker (/sw.js) ke browser
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('⚠️ Browser ini tidak mendukung fitur Notifikasi Web Push.')
    return null
  }

  try {
    // Register sw.js di lingkup root web
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/'
    })
    console.log('✅ [Push] Service Worker terdaftar dengan sukses:', registration.scope)
    return registration
  } catch (error) {
    console.error('🚨 [Push] Gagal mendaftarkan Service Worker:', error)
    return null
  }
}

/**
 * 🔔 Mendaftarkan User ke Layanan Push (Minta permission, ambil key, subscribe)
 */
export async function subscribeUserToPush(): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Amankan Sesi Aktif Supabase Sebelum Lanjut
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return { success: false, error: 'Sesi telah berakhir. Silakan masuk/login ulang terlebih dahulu.' }
    }
    const token = session.access_token

    // 2. Validasi Kesiapan Service Worker
    let registration: ServiceWorkerRegistration | null | undefined = await navigator.serviceWorker.getRegistration()
    if (!registration) {
      registration = await registerServiceWorker()
    }
    if (!registration) {
      return { success: false, error: 'Gagal mengaktifkan pengendali notifikasi browser (SW).' }
    }

    // 3. Panggil Dialog Izin Browser
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      return { success: false, error: 'Izin notifikasi diblokir. Mohon aktifkan manual di pengaturan gembok alamat browser.' }
    }

    // 4. Tarik Kunci VAPID Publik dari Server Backend kita (Dengan Proteksi JWT)
    const keyResponse = await fetch('/api/push/vapid-key', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    const keyData = await keyResponse.json()

    if (!keyResponse.ok || !keyData.success || !keyData.data?.publicKey) {
      return { success: false, error: 'Gagal menyambung ke server notifikasi.' }
    }

    const applicationServerKey = urlBase64ToUint8Array(keyData.data.publicKey)

    // 5. Bangun Saluran Komunikasi Push Manager Browser
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationServerKey as any
    })

    // 6. Kirim Tanda Pengenal Saluran (Subscription Data) ke Database API Backend kita
    const syncResponse = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ subscription })
    })

    const syncResult = await syncResponse.json()

    if (syncResponse.ok && syncResult.success) {
      console.log('🎉 [Push] Browser Berhasil Terdaftar ke Database!')
      return { success: true }
    } else {
      return { success: false, error: syncResult.error || 'Sinkronisasi database gagal.' }
    }

  } catch (error) {
    console.error('🚨 [Push] Kegagalan rantai subscription:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Terjadi gangguan tak terduga'
    }
  }
}

/**
 * 🔕 Memutus Langganan Push (Unsubscribe)
 */
export async function unsubscribeUserFromPush(): Promise<{ success: boolean }> {
  try {
    const registration = await navigator.serviceWorker.getRegistration()
    if (registration) {
      const subscription = await registration.pushManager.getSubscription()
      if (subscription) {
        await subscription.unsubscribe()
      }
    }

    // Informasikan ke Backend untuk bersih-bersih data di DB
    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
      await fetch('/api/push/unsubscribe', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })
    }

    return { success: true }
  } catch (err) {
    console.error('🚨 [Push] Gagal memutus saluran:', err)
    return { success: false }
  }
}

/**
 * 🔍 Memeriksa status aktif subscription saat ini di browser
 */
export async function getPushSubscriptionStatus(): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false

  try {
    const registration = await navigator.serviceWorker.getRegistration()
    if (!registration) return false

    const subscription = await registration.pushManager.getSubscription()
    return !!subscription
  } catch {
    return false
  }
}
