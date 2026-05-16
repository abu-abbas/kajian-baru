import { useState } from 'react'
import type { Kajian } from '@kajian-baru/types'
import { Badge } from './ui/badge'
import { Clock, MapPin, Phone, Calendar, Navigation, Mic, Ban } from 'lucide-react'
import { cleanVisual, getAudienceVariant, getAudienceTextColor, formatDisplayDate, checkSelesaiRedundant, splitTempatAddress, getCategoryGradient } from '../lib/utils'

type KajianCardProps = {
  // Menerima objek tunggal atau array (Multi-Session) untuk di-grouping ke satu kartu bertab!
  kajian: Kajian | Kajian[]
  onClick?: (selected: Kajian) => void
}

export function KajianCard({ kajian, onClick }: KajianCardProps) {
  const [activeIdx, setActiveIdx] = useState(0)

  // Ubah ke bentuk array homogen agar logika rendering seragam
  const items = Array.isArray(kajian) ? kajian : [kajian]
  const activeItem = items[activeIdx] ?? items[0]! // Fail-safe recovery

  // 🔍 TEROBOSAN CERDAS: Jika minimal 1 sesi punya poster, buat SEMUA sesi memiliki area banner agar tinggi kartu terkunci!
  const groupHasAnyPoster = items.some(k => !!k.poster_url)
  
  const gradientStyle = {
    background: getCategoryGradient(activeItem.audience, activeItem.gradient_config?.angle),
  }

  // Jalankan runtime visual scrubbing ke item yang sedang aktif ditonton user
  const displayMateri = cleanVisual(activeItem.materi, 'Materi|Tema|Judul|Kajian')
  const displayPemateri = cleanVisual(activeItem.pemateri, 'Pemateri|Penceramah|Narasumber|Bersama|Oleh')
  const displayTempatRaw = cleanVisual(activeItem.tempat, 'Tempat|Lokasi')
  const { cleanTempat, cleanAlamat } = splitTempatAddress(displayTempatRaw, activeItem.alamat)
  const displayKontak = cleanVisual(activeItem.kontak, 'Info\\s+Panitia\\s+Kajian|Info\\s+Panitia|Info|Kontak|Hubungi|WA|Telp', false)
  const displayWaktuMulai = cleanVisual(activeItem.waktu_mulai, 'Waktu|Jam|Pukul', false)

  const isSelesaiRedundant = checkSelesaiRedundant(displayWaktuMulai, activeItem.waktu_selesai)

  // Handler penggantian tab sesi internal kartu
  const handleTabClick = (e: React.MouseEvent, idx: number) => {
    e.stopPropagation() // 🛑 Mencegah memicu trigger 'onClick' modal kartu induk!
    setActiveIdx(idx)
  }

  // Helper penentuan label tab yang ergonomis
  const getSessionLabel = (k: Kajian, index: number) => {
    const placeUpper = (k.tempat || '').toUpperCase()
    if (placeUpper.includes('SESI 1')) return 'Sesi 1'
    if (placeUpper.includes('SESI 2')) return 'Sesi 2'
    if (placeUpper.includes('SESI 3')) return 'Sesi 3'
    
    return `Sesi ${index + 1}`
  }

  return (
    <div 
      onClick={() => onClick?.(activeItem)} // Oper item aktif saat ini saat ditekan!
      className={`
        group relative overflow-hidden rounded-3xl border border-border/80 bg-card text-foreground shadow-lg dark:shadow-2xl dark:shadow-black/40 transition-all duration-500 hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5
        ${onClick ? 'cursor-pointer active:scale-[0.99]' : ''}
        ${activeItem.is_cancelled ? 'opacity-75 grayscale-[20%] border-red-500/20' : ''}
      `}
    >
 
      {/* Floating Glow Effect */}
      <div className="absolute -top-24 -right-24 h-48 w-48 rounded-full bg-primary/5 blur-3xl transition-opacity duration-500 group-hover:bg-primary/10 pointer-events-none" />

      {/* TOP MEDIA: Muncul konsisten jika ada salah satu sesi di grup ini yang memiliki poster */}
      {groupHasAnyPoster && (
        <div className="relative w-full aspect-[21/9] sm:aspect-[16/7] overflow-hidden border-b border-border/40 bg-[#0b120d]">
          {activeItem.poster_url ? (
            <img
              src={activeItem.poster_url!}
              alt={displayMateri}
              className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105 animate-in fade-in-30"
            />
          ) : (
            <div style={gradientStyle} className="h-full w-full relative flex items-center justify-center text-white overflow-hidden animate-in fade-in-30 duration-500">
              <div className="absolute inset-0 opacity-25 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]" />
              <div className={`z-10 bg-white/10 backdrop-blur-md border border-white/20 px-3 py-1 rounded-xl font-black uppercase tracking-widest text-[8px] shadow-xl shadow-black/5 ${getAudienceTextColor(activeItem.audience)}`}>
                Sesi Tanpa Poster
              </div>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
        </div>
      )}
 
      {/* Content Layout */}
      <div className="relative p-5 sm:p-6 flex flex-col gap-5">
        
        {/* Top Row: Badge & Date */}
        <div className="flex items-center justify-between">
          <div className="flex gap-2 items-center">
            <Badge variant={getAudienceVariant(activeItem.audience)} className="font-bold">
              {activeItem.audience}
            </Badge>
            {activeItem.is_cancelled && (
              <Badge variant="destructive" className="font-black tracking-wider uppercase border border-red-500/30 animate-pulse flex items-center gap-1">
                <Ban className="h-2.5 w-2.5" />
                {/batal/i.test(activeItem.source_text || activeItem.materi || '') ? 'Dibatalkan' : 'Diliburkan'}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground">
            <Calendar className="h-3.5 w-3.5 text-primary" />
            <span>{formatDisplayDate(activeItem.tanggal_masehi)}</span>
          </div>
        </div>

        {/* 📑 MULTI-SESSION GLASS TABS ROW */}
        {items.length > 1 && (
          <div className="flex flex-wrap gap-1.5 bg-secondary/40 border border-border/30 p-1 rounded-2xl w-fit backdrop-blur-sm z-10 relative animate-in fade-in-50 duration-300">
            {items.map((item, idx) => {
              const isActive = idx === activeIdx
              const isBatal = item.is_cancelled
              return (
                <button
                  key={item.id ?? idx}
                  onClick={(e) => handleTabClick(e, idx)}
                  className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all duration-300 flex items-center gap-1 relative cursor-pointer select-none
                    ${isActive 
                      ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20 scale-100' 
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary/80 scale-[0.98] hover:scale-100'
                    }
                    ${isBatal && !isActive ? 'line-through decoration-red-500/50 opacity-60' : ''}
                  `}
                >
                  {isBatal && <Ban className="h-2.5 w-2.5 text-red-500" />}
                  <span>{getSessionLabel(item, idx)}</span>
                </button>
              )
            })}
          </div>
        )}

        {/* Middle: Title and Speaker */}
        <div className="space-y-3">
          <h3 className="text-base sm:text-lg font-black tracking-tight leading-snug text-foreground transition-colors group-hover:text-primary whitespace-normal break-words">
            {displayMateri || (activeItem.is_cancelled ? (/batal/i.test(activeItem.source_text || activeItem.materi || '') ? '(Kajian Dibatalkan)' : '(Kajian Diliburkan)') : '')}
          </h3>
          {(displayPemateri || !activeItem.is_cancelled) && (
            <div className="inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-bold border bg-secondary/50 border-border/60 text-emerald-700 dark:text-emerald-100 shadow-sm">
              <Mic className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>{displayPemateri || 'Ustadz/Pemateri'}</span>
            </div>
          )}
        </div>

        {/* Bottom Info Grid */}
        <div className="grid grid-cols-1 gap-3 pt-2 border-t border-border/50">
          {/* Time */}
          <div className="flex items-start gap-3 text-sm">
            <Clock className="h-4 w-4 mt-0.5 text-primary shrink-0" />
            <div className="text-foreground/80">
              <span className="font-bold text-foreground">{displayWaktuMulai || '-'}</span>
              {activeItem.waktu_selesai && !isSelesaiRedundant && (
                <>
                  <span className="mx-1.5 opacity-40">—</span>
                  <span>{activeItem.waktu_selesai}</span>
                </>
              )}
            </div>
          </div>

          {/* Place */}
          <div className="flex items-start gap-3 text-sm">
            <MapPin className="h-4 w-4 mt-0.5 text-primary shrink-0" />
            <div className="text-foreground/80">
              <p className="font-bold text-foreground">{cleanTempat}</p>
              {cleanAlamat && (
                <p className="text-[11px] mt-0.5 text-muted-foreground/80 whitespace-normal break-words leading-relaxed font-normal">{cleanAlamat}</p>
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
          
          {/* Source Kontributor */}
          {activeItem.kontributor && (
            <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-wider font-extrabold text-muted-foreground/50 pt-1">
              <span>Source: {activeItem.kontributor}</span>
            </div>
          )}
        </div>

        {/* Actions */}
        {activeItem.maps_url && (
          <div className="pt-2">
            <a
              href={activeItem.maps_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold border border-border bg-secondary text-foreground hover:bg-primary hover:text-white hover:border-primary transition-all duration-300 active:scale-[0.98]"
              onClick={(e) => e.stopPropagation()} // Cegah modal terbuka jika menekan tombol Maps langsung
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
