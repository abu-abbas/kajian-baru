import { useState, useEffect, useRef } from 'react'
import { KajianCard } from '../components/KajianCard'
import { ThemeToggle } from '../components/ui/theme-toggle'
import { Button } from '../components/ui/button'
import { useAuth } from '../hooks/use-auth'
import { OneTapPrompt } from '../components/OneTapPrompt'
import { FilterDialog } from '../components/FilterDialog'
import { KajianDetailDialog } from '../components/KajianDetailDialog'
import { NotificationsCenter } from '../components/NotificationsCenter'
import { ScrollToTop } from '../components/ScrollToTop'
import type { Audience, Kajian, ApiResponse } from '@kajian-baru/types'
import { Compass, LogIn, LogOut, Settings, Search, SlidersHorizontal, X, Loader2, Bell, BellOff, CheckCircle2, AlertCircle, ArrowUp, Quote, MapPin, CalendarDays } from 'lucide-react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { registerServiceWorker, subscribeUserToPush, unsubscribeUserFromPush, getPushSubscriptionStatus } from '../lib/push-notifications'
import { groupKajiansByLocation } from '../lib/utils'

export function Home() {
  const today = new Date().toISOString().split('T')[0] ?? ''
  const [kota, setKota] = useState('')
  const lastLoadedTimestamp = useRef<string>(new Date().toISOString())
  const [audience, setAudience] = useState<Audience | ''>('')

  // Diinisialisasi kosong agar menampilkan TIMELINE GLOBAL (semua kajian terbaru)
  const [tanggal, setTanggal] = useState('')
  const [search, setSearch] = useState('') // 🔎 TINGKAT DEWA: Keyword Search Spotlight!

  const [kajianList, setKajianList] = useState<Kajian[]>([])
  const [loading, setLoading] = useState(false)

  // States Paginasi/Timeline
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const LIMIT = 10 // Load 10 data per rentang layar

  const [isScrolled, setIsScrolled] = useState(false)
  const [isFilterOpen, setIsFilterOpen] = useState(false)

  // 🧬 Interaksi Kartu Kajian & Dialog Detil
  const [selectedKajian, setSelectedKajian] = useState<Kajian | null>(null)
  const [selectedGroup, setSelectedGroup] = useState<Kajian[]>([]) // Wadah sesi ganda grup terpilih
  const [isDetailOpen, setIsDetailOpen] = useState(false)

  const { user, isAdmin, signInWithGoogle, signOut } = useAuth()

  const [pushEnabled, setPushEnabled] = useState(false)
  const [toastMsg, setToastMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  // 🐦 REALTIME STATES: Untuk melacak data masuk baru secara instan!
  const [newKajianCount, setNewKajianCount] = useState(0)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  // 🎯 DYNAMIC ANCHOR: Melacak koordinat elemen pencarian utama secara presisi!
  const heroSearchRef = useRef<HTMLDivElement>(null)

  // 🛸 Registrasi Service Worker Global (On Load)
  useEffect(() => {
    void registerServiceWorker()
  }, [])

  // 🔍 Periksa status notifikasi browser jika user aktif
  useEffect(() => {
    const checkStatus = async () => {
      if (user) {
        const status = await getPushSubscriptionStatus()
        setPushEnabled(status)
      } else {
        setPushEnabled(false)
      }
    }
    void checkStatus()
  }, [user])

  // 🔗 DEEP LINKING: Buka otomatis modal detail jika alamat browser memiliki ?kajianId=...
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const linkedId = params.get('kajianId')
    if (!linkedId) return

    const loadDeepLinkedKajian = async () => {
      try {
        const { data, error } = await supabase
          .from('kajian')
          .select('*')
          .eq('id', linkedId)
          .maybeSingle()

        if (data && !error) {
          // Buka modal secara instan!
          setSelectedKajian(data as Kajian)
          setIsDetailOpen(true)

          // 🧼 Rapikan kembali URL browser (menghapus query param visual) tanpa reload
          window.history.replaceState({}, document.title, window.location.pathname)
        }
      } catch (err) {
        console.warn('⚠️ Gagal menangkap sinyal link detail:', err)
      }
    }

    void loadDeepLinkedKajian()
  }, []) // Efek ini hanya berjalan 1x saat halaman pertama kali dibuka

  // ⌨️ SHORTCUT KEYBOARD: Aktifkan Spotlight dengan Cmd+K atau Ctrl+K!
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setIsFilterOpen(prev => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // 📡 POLLING FALLBACK: Cek data kajian baru setiap 30 detik (lebih reliable dari WebSocket)
  useEffect(() => {
    // Reset hitungan & majukan timestamp referensi setiap kali filter berubah agar sinkron!
    lastLoadedTimestamp.current = new Date().toISOString()
    setNewKajianCount(0)

    const pollForNewKajian = async () => {
      try {
        let query = supabase
          .from('kajian')
          .select('*', { count: 'exact', head: true })
          .gt('created_at', lastLoadedTimestamp.current)

        // Terapkan filter aktif saat ini agar gelembung notifikasi relevan!
        if (kota) query = query.eq('kota', kota)
        if (tanggal) query = query.eq('tanggal_masehi', tanggal)
        if (audience) query = query.eq('audience', audience)
        if (search) query = query.or(`materi.ilike.%${search}%,pemateri.ilike.%${search}%,tempat.ilike.%${search}%`)

        const { count } = await query

        if (count && count > 0) {
          setNewKajianCount(count)
        }
      } catch (err) {
        console.error('[Poll] Gagal mengecek kajian baru:', err)
      }
    }

    const interval = setInterval(() => void pollForNewKajian(), 30_000)

    return () => clearInterval(interval)
  }, [kota, tanggal, audience])

  const handleLoadNewTimeline = () => {
    // 1. Cinematic Smooth Scroll to Top
    window.scrollTo({ top: 0, behavior: 'smooth' })

    // 2. Reset gelembung notifikasi timeline & majukan batas referensi pencarian instan!
    setNewKajianCount(0)
    lastLoadedTimestamp.current = new Date().toISOString()

    // 3. Picu penarikan ulang data (Halaman Pertama)
    if (offset === 0) {
      setRefreshTrigger(prev => prev + 1)
    } else {
      setOffset(0)
      setHasMore(true)
    }
  }

  const handleTogglePush = async () => {
    if (!user) {
      setToastMsg({ text: 'Silakan masuk/login terlebih dahulu!', type: 'error' })
      setTimeout(() => setToastMsg(null), 3000)
      return
    }

    try {
      if (pushEnabled) {
        await unsubscribeUserFromPush()
        setPushEnabled(false)
        setToastMsg({ text: 'Notifikasi berhasil dinonaktifkan.', type: 'success' })
      } else {
        // Tambahkan toast memuat sementara agar UI responsif
        setToastMsg({ text: 'Menghubungkan notifikasi browser...', type: 'success' })
        const result = await subscribeUserToPush()

        if (result.success) {
          setPushEnabled(true)
          setToastMsg({ text: 'Notifikasi Aktif! Anda siap menerima update.', type: 'success' })
        } else {
          setToastMsg({ text: `Gagal: ${result.error || 'Izin diblokir'}`, type: 'error' })
        }
      }
    } catch {
      setToastMsg({ text: 'Gangguan saat menyambungkan notifikasi.', type: 'error' })
    } finally {
      setTimeout(() => setToastMsg(null), 3500)
    }
  }

  // Deteksi pergerakan scroll layar secara DYNAMIC & RESPONSIVE
  useEffect(() => {
    const handleScroll = () => {
      if (!heroSearchRef.current) {
        setIsScrolled(window.scrollY > 300)
        return
      }
      // Baca koordinat aktual elemen pencarian di bawah hero
      const rect = heroSearchRef.current.getBoundingClientRect()
      // Aktifkan Search Navbar hanya jika elemen pencarian utama sudah "tersembunyi" di balik navbar (y +/- 72px)
      setIsScrolled(rect.bottom < 72)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll() // Cek awal saat mount
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // RESET total ketika filter pencarian berganti
  useEffect(() => {
    setKajianList([])
    setOffset(0)
    setHasMore(true)
  }, [tanggal, kota, audience, search])

  // Deteksi dasar layar (Scroll to Bottom) untuk memicu pemuatan data selanjutnya
  useEffect(() => {
    const handleInfiniteScroll = () => {
      if (!hasMore || loading || loadingMore) return

      // Hitung posisi scroll saat ini relatif terhadap batas bawah viewport
      const totalHeight = document.documentElement.scrollHeight
      const currentScrollPosition = window.innerHeight + window.scrollY

      // Jika sisa scroll kurang dari 300px, muat data halaman selanjutnya!
      if (totalHeight - currentScrollPosition < 300) {
        setOffset((prev) => prev + LIMIT)
      }
    }

    window.addEventListener('scroll', handleInfiniteScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleInfiniteScroll)
  }, [hasMore, loading, loadingMore])

  // Penarikan data (Timeline Loader) berbasis kombinasi Filter + Offset
  useEffect(() => {
    // 🛡️ REM DARURAT: Mencegah tembakan ganda akibat React StrictMode & Race Condition
    const controller = new AbortController()
    const { signal } = controller

    const fetchTimelineKajian = async () => {
      const isInitialLoad = offset === 0

      if (isInitialLoad) {
        setLoading(true)
      } else {
        setLoadingMore(true)
      }

      try {
        const params = new URLSearchParams()
        if (tanggal) params.append('tanggal', tanggal)
        if (kota) params.append('kota', kota)
        if (audience) params.append('audience', audience)
        if (search) params.append('q', search)

        params.append('limit', String(LIMIT))
        params.append('offset', String(offset))

        const response = await fetch(`/api/kajian?${params.toString()}`, { signal })
        const resData = await response.json() as ApiResponse<Kajian[]>

        if (response.ok && resData.success) {
          const fetchedItems = resData.data ?? []

          setKajianList((prev) => {
            // Gabungkan data lama dengan data baru jika scroll, overwrite jika ganti filter/awal
            return isInitialLoad ? fetchedItems : [...prev, ...fetchedItems]
          })

          // Jika hasil data yang kembali lebih sedikit dari LIMIT, berarti data di DB sudah habis
          if (fetchedItems.length < LIMIT) {
            setHasMore(false)
          }
        } else {
          if (isInitialLoad) setKajianList([])
          setHasMore(false)
        }
      } catch (err) {
        // Abaikan eror jika dibatalkan sengaja oleh controller (bukan eror jaringan asli)
        if (err instanceof Error && err.name === 'AbortError') {
          return
        }
        console.error('Gagal menarik umpan timeline:', err)
        if (isInitialLoad) setKajianList([])
        setHasMore(false)
      } finally {
        // Hanya matikan loading jika kueri ini tidak dibatalkan
        if (!signal.aborted) {
          setLoading(false)
          setLoadingMore(false)
        }
      }
    }

    void fetchTimelineKajian()

    // 🧹 CLEANUP: Batalkan tembakan lama saat komponen unmount / dependencies berubah!
    return () => controller.abort()
  }, [tanggal, kota, audience, search, offset, refreshTrigger])

  // Hitung jumlah filter aktif untuk lencana visual di ikon pencarian
  const activeFilterCount = [
    kota ? 1 : 0,
    audience ? 1 : 0,
    tanggal ? 1 : 0,
    search ? 1 : 0
  ].reduce((a, b) => a + b, 0)

  return (
    <div className="min-h-screen flex flex-col">
      <OneTapPrompt />

      {/* Dialog Filter Pencarian Mengambang */}
      <FilterDialog
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        search={search}
        onSearchChange={setSearch}
        kota={kota}
        onKotaChange={setKota}
        audience={audience}
        onAudienceChange={setAudience}
        tanggal={tanggal}
        onTanggalChange={setTanggal}
      />

      {/* 💎 Dialog Detil Kajian Ultra-Luxury & Tombol Ikuti */}
      <KajianDetailDialog
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        kajian={selectedKajian}
        allSessions={selectedGroup}
        initialIndex={selectedKajian ? Math.max(0, selectedGroup.indexOf(selectedKajian)) : 0}
      />

      {/* Super Premium Sticky Header */}
      <header className="sticky top-0 z-40 bg-background/40 backdrop-blur-xl border-b border-border/40 transition-all duration-500">
        <div className="max-w-2xl mx-auto px-4 h-16 flex items-center justify-between relative">

          {/* KIRI: Logo Brand (Memudar halus jika di-scroll untuk memberi ruang pada judul tengah) */}
          <div className={`flex items-center gap-2.5 transition-all duration-500 ${isScrolled ? 'opacity-100 scale-95' : 'opacity-100 scale-100'}`}>
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-md shadow-emerald-500/20">
              <span className="text-xl font-bold text-white leading-none">K</span>
            </div>
            <div className="hidden sm:block">
              <h1 className="text-lg font-black tracking-tight text-foreground">
                KajianBaru
              </h1>
              <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400/80 tracking-widest uppercase -mt-0.5">
                Daily Reminder
              </p>
            </div>
          </div>

          {/* TENGAH: Kosong (Menghapus sticky text lama sesuai permintaan abang agar lebih lega!) */}
          <div className="absolute left-1/2 -translate-x-1/2 pointer-events-none hidden sm:block" />

          {/* KANAN: Aksi-aksi Header */}
          <div className="flex items-center gap-1.5">

            {/* 🔎 Premium Search Dynamic Trigger (MUNCUL HANYA SAAT SCROLL: Gaya Minimalis Kelas Dunia!) */}
            {isScrolled && (
              <div className="flex items-center gap-1.5 animate-in fade-in slide-in-from-top-2 duration-300 ease-out">
                {/* 🔎 Desktop Trigger */}
                <button
                  onClick={() => setIsFilterOpen(true)}
                  className="h-9 hidden sm:flex items-center justify-between gap-4 pl-3 pr-1.5 bg-secondary/20 border border-border/60 hover:border-emerald-500/40 rounded-xl text-muted-foreground hover:text-foreground transition-all duration-300 active:scale-[0.98] cursor-pointer relative overflow-hidden"
                >
                  <div className="flex items-center gap-2 relative max-w-[130px]">
                    <Search className={`h-3.5 w-3.5 transition-colors ${search ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground/80'}`} />
                    <span className={`text-[11px] font-bold tracking-wide truncate transition-all ${search ? 'text-emerald-600 dark:text-emerald-400 font-black scale-100' : ''}`}>
                      {search ? `"${search}"` : 'Cari'}
                    </span>
                  </div>
                  <kbd className="flex items-center gap-0.5 border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 rounded-md text-[9px] font-black text-emerald-600 dark:text-emerald-400 leading-none tracking-normal shrink-0 shadow-xs font-sans relative">
                    <span>⌘</span>
                    <span>K</span>
                  </kbd>
                </button>

                {/* 🔎 Mobile Trigger */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsFilterOpen(true)}
                  title="Pencarian & Filter"
                  className={`relative sm:hidden rounded-full h-10 w-10 transition-all duration-300 ${
                    isFilterOpen
                      ? 'bg-primary/10 text-primary'
                      : 'hover:bg-accent hover:text-accent-foreground'
                  }`}
                >
                  <Search className="h-4 w-4" />

                  {/* Lencana Merah/Ijo Kecil Penanda Ada Filter Aktif */}
                  {activeFilterCount > 0 && (
                    <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-emerald-500 border-2 border-background ring-1 ring-emerald-500/50" />
                  )}
                </Button>
              </div>
            )}

            <ThemeToggle />

            {loading ? (
              // 🪄 Premium Floating Micro-Loader (Mencegah Lompatan Tombol)
              <div className="flex items-center border-l border-border/60 pl-2 ml-1">
                <div className="h-9 w-9 rounded-full bg-accent/30 flex items-center justify-center transition-all">
                  <Loader2 className="h-3.5 w-3.5 text-primary animate-spin" />
                </div>
              </div>
            ) : user ? (
              // Case A: User Logged In (Menampilkan Dashboard/Logout)
              <div className="flex items-center gap-1 border-l border-border/60 pl-1.5 ml-1 animate-in fade-in zoom-in-95 duration-300">
                {/* 🔔 Premium Multi-Functional Notifications Center */}
                <NotificationsCenter
                  pushEnabled={pushEnabled}
                  onTogglePush={handleTogglePush}
                  onSelectKajian={(k) => {
                    setSelectedKajian(k)
                    setSelectedGroup([k]) // Bungkus objek tunggal agar data synchronizer stabil!
                    setIsDetailOpen(true)
                  }}
                />
                {isAdmin && (
                  <Link to="/admin">
                    <Button variant="ghost" size="icon" title="Admin Dashboard" className="rounded-full text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/30 h-10 w-10">
                      <Settings className="h-4 w-4" />
                    </Button>
                  </Link>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => void signOut()}
                  title={`Keluar (${user.email ?? ''})`}
                  className="rounded-full hover:bg-destructive/5 hover:text-destructive h-10 w-10"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              // Case B: Guest State (Menampilkan Tombol Masuk)
              <Button
                variant="outline"
                size="sm"
                onClick={() => void signInWithGoogle()}
                className="text-xs font-semibold rounded-xl flex items-center gap-1.5 border-border hover:bg-accent/50 ml-1 animate-in fade-in duration-300"
              >
                <LogIn className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Masuk</span>
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* 🐦 Realtime Floating Timeline Update Bar (Gaya Twitter/X) */}
      {newKajianCount > 0 && (
        <button
          onClick={handleLoadNewTimeline}
          className="fixed top-[72px] left-1/2 -translate-x-1/2 z-40 bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-400/30 shadow-xl shadow-emerald-900/30 px-4 py-2 rounded-full text-[10px] font-black tracking-widest uppercase flex items-center gap-2 active:scale-95 transition-all duration-500 animate-in slide-in-from-top-5 fade-in ease-out group cursor-pointer"
        >
          <ArrowUp className="h-3.5 w-3.5 animate-bounce group-hover:translate-y-[-2px] transition-transform" />
          <span>{newKajianCount} Postingan Baru</span>
        </button>
      )}

      {/* Main Content Body */}
      <main className="flex-1 w-full max-w-2xl mx-auto px-4 py-8 space-y-8">

        {/* Greeting Section (Judul Besar Asli, akan tergulung alami ke atas) */}
        <div className="py-2">
          <h2 className="text-3xl font-black text-foreground leading-tight tracking-tight">
            Temukan Ilmu <br />
            <span className="text-emerald-500 dark:text-emerald-400 text-4xl bg-clip-text bg-gradient-to-r from-emerald-500 to-teal-400 text-transparent">Hari Ini.</span>
          </h2>
          <div className="mt-4 relative p-4 rounded-2xl border border-primary/10 bg-gradient-to-br from-emerald-500/5 to-teal-500/5 backdrop-blur-sm group hover:border-primary/20 transition-all duration-300 animate-in fade-in-50 slide-in-from-bottom-2">
            <Quote className="absolute top-3.5 left-3.5 h-4 w-4 text-emerald-500/30 shrink-0 group-hover:text-emerald-500/50 transition-colors" />
            <blockquote className="pl-6 italic text-[11px] sm:text-xs font-semibold leading-relaxed text-muted-foreground/90">
              "Barangsiapa yang menunjuki kepada kebaikan maka dia akan mendapatkan pahala seperti pahala orang yang mengerjakannya."
            </blockquote>
            <cite className="block pl-6 mt-1.5 text-[9px] sm:text-[10px] font-black tracking-wider uppercase text-emerald-600 dark:text-emerald-400 not-italic">
              — HR. Muslim no. 1893
            </cite>
          </div>
        </div>

        {/* 🔎 SPOTLIGHT SEARCH TRIGGER: Standar di bawah hero (Menggulung alami ke atas) */}
        <div ref={heroSearchRef} className="py-1 animate-in fade-in duration-500">
          <button
            onClick={() => setIsFilterOpen(true)}
            className="w-full h-12 flex items-center justify-between px-4 bg-card/50 dark:bg-[#0e1310]/80 border border-border/80 dark:border-emerald-500/10 hover:border-emerald-500/40 rounded-2xl shadow-sm hover:shadow-md text-muted-foreground hover:text-foreground transition-all duration-300 active:scale-[0.99] group cursor-pointer relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/0 via-emerald-500/5 to-teal-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
            <div className="flex items-center gap-3 relative z-10">
              <Search className="h-4 w-4 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform" />
              <span className="text-xs sm:text-sm font-semibold tracking-wide text-muted-foreground/80 group-hover:text-foreground transition-colors truncate max-w-[200px] sm:max-w-none">
                {search ? `Mencari: "${search}"` : 'Cari kajian, ustadz, atau masjid...'}
              </span>
            </div>
            <div className="flex items-center gap-1 border border-border/60 bg-background dark:bg-black/40 px-2 py-1 rounded-lg text-[9px] font-black tracking-widest text-muted-foreground shrink-0 shadow-inner relative z-10">
              <span>⌘</span>
              <span>K</span>
            </div>
          </button>
        </div>

        {/* Mini Pills Info Bar (Pengganti Visual FilterBar lama: Hanya info singkat filter aktif saat ini) */}
        {activeFilterCount > 0 && (
          <div className="flex flex-wrap items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-300">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1 mr-1">
              <SlidersHorizontal className="h-3 w-3" /> Aktif:
            </span>
            {kota && (
              <span className="px-2.5 py-1 rounded-lg bg-primary/10 text-primary border border-primary/20 text-[11px] font-semibold">
                {kota}
              </span>
            )}
            {tanggal && (
              <span className="px-2.5 py-1 rounded-lg bg-secondary/70 text-muted-foreground border border-border/60 text-[11px] font-semibold flex items-center gap-1">
                <CalendarDays className="h-3.5 w-3.5 opacity-70" /> {new Date(tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
              </span>
            )}
            {audience && (
              <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[11px] font-bold uppercase">
                {audience}
              </span>
            )}
            {search && (
              <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[11px] font-semibold truncate max-w-[120px] flex items-center gap-1">
                <Search className="h-3 w-3 text-emerald-500" /> "{search}"
              </span>
            )}

            {/* Quick Clear / Reset Button */}
            <button
              onClick={() => {
                setKota('')
                setAudience('')
                setTanggal('')
                setSearch('')
              }}
              className="px-2 py-1 rounded-lg bg-destructive/5 text-destructive/80 border border-destructive/10 hover:bg-destructive/10 hover:text-destructive text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 transition-all ml-1 duration-200 active:scale-95 cursor-pointer"
              title="Hapus semua filter"
            >
              <X className="h-3 w-3" />
              Hapus
            </button>
          </div>
        )}

        {/* Body States List */}
        <div className="pt-2">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 space-y-4">
              <div className="h-9 w-9 border-4 border-t-primary border-emerald-950/30 rounded-full animate-spin" />
              <span className="text-xs text-muted-foreground font-medium tracking-wider">Memuat Jadwal Kajian...</span>
            </div>
          ) : kajianList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center space-y-5 rounded-[32px] border border-dashed border-border bg-card/40 px-6 shadow-sm">
              <div className="h-16 w-16 rounded-3xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-inner">
                <Compass className="h-8 w-8 animate-pulse" />
              </div>
              <div className="space-y-2">
                <p className="text-base font-extrabold text-foreground tracking-tight">
                  Belum Ada Jadwal
                </p>
                <p className="text-xs text-muted-foreground max-w-[260px] mx-auto leading-relaxed">
                  Belum terdaftar jadwal kajian untuk tanggal ini. Ketuk tombol pencarian di kanan atas untuk menyesuaikan filter kota atau tanggal.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsFilterOpen(true)}
                className="rounded-xl text-xs font-bold gap-2 mt-2 border-border/80 hover:bg-accent"
              >
                <Search className="h-3.5 w-3.5" />
                Buka Pencarian
              </Button>
            </div>
          ) : (
            <div className="flex flex-col space-y-6">
              {/* Grid Kartu Timeline */}
              <div className="grid gap-6 animate-in fade-in slide-in-from-bottom-6 duration-700 ease-out">
                {groupKajiansByLocation(kajianList).map((group, i) => (
                  <KajianCard
                    key={group[0]?.id ?? i}
                    kajian={group} // Oper seluruh session array agar di-grouping di level kartu!
                    onClick={(selected) => {
                      setSelectedKajian(selected)
                      setSelectedGroup(group) // Oper data grup lengkap ke modal detail!
                      setIsDetailOpen(true)
                    }}
                  />
                ))}
              </div>

              {/* Visual Infinite Scroll Loading (Muncul saat scroll ke dasar) */}
              {loadingMore && (
                <div className="flex items-center justify-center py-6 animate-in fade-in duration-300">
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/5 border border-primary/10 shadow-sm">
                    <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    <span className="text-[10px] font-black tracking-widest uppercase text-primary/80">Memuat Timeline...</span>
                  </div>
                </div>
              )}

              {/* Pesan jika data habis (Ujung Timeline) */}
              {!hasMore && kajianList.length > 0 && (
                <div className="text-center py-8 text-muted-foreground/40 animate-in fade-in duration-500">
                  <div className="w-8 h-1 bg-border/40 rounded-full mx-auto mb-3" />
                  <p className="text-[10px] font-bold tracking-wider uppercase">Anda Telah Mencapai Data Terakhir</p>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Small premium footer */}
      <footer className="py-10 text-center border-t border-border/30 bg-card/20 mt-auto">
        <p className="text-[11px] font-medium text-muted-foreground tracking-widest uppercase opacity-70">
          © 2026 KajianBaru • Menuntut Ilmu Syar'i
        </p>
      </footer>

      {/* 📬 Interactive Push Notifications Toast Feedback */}
      {toastMsg && (
        <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-50 backdrop-blur-md px-5 py-3.5 rounded-full shadow-2xl border flex items-center gap-2.5 text-xs font-black tracking-wider uppercase animate-in slide-in-from-top-6 duration-300 ${
          toastMsg.type === 'success'
            ? 'bg-emerald-950/95 border-emerald-500/30 text-emerald-100 shadow-emerald-900/20'
            : 'bg-destructive/95 border-destructive/30 text-destructive-foreground shadow-destructive/20'
        }`}>
          <div className={`h-5 w-5 rounded-full flex items-center justify-center shrink-0 ${
            toastMsg.type === 'success' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/20 text-white'
          }`}>
            {toastMsg.type === 'success' ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
          </div>
          <span>{toastMsg.text}</span>
        </div>
      )}
      {/* 🚀 Elegant Scroll to Top Widget */}
      <ScrollToTop />
    </div>
  )
}
