import { useState } from 'react'
import { parseMessage } from '@kajian-baru/parser'
import { KajianCard } from './KajianCard'
import { Button } from './ui/button'
import type { ParseResult, Kajian, ApiResponse } from '@kajian-baru/types'
import { Sparkles, RefreshCcw, Trash2, Database, AlertTriangle, CheckCircle2, ArrowRight, Image, FileText } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useToast } from '../hooks/use-toast'

export function ParseInput() {
  const { toast } = useToast()
  const [rawText, setRawText] = useState('')
  const [result, setResult] = useState<ParseResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  const generateTemplate = () => {
    const template = `*○●[NAMA KOTA]●○*

🕌 [Nama Masjid]
([Keterangan / Detail Lokasi])
[Alamat Lengkap Jalan / Kelurahan / Kecamatan / Kota]
🌏 G-maps : https://maps.app.goo.gl/placeholder
》Pemateri : Ustadz [Nama Pemateri]
》Tema : [Judul / Kitab Kajian]
》Waktu : [Waktu Mulai] s/d Selesai
》CP : [Nomor CP] 🚹🚺
***`
    setRawText(template)
  }

  const handleParse = () => {
    if (!rawText.trim()) return

    setLoading(true)
    setSaveSuccess(false)

    // Menambahkan sedikit delay buatan agar transisi terasa "cerdas" dan premium bagi user
    setTimeout(() => {
      try {
        const parsed = parseMessage(rawText)
        setResult(parsed)
      } catch (err) {
        console.error('Parse Error', err)
      } finally {
        setLoading(false)
      }
    }, 500)
  }

  const handleClear = () => {
    setRawText('')
    setResult(null)
    setSaveSuccess(false)
  }

  const handleSaveToDatabase = async () => {
    if (!result || result.kajian_list.length === 0) return
    
    setSaving(true)
    setSaveSuccess(false)
    
    try {
      // 🔐 Ambil Token JWT Aktif dari SDK Supabase client-side
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      // Tembakan HTTP POST sesungguhnya ke API Hono Server kita melalui proxy Vite!
      const response = await fetch('/api/kajian/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token ?? ''}`
        },
        body: JSON.stringify({ kajian_list: result.kajian_list }),
      })

      const resData = await response.json() as ApiResponse<Kajian[]>
      
      if (response.ok && resData.success) {
        // Berhasil menyimpan! Tampilkan status sukses
        setSaveSuccess(true)
        
        // Kosongkan editor otomatis setelah jeda sejenak agar siap meng-input kajian lain
        setTimeout(() => {
          setSaveSuccess(false)
          setResult(null)
          setRawText('')
        }, 2500)

        toast({
          variant: 'success',
          title: 'Penyimpanan Berhasil',
          description: 'Kajian baru telah sukses ditambahkan ke database.'
        })
      } else {
        toast({
          variant: 'destructive',
          title: 'Gagal Menyimpan',
          description: resData.error ?? 'Terjadi gangguan internal server API.'
        })
      }
    } catch (err) {
      console.error('Gagal menghubungi API:', err)
      toast({
        variant: 'destructive',
        title: 'Koneksi Terputus',
        description: 'Gagal menghubungi server API backend.'
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
      
      {/* PANEL KIRI: Input Area (Lebar: 7/12) */}
      <div className="lg:col-span-7 flex flex-col space-y-6">
        <div className="bg-card border border-border/50 rounded-[32px] p-6 sm:p-8 shadow-xl shadow-black/5 relative overflow-hidden group transition-all duration-300 hover:border-primary/20 flex flex-col">
          
          {/* Efek latar belakang dekoratif */}
          <div className="absolute -right-20 -top-20 w-48 h-48 bg-primary/5 rounded-full blur-3xl pointer-events-none group-hover:bg-primary/10 transition-all duration-500" />
          
          {/* Header Panel */}
          <div className="flex items-center justify-between mb-6 relative z-10 flex-wrap gap-3">
            <div className="flex items-center gap-3.5">
              <div className="h-11 w-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shadow-inner shrink-0">
                <ClipboardText className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-black tracking-tight text-foreground">Paste Jadwal Kajian</h2>
                <p className="text-xs font-medium text-muted-foreground mt-0.5">Salin dari WhatsApp atau Telegram grup kopas Anda</p>
              </div>
            </div>
            
            <Button 
              variant="outline" 
              size="sm" 
              onClick={generateTemplate}
              className="h-9 rounded-xl text-[10px] font-black uppercase tracking-wider border-primary/20 hover:bg-primary/5 text-primary gap-1.5 active:scale-95 transition-all shrink-0"
            >
              <FileText className="h-3.5 w-3.5" />
              Get Template
            </Button>
          </div>

          {/* Luxury Input Textarea Area */}
          <div className="relative flex-1 group/textarea">
            <textarea
              id="parse-input"
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="Contoh:
HADIRILAH KAJIAN ISLAM!
Tema: Meraih Keberkahan Waktu
Pemateri: Ustadz Yazid bin Abdul Qadir Jawas
..."
              className="w-full min-h-[280px] sm:min-h-[360px] rounded-2xl border border-border bg-background/50 dark:bg-background/30 px-5 py-4 text-sm font-mono leading-relaxed text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-transparent transition-all duration-300 resize-y group-hover/textarea:border-border/80 dark:[color-scheme:dark]"
            />
            
            {!rawText && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-30 group-hover/textarea:opacity-40 transition-opacity duration-500">
                <div className="flex flex-col items-center gap-2">
                  <Sparkles className="h-10 w-10 text-primary" />
                  <span className="text-xs font-bold tracking-wider uppercase">Magic Parser Engine</span>
                </div>
              </div>
            )}
          </div>

          {/* Action Bar Row */}
          <div className="flex flex-wrap gap-3 mt-6 pt-5 border-t border-border/40">
            <Button
              id="parse-submit"
              onClick={handleParse}
              disabled={!rawText.trim() || loading}
              className="h-12 px-6 flex-1 font-black tracking-wide text-sm rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 transition-all active:scale-98 disabled:opacity-50 flex items-center justify-center gap-2 group/btn"
            >
              {loading ? (
                <>
                  <RefreshCcw className="h-4 w-4 animate-spin" />
                  Mengekstrak Teks...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 group-hover/btn:animate-pulse" />
                  Mulai Ekstrak Teks
                </>
              )}
            </Button>
            
            {rawText && (
              <Button
                id="parse-clear"
                onClick={handleClear}
                variant="outline"
                className="h-12 w-12 p-0 rounded-2xl border-border hover:bg-destructive/5 hover:text-destructive hover:border-destructive/20 active:scale-95 transition-all"
                title="Bersihkan Teks"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* PANEL KANAN: Preview & Action Workspace (Lebar: 5/12) */}
      <div className="lg:col-span-5 flex flex-col">
        <div className="sticky top-24 flex flex-col h-full space-y-5">
          
          {/* Label Status Bar */}
          <div className="flex items-center justify-between">
            <h3 className="text-[11px] font-bold tracking-widest uppercase text-muted-foreground flex items-center gap-2 ml-2">
              <div className={`h-1.5 w-1.5 rounded-full ${result ? 'bg-primary animate-pulse' : 'bg-border'}`} />
              Pratinjau Realtime (Live Preview)
            </h3>
          </div>

          {!result ? (
            /* Kosong State: Panduan Awal */
            <div className="flex-1 min-h-[320px] rounded-[32px] border-2 border-dashed border-border/70 bg-card/10 flex flex-col items-center justify-center text-center p-8 transition-all duration-300 hover:border-border hover:bg-card/20">
              <div className="h-16 w-16 rounded-3xl bg-accent flex items-center justify-center text-muted-foreground/60 mb-4 shadow-inner">
                <ArrowRight className="h-6 w-6 rotate-90 lg:rotate-0 opacity-50" />
              </div>
              <h4 className="text-sm font-extrabold text-foreground tracking-tight">Menunggu Input Teks</h4>
              <p className="text-xs text-muted-foreground max-w-[220px] mt-1.5 leading-relaxed">
                Tempel pesan jadwal di kiri dan klik Ekstrak untuk merender kartu visual di sini.
              </p>
            </div>
          ) : (
            /* Berhasil Di-Parse State */
            <div className="flex flex-col space-y-5 animate-in zoom-in-95 duration-300">
              
              {/* Status Ekstraksi */}
              <div className={`px-5 py-4 rounded-2xl flex items-center gap-3 border ${
                result.success 
                  ? 'bg-primary/5 border-primary/20 text-emerald-700 dark:text-emerald-300 shadow-sm' 
                  : 'bg-destructive/5 border-destructive/20 text-destructive'
              }`}>
                {result.success ? (
                  <>
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" />
                    <div className="text-xs font-bold">
                      Berhasil mengekstrak {result.kajian_list.length} jadwal kajian!
                    </div>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-5 w-5 shrink-0" />
                    <div className="text-xs font-bold">
                      Gagal mengekstrak: {result.errors[0]?.message ?? 'Format tak dikenal'}
                    </div>
                  </>
                )}
              </div>

              {/* List Kartu Hasil Parsing */}
              <div className="space-y-4 max-h-[480px] overflow-y-auto pr-2 -mr-2 py-1 custom-scrollbar">
                {result.kajian_list.map((kajian: Kajian, i: number) => (
                  <div key={i} className="space-y-3 animate-in slide-in-from-right-8 duration-500 ease-out shadow-lg bg-card/40 rounded-3xl p-3 border border-border/40" style={{ animationDelay: `${i * 100}ms` }}>
                    <KajianCard kajian={kajian} />
                  </div>
                ))}
              </div>

              {/* Blok Error Spesifik Jika Ada */}
              {result.errors.length > 0 && (
                <div className="bg-destructive/5 border border-destructive/20 rounded-2xl p-4 space-y-2">
                  <div className="flex items-center gap-2 text-destructive text-xs font-bold">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    <span>Peringatan Mesin Parser:</span>
                  </div>
                  {result.errors.map((err, i) => (
                    <p key={i} className="text-[11px] text-muted-foreground pl-5">
                      Blok #{err.block_index + 1}: {err.message}
                    </p>
                  ))}
                </div>
              )}

              {/* TOMBOL EKSEKUSI FINAL: SIMPAN KE DATABASE */}
              {result.success && result.kajian_list.length > 0 && (
                <div className="pt-2 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-300">
                  <Button
                    onClick={handleSaveToDatabase}
                    disabled={saving || saveSuccess}
                    className={`w-full h-14 rounded-[20px] font-extrabold tracking-wide text-sm transition-all duration-300 flex items-center justify-center gap-2.5 shadow-xl border-0
                      ${saveSuccess
                        ? 'bg-emerald-500 text-white shadow-emerald-500/20 scale-100 hover:bg-emerald-500'
                        : 'bg-foreground text-background hover:bg-foreground/90 hover:scale-[1.01] shadow-black/10 active:scale-98'
                      }
                    `}
                  >
                    {saving ? (
                      <>
                        <RefreshCcw className="h-4 w-4 animate-spin" />
                        Memasukkan Data Ke Supabase...
                      </>
                    ) : saveSuccess ? (
                      <>
                        <CheckCircle2 className="h-4 w-4" />
                        Data Berhasil Disimpan!
                      </>
                    ) : (
                      <>
                        <Database className="h-4 w-4" />
                        Simpan Jadwal ke Database
                      </>
                    )}
                  </Button>
                </div>
              )}

            </div>
          )}

        </div>
      </div>
    </div>
  )
}

// Icon Helper fallbacks to ensure compile stability
function ClipboardText(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect width="8" height="4" x="8" y="2" rx="1" ry="1"/>
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
      <path d="M9 12h6"/>
      <path d="M9 16h6"/>
    </svg>
  )
}
