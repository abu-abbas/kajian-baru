import { useState, useEffect } from 'react'
import type { Kajian, ApiResponse } from '@kajian-baru/types'
import { Button } from './ui/button'
import { 
  RefreshCcw, Trash2, Edit3, Image as ImageIcon, Check, X, AlertCircle, Calendar, 
  MapPin, User, ExternalLink, Search, AlertTriangle
} from 'lucide-react'

import { PosterUpload } from './PosterUpload'
import { supabase } from '../lib/supabase'
import { cleanVisual, formatDisplayDate } from '../lib/utils'

export function KajianListAdmin() {
  const [kajians, setKajians] = useState<Kajian[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  
  // State untuk mengontrol baris mana yang sedang di-edit secara inline
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editMateri, setEditMateri] = useState('')
  const [editPosterUrl, setEditPosterUrl] = useState('')
  const [updating, setUpdating] = useState(false)

  // State Konfirmasi Hapus
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Tarik data dari API
  const fetchKajianData = async () => {
    setLoading(true)
    try {
      // Ambil 50 data terakhir dari database untuk keperluan admin
      const res = await fetch('/api/kajian?limit=50')
      const resData = await res.json() as ApiResponse<Kajian[]>
      if (res.ok && resData.success) {
        setKajians(resData.data ?? [])
      }
    } catch (err) {
      console.error('Gagal memuat arsip kajian:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchKajianData()
  }, [])

  // Aktifkan mode edit inline pada sebuah baris
  const startEdit = (kajian: Kajian) => {
    if (!kajian.id) return
    setEditingId(kajian.id)
    setEditMateri(kajian.materi)
    setEditPosterUrl(kajian.poster_url ?? '')
  }

  // Batalkan edit
  const cancelEdit = () => {
    setEditingId(null)
    setEditMateri('')
    setEditPosterUrl('')
  }

  // Simpan perubahan (PATCH) ke Database via API Hono
  const handleSaveUpdate = async (id: string) => {
    setUpdating(true)
    try {
      // 🔐 Ambil Token JWT Aktif dari SDK Supabase client-side
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      const response = await fetch(`/api/kajian/${id}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token ?? ''}`
        },
        body: JSON.stringify({
          materi: editMateri.replace(/^(?:[Mm]ateri|[Tt]ema|[Jj]udul|[Kk]ajian)\s*[:\-–]?\s*/i, '').trim(),
          poster_url: editPosterUrl.trim() === '' ? null : editPosterUrl.trim(),
        }),
      })

      const resData = await response.json() as ApiResponse<Kajian>

      if (response.ok && resData.success && resData.data) {
        // Update state lokal secara instan tanpa full reload!
        setKajians(prev => prev.map(k => k.id === id ? resData.data! : k))
        setEditingId(null)
      } else {
        alert(`Gagal memperbarui: ${resData.error ?? 'Masalah internal API'}`)
      }
    } catch (err) {
      console.error('Gagal mengupdate kajian:', err)
      alert('Terjadi kegagalan koneksi API.')
    } finally {
      setUpdating(false)
    }
  }

  // Eksekusi Hapus Data (DELETE)
  const handleDelete = async (id: string) => {
    try {
      // 🔐 Ambil Token JWT Aktif dari SDK Supabase client-side
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      const response = await fetch(`/api/kajian/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token ?? ''}`
        }
      })
      
      if (response.ok) {
        // Hapus dari state lokal seketika!
        setKajians(prev => prev.filter(k => k.id !== id))
        setDeletingId(null)
      } else {
        const resData = await response.json() as ApiResponse<null>
        alert(`Gagal menghapus: ${resData.error ?? 'Izin ditolak backend'}`)
      }
    } catch (err) {
      console.error('Gagal menghapus kajian:', err)
      alert('Gagal terhubung ke server untuk menghapus.')
    }
  }

  // Filter pencarian lokal untuk kenyamanan admin (search by materi atau pemateri)
  const filteredKajians = kajians.filter(k => 
    k.materi.toLowerCase().includes(searchTerm.toLowerCase()) || 
    k.pemateri.toLowerCase().includes(searchTerm.toLowerCase()) ||
    k.kota.toLowerCase().includes(searchTerm.toLowerCase())
  )





  const scrubMateri = (val: string) => cleanVisual(val, 'Materi|Tema|Judul|Kajian')
  const scrubPemateri = (val: string) => cleanVisual(val, 'Pemateri|Penceramah|Narasumber|Bersama|Oleh')

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Filter & Search Command Center */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-card border border-border/50 rounded-3xl p-5 shadow-lg">
        <div className="relative w-full sm:max-w-md group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
          <input 
            type="text"
            placeholder="Cari materi, pemateri, atau kota..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-11 pl-11 pr-4 bg-background border border-border rounded-2xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
          />
        </div>
        
        <Button 
          variant="outline" 
          onClick={() => void fetchKajianData()}
          className="h-11 rounded-2xl text-xs font-bold flex items-center gap-2 w-full sm:w-auto shrink-0 border-border hover:bg-secondary"
        >
          <RefreshCcw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Sinkron Data
        </Button>
      </div>

      {/* MAIN CONTAINER: Interactive List of Records */}
      <div className="bg-card border border-border/50 rounded-[32px] overflow-hidden shadow-2xl shadow-black/5">
        
        {loading && kajians.length === 0 ? (
          /* Loading Skeleton Shimmer */
          <div className="p-12 flex flex-col items-center justify-center text-center space-y-3">
            <RefreshCcw className="h-8 w-8 text-primary animate-spin" />
            <p className="text-xs font-bold text-muted-foreground tracking-wider uppercase animate-pulse">Menarik Database Kajian...</p>
          </div>
        ) : filteredKajians.length === 0 ? (
          /* Empty Results State */
          <div className="p-16 flex flex-col items-center justify-center text-center space-y-4">
            <div className="h-16 w-16 rounded-full bg-accent flex items-center justify-center text-muted-foreground/60 shadow-inner">
              <AlertCircle className="h-7 w-7" />
            </div>
            <div>
              <h4 className="text-sm font-black text-foreground">Tidak Ada Jadwal Ditemukan</h4>
              <p className="text-xs text-muted-foreground mt-1">Silakan sesuaikan kata kunci pencarian atau tambahkan kajian baru.</p>
            </div>
          </div>
        ) : (
          /* Render Modern Interactive Grid/Rows */
          <div className="divide-y divide-border/40">
            {filteredKajians.map((kajian) => {
              const isEditing = editingId === kajian.id
              const isDeleting = deletingId === kajian.id
              const hasPoster = !!kajian.poster_url

              return (
                <div 
                  key={kajian.id} 
                  className={`p-5 sm:p-6 transition-all duration-300 flex flex-col gap-4
                    ${isEditing ? 'bg-primary/5 border-l-4 border-l-primary animate-in slide-in-from-left-1' : 'hover:bg-secondary/30'}
                  `}
                >
                  {/* HEADER BARIS DATA */}
                  <div className="flex flex-col md:flex-row gap-4 justify-between">
                    
                    {/* Kiri: Thumbnail Mini & Info Rangkuman */}
                    <div className="flex gap-4 items-start flex-1">
                      {/* Mini Glass Thumbnail (Status Poster) */}
                      <div className="relative h-16 w-16 rounded-2xl overflow-hidden shrink-0 border border-border/80 bg-secondary flex items-center justify-center group">
                        {hasPoster ? (
                          <>
                            <img 
                              src={kajian.poster_url!} 
                              alt="Mini Poster" 
                              className="h-full w-full object-cover brightness-90 group-hover:scale-110 transition-transform duration-300"
                            />
                            <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <a href={kajian.poster_url!} target="_blank" rel="noreferrer">
                                <ExternalLink className="h-3.5 w-3.5 text-white" />
                              </a>
                            </div>
                          </>
                        ) : (
                          <div className="flex flex-col items-center text-muted-foreground/50">
                            <ImageIcon className="h-6 w-6" />
                            <span className="text-[8px] font-black uppercase mt-0.5">Polos</span>
                          </div>
                        )}
                      </div>

                      {/* Metadata Info Center */}
                      <div className="space-y-1 flex-1">
                        {isEditing ? (
                          /* Mode Input Judul saat Edit */
                          <div className="space-y-1">
                            <label className="text-[9px] font-extrabold tracking-widest text-primary uppercase">Materi Kajian</label>
                            <input 
                              type="text"
                              value={editMateri}
                              onChange={(e) => setEditMateri(e.target.value)}
                              className="w-full h-9 px-3 bg-background border border-border rounded-xl text-xs font-bold text-foreground focus:ring-2 focus:ring-primary/40 focus:outline-none transition-all"
                            />
                          </div>
                        ) : (
                          /* Display Mode */
                          <h4 className="text-sm font-extrabold text-foreground leading-snug line-clamp-2 hover:text-primary transition-colors">
                            {scrubMateri(kajian.materi)}
                          </h4>
                        )}

                        <div className="flex flex-wrap gap-x-4 gap-y-1.5 pt-1">
                          <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                            <User className="h-3 w-3" /> {scrubPemateri(kajian.pemateri)}
                          </span>
                          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                            <Calendar className="h-3 w-3" /> {formatDisplayDate(kajian.tanggal_masehi, true)}
                          </span>
                          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                            <MapPin className="h-3 w-3" /> {kajian.kota}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Kanan: Tombol Aksi Awal (Bila tidak sedang Hapus/Edit) */}
                    {!isEditing && !isDeleting && (
                      <div className="flex items-center gap-2 md:self-center shrink-0">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => startEdit(kajian)}
                          className="h-9 px-3.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border-border hover:bg-accent hover:text-primary"
                        >
                          <Edit3 className="h-3 w-3" />
                          Edit Poster
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => setDeletingId(kajian.id ?? null)}
                          className="h-9 w-9 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* ROW EXPANSION A: Mode Form Edit Poster & Upload */}
                  {isEditing && (
                    <div className="mt-1 pt-3 border-t border-dashed border-border space-y-4 animate-in slide-in-from-top-2 duration-300">
                      
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                        {/* Sisi Kiri: Direct Uploader Widget */}
                        <div className="space-y-2">
                          <label className="text-[9px] font-extrabold tracking-widest text-primary uppercase flex items-center gap-1.5 ml-1">
                            📁 Unggah File Poster Baru
                          </label>
                          <PosterUpload 
                            onUploadSuccess={(url) => setEditPosterUrl(url)}
                            currentUrl={editPosterUrl}
                          />
                        </div>

                        {/* Sisi Kanan: Link URL Manual Backup */}
                        <div className="space-y-2 flex flex-col justify-end">
                          <div className="bg-secondary/40 border border-border/60 rounded-2xl p-4 space-y-2 mt-auto">
                            <label className="text-[9px] font-extrabold tracking-widest text-muted-foreground uppercase flex items-center gap-1.5">
                              <ImageIcon className="h-3 w-3 text-primary" /> Atau Tempel Manual Tautan URL
                            </label>
                            <div className="flex gap-2">
                              <input 
                                type="url"
                                placeholder="https://link-poster.jpg"
                                value={editPosterUrl}
                                onChange={(e) => setEditPosterUrl(e.target.value)}
                                className="flex-1 h-9 px-3 text-xs font-medium rounded-xl border border-border bg-background focus:ring-1 focus:ring-primary focus:outline-none transition-all"
                              />
                              {editPosterUrl && (
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  onClick={() => setEditPosterUrl('')} 
                                  className="h-9 w-9 rounded-xl hover:bg-background border border-transparent hover:border-border"
                                >
                                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                                </Button>
                              )}
                            </div>
                            <p className="text-[9px] text-muted-foreground/80 italic font-medium pl-1">
                              Kolom URL ini otomatis terisi saat Anda berhasil mengunggah file di kolom kiri.
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/40">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={cancelEdit} 
                          disabled={updating}
                          className="h-9 px-4 text-xs font-bold rounded-xl hover:bg-accent"
                        >
                          Batal
                        </Button>
                        <Button 
                          size="sm" 
                          onClick={() => handleSaveUpdate(kajian.id!)} 
                          disabled={updating}
                          className="h-9 px-4 text-xs font-extrabold rounded-xl bg-foreground text-background hover:bg-foreground/90 shadow-lg flex items-center gap-1.5"
                        >
                          {updating ? (
                            <>
                              <RefreshCcw className="h-3 w-3 animate-spin" />
                              Menyimpan...
                            </>
                          ) : (
                            <>
                              <Check className="h-3.5 w-3.5" />
                              Simpan Perubahan
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* ROW EXPANSION B: Panel Konfirmasi Penghapusan yang Aman */}
                  {isDeleting && (
                    <div className="mt-1 p-4 bg-destructive/5 border border-destructive/20 rounded-2xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 animate-in zoom-in-95 duration-300">
                      <div className="flex items-center gap-2 text-destructive text-xs font-bold">
                        <AlertTriangle className="h-4 w-4 shrink-0" />
                        <span>Yakin menghapus data ini secara permanen?</span>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => setDeletingId(null)}
                          className="h-8 rounded-xl text-[11px] font-bold text-muted-foreground hover:bg-accent"
                        >
                          Batal
                        </Button>
                        <Button 
                          variant="destructive" 
                          size="sm"
                          onClick={() => void handleDelete(kajian.id!)}
                          className="h-8 rounded-xl text-[11px] font-extrabold bg-destructive text-white hover:bg-destructive/90 flex items-center gap-1"
                        >
                          <Trash2 className="h-3 w-3" />
                          Ya, Hapus!
                        </Button>
                      </div>
                    </div>
                  )}

                </div>
              )
            })}
          </div>
        )}
      </div>

    </div>
  )
}
