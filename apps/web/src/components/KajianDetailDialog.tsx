import type { Kajian } from '@kajian-baru/types'
import { generateFollowKey } from '@kajian-baru/parser'
import { Badge } from './ui/badge'
import { 
  X, Calendar, Clock, MapPin, Phone, Compass, 
  Navigation, Share2, BellRing, BellMinus, CheckCircle2,
  Mic, Building2, Map, Moon, AlertCircle, Ban
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from './ui/button'
import { supabase } from '../lib/supabase'
import { cleanVisual, getCategoryGradient, formatDisplayDate, checkSelesaiRedundant, splitTempatAddress } from '../lib/utils'

type KajianDetailDialogProps = {
  isOpen: boolean
  onClose: () => void
  kajian: Kajian | null
  allSessions?: Kajian[]
  initialIndex?: number
}

export function KajianDetailDialog({ 
  isOpen, onClose, kajian: propKajian, allSessions = [], initialIndex = 0 
}: KajianDetailDialogProps) {
  const [activeIdx, setActiveIdx] = useState(initialIndex)

  // 🔄 Sinkronisasikan index aktif kembali ke sesi pemicu saat dialog dibuka
  useEffect(() => {
    if (isOpen) {
      setActiveIdx(initialIndex)
    }
  }, [isOpen, initialIndex])

  // Normalisasi dataset homogen (dukung sesi ganda)
  const items = allSessions.length > 0 ? allSessions : (propKajian ? [propKajian] : [])
  const kajian = items[activeIdx] ?? propKajian // 🔥 ALIASING: Menutupi scope propKajian tanpa merubah baris JSX bawah!

  const [followedUstadz, setFollowedUstadz] = useState(false)
  const [followedMasjid, setFollowedMasjid] = useState(false)
  const [followedKota, setFollowedKota] = useState(false)
  const [toastMsg, setToastMsg] = useState<string | null>(null)



  const displayMateri = cleanVisual(kajian?.materi, 'Materi|Tema|Judul|Kajian')
  const displayPemateri = cleanVisual(kajian?.pemateri, 'Pemateri|Penceramah|Narasumber|Bersama|Oleh')
  const displayTempatRaw = cleanVisual(kajian?.tempat, 'Tempat|Lokasi')
  const { cleanTempat, cleanAlamat } = splitTempatAddress(displayTempatRaw, kajian?.alamat)

  // 🔄 SYNC STATE: Tarik status langganan sesungguhnya dari DB saat dialog terbuka!
  useEffect(() => {
    if (!isOpen || !kajian) return
    
    let isMounted = true

    // Reset local states to prevent stale visual jumps
    setFollowedUstadz(false)
    setFollowedMasjid(false)
    setFollowedKota(false)

    const fetchActiveFollows = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return // User tidak login, biarkan False

        const res = await fetch('/api/push/follows', {
          headers: { 'Authorization': `Bearer ${session.access_token}` }
        })
        const resData = await res.json()
        
        if (resData.success && resData.data && isMounted) {
          const activeList = resData.data as { entity_type: string; entity_key: string }[]
          
          const currentUstadzKey = generateFollowKey('USTADZ', displayPemateri)
          const currentMasjidKey = generateFollowKey('MASJID', cleanTempat, kajian.kota)
          const currentKotaKey = generateFollowKey('KOTA', kajian.kota)

          setFollowedUstadz(activeList.some(f => f.entity_type === 'USTADZ' && f.entity_key === currentUstadzKey))
          setFollowedMasjid(activeList.some(f => f.entity_type === 'MASJID' && f.entity_key === currentMasjidKey))
          setFollowedKota(activeList.some(f => f.entity_type === 'KOTA' && f.entity_key === currentKotaKey))
        }
      } catch (err) {
        console.error('⚠️ Gagal memuat status langganan:', err)
      }
    }

    void fetchActiveFollows()

    return () => { isMounted = false }
  }, [isOpen, kajian, displayPemateri, cleanTempat])

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  if (!isOpen || !kajian) return null

  const hasPoster = !!kajian.poster_url
  
  const gradientStyle = {
    background: getCategoryGradient(kajian.audience, kajian.gradient_config?.angle),
  }

  const displayKontak = cleanVisual(kajian.kontak, 'Info\\s+Panitia\\s+Kajian|Info\\s+Panitia|Info|Kontak|Hubungi|WA|Telp', false)
  const displayWaktuMulai = cleanVisual(kajian.waktu_mulai, 'Waktu|Jam|Pukul', false)

  const isSelesaiRedundant = checkSelesaiRedundant(displayWaktuMulai, kajian.waktu_selesai)

  // 🔔 TRIGGER BACKEND: Lakukan Toggle Follow sungguhan di Supabase database via API!
  const handleFollowClick = async (
    type: 'USTADZ' | 'MASJID' | 'KOTA', 
    name: string, 
    isFollowing: boolean, 
    setFollowing: (v: boolean) => void,
    extraValue?: string
  ) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setToastMsg('🔒 Mohon Masuk/Login Terlebih Dahulu!')
        setTimeout(() => setToastMsg(null), 2500)
        return
      }

      // Optimistic UI state update (Sangat responsif!)
      setFollowing(!isFollowing)
      setToastMsg(!isFollowing ? `⏳ Menyambungkan notifikasi...` : `⏳ Memutuskan notifikasi...`)

      const response = await fetch('/api/push/follows/toggle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ 
          entity_type: type, 
          entity_name: name,
          entity_extra: extraValue
        })
      })

      const data = await response.json()

      if (data.success) {
        const textType = type === 'USTADZ' ? 'Ustadz' : type === 'MASJID' ? 'Masjid' : 'Kota'
        setToastMsg(
          data.data.status === 'FOLLOWED'
            ? `🔔 Berhasil mengikuti ${textType}: ${name}`
            : `🔕 Berhenti menerima notifikasi ${textType}!`
        )
      } else {
        // Gagal: Kembalikan state visual ke sebelumnya
        setFollowing(isFollowing)
        setToastMsg(`❌ Gagal: ${String(data.error ?? 'Gangguan sistem')}`)
      }
    } catch (error) {
      setFollowing(isFollowing)
      setToastMsg('❌ Terjadi gangguan koneksi internet!')
    } finally {
      setTimeout(() => setToastMsg(null), 3000)
    }
  }


  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-300">
      {/* Backdrop dengan blur sinematik */}
      <div className="absolute inset-0 bg-[#050806]/70 backdrop-blur-sm" onClick={onClose} />

      {/* Interactive Dynamic Toast Feedback */}
      {toastMsg && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-50 bg-emerald-950/95 border border-emerald-500/30 backdrop-blur-md text-emerald-100 px-5 py-3 rounded-full shadow-2xl shadow-emerald-900/20 flex items-center gap-2.5 text-xs font-black tracking-wider uppercase animate-in slide-in-from-top-6 duration-300">
          <div className="h-5 w-5 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
            <CheckCircle2 className="h-3.5 w-3.5" />
          </div>
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Dialog Box wrapper */}
      <div className="bg-card w-full sm:max-w-lg rounded-t-[36px] sm:rounded-[36px] border border-border/40 sm:border-emerald-500/10 relative z-10 shadow-2xl shadow-black/20 flex flex-col max-h-[92vh] overflow-hidden animate-in slide-in-from-bottom-12 duration-400 ease-out">
        
        {/* Custom Floating Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 z-20 h-10 w-10 rounded-full bg-black/30 hover:bg-black/50 text-white flex items-center justify-center backdrop-blur-md border border-white/10 transition-all active:scale-90 shadow-lg"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex-1 overflow-y-auto custom-scrollbar bg-card">
          
          {/* TOP: Media Section (Taller & Immersive) */}
          <div className="relative w-full aspect-[16/10] overflow-hidden group bg-[#0b120d] border-b border-border/10">
            {hasPoster ? (
              <img 
                src={kajian.poster_url!} 
                alt={displayMateri} 
                className="w-full h-full object-cover transition-transform duration-[2000ms] group-hover:scale-105 animate-in fade-in-30 duration-500"
              />
            ) : (
              <div style={gradientStyle} className="w-full h-full relative flex items-center justify-center text-white overflow-hidden animate-in fade-in-30 duration-500">
                <div className="absolute inset-0 opacity-25 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]" />
                <div className={`z-10 bg-white/10 backdrop-blur-md border border-white/20 px-4 py-2 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl shadow-black/5 ${
                  kajian.audience === 'AKHWAT' ? 'text-rose-100' : kajian.audience === 'IKHWAN' ? 'text-blue-100' : 'text-emerald-50'
                }`}>
                  KAJIAN ILMIYYAH
                </div>
              </div>
            )}
            {/* Soft Vignette */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-transparent pointer-events-none" />
          </div>

          {/* 🎭 THE FLOATING OVERLAP: Content floats gracefully OVER the bottom of the poster */}
          <div className="relative -mt-10 bg-card px-6 sm:px-8 pt-7 pb-8 rounded-t-[36px] shadow-[0_-12px_40px_rgba(0,0,0,0.12)] space-y-7 border-t border-border/30">
            
            {/* Decorative Drawer Grabber */}
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-white/40 dark:bg-white/20 rounded-full blur-[0.5px] pointer-events-none" />

            {/* 🏷️ HEADER ROW: Badges (Kiri) & Sesi Toggles (Kanan) */}
            <div className="flex flex-wrap items-center justify-between gap-3.5 w-full">
              
              {/* KIRI: Badge Audience, Diliburkan, & Tanggal Masehi */}
              <div className="flex flex-wrap items-center gap-2.5">
                <Badge variant={kajian.audience === 'AKHWAT' ? 'pink' : kajian.audience === 'IKHWAN' ? 'blue' : 'success'} className="font-extrabold tracking-wider uppercase rounded-lg text-[10px] px-2.5 py-1 shadow-sm">
                  {kajian.audience}
                </Badge>
                {kajian.is_cancelled && (
                  <Badge variant="destructive" className="font-black tracking-wider uppercase border border-red-500/30 animate-pulse text-[9px] px-2 py-1 rounded-lg flex items-center gap-1">
                    <Ban className="h-2.5 w-2.5" />
                    Diliburkan
                  </Badge>
                )}
                <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/10 px-3 py-1 rounded-lg flex items-center gap-1.5 shadow-inner">
                  <Calendar className="h-3 w-3 text-emerald-600 dark:text-emerald-400" /> 
                  {formatDisplayDate(kajian.tanggal_masehi)}
                </span>
              </div>

              {/* KANAN: 📑 TABS PEMILIH SESI GANDA INTERAKTIF */}
              {items.length > 1 && (
                <div className="flex flex-wrap gap-1 bg-emerald-500/[0.03] dark:bg-emerald-500/[0.01] border border-emerald-500/10 p-0.5 rounded-2xl backdrop-blur-sm z-10 relative animate-in fade-in-50 duration-300">
                  {items.map((item, idx) => {
                    const isActive = idx === activeIdx
                    const isBatal = item.is_cancelled
                    
                    const getLabel = (k: Kajian, index: number) => {
                      const placeUpper = (k.tempat || '').toUpperCase()
                      if (placeUpper.includes('SESI 1')) return 'Sesi 1'
                      if (placeUpper.includes('SESI 2')) return 'Sesi 2'
                      if (placeUpper.includes('SESI 3')) return 'Sesi 3'
                      return `Sesi ${index + 1}`
                    }

                    return (
                      <button
                        key={item.id ?? idx}
                        onClick={() => setActiveIdx(idx)}
                        className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all duration-300 flex items-center gap-1 relative cursor-pointer select-none border
                          ${isActive 
                            ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm shadow-emerald-600/20 scale-100' 
                            : 'text-muted-foreground border-transparent hover:text-foreground hover:bg-emerald-500/5 scale-[0.98] hover:scale-100'
                          }
                          ${isBatal && !isActive ? 'line-through decoration-red-500/50 opacity-60' : ''}
                        `}
                      >
                        {isBatal && <Ban className="h-2.5 w-2.5 text-red-500" />}
                        <span>{getLabel(item, idx)}</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* 📖 JUDUL MATERI & TANGGAL HIJRIYAH */}
            <div className="space-y-3.5">
              <h2 className="text-xl sm:text-2xl font-black tracking-tight text-foreground leading-tight whitespace-normal pr-2">
                {displayMateri || (kajian.is_cancelled ? '(Materi Diliburkan)' : '')}
              </h2>
              
              {kajian.tanggal_hijriyah && (
                <div className="inline-flex items-center gap-1.5 text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400/90 tracking-wide bg-gradient-to-r from-emerald-500/[0.06] to-emerald-500/[0.01] border border-emerald-500/10 px-3.5 py-1.5 rounded-xl">
                  <Moon className="h-3 w-3 text-emerald-500 dark:text-emerald-400 animate-pulse" /> {kajian.tanggal_hijriyah}
                </div>
              )}
            </div>

            {/* 💎 INTERACTIVE GROUP PANEL: All follow inputs united inside a single glassmorphism card */}
            <div className="space-y-2.5">
              <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1 mb-1">Aksi & Pilihan Favorit</h4>
              
              <div className="bg-emerald-500/[0.02] dark:bg-emerald-500/[0.01] border border-emerald-500/10 rounded-[28px] overflow-hidden divide-y divide-emerald-500/10 dark:divide-emerald-500/5 shadow-sm">
                
                {/* Row Ustadz */}
                <div className="flex items-center justify-between p-4 sm:p-5 hover:bg-emerald-500/[0.03] dark:hover:bg-emerald-500/[0.02] transition-colors duration-300">
                  <div className="flex items-center gap-4 overflow-hidden mr-3">
                    <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-emerald-100 to-emerald-500/5 dark:from-emerald-500/20 dark:to-teal-500/5 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0 border border-emerald-500/10 shadow-sm">
                      <Mic className="h-5 w-5" />
                    </div>
                    <div className="flex-1 overflow-hidden pr-1">
                      <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest leading-none mb-1.5">Ustadz / Pemateri</p>
                      <p className="text-sm font-extrabold text-foreground leading-snug whitespace-normal break-words line-clamp-2">{displayPemateri}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleFollowClick('USTADZ', displayPemateri, followedUstadz, setFollowedUstadz)}
                    className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-wider transition-all duration-300 ease-out flex items-center gap-1.5 shrink-0 select-none shadow-sm active:scale-95
                      ${followedUstadz 
                        ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20 border-transparent' 
                        : 'bg-emerald-500/5 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/15 border border-emerald-500/20'
                      }
                    `}
                  >
                    {followedUstadz ? <BellMinus className="h-3.5 w-3.5" /> : <BellRing className="h-3.5 w-3.5" />}
                    {followedUstadz ? 'Diikuti' : 'Ikuti'}
                  </button>
                </div>

                {/* Row Masjid */}
                <div className="flex items-center justify-between p-4 sm:p-5 hover:bg-emerald-500/[0.03] dark:hover:bg-emerald-500/[0.02] transition-colors duration-300">
                  <div className="flex items-center gap-4 overflow-hidden mr-3">
                    <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-emerald-100 to-emerald-500/5 dark:from-emerald-500/20 dark:to-teal-500/5 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0 border border-emerald-500/10 shadow-sm">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div className="flex-1 overflow-hidden pr-1">
                      <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest leading-none mb-1.5">Masjid / Tempat</p>
                      <p className="text-sm font-extrabold text-foreground leading-snug whitespace-normal break-words line-clamp-2">{cleanTempat}</p>
                      {cleanAlamat && (
                        <p className="text-[10px] mt-1 text-muted-foreground/80 whitespace-normal break-words leading-relaxed font-normal line-clamp-2">{cleanAlamat}</p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleFollowClick('MASJID', cleanTempat, followedMasjid, setFollowedMasjid, kajian.kota)}
                    className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-wider transition-all duration-300 ease-out flex items-center gap-1.5 shrink-0 select-none shadow-sm active:scale-95
                      ${followedMasjid 
                        ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20 border-transparent' 
                        : 'bg-emerald-500/5 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/15 border border-emerald-500/20'
                      }
                    `}
                  >
                    {followedMasjid ? <BellMinus className="h-3.5 w-3.5" /> : <BellRing className="h-3.5 w-3.5" />}
                    {followedMasjid ? 'Diikuti' : 'Ikuti'}
                  </button>
                </div>

                {/* Row Kota */}
                <div className="flex items-center justify-between p-4 sm:p-5 hover:bg-emerald-500/[0.03] dark:hover:bg-emerald-500/[0.02] transition-colors duration-300">
                  <div className="flex items-center gap-4 overflow-hidden mr-3">
                    <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-emerald-100 to-emerald-500/5 dark:from-emerald-500/20 dark:to-teal-500/5 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0 border border-emerald-500/10 shadow-sm">
                      <Map className="h-5 w-5" />
                    </div>
                    <div className="flex-1 overflow-hidden pr-1">
                      <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest leading-none mb-1.5">Daerah / Kota</p>
                      <p className="text-sm font-extrabold text-foreground leading-snug whitespace-normal break-words truncate">{kajian.kota}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleFollowClick('KOTA', kajian.kota, followedKota, setFollowedKota)}
                    className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-wider transition-all duration-300 ease-out flex items-center gap-1.5 shrink-0 select-none shadow-sm active:scale-95
                      ${followedKota 
                        ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20 border-transparent' 
                        : 'bg-emerald-500/5 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/15 border border-emerald-500/20'
                      }
                    `}
                  >
                    {followedKota ? <BellMinus className="h-3.5 w-3.5" /> : <BellRing className="h-3.5 w-3.5" />}
                    {followedKota ? 'Diikuti' : 'Ikuti'}
                  </button>
                </div>

              </div>
            </div>

            {/* 📦 LOGISTICS INFORMATION PANEL: Consolidating all practical data */}
            <div className="space-y-2.5">
              <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1 mb-1">Informasi Logistik</h4>
              
              <div className="bg-secondary/40 dark:bg-secondary/20 border border-border/50 rounded-[28px] p-6 space-y-5 shadow-sm">
                <div className="flex items-start gap-4 text-sm">
                  <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                    <Clock className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-[9px] font-black text-muted-foreground uppercase tracking-wider leading-none mb-1.5">Waktu Kajian</p>
                    <p className="font-extrabold text-foreground tracking-wide text-sm sm:text-base">
                      {displayWaktuMulai}
                      {kajian.waktu_selesai && !isSelesaiRedundant ? ` — ${kajian.waktu_selesai}` : ''}
                    </p>
                  </div>
                </div>

                {kajian.alamat && (
                  <div className="flex items-start gap-4 text-sm border-t border-border/40 pt-5">
                    <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                      <MapPin className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-muted-foreground uppercase tracking-wider leading-none mb-1.5">Alamat Lengkap</p>
                      <p className="font-bold text-foreground leading-relaxed text-xs sm:text-sm whitespace-normal break-words">{kajian.alamat}</p>
                    </div>
                  </div>
                )}

                {kajian.himbauan && (
                  <div className="flex items-start gap-4 text-sm border-t border-border/40 pt-5">
                    <div className="h-8 w-8 rounded-xl bg-amber-500/15 dark:bg-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0 border border-amber-500/20">
                      <AlertCircle className="h-4 w-4" />
                    </div>
                    <div className="flex-1 bg-amber-500/[0.04] dark:bg-amber-500/[0.08] border border-amber-500/10 p-3.5 rounded-2xl">
                      <p className="text-[9px] font-black text-amber-700 dark:text-amber-400 uppercase tracking-wider leading-none mb-1.5 flex items-center gap-1">PENTING / HIMBAUAN</p>
                      <p className="font-bold text-amber-800 dark:text-amber-200 leading-relaxed text-xs sm:text-sm whitespace-normal break-words">{kajian.himbauan}</p>
                    </div>
                  </div>
                )}

                {displayKontak && (
                  <div className="flex items-start gap-4 text-sm border-t border-border/40 pt-5">
                    <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                      <Phone className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-muted-foreground uppercase tracking-wider leading-none mb-1.5">Informasi & Kontak Panitia</p>
                      <p className="font-extrabold text-emerald-700 dark:text-emerald-300 tracking-wide text-xs sm:text-sm whitespace-normal break-words">{displayKontak}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>

        {/* ULTRA PRESTIGE ACTION FOOTER */}
        <div className="p-5 sm:p-6 bg-card border-t border-border/40 flex gap-4 shrink-0 shadow-[0_-8px_30px_rgba(0,0,0,0.03)] relative z-20">
          <Button
            variant="outline"
            className="flex-1 h-13 rounded-2xl font-black text-xs tracking-wider uppercase gap-2 border-border hover:bg-accent active:scale-95 transition-all"
            onClick={() => {
              if (navigator.share) {
                void navigator.share({
                  title: `Kajian: ${displayMateri}`,
                  text: `Hadirilah Kajian Sunnah bersama ${displayPemateri} di ${cleanTempat}${cleanAlamat ? ', ' + cleanAlamat : ''} pada ${formatDisplayDate(kajian.tanggal_masehi)} pukul ${displayWaktuMulai}.`,
                  url: window.location.href
                })
              }
            }}
          >
            <Share2 className="h-4 w-4" />
            Bagikan
          </Button>

          {kajian.maps_url ? (
            <a 
              href={kajian.maps_url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex-[2]"
            >
              <Button
                className="w-full h-13 rounded-2xl font-black text-xs tracking-wider uppercase gap-2 shadow-xl shadow-emerald-600/15 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 active:scale-[0.97] transition-all border-0 text-white"
              >
                <Navigation className="h-4 w-4 animate-pulse" />
                Petunjuk Arah (Maps)
              </Button>
            </a>
          ) : (
            <Button
              disabled
              className="flex-[2] h-13 rounded-2xl font-black text-xs tracking-wider uppercase gap-2 opacity-50 bg-secondary text-muted-foreground border-0 cursor-not-allowed"
            >
              <Compass className="h-4 w-4" />
              Maps Kosong
            </Button>
          )}
        </div>

      </div>
    </div>
  )
}
