import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/use-auth'
import { ParseInput } from '../components/ParseInput'
import { KajianManualForm } from '../components/KajianManualForm'
import { KajianListAdmin } from '../components/KajianListAdmin'
import { BotUserList } from '../components/BotUserList'
import { Button } from '../components/ui/button'
import { LogOut, Lock, AlertTriangle, ShieldCheck, Home, Sparkles, ClipboardList, PenLine, Bot, Archive, Users } from 'lucide-react'
import { ThemeToggle } from '../components/ui/theme-toggle'
import { Link } from 'react-router-dom'
import { Toaster } from '../components/ui/toaster'

export function Admin() {
  const { user, loading, isAdmin, signInWithGoogle, signOut } = useAuth()

  type AdminTab = 'parser' | 'manual' | 'daftar' | 'bot-users'

  // 🗂️ State Pengontrol Navigasi Tab Panel Admin (Dinamis memuat dari Hash URL)
  const [activeTab, setActiveTab] = useState<AdminTab>(() => {
    const hash = window.location.hash.replace('#', '') as AdminTab
    const validTabs: AdminTab[] = ['parser', 'manual', 'daftar', 'bot-users']
    return validTabs.includes(hash) ? hash : 'parser'
  })

  // 🕵️‍♂️ Scroll Sensor untuk Fitur Header Morphing
  const [isScrolled, setIsScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 65)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // 🔗 HASH SYNCHRONIZER: Rekam perpindahan tab ke dalam URL Hash tanpa memicu reload bawaan browser
  useEffect(() => {
    window.history.replaceState(null, '', `#${activeTab}`)
  }, [activeTab])

  // 🧭 HISTORY LISTENER: Responsif saat pengguna menekan tombol Back / Forward di browser!
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '') as AdminTab
      const validTabs: AdminTab[] = ['parser', 'manual', 'daftar', 'bot-users']
      if (validTabs.includes(hash)) {
        setActiveTab(hash)
      }
    }
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  // ⛷️ SMOOTH AUTO-SCROLL: Antarkan layar kembali ke puncak secara mulus saat ganti tab!
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [activeTab])

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background space-y-3">
        <div className="h-10 w-10 border-4 border-t-primary border-emerald-950/30 rounded-full animate-spin" />
        <span className="text-sm font-medium text-muted-foreground tracking-wide">Memverifikasi akun...</span>
      </div>
    )
  }

  // Case 1: Not Logged In (Portal Login Admin)
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background relative overflow-hidden">
        {/* Top Glow Decoration */}
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-96 h-96 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />

        <div className="glass max-w-md w-full rounded-3xl p-8 text-center space-y-6 relative z-10 shadow-2xl">
          <div className="h-16 w-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-sm">
            <Lock className="h-8 w-8" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-black tracking-tight text-foreground">Admin Portal</h1>
            <p className="text-sm text-muted-foreground max-w-[280px] mx-auto">
              Silakan masuk dengan akun Google terverifikasi untuk mengelola data kajian.
            </p>
          </div>

          {/* Tombol Login Utama & Navigasi Pulang */}
          <div className="flex flex-col gap-3">
            <Button
              id="admin-login"
              size="lg"
              onClick={() => void signInWithGoogle()}
              className="w-full font-bold text-sm h-12 rounded-xl shadow-lg shadow-primary/20 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 border-0 text-white"
            >
              Login dengan Google
            </Button>

            <Link to="/" className="w-full">
              <Button
                variant="ghost"
                className="w-full font-bold text-xs h-11 rounded-xl text-muted-foreground hover:text-foreground flex items-center justify-center gap-2"
              >
                <Home className="h-3.5 w-3.5" />
                Kembali ke Beranda
              </Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Case 2: Logged in, but NOT an Admin (Akses Ditolak)
  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <div className="glass border-destructive/30 max-w-md w-full rounded-3xl p-8 text-center space-y-6 shadow-2xl relative">
          <div className="h-16 w-16 mx-auto rounded-2xl bg-destructive/10 flex items-center justify-center text-destructive">
            <AlertTriangle className="h-8 w-8" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-black tracking-tight text-foreground">Akses Ditolak</h1>
            <div className="p-3 bg-destructive/5 rounded-xl border border-destructive/10 space-y-1">
              <p className="text-xs text-muted-foreground">Akun saat ini:</p>
              <p className="text-sm font-semibold text-foreground break-all">{user.email}</p>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed pt-2 px-4 font-medium">
              Maaf, akun Anda tidak terdaftar sebagai administrator resmi. Halaman ini hanya dapat diakses oleh kontributor terverifikasi.
            </p>
          </div>

          {/* Tombol Pilihan Tindakan */}
          <div className="flex flex-col gap-2.5 pt-2">
            <Button
              variant="outline"
              onClick={() => void signOut()}
              className="font-semibold flex items-center justify-center gap-2 border-border h-11 rounded-xl"
            >
              <LogOut className="h-4 w-4" />
              Keluar (Logout)
            </Button>

            <Link to="/" className="w-full">
              <Button
                variant="ghost"
                className="w-full font-bold text-xs h-11 rounded-xl text-muted-foreground hover:text-foreground flex items-center justify-center gap-2"
              >
                <Home className="h-3.5 w-3.5" />
                Kembali ke Beranda
              </Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Case 3: Welcome Boss! Authorized Admin
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Admin Sticky Header */}
      <header className="sticky top-0 z-50 bg-background/50 backdrop-blur-xl border-b border-border/50 transition-colors duration-500">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between relative">

          {/* KIRI: Label Identitas (Memudar halus saat scroll) */}
          <div className={`flex items-center gap-2 sm:gap-3 transition-all duration-500 whitespace-nowrap ${isScrolled ? 'opacity-40 scale-95 hover:opacity-100' : 'opacity-100 scale-100'}`}>
            <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20 shadow-sm">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-sm sm:text-base font-black tracking-tight text-foreground leading-tight">
                Dashboard
              </h1>
              <p className={`text-[10px] font-medium text-emerald-600 dark:text-emerald-400 max-w-[140px] sm:max-w-none truncate leading-none mt-0.5 transition-all duration-300 ${isScrolled ? 'h-0 opacity-0 invisible -mt-1' : 'h-auto opacity-100'}`}>
                {user.email}
              </p>
            </div>
          </div>

          {/* 🧬 TENGAH (MORPH CENTER NAVIGATION): Turun meluncur saat halaman digulir ke bawah */}
          <div className={`absolute top-full left-0 w-full sm:w-auto sm:left-1/2 sm:top-1/2 sm:-translate-y-1/2 sm:-translate-x-1/2 flex items-center justify-center pointer-events-none z-20`}>
            <div className={`flex items-center justify-start sm:justify-center gap-1 sm:gap-0.5 bg-background/90 sm:bg-secondary/40 border-b sm:border border-border/60 py-2 px-3 sm:p-1 sm:rounded-xl backdrop-blur-xl transition-all duration-500 shadow-md sm:shadow-sm pointer-events-auto w-full sm:w-auto overflow-x-auto custom-scrollbar ${
              isScrolled
                ? 'opacity-100 translate-y-0 scale-100'
                : 'opacity-0 -translate-y-2 sm:-translate-y-4 scale-100 sm:scale-95'
            }`}>
            <button
              onClick={() => setActiveTab('parser')}
              className={`px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all duration-200
                ${activeTab === 'parser'
                  ? 'bg-background text-primary shadow-sm border border-border/50 scale-100'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/30 border border-transparent scale-95'
                }
              `}
            >
              Parser
            </button>

            <button
              onClick={() => setActiveTab('manual')}
              className={`px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all duration-200
                ${activeTab === 'manual'
                  ? 'bg-background text-primary shadow-sm border border-border/50 scale-100'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/30 border border-transparent scale-95'
                }
              `}
            >
              Form
            </button>

            <button
              onClick={() => setActiveTab('daftar')}
              className={`px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all duration-200
                ${activeTab === 'daftar'
                  ? 'bg-background text-primary shadow-sm border border-border/50 scale-100'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/30 border border-transparent scale-95'
                }
              `}
            >
              Arsip
            </button>

            <button
              onClick={() => setActiveTab('bot-users')}
              className={`px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all duration-200
                ${activeTab === 'bot-users'
                  ? 'bg-background text-primary shadow-sm border border-border/50 scale-100'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/30 border border-transparent scale-95'
                }
              `}
            >
              Users
            </button>
          </div>
          </div>

          {/* KANAN: Navbar Control Panel */}
          <div className="flex items-center gap-1 relative z-10">
            <Link to="/">
              <Button
                variant="ghost"
                size="icon"
                title="Lihat Halaman Depan (Beranda)"
                className="h-9 w-9 rounded-xl text-muted-foreground hover:text-foreground transition-colors"
              >
                <Home className="h-4 w-4" />
              </Button>
            </Link>

            <ThemeToggle />

            <div className="w-px h-4 bg-border/50 mx-1" />

            <Button
              variant="ghost"
              size="sm"
              onClick={() => void signOut()}
              className="text-xs font-semibold hover:bg-destructive/5 hover:text-destructive flex items-center gap-2 border border-transparent hover:border-destructive/10 rounded-xl h-9 px-3"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Keluar</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Admin Dashboard Content */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 pt-6 pb-10 space-y-7 flex flex-col">

        {/* 🗂️ Modern Switcher Tab Navigation (Scrollable horizontal di Mobile agar lapang!) */}
        <div className="flex flex-row md:flex-wrap items-center gap-1.5 bg-secondary/40 border border-border/60 p-1.5 rounded-2xl shadow-sm backdrop-blur-md relative z-10 overflow-x-auto max-w-full scrollbar-none w-full md:w-auto md:self-start select-none">
          <button
            onClick={() => setActiveTab('parser')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition-all duration-300 shrink-0
              ${activeTab === 'parser'
                ? 'bg-background border border-border/60 text-primary shadow-sm scale-100'
                : 'text-muted-foreground hover:text-foreground border border-transparent hover:bg-secondary/40'
              }
            `}
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Ekstrak Teks</span>
          </button>

          <button
            onClick={() => setActiveTab('manual')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition-all duration-300 shrink-0
              ${activeTab === 'manual'
                ? 'bg-background border border-border/60 text-primary shadow-sm scale-100'
                : 'text-muted-foreground hover:text-foreground border border-transparent hover:bg-secondary/40'
              }
            `}
          >
            <PenLine className="h-3.5 w-3.5" />
            <span>Input Manual</span>
          </button>

          <button
            onClick={() => setActiveTab('daftar')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition-all duration-300 shrink-0
              ${activeTab === 'daftar'
                ? 'bg-background border border-border/60 text-primary shadow-sm scale-100'
                : 'text-muted-foreground hover:text-foreground border border-transparent hover:bg-secondary/40'
              }
            `}
          >
            <ClipboardList className="h-3.5 w-3.5" />
            <span>Arsip Kajian</span>
          </button>

          <button
            onClick={() => setActiveTab('bot-users')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition-all duration-300 shrink-0
              ${activeTab === 'bot-users'
                ? 'bg-background border border-border/60 text-primary shadow-sm scale-100'
                : 'text-muted-foreground hover:text-foreground border border-transparent hover:bg-secondary/40'
              }
            `}
          >
            <Users className="h-3.5 w-3.5" />
            <span>Pengguna Bot</span>
          </button>
        </div>

        {/* 🚀 Rendering Body Berdasarkan Aktif Tab */}
        {activeTab === 'parser' && (
          <div className="space-y-6 animate-in fade-in duration-500 flex flex-col">
            <div className="space-y-1 pt-1">
              <h2 className="text-xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
                <Bot className="h-5 w-5 text-primary shrink-0" /> Robot Ekstraksi Teks
              </h2>
              <p className="text-xs text-muted-foreground leading-relaxed max-w-2xl">
                Tempel teks jadwal kajian mentah (bisa 1 pesan berisi banyak buku kajian). Sistem cerdas akan mengurai data visualnya untuk Anda modifikasi dan simpan secara otomatis.
              </p>
            </div>
            <ParseInput />
          </div>
        )}

        {activeTab === 'manual' && (
          <div className="space-y-6 animate-in fade-in duration-500 flex flex-col">
            <div className="space-y-1 pt-1">
              <h2 className="text-xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
                <PenLine className="h-5 w-5 text-primary shrink-0" /> Input Data Baru Secara Manual
              </h2>
              <p className="text-xs text-muted-foreground leading-relaxed max-w-2xl">
                Gunakan form rapi ini jika informasi didapatkan secara lisan, dari mulut ke mulut, atau jika teks copasnya terlalu rusak. Lihat hasil visual instan di sebelah kanan!
              </p>
            </div>
            <KajianManualForm />
          </div>
        )}

        {activeTab === 'daftar' && (
          <div className="space-y-6 animate-in fade-in duration-500 flex flex-col">
            <div className="space-y-1 pt-1">
              <h2 className="text-xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
                <Archive className="h-5 w-5 text-primary shrink-0" /> Arsip & Inventaris Kajian
              </h2>
              <p className="text-xs text-muted-foreground leading-relaxed max-w-2xl">
                Semua jadwal kajian aktif terdaftar di bawah ini. Anda dapat memperbarui poster pamflet terbaru, mengganti judul yang salah ketik, atau menghapus jadwal yang dibatalkan.
              </p>
            </div>
            <KajianListAdmin />
          </div>
        )}

        {activeTab === 'bot-users' && (
          <div className="space-y-6 animate-in fade-in duration-500 flex flex-col">
            <div className="space-y-1 pt-1">
              <h2 className="text-xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
                <Users className="h-5 w-5 text-primary shrink-0" /> Pengguna Bot Telegram
              </h2>
              <p className="text-xs text-muted-foreground leading-relaxed max-w-2xl">
                Kelola akses pengguna yang mendaftar melalui bot Telegram. Setujui atau tolak permintaan akses untuk mengontrol siapa saja yang boleh mengirim data kajian via bot.
              </p>
            </div>
            <BotUserList />
          </div>
        )}

      </main>

      <footer className="py-8 text-center border-t border-border/40 mt-auto text-xs text-muted-foreground">
        Authorized Admin Panel • Secure TLS 1.3
      </footer>

      <Toaster />
    </div>
  )
}
