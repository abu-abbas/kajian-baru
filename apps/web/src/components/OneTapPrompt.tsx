import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/use-auth'
import { Button } from './ui/button'
import { X, Sparkles } from 'lucide-react'

export function OneTapPrompt() {
  const { user, loading, signInWithGoogle } = useAuth()
  const [show, setShow] = useState(false)

  useEffect(() => {
    // Cek apakah user sudah pernah menutup prompt ini di sesi ini
    const dismissed = sessionStorage.getItem('kajian-baru-onetap-dismissed')

    if (!loading && !user && !dismissed) {
      // Munculkan setelah jeda 2 detik agar terkesan profesional dan mulus
      const timer = setTimeout(() => {
        setShow(true)
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [loading, user])

  const handleDismiss = () => {
    setShow(false)
    // Catat ke session storage agar tidak mengganggu di reload berikutnya dalam sesi yang sama
    sessionStorage.setItem('kajian-baru-onetap-dismissed', 'true')
  }

  if (!show) return null

  return (
    <div className="fixed z-50 bottom-4 right-4 left-4 md:left-auto md:top-20 md:bottom-auto md:right-6 md:max-w-sm animate-in slide-in-from-bottom-full md:slide-in-from-right-full duration-700 ease-out">
      <div className="glass p-5 rounded-3xl relative border border-primary/30 shadow-2xl overflow-hidden group">
        
        {/* Decorative ambient glow */}
        <div className="absolute -right-20 -top-20 w-40 h-40 bg-primary/20 rounded-full blur-3xl group-hover:bg-primary/30 transition-colors pointer-events-none" />
        
        {/* Close Button */}
        <button
          onClick={handleDismiss}
          className="absolute top-3 right-3 p-1.5 rounded-full text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-start gap-4">
          {/* Icon */}
          <div className="h-11 w-11 shrink-0 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-md text-white shadow-emerald-500/20">
            <Sparkles className="h-5 w-5 animate-pulse" />
          </div>

          {/* Text */}
          <div className="flex-1 space-y-1.5 pr-6">
            <h4 className="text-sm font-bold text-foreground leading-tight">
              Lanjutkan Lebih Mudah
            </h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Masuk dengan Google untuk menikmati notifikasi jadwal terbaru dan sinkronisasi antar perangkat.
            </p>
          </div>
        </div>

        {/* CTA Button */}
        <div className="mt-4">
          <Button
            size="sm"
            onClick={() => void signInWithGoogle()}
            className="w-full h-10 font-bold text-xs rounded-xl bg-foreground text-background hover:bg-foreground/90 transition-all duration-300 flex items-center justify-center gap-2 shadow-md border-0"
          >
            {/* Inline Google SVG Icon */}
            <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Masuk Cepat dengan Google
          </Button>
        </div>
      </div>
    </div>
  )
}
