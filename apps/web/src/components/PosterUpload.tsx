import { useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { Button } from './ui/button'
import { UploadCloud, Loader2, CheckCircle2, AlertCircle, Image as ImageIcon } from 'lucide-react'

type PosterUploadProps = {
  onUploadSuccess: (publicUrl: string) => void
  currentUrl?: string
}

export function PosterUpload({ onUploadSuccess, currentUrl }: PosterUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [isError, setIsError] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    const file = files[0]
    if (!file) return

    // 📏 Limit Validasi Sisi Klien (Maks 1MB)
    if (file.size > 1024 * 1024) {
      setIsError(true)
      setStatusMessage('Ukuran file terlalu jumbo! Maksimal 1 MB.')
      return
    }

    // 🎨 Validasi Tipe File
    if (!file.type.startsWith('image/')) {
      setIsError(true)
      setStatusMessage('Wajib berupa file gambar (PNG/JPG/WEBP)!')
      return
    }

    setUploading(true)
    setIsError(false)
    setStatusMessage('Sedang mengunggah ke Supabase...')

    try {
      // 📂 Buat nama file unik anti-tabrakan
      const fileExt = file.name.split('.').pop() ?? 'jpg'
      const cleanName = file.name
        .replace(/\.[^/.]+$/, "")
        .replace(/[^a-zA-Z0-9]/g, '_')
        .substring(0, 20)

      const fileName = `kajian-${cleanName}-${Date.now()}.${fileExt}`
      const filePath = `public/${fileName}`

      // 🛰️ UNGGAH KE BUCKET SUPABASE STORAGE
      const { error: uploadError } = await supabase.storage
        .from('posters_kajian_baru')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        })

      if (uploadError) {
        throw new Error(uploadError.message)
      }

      // 🔗 AMBIL PUBLIC URL DARI FILE TERUNGGAH
      const { data: { publicUrl } } = supabase.storage
        .from('posters_kajian_baru')
        .getPublicUrl(filePath)

      // 🧹 BERSIH-BERSIH OTOMATIS: Hapus poster LAMA dari Supabase storage agar tidak menumpuk sampah!
      if (currentUrl && currentUrl.includes('posters_kajian_baru')) {
        try {
          const match = currentUrl.match(/\/posters_kajian_baru\/(.+)$/)
          if (match && match[1]) {
            const oldFilePath = decodeURIComponent(match[1])
            // Fire-and-forget background cleanup so it doesn't slow down user feedback
            void supabase.storage
              .from('posters_kajian_baru')
              .remove([oldFilePath])
              .then(({ error }) => {
                if (error) console.warn('⚠️ Gagal menghapus file lama di storage:', error.message)
                else console.log(`✅ Storage Cleaned! File lama terhapus otomatis: ${oldFilePath}`)
              })
          }
        } catch (cleanupErr) {
          console.warn('⚠️ Gagal mengeksekusi pembersihan storage:', cleanupErr)
        }
      }

      setIsError(false)
      setStatusMessage('Upload Berhasil! Memasang URL...')

      // Kirim URL sukses ke parent component
      onUploadSuccess(publicUrl)

      // Reset input file element
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (err: unknown) {
      console.error('Supabase Upload Error:', err)
      setIsError(true)
      const errMsg = err instanceof Error ? err.message : 'Kesalahan teknis storage'

      if (errMsg.includes('violates row level security')) {
        setStatusMessage('Gagal! Sepertinya Admin belum menjalankan SQL di dashboard Supabase.')
      } else {
        setStatusMessage(`Gagal Upload: ${errMsg}`)
      }
    } finally {
      setUploading(false)
    }
  }

  const triggerFileSelect = () => {
    fileInputRef.current?.click()
  }

  return (
    <div className="space-y-3 w-full animate-in fade-in duration-300">
      {/* Hidden HTML File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        accept="image/*"
        className="hidden"
        disabled={uploading}
      />

      {/* Interactive Drag-N-Drop / Click Dashboard Area */}
      <div
        onClick={!uploading ? triggerFileSelect : undefined}
        className={`
          relative border-2 border-dashed rounded-2xl p-5 flex flex-col items-center justify-center text-center transition-all cursor-pointer group
          ${uploading
            ? 'bg-accent/30 border-primary/30 pointer-events-none animate-pulse'
            : isError
            ? 'bg-destructive/5 border-destructive/30 hover:border-destructive/60 hover:bg-destructive/10'
            : 'bg-secondary/40 border-border hover:border-primary/40 hover:bg-secondary/70 shadow-inner'
          }
        `}
      >
        {/* Dynamic Icon Handler */}
        <div className={`
          h-12 w-12 rounded-full flex items-center justify-center mb-3 transition-transform duration-300 group-hover:scale-110 shadow-sm
          ${uploading
            ? 'bg-accent text-primary'
            : isError
            ? 'bg-destructive/10 text-destructive'
            : 'bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white'
          }
        `}>
          {uploading ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : isError ? (
            <AlertCircle className="h-6 w-6" />
          ) : (
            <UploadCloud className="h-6 w-6" />
          )}
        </div>

        {/* Status Text Title */}
        <h5 className="text-xs font-black text-foreground tracking-tight uppercase mb-1">
          {uploading ? 'Mengunggah File...' : 'Klik untuk Pilih File Gambar'}
        </h5>

        <p className="text-[10px] text-muted-foreground font-medium max-w-[240px] leading-relaxed">
          Maksimal ukuran foto adalah <strong>1 MB</strong>. Gunakan format JPG, PNG, atau WEBP untuk efisiensi optimal.
        </p>
      </div>

      {/* Live Feedback Ribbon */}
      {statusMessage && (
        <div className={`
          flex items-start gap-2 p-3 rounded-xl border text-xs font-bold animate-in slide-in-from-top-1 duration-300
          ${isError
            ? 'bg-destructive/10 border-destructive/20 text-destructive'
            : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
          }
        `}>
          {isError ? <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" /> : <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0" />}
          <span className="flex-1">{statusMessage}</span>
        </div>
      )}

      {/* Preview Thumbnail Mini (Jika Sedang Terpasang) */}
      {currentUrl && !uploading && !isError && (
        <div className="flex items-center gap-3 p-3 bg-primary/5 border border-primary/20 rounded-xl animate-in slide-in-from-bottom-1">
          <div className="h-10 w-10 rounded-lg bg-secondary overflow-hidden border border-border shrink-0">
            <img src={currentUrl} alt="Mini Preview" className="h-full w-full object-cover" />
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="text-[9px] font-extrabold tracking-wider text-primary uppercase flex items-center gap-1">
              <ImageIcon className="h-2.5 w-2.5" /> File Terkoneksi
            </p>
            <p className="text-[11px] text-muted-foreground font-medium truncate">{currentUrl}</p>
          </div>
        </div>
      )}
    </div>
  )
}
