import { useState, useEffect } from 'react'
import { KajianCard } from './KajianCard'
import { Button } from './ui/button'
import { PosterUpload } from './PosterUpload'
import { AutoSuggestInput } from './AutoSuggestInput'
import { supabase } from '../lib/supabase'
import type { Kajian, ApiResponse } from '@kajian-baru/types'
import {
  Sparkles, Save, MapPin, Calendar, User, BookOpen, Clock,
  Compass, Users, CheckCircle2, AlertTriangle, Home, Link2, AlertCircle, Image
} from 'lucide-react'

export function KajianManualForm() {
  const [loading, setLoading] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState<Partial<Kajian>>({
    kota: 'Tangerang',
    tanggal_masehi: new Date().toISOString().split('T')[0] || '',
    tanggal_hijriyah: '',
    materi: '',
    pemateri: '',
    waktu_mulai: '18:00',
    waktu_selesai: 'Selesai',
    tempat: '',
    alamat: '',
    maps_url: '',
    kontak: '',
    audience: 'UMUM',
    poster_url: null,
    gradient_config: { from: '#1a4731', to: '#2d7a4f', angle: 135 },
    himbauan: '',
  })

  // 🧼 Sanitasi data kotor/warisan masa lalu (Legacy Data Sanitizer)
  const cleanLegacy = (str: string | null | undefined, p: string) => {
    if (!str) return ''
    const cleanStr = str
      .replace(/[\u200b-\u200d\ufeff\ufe00-\ufe0f]/g, '') // Hancurkan spasi hantu & sisa emoji!
      .trim()
    return cleanStr
      .replace(/^(?:📚|🎙️|🎙|🕰️|🕰|🕌|📞|📍|🗺️|⚠️|📣|📢|🚫|💡)\s*/gu, '')
      .replace(new RegExp(`^(?:${p})\\s*[:：\\-–]?\\s*`, 'i'), '')
      .trim()
  }

  // 🧠 Deduplikasi Cerdas Case-Insensitive: Gabungkan teks duplikat case, pilih variasi kapitalisasi terbaik!
  const getUniqueCaseInsensitive = (arr: string[]): string[] => {
    const map = new Map<string, string>()
    const countUpper = (s: string) => (s.match(/[A-Z]/g) || []).length

    for (const item of arr) {
      const key = item.trim().toLowerCase()
      if (!key) continue
      
      if (!map.has(key)) {
        map.set(key, item.trim())
      } else {
        // Pilih variasi penulisan yang paling 'benar' (kapital lebih banyak)
        if (countUpper(item) > countUpper(map.get(key)!)) {
          map.set(key, item.trim())
        }
      }
    }
    return Array.from(map.values())
  }

  // -- Dynamic Predictive Auto-Suggest Handlers --
  const searchPemateri = async (query: string): Promise<string[]> => {
    try {
      const { data } = await supabase
        .from('kajian')
        .select('pemateri')
        .ilike('pemateri', `%${query}%`)
        .limit(15)
      if (!data) return []
      const raw = data.map(d => cleanLegacy(d.pemateri, 'Pemateri|Penceramah|Narasumber|Bersama|Oleh')).filter(Boolean)
      return getUniqueCaseInsensitive(raw).sort()
    } catch (e) {
      console.warn('Gagal mencari pemateri:', e)
      return []
    }
  }

  const searchTempat = async (query: string): Promise<string[]> => {
    try {
      const { data } = await supabase
        .from('kajian')
        .select('tempat')
        .ilike('tempat', `%${query}%`)
        .limit(15)
      if (!data) return []
      const raw = data.map(d => cleanLegacy(d.tempat, 'Tempat|Lokasi')).filter(Boolean)
      return getUniqueCaseInsensitive(raw).sort()
    } catch (e) {
      console.warn('Gagal mencari tempat:', e)
      return []
    }
  }

  const searchAlamat = async (query: string): Promise<string[]> => {
    try {
      const { data } = await supabase
        .from('kajian')
        .select('alamat')
        .ilike('alamat', `%${query}%`)
        .limit(15)
      if (!data) return []
      const raw = data.map(d => cleanLegacy(d.alamat, 'Alamat|Maps')).filter(Boolean)
      return getUniqueCaseInsensitive(raw).sort()
    } catch (e) {
      console.warn('Gagal mencari alamat:', e)
      return []
    }
  }

  const searchKota = async (query: string): Promise<string[]> => {
    try {
      const { data } = await supabase
        .from('kajian')
        .select('kota')
        .ilike('kota', `%${query}%`)
        .limit(15)
      if (!data) return []
      const raw = data.map(d => cleanLegacy(d.kota, 'Kota')).filter(Boolean)
      return getUniqueCaseInsensitive(raw).sort()
    } catch (e) {
      console.warn('Gagal mencari kota:', e)
      return []
    }
  }

  // 🚀 Handler Cerdas Lazy-Loading: Ambil data Alamat & Maps jika Tempat dipilih!
  const handleTempatSelect = async (selectedTempat: string) => {
    setFormData(prev => ({ ...prev, tempat: selectedTempat }))
    try {
      const { data } = await supabase
        .from('kajian')
        .select('alamat, maps_url')
        .ilike('tempat', selectedTempat)
        .order('created_at', { ascending: false })
        .limit(1)

      if (data && data[0]) {
        setFormData(prev => ({
          ...prev,
          alamat: cleanLegacy(data[0]?.alamat, 'Alamat|Maps') || prev.alamat || '',
          maps_url: data[0]?.maps_url || prev.maps_url || ''
        }))
      }
    } catch (err) {
      console.warn('Gagal me-load detail tempat terpilih:', err)
    }
  }

  const handleSave = async () => {
    if (!formData.materi || !formData.pemateri || !formData.tempat) {
      setError('Mohon isi minimal Materi, Pemateri, dan Tempat Kajian!')
      return
    }

    setLoading(true)
    setError(null)
    setSaveSuccess(false)

    try {
      // 🔐 Ambil Token JWT Aktif dari SDK Supabase client-side
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      const response = await fetch('/api/kajian/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token ?? ''}`
        },
        body: JSON.stringify({
          kajian_list: [{
            ...formData,
            materi: cleanLegacy(formData.materi, 'Materi|Tema|Judul|Kajian'),
            pemateri: cleanLegacy(formData.pemateri, 'Pemateri|Penceramah|Narasumber|Bersama|Oleh'),
            tempat: cleanLegacy(formData.tempat, 'Tempat|Lokasi'),
            alamat: cleanLegacy(formData.alamat, 'Alamat|Maps'),
            kota: cleanLegacy(formData.kota, 'Kota'),
            source_text: 'Dibuat manual via Dashboard Admin'
          }]
        })
      })

      const result = await response.json() as ApiResponse<Kajian[]>

      if (result.success) {
        setSaveSuccess(true)
        // Reset form parsial, sisakan beberapa default yang mungkin dipakai lagi
        setFormData(prev => ({
          ...prev,
          materi: '',
          pemateri: '',
          poster_url: null,
        }))
      } else {
        setError(result.error ?? 'Gagal menyimpan ke database')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal terhubung ke server')
    } finally {
      setLoading(false)
    }
  }

  // Helper cast parsial ke tipe Kajian penuh untuk kebutuhan preview card
  const previewKajian = {
    ...formData,
    id: 'preview',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  } as Kajian

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in-50 duration-500">

      {/* COL 1: FORM INPUT MANUAL */}
      <div className="lg:col-span-7 space-y-5">
        <div className="bg-card/40 border border-border/60 rounded-[32px] p-6 lg:p-8 shadow-xl space-y-6">

          <div className="flex items-center gap-3 border-b border-border/40 pb-4">
            <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base tracking-tight">Form Input Cepat</h3>
              <p className="text-xs text-muted-foreground">Isi detail kajian secara manual & simpan instan</p>
            </div>
          </div>

          {error && (
            <div className="bg-destructive/5 border border-destructive/20 text-destructive rounded-xl p-3 text-xs font-bold flex items-center gap-2 animate-in shake-1 duration-300">
              <AlertTriangle className="h-4 w-4" /> {error}
            </div>
          )}

          {saveSuccess && (
            <div className="bg-primary/5 border border-primary/20 text-emerald-500 rounded-xl p-3 text-xs font-bold flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" /> Kajian Berhasil Disimpan ke Database!
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-extrabold tracking-widest text-muted-foreground uppercase flex items-center gap-1.5 ml-1"><BookOpen className="h-3 w-3"/> Judul / Materi</label>
              <input
                value={formData.materi}
                onChange={e => setFormData({...formData, materi: e.target.value})}
                placeholder="Kajian Kitab..."
                className="w-full h-10 px-3.5 text-xs font-semibold rounded-xl border border-border bg-background/50 focus:outline-none focus:ring-1 focus:ring-primary focus:bg-background transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-extrabold tracking-widest text-muted-foreground uppercase flex items-center gap-1.5 ml-1"><User className="h-3 w-3"/> Pemateri / Ustadz</label>
              <AutoSuggestInput
                value={formData.pemateri || ''}
                onChange={val => setFormData({...formData, pemateri: val})}
                onSearch={searchPemateri}
                placeholder="Ustadz Aldhi Ferdian..."
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-extrabold tracking-widest text-muted-foreground uppercase flex items-center gap-1.5 ml-1"><Calendar className="h-3 w-3"/> Tanggal</label>
              <input
                type="date"
                value={formData.tanggal_masehi}
                onChange={e => setFormData({...formData, tanggal_masehi: e.target.value})}
                className="w-full h-10 px-3.5 text-xs font-semibold rounded-xl border border-border bg-background/50 focus:outline-none focus:ring-1 focus:ring-primary focus:bg-background transition-all text-foreground [color-scheme:dark]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-extrabold tracking-widest text-muted-foreground uppercase flex items-center gap-1.5 ml-1"><Clock className="h-3 w-3"/> Waktu</label>
              <input
                value={formData.waktu_mulai}
                onChange={e => setFormData({...formData, waktu_mulai: e.target.value})}
                placeholder="18:00 WIB atau Ba'da Maghrib"
                className="w-full h-10 px-3.5 text-xs font-semibold rounded-xl border border-border bg-background/50 focus:outline-none focus:ring-1 focus:ring-primary focus:bg-background transition-all"
              />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <label className="text-[10px] font-extrabold tracking-widest text-muted-foreground uppercase flex items-center gap-1.5 ml-1"><MapPin className="h-3 w-3"/> Nama Masjid / Tempat</label>
              <AutoSuggestInput
                value={formData.tempat || ''}
                onChange={handleTempatSelect}
                onSearch={searchTempat}
                placeholder="Masjid Jami' Al-Jihad"
              />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <label className="text-[10px] font-extrabold tracking-widest text-muted-foreground uppercase flex items-center gap-1.5 ml-1"><Home className="h-3 w-3"/> Alamat Lengkap (Opsional)</label>
              <AutoSuggestInput
                value={formData.alamat || ''}
                onChange={val => setFormData({...formData, alamat: val})}
                onSearch={searchAlamat}
                placeholder="Contoh: Jl. H. Mansyur No. 10, RT 02/01"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-extrabold tracking-widest text-muted-foreground uppercase flex items-center gap-1.5 ml-1"><Compass className="h-3 w-3"/> Kota</label>
              <AutoSuggestInput
                value={formData.kota || ''}
                onChange={val => setFormData({...formData, kota: val})}
                onSearch={searchKota}
                placeholder="Tangerang"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-extrabold tracking-widest text-muted-foreground uppercase flex items-center gap-1.5 ml-1"><Users className="h-3 w-3"/> Audience</label>
              <select
                value={formData.audience}
                onChange={e => {
                  const aud = e.target.value as any
                  let grad = { from: '#1a4731', to: '#2d7a4f', angle: 135 }
                  if (aud === 'AKHWAT') grad = { from: '#4c0519', to: '#9d174d', angle: 135 }
                  else if (aud === 'IKHWAN') grad = { from: '#0f172a', to: '#1e3a8a', angle: 135 }
                  setFormData({...formData, audience: aud, gradient_config: grad})
                }}
                className="w-full h-10 px-3.5 text-xs font-semibold rounded-xl border border-border bg-background/50 focus:outline-none focus:ring-1 focus:ring-primary focus:bg-background transition-all"
              >
                <option value="UMUM">UMUM</option>
                <option value="IKHWAN">KHUSUS IKHWAN</option>
                <option value="AKHWAT">KHUSUS AKHWAT</option>
              </select>
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <label className="text-[10px] font-extrabold tracking-widest text-muted-foreground uppercase flex items-center gap-1.5 ml-1"><Link2 className="h-3 w-3"/> Tautan Google Maps</label>
              <input
                value={formData.maps_url}
                onChange={e => setFormData({...formData, maps_url: e.target.value})}
                placeholder="https://maps.app.goo.gl/..."
                className="w-full h-10 px-3.5 text-xs font-semibold rounded-xl border border-border bg-background/50 focus:outline-none focus:ring-1 focus:ring-primary focus:bg-background transition-all"
              />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <label className="text-[10px] font-extrabold tracking-widest text-muted-foreground uppercase flex items-center gap-1.5 ml-1"><AlertCircle className="h-3 w-3"/> Himbauan / Catatan Khusus (Opsional)</label>
              <input
                value={formData.himbauan}
                onChange={e => setFormData({...formData, himbauan: e.target.value})}
                placeholder="Contoh: Disarankan naik motor, parkir mobil terbatas, bawa tumbler"
                className="w-full h-10 px-3.5 text-xs font-semibold rounded-xl border border-border bg-background/50 focus:outline-none focus:ring-1 focus:ring-primary focus:bg-background transition-all"
              />
            </div>
          </div>

          {/* Widget Unggah Poster Langsung */}
          <div className="space-y-2 pt-2 border-t border-border/40">
            <label className="text-[10px] font-extrabold tracking-widest text-primary uppercase flex items-center gap-1.5 ml-1">
              <Image className="h-3 w-3"/> Unggah File Poster (Opsional)
            </label>
            <PosterUpload
              onUploadSuccess={(url) => setFormData({...formData, poster_url: url})}
              currentUrl={formData.poster_url ?? ''}
            />
          </div>

          <Button
            onClick={handleSave}
            disabled={loading}
            className="w-full h-11 rounded-2xl font-bold flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 border border-emerald-500/30 shadow-lg shadow-emerald-950/20 group transition-all active:scale-[0.98]"
          >
            <Save className={`h-4 w-4 transition-transform duration-300 ${loading ? 'animate-pulse' : 'group-hover:scale-110'}`} />
            {loading ? 'Menyimpan Data...' : 'Simpan Kajian'}
          </Button>
        </div>
      </div>

      {/* COL 2: LIVE PREVIEW CARD */}
      <div className="lg:col-span-5 flex flex-col">
        <div className="sticky top-24 flex flex-col space-y-4">
          <h3 className="text-[11px] font-bold tracking-widest uppercase text-muted-foreground flex items-center gap-2 ml-2">
            <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            Live Card Preview
          </h3>
          <div className="bg-card/20 rounded-[32px] border-2 border-dashed border-border/60 p-4 flex items-center justify-center min-h-[280px]">
            <div className="w-full transform transition-transform hover:scale-[1.01] duration-300">
              <KajianCard kajian={previewKajian} />
            </div>
          </div>
        </div>
      </div>

    </div>
  )
}
