import { useState, useEffect } from 'react'
import { ArrowUp } from 'lucide-react'

export function ScrollToTop() {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const toggleVisibility = () => {
      // Hanya tampilkan jika scroll melewati 400px
      if (window.scrollY > 400) {
        setIsVisible(true)
      } else {
        setIsVisible(false)
      }
    }

    window.addEventListener('scroll', toggleVisibility)
    return () => window.removeEventListener('scroll', toggleVisibility)
  }, [])

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    })
  }

  if (!isVisible) return null

  return (
    <button
      onClick={scrollToTop}
      className="fixed bottom-6 right-6 z-40 h-12 w-12 rounded-2xl glass hover:bg-emerald-600/90 dark:hover:bg-emerald-600/90 text-emerald-700 dark:text-emerald-300 hover:text-white flex items-center justify-center shadow-2xl shadow-black/20 border border-white/20 hover:scale-105 active:scale-95 transition-all duration-300 ease-out animate-in fade-in slide-in-from-bottom-8 pointer-events-auto"
      aria-label="Kembali ke atas"
    >
      <ArrowUp className="h-5 w-5 transition-transform duration-300 group-hover:-translate-y-0.5" />
    </button>
  )
}
