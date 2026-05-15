import type { Kajian } from '@kajian-baru/types'
import { Badge } from './ui/badge'
import { Clock, MapPin, Phone, Calendar, Navigation, Mic } from 'lucide-react'
import { cleanVisual, getAudienceVariant, formatDisplayDate, checkSelesaiRedundant } from '../lib/utils'

type KajianCardProps = {
  kajian: Kajian
  onClick?: () => void
}

export function KajianCard({ kajian, onClick }: KajianCardProps) {
  const hasPoster = !!kajian.poster_url

  const displayMateri = cleanVisual(kajian.materi, 'Materi|Tema|Judul|Kajian')
  const displayPemateri = cleanVisual(kajian.pemateri, 'Pemateri|Penceramah|Narasumber|Bersama|Oleh')
  const displayTempat = cleanVisual(kajian.tempat, 'Tempat|Lokasi')
  const displayKontak = cleanVisual(kajian.kontak, 'Info\\s+Panitia\\s+Kajian|Info\\s+Panitia|Info|Kontak|Hubungi|WA|Telp', false)
  const displayWaktuMulai = cleanVisual(kajian.waktu_mulai, 'Waktu|Jam|Pukul', false)

  const isSelesaiRedundant = checkSelesaiRedundant(displayWaktuMulai, kajian.waktu_selesai)

  return (
    <div 
      onClick={onClick}
      className={`
        group relative overflow-hidden rounded-3xl border border-border/80 bg-card text-foreground shadow-lg dark:shadow-2xl dark:shadow-black/40 transition-all duration-500 hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5
        ${onClick ? 'cursor-pointer active:scale-[0.99]' : ''}
      `}
    >
 
      {/* Floating Glow Effect */}
      <div className="absolute -top-24 -right-24 h-48 w-48 rounded-full bg-primary/5 blur-3xl transition-opacity duration-500 group-hover:bg-primary/10 pointer-events-none" />

      {/* TOP MEDIA: Sits at the peak of the card if poster exists */}
      {hasPoster && (
        <div className="relative w-full aspect-[21/9] sm:aspect-[16/7] overflow-hidden border-b border-border/40">
          <img
            src={kajian.poster_url!}
            alt={displayMateri}
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
          {/* Soft gradient bottom shadow for the image */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
        </div>
      )}
 
      {/* Content Layout */}
      <div className="relative p-5 sm:p-6 flex flex-col gap-5">
        
        {/* Top Row: Badge & Date */}
        <div className="flex items-center justify-between">
          <Badge variant={getAudienceVariant(kajian.audience)} className="font-bold">
            {kajian.audience}
          </Badge>
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground">
            <Calendar className="h-3.5 w-3.5 text-primary" />
            <span>{formatDisplayDate(kajian.tanggal_masehi)}</span>
          </div>
        </div>

        {/* Middle: Title and Speaker */}
        <div className="space-y-3">
          <h3 className="text-base sm:text-lg font-black tracking-tight leading-snug text-foreground transition-colors group-hover:text-primary whitespace-normal break-words">
            {displayMateri}
          </h3>
          <div className="inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-bold border bg-secondary/50 border-border/60 text-emerald-700 dark:text-emerald-100 shadow-sm">
            <Mic className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>{displayPemateri}</span>
          </div>
        </div>

        {/* Bottom Info Grid */}
        <div className="grid grid-cols-1 gap-3 pt-2 border-t border-border/50">
          {/* Time */}
          <div className="flex items-start gap-3 text-sm">
            <Clock className="h-4 w-4 mt-0.5 text-primary shrink-0" />
            <div className="text-foreground/80">
              <span className="font-bold text-foreground">{displayWaktuMulai}</span>
              {kajian.waktu_selesai && !isSelesaiRedundant && (
                <>
                  <span className="mx-1.5 opacity-40">—</span>
                  <span>{kajian.waktu_selesai}</span>
                </>
              )}
            </div>
          </div>

          {/* Place */}
          <div className="flex items-start gap-3 text-sm">
            <MapPin className="h-4 w-4 mt-0.5 text-primary shrink-0" />
            <div className="text-foreground/80">
              <p className="font-bold text-foreground">{displayTempat}</p>
              {kajian.alamat && (
                <p className="text-[11px] mt-0.5 text-muted-foreground whitespace-normal break-words leading-relaxed">{kajian.alamat}</p>
              )}
            </div>
          </div>

          {/* Contact */}
          {displayKontak && (
            <div className="flex items-start gap-3 text-sm">
              <Phone className="h-4 w-4 mt-0.5 text-primary shrink-0" />
              <span className="text-foreground/70 text-xs tracking-wide whitespace-normal break-words">{displayKontak}</span>
            </div>
          )}
        </div>

        {/* Actions */}
        {kajian.maps_url && (
          <div className="pt-2">
            <a
              href={kajian.maps_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold border border-border bg-secondary text-foreground hover:bg-primary hover:text-white hover:border-primary transition-all duration-300 active:scale-[0.98]"
            >
              <Navigation className="h-3.5 w-3.5" />
              Buka Navigasi Maps
            </a>
          </div>
        )}

      </div>
    </div>
  )
}
