import type { Audience } from '@kajian-baru/types'
import { Button } from './ui/button'
import { CalendarDays, MapPin, X, Sparkles, Check, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'

type FilterDialogProps = {
  isOpen: boolean
  onClose: () => void
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
  kota,
  onKotaChange,
  audience,
  onAudienceChange,
  tanggal,
  onTanggalChange,
}: FilterDialogProps) {
  
  // State untuk menampung filter aktif dari database secara dinamis
  const [activeCities, setActiveCities] = useState<string[]>([])
  const [activeAudiences, setActiveAudiences] = useState<Audience[]>([])
  const [loadingFilters, setLoadingFilters] = useState(false)

  // Kunci scroll body web ketika modal sedang terbuka
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  // Pemicu pengambilan metadata filter AKTIF dari backend API
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
        console.error('Gagal menarik faceted filters metadata:', err)
      } finally {
        setLoadingFilters(false)
      }
    }

    void fetchMetadataFilters()
  }, [isOpen])

  // Konstruksi opsi audience dinamis (selalu tampilkan "Semua", lalu ikuti data nyata dari database)
  const dynamicAudienceOptions = [
    { value: '' as const, label: 'Semua' },
    ...activeAudiences.map(aud => ({
      value: aud,
      label: AUDIENCE_LABELS[aud] ?? aud
    }))
  ]

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-300">
      {/* Backdrop blur gelap dengan opacity lebih halus */}
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-[4px]" 
        onClick={onClose}
      />

      {/* Dialog Box: Crystal Clear & Sharp in Light Mode, Glassy in Dark Mode */}
      <div className="bg-background sm:bg-background/95 dark:bg-[#0b0f0c]/90 backdrop-blur-xl w-full sm:max-w-md rounded-t-[32px] sm:rounded-[32px] p-6 sm:p-7 relative z-10 shadow-2xl shadow-black/10 border-t sm:border border-border dark:border-primary/20 flex flex-col animate-in slide-in-from-bottom-12 duration-300 ease-out max-h-[85vh] overflow-y-auto">
        
        {/* Decorative Grabber for Mobile */}
        <div className="w-12 h-1 bg-border/50 rounded-full mx-auto mb-4 sm:hidden" />
        
        {/* Header Dialog */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-base font-black tracking-tight text-foreground leading-tight">Filter Pencarian</h3>
              <p className="text-[11px] font-medium text-muted-foreground mt-0.5">Sesuaikan jadwal kajian Anda</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-full text-muted-foreground hover:bg-accent hover:text-foreground transition-colors border border-border/30"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Input Sections */}
        <div className="space-y-5 relative">
          
          {/* Overlay Loading saat memuat metadata filter */}
          {loadingFilters && activeCities.length === 0 && (
            <div className="absolute inset-0 z-20 bg-background/60 backdrop-blur-[2px] flex flex-col items-center justify-center gap-2">
              <Loader2 className="h-6 w-6 text-primary animate-spin" />
              <span className="text-[10px] font-bold text-muted-foreground tracking-widest uppercase">Sinkronisasi Filter...</span>
            </div>
          )}

          {/* Pilihan Kota (Dinamis) */}
          <div className="space-y-2">
            <label htmlFor="dlg-kota" className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" />
              Pilih Kota
            </label>
            <div className="relative">
              <select
                id="dlg-kota"
                value={kota}
                onChange={(e) => onKotaChange(e.target.value)}
                className="w-full h-12 pl-4 pr-8 rounded-2xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent appearance-none cursor-pointer hover:bg-accent/50 transition-all"
              >
                <option value="" className="bg-popover text-foreground">Semua Kota ({activeCities.length})</option>
                {activeCities.map((k) => (
                  <option key={k} value={k} className="bg-popover text-foreground">{k}</option>
                ))}
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none pl-2 border-l border-border">
                <span className="text-muted-foreground text-[9px]">▼</span>
              </div>
            </div>
          </div>

          {/* Pilih Tanggal */}
          <div className="space-y-2">
            <label htmlFor="dlg-tanggal" className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" />
              Pilih Tanggal
            </label>
            <input
              id="dlg-tanggal"
              type="date"
              value={tanggal}
              onChange={(e) => onTanggalChange(e.target.value)}
              className="w-full h-12 px-4 rounded-2xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent cursor-pointer hover:bg-accent/50 transition-all dark:[color-scheme:dark]"
            />
          </div>

          {/* Kategori / Audience (Dinamis) */}
          <div className="space-y-2.5 pb-2">
            <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5" />
              Kategori Jamaah
            </label>
            <div className="grid grid-cols-2 gap-2">
              {dynamicAudienceOptions.map((opt) => {
                const isActive = audience === opt.value
                return (
                  <button
                    key={opt.value}
                    onClick={() => onAudienceChange(opt.value)}
                    className={`
                      h-11 rounded-2xl text-xs font-bold transition-all duration-300 flex items-center justify-center gap-2 border
                      ${isActive 
                        ? 'bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20 scale-[1.02]' 
                        : 'bg-secondary/50 border-border/60 text-muted-foreground hover:bg-secondary hover:text-foreground'
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

        {/* Apply Action Footer Button */}
        <div className="mt-6 pt-4 border-t border-border/40">
          <Button
            onClick={onClose}
            size="lg"
            className="w-full h-12 font-extrabold text-sm rounded-2xl bg-foreground text-background hover:bg-foreground/90 shadow-xl border-0"
          >
            Tampilkan Jadwal
          </Button>
        </div>
      </div>
    </div>
  )
}
