import type { Audience } from '@kajian-baru/types'
import { Button } from './ui/button'
import { CalendarDays, MapPin, X, Check, Loader2, Search, SlidersHorizontal } from 'lucide-react'
import { useEffect, useState, useRef } from 'react'

type FilterDialogProps = {
  isOpen: boolean
  onClose: () => void
  search: string
  onSearchChange: (q: string) => void
  kota: string
  onKotaChange: (kota: string) => void
  audience: Audience | ''
  onAudienceChange: (audience: Audience | '') => void
  tanggal: string
  onTanggalChange: (tanggal: string) => void
}

const AUDIENCE_LABELS: Record<Audience, string> = {
  UMUM: 'Umum',
  IKHWAN: 'Ikhwan',
  AKHWAT: 'Akhwat'
}

export function FilterDialog({
  isOpen,
  onClose,
  search,
  onSearchChange,
  kota,
  onKotaChange,
  audience,
  onAudienceChange,
  tanggal,
  onTanggalChange,
}: FilterDialogProps) {
  
  const inputRef = useRef<HTMLInputElement>(null)
  const [activeCities, setActiveCities] = useState<string[]>([])
  const [activeAudiences, setActiveAudiences] = useState<Audience[]>([])
  const [loadingFilters, setLoadingFilters] = useState(false)

  // 🎯 SPOTLIGHT INTERACTION: Fokus instan & tangkap tombol ESC untuk menutup dialog!
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      
      // Beri sedikit delay animasi transisi agar browser tidak skip fokus
      const timer = setTimeout(() => inputRef.current?.focus(), 150)

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onClose()
        }
      }
      window.addEventListener('keydown', handleKeyDown)

      return () => {
        clearTimeout(timer)
        document.body.style.overflow = ''
        window.removeEventListener('keydown', handleKeyDown)
      }
    }
    return () => { document.body.style.overflow = '' }
  }, [isOpen, onClose])

  // Tarik faceted filters dinamis
  useEffect(() => {
    if (!isOpen) return

    const fetchMetadataFilters = async () => {
      setLoadingFilters(true)
      try {
        const response = await fetch('/api/kajian/filters')
        const resData = await response.json()
        
        if (response.ok && resData.success && resData.data) {
          setActiveCities(resData.data.kota ?? [])
          setActiveAudiences(resData.data.audience ?? [])
        }
      } catch (err) {
        console.error('Gagal memuat metadata filter:', err)
      } finally {
        setLoadingFilters(false)
      }
    }

    void fetchMetadataFilters()
  }, [isOpen])

  const dynamicAudienceOptions = [
    { value: '' as const, label: 'Semua' },
    ...activeAudiences.map(aud => ({
      value: aud,
      label: AUDIENCE_LABELS[aud] ?? aud
    }))
  ]

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-0 sm:pt-[15vh] animate-in fade-in duration-200">
      {/* High-Blur Cinematic Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-md" 
        onClick={onClose}
      />

      {/* 🍏 SPOTLIGHT COMPONENT WINDOW: Floating elegantly in the top-middle area */}
      <div className="bg-background/95 dark:bg-[#0c110d]/95 backdrop-blur-2xl w-full sm:max-w-xl rounded-3xl border border-border/60 dark:border-emerald-500/20 relative z-10 shadow-2xl shadow-black/30 flex flex-col animate-in zoom-in-95 slide-in-from-top-8 duration-300 ease-out max-h-[75vh] sm:max-h-[60vh] overflow-hidden">
        
        {/* 🔎 TOP SPOTLIGHT BAR: Large, clean, borderless input */}
        <div className="flex items-center px-5 border-b border-border/40 h-16 shrink-0 relative bg-secondary/10">
          <Search className="h-5 w-5 text-emerald-500 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Cari kajian, ustadz, atau masjid..."
            className="flex-1 h-full bg-transparent px-4 text-base sm:text-lg font-semibold text-foreground outline-none border-none placeholder:text-muted-foreground/40 focus:ring-0 focus:outline-none selection:bg-emerald-500/30"
            onKeyDown={(e) => {
              if (e.key === 'Enter') onClose()
            }}
          />
          <div className="flex items-center gap-2 shrink-0">
            {search && (
              <button 
                onClick={() => onSearchChange('')}
                className="p-1.5 rounded-full bg-secondary/60 hover:bg-secondary text-muted-foreground transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
            <div className="hidden sm:flex items-center gap-1 border border-border bg-card px-2 py-1 rounded-lg text-[9px] font-black tracking-wider text-muted-foreground/60 shadow-xs">
              <span>ESC</span>
            </div>
          </div>
        </div>

        {/* 📑 SCROLLABLE RESULTS / FACETED SECTION */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6 custom-scrollbar bg-gradient-to-b from-transparent to-emerald-950/5">
          
          {/* Category Section Label */}
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">
            <SlidersHorizontal className="h-3.5 w-3.5 text-primary" />
            <span>Filter Tambahan</span>
          </div>

          {/* Input Container */}
          <div className="space-y-5 relative">
            {loadingFilters && activeCities.length === 0 && (
              <div className="absolute inset-0 z-20 bg-background/50 backdrop-blur-[1px] flex items-center justify-center gap-2">
                <Loader2 className="h-5 w-5 text-primary animate-spin" />
              </div>
            )}

            {/* PILIH KOTA */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
              <label htmlFor="dlg-kota" className="sm:col-span-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5 text-emerald-600" />
                Kota
              </label>
              <div className="sm:col-span-9 relative">
                <select
                  id="dlg-kota"
                  value={kota}
                  onChange={(e) => onKotaChange(e.target.value)}
                  className="w-full h-10 pl-3 pr-8 rounded-xl border border-border bg-background/50 text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary appearance-none cursor-pointer hover:bg-accent/50 transition-all"
                >
                  <option value="" className="bg-popover">Semua Kota ({activeCities.length})</option>
                  {activeCities.map((k) => (
                    <option key={k} value={k} className="bg-popover">{k}</option>
                  ))}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-40">
                  <span className="text-[8px]">▼</span>
                </div>
              </div>
            </div>

            {/* PILIH TANGGAL */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
              <label htmlFor="dlg-tanggal" className="sm:col-span-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <CalendarDays className="h-3.5 w-3.5 text-emerald-600" />
                Tanggal
              </label>
              <input
                id="dlg-tanggal"
                type="date"
                value={tanggal}
                onChange={(e) => onTanggalChange(e.target.value)}
                className="sm:col-span-9 w-full h-10 px-3 rounded-xl border border-border bg-background/50 text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer hover:bg-accent/50 transition-all dark:[color-scheme:dark]"
              />
            </div>

            {/* KATEGORI AUDIENCE */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-start pt-1">
              <label className="sm:col-span-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2 mt-2.5">
                <Check className="h-3.5 w-3.5 text-emerald-600" />
                Jamaah
              </label>
              <div className="sm:col-span-9 grid grid-cols-3 gap-1.5">
                {dynamicAudienceOptions.map((opt) => {
                  const isActive = audience === opt.value
                  return (
                    <button
                      key={opt.value}
                      onClick={() => onAudienceChange(opt.value)}
                      className={`
                        h-9 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-1 border
                        ${isActive 
                          ? 'bg-primary text-primary-foreground border-primary shadow-md shadow-primary/10 scale-100' 
                          : 'bg-secondary/40 border-border/60 text-muted-foreground hover:bg-secondary hover:text-foreground hover:scale-[1.02]'
                        }
                      `}
                    >
                      {opt.label}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        {/* 🏁 ACTION FOOTER */}
        <div className="px-5 py-3 border-t border-border/40 flex items-center justify-between bg-secondary/10 shrink-0">
          <span className="text-[9px] font-bold text-muted-foreground/50 tracking-widest uppercase hidden sm:inline-block">
            KajianBaru Spotlight Search
          </span>
          <Button
            onClick={onClose}
            size="sm"
            className="w-full sm:w-auto px-6 h-8 font-extrabold text-[10px] tracking-wider uppercase rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white border-0 shadow-lg shadow-emerald-950/20"
          >
            Tampilkan Jadwal
          </Button>
        </div>
      </div>
    </div>
  )
}
