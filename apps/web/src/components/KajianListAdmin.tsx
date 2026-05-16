import { useState, useEffect } from 'react'
import type { Kajian, ApiResponse } from '@kajian-baru/types'
import { Button } from './ui/button'
import { 
  RefreshCcw, Trash2, Edit3, Image as ImageIcon, Check, X, AlertCircle, Calendar, 
  MapPin, User, ExternalLink, Search, AlertTriangle, FolderOpen, FileText, FileCheck, Ban, CheckCircle2, Sparkles
} from 'lucide-react'

import { PosterUpload } from './PosterUpload'
import { supabase } from '../lib/supabase'
import { cleanVisual, formatDisplayDate, splitTempatAddress } from '../lib/utils'
import { useToast } from '../hooks/use-toast'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from './ui/alert-dialog'

export function KajianListAdmin() {
  const { toast } = useToast()
  const [kajians, setKajians] = useState<Kajian[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  
  // 📂 SUB-TAB STATE: Pisahkan Draf dengan yang sudah Tayang!
  const [subTab, setSubTab] = useState<'draft' | 'published'>('draft')
  
  // 🗳️ SELECTION STATE: Untuk aksi massal (Bulk Action)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [bulkActionLoading, setBulkActionLoading] = useState(false)

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
    setSelectedIds([]) // Reset seleksi saat memuat ulang
    try {
      // Ambil 100 data terakhir dari database agar lapang
      const res = await fetch('/api/kajian?limit=100&include_unpublished=true')
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

  // 🧩 PARTISI DATA BERDASARKAN TABS
  const draftKajians = kajians.filter(k => !k.is_published)
  const publishedKajians = kajians.filter(k => k.is_published)

  const activeKajianList = subTab === 'draft' ? draftKajians : publishedKajians

  // Reset Pilihan Tiap Ganti Tab
  useEffect(() => {
    setSelectedIds([])
  }, [subTab])

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
        setKajians(prev => prev.map(k => k.id === id ? resData.data! : k))
        setEditingId(null)
        toast({
          variant: 'success',
          title: 'Berhasil Diperbarui',
          description: 'Poster kajian telah sukses diperbarui.'
        })
      } else {
        toast({
          variant: 'destructive',
          title: 'Gagal Memperbarui',
          description: resData.error ?? 'Masalah internal API'
        })
      }
    } catch (err) {
      console.error('Gagal mengupdate kajian:', err)
      toast({
        variant: 'destructive',
        title: 'Kesalahan Sistem',
        description: 'Terjadi kegagalan koneksi API.'
      })
    } finally {
      setUpdating(false)
    }
  }

  // Eksekusi Hapus Data (DELETE)
  const handleDelete = async (id: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      const response = await fetch(`/api/kajian/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token ?? ''}`
        }
      })
      
      if (response.ok) {
        setKajians(prev => prev.filter(k => k.id !== id))
        setDeletingId(null)
        toast({
          variant: 'success',
          title: 'Kajian Dihapus',
          description: 'Kajian telah dihapus dari arsip data.'
        })
      } else {
        const resData = await response.json() as ApiResponse<null>
        toast({
          variant: 'destructive',
          title: 'Gagal Menghapus',
          description: resData.error ?? 'Izin ditolak backend'
        })
      }
    } catch (err) {
      console.error('Gagal menghapus kajian:', err)
      toast({
        variant: 'destructive',
        title: 'Kesalahan Sistem',
        description: 'Gagal terhubung ke server untuk menghapus.'
      })
    }
  }

  // Menerbitkan draf AMAN (Menggunakan Engine Duplikasi Backend)
  const handlePublishNow = async (id: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      const response = await fetch('/api/kajian/bulk-publish', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token ?? ''}`
        },
        body: JSON.stringify({ ids: [id] }),
      })

      const resData = await response.json()

      if (response.ok && resData.success) {
        const { published, skippedDuplicates } = resData.data
        
        if (skippedDuplicates > 0) {
          toast({
            variant: 'destructive',
            title: 'Duplikat Terdeteksi!',
            description: 'Gagal terbit! Kajian yang sama persis (Tanggal + Tempat + Waktu) sudah tayang di website.'
          })
        } else if (published > 0) {
          setKajians(prev => prev.map(k => k.id === id ? { ...k, is_published: true } : k))
          toast({
            variant: 'success',
            title: 'Berhasil Dipublikasikan',
            description: 'Kajian sekarang telah tayang live di halaman utama!'
          })
        }
      } else {
        toast({
          variant: 'destructive',
          title: 'Gagal Mempublikasikan',
          description: resData.error ?? 'Terjadi kegagalan API.'
        })
      }
    } catch (err) {
      console.error('Gagal mempublikasikan kajian:', err)
      toast({
        variant: 'destructive',
        title: 'Kesalahan Sistem',
        description: 'Gagal terhubung ke server.'
      })
    }
  }

  // ⚡ METODE SELEKSI MASSAL (Bulk selection toggle handlers)
  const toggleSelectAll = (visibleIds: string[]) => {
    if (selectedIds.length === visibleIds.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(visibleIds)
    }
  }

  const toggleSelectOne = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  const toggleSelectBatch = (batchId: string | undefined, visibleKajians: Kajian[]) => {
    if (!batchId) return
    const batchIds = visibleKajians.filter(k => k.batch_id === batchId).map(k => k.id!)
    
    // Check if ALL items in this batch are already selected
    const allSelected = batchIds.every(id => selectedIds.includes(id))
    
    if (allSelected) {
      // Unselect this batch
      setSelectedIds(prev => prev.filter(id => !batchIds.includes(id)))
    } else {
      // Select this batch
      setSelectedIds(prev => {
        const newIds = new Set([...prev, ...batchIds])
        return Array.from(newIds)
      })
    }
  }

  // ⚡ EKSEKUSI MASAL BULK PUBLISH
  const handleBulkPublish = async () => {
    if (selectedIds.length === 0) return
    setBulkActionLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      const response = await fetch('/api/kajian/bulk-publish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token ?? ''}`
        },
        body: JSON.stringify({ ids: selectedIds })
      })

      const resData = await response.json()

      if (response.ok && resData.success) {
        const { published, skippedDuplicates, skippedIds } = resData.data
        
        // Pindahkan ke published dalam state lokal
        setKajians(prev => prev.map(k => 
          selectedIds.includes(k.id!) && !skippedIds.includes(k.id!)
            ? { ...k, is_published: true }
            : k
        ))
        
        setSelectedIds([])

        let desc = `Sukses menayangkan ${published} jadwal kajian.`
        if (skippedDuplicates > 0) {
          desc += ` Ada ${skippedDuplicates} kajian duplikat dilewati secara aman.`
        }

        toast({
          variant: skippedDuplicates > 0 ? 'destructive' : 'success',
          title: 'Proses Bulk Selesai',
          description: desc
        })
      } else {
        toast({ variant: 'destructive', title: 'Gagal Publish', description: resData.error ?? 'Koneksi putus.' })
      }
    } catch (err) {
      console.error('Bulk Publish error:', err)
    } finally {
      setBulkActionLoading(false)
    }
  }

  // ⚡ EKSEKUSI MASAL BULK DELETE
  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return
    
    setBulkActionLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      await Promise.all(selectedIds.map(id => 
        fetch(`/api/kajian/${id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token ?? ''}` }
        })
      ))

      setKajians(prev => prev.filter(k => !selectedIds.includes(k.id!)))
      setSelectedIds([])

      toast({
        variant: 'success',
        title: 'Berhasil Dihapus',
        description: 'Data terpilih telah bersih dari database.'
      })
    } catch (err) {
      console.error('Bulk Delete error:', err)
      toast({ variant: 'destructive', title: 'Terjadi Eror', description: 'Sebagian data mungkin gagal dihapus.' })
    } finally {
      setBulkActionLoading(false)
    }
  }

  // Filter pencarian lokal pada partisi aktif!
  const filteredKajians = activeKajianList.filter(k => 
    k.materi.toLowerCase().includes(searchTerm.toLowerCase()) || 
    k.pemateri.toLowerCase().includes(searchTerm.toLowerCase()) ||
    k.kota.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const scrubMateri = (val: string) => cleanVisual(val, 'Materi|Tema|Judul|Kajian')
  const scrubPemateri = (val: string) => cleanVisual(val, 'Pemateri|Penceramah|Narasumber|Bersama|Oleh')

  const allVisibleIds = filteredKajians.map(k => k.id!).filter(Boolean)

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* 🗂️ SUB-TAB ARCHIVE NAVIGATION (Draf vs Tayang!) */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-1">
        <div className="flex items-center gap-1.5 bg-secondary/40 border border-border/50 p-1 rounded-xl self-start shadow-sm">
          <button
            onClick={() => setSubTab('draft')}
            className={`flex items-center gap-2 px-3.5 py-1.5 text-[11px] font-black tracking-wider uppercase rounded-lg transition-all duration-200
              ${subTab === 'draft' 
                ? 'bg-background text-yellow-600 dark:text-yellow-400 shadow-sm border border-border/50 scale-100' 
                : 'text-muted-foreground hover:text-foreground'
              }
            `}
          >
            <FileText className="h-3.5 w-3.5" />
            Draf Antrian
            <span className={`inline-flex items-center justify-center px-1.5 py-0.5 text-[9px] rounded-md font-black ${
              subTab === 'draft' ? 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400' : 'bg-muted text-muted-foreground'
            }`}>
              {draftKajians.length}
            </span>
          </button>

          <button
            onClick={() => setSubTab('published')}
            className={`flex items-center gap-2 px-3.5 py-1.5 text-[11px] font-black tracking-wider uppercase rounded-lg transition-all duration-200
              ${subTab === 'published' 
                ? 'bg-background text-emerald-600 dark:text-emerald-400 shadow-sm border border-border/50 scale-100' 
                : 'text-muted-foreground hover:text-foreground'
              }
            `}
          >
            <FileCheck className="h-3.5 w-3.5" />
            Sudah Tayang
            <span className={`inline-flex items-center justify-center px-1.5 py-0.5 text-[9px] rounded-md font-black ${
              subTab === 'published' ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-muted text-muted-foreground'
            }`}>
              {publishedKajians.length}
            </span>
          </button>
        </div>

        <Button 
          variant="outline" 
          size="sm"
          onClick={() => void fetchKajianData()}
          disabled={loading}
          className="h-9 rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0 border-border shadow-sm"
        >
          <RefreshCcw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
          Refresh Database
        </Button>
      </div>

      {/* Filter & Search Bar Container */}
      <div className="flex flex-col sm:flex-row gap-3 bg-card border border-border/50 rounded-2xl p-4 shadow-md relative z-20">
        <div className="relative flex-1 group">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground group-focus-within:text-primary transition-colors" />
          <input 
            type="text"
            placeholder={`Cari di dalam daftar ${subTab === 'draft' ? 'draf' : 'arsip'}...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-10 pl-10 pr-4 bg-background border border-border rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
          />
        </div>
      </div>

      {/* ⚡ FLOATING BULK ACTION COMMAND CENTER (Hanya muncul saat ada seleksi!) */}
      {selectedIds.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-emerald-950/90 to-emerald-900/90 border border-emerald-500/30 text-white px-5 py-3.5 rounded-2xl shadow-2xl animate-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center">
              <span className="text-xs font-extrabold text-emerald-300">{selectedIds.length}</span>
            </div>
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-200">Tindakan Massal Aktif</p>
              <p className="text-[10px] text-emerald-400 font-medium mt-0.5">{selectedIds.length} Kajian terpilih di antrian.</p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              disabled={bulkActionLoading}
              onClick={() => setSelectedIds([])}
              className="h-8 px-3.5 text-[10px] font-bold text-emerald-200 hover:text-white hover:bg-white/5 rounded-lg"
            >
              Batal
            </Button>

            {subTab === 'draft' && (
              <Button
                variant="default"
                size="sm"
                disabled={bulkActionLoading}
                onClick={() => void handleBulkPublish()}
                className="h-8 px-4 text-[10px] font-black bg-emerald-500 hover:bg-emerald-400 text-emerald-950 rounded-lg flex items-center gap-1.5 transition-transform active:scale-95 shadow-lg shadow-emerald-950/30"
              >
                {bulkActionLoading ? (
                  <RefreshCcw className="h-3 w-3 animate-spin" />
                ) : (
                  <Check className="h-3 w-3" />
                )}
                Publish Massal ({selectedIds.length})
              </Button>
            )}

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={bulkActionLoading}
                  className="h-8 px-4 text-[10px] font-black bg-red-600/90 hover:bg-red-500 text-white rounded-lg flex items-center gap-1.5 shadow-lg shadow-red-950/20 active:scale-95 transition-transform"
                >
                  <Trash2 className="h-3 w-3" />
                  Hapus ({selectedIds.length})
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="glass max-w-[380px] border-red-500/20">
                <AlertDialogHeader className="space-y-3 flex flex-col items-center text-center">
                  <div className="h-12 w-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 shadow-inner">
                    <AlertTriangle className="h-6 w-6" />
                  </div>
                  <div className="space-y-1.5">
                    <AlertDialogTitle className="text-center text-base font-black text-foreground">
                      Konfirmasi Hapus Massal
                    </AlertDialogTitle>
                    <AlertDialogDescription className="text-center text-[11px] font-medium leading-relaxed">
                      Apakah Anda yakin ingin menghapus secara permanen <span className="font-black text-foreground underline underline-offset-2 decoration-red-500">{selectedIds.length} data kajian</span> terpilih sekaligus? Tindakan ini bersifat final.
                    </AlertDialogDescription>
                  </div>
                </AlertDialogHeader>
                <AlertDialogFooter className="mt-3 flex !flex-row gap-3 sm:justify-center">
                  <AlertDialogCancel className="flex-1 h-9 mt-0 text-[10px] font-black tracking-wider uppercase rounded-xl border-border hover:bg-secondary">
                    Batal
                  </AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={() => void handleBulkDelete()}
                    className="flex-1 h-9 text-[10px] font-black tracking-wider uppercase rounded-xl bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-500/20 active:scale-95 transition-transform"
                  >
                    Hapus Permanen
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      )}

      {/* MAIN CONTAINER: Interactive List of Records */}
      <div className="bg-card border border-border/50 rounded-[32px] overflow-hidden shadow-2xl shadow-black/5">
        
        {loading && kajians.length === 0 ? (
          <div className="p-12 flex flex-col items-center justify-center text-center space-y-3">
            <RefreshCcw className="h-8 w-8 text-primary animate-spin" />
            <p className="text-xs font-bold text-muted-foreground tracking-wider uppercase animate-pulse">Menarik Database Kajian...</p>
          </div>
        ) : filteredKajians.length === 0 ? (
          <div className="p-16 flex flex-col items-center justify-center text-center space-y-4">
            <div className="h-16 w-16 rounded-full bg-accent flex items-center justify-center text-muted-foreground/60 shadow-inner">
              <AlertCircle className="h-7 w-7" />
            </div>
            <div>
              <h4 className="text-sm font-black text-foreground">Tidak Ada Jadwal Ditemukan</h4>
              <p className="text-xs text-muted-foreground mt-1">
                {searchTerm ? 'Sesuaikan filter pencarian Anda.' : `Tidak ada data di folder ${subTab === 'draft' ? 'Draf Antrian' : 'Tayang Live'}.`}
              </p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-border/40 flex flex-col">
            
            {/* HEADER ROW SELECTION CONTROL */}
            <div className="px-5 sm:px-6 py-3.5 bg-secondary/20 flex items-center border-b border-border/40">
              <div className="flex items-center gap-3 select-none">
                <input
                  type="checkbox"
                  id="bulk-select-all"
                  className="h-4 w-4 rounded-md accent-primary border-border hover:scale-105 transition-transform cursor-pointer"
                  checked={allVisibleIds.length > 0 && selectedIds.length === allVisibleIds.length}
                  onChange={() => toggleSelectAll(allVisibleIds)}
                />
                <label htmlFor="bulk-select-all" className="text-[10px] font-black tracking-wider text-muted-foreground uppercase cursor-pointer">
                  Pilih Semua Tampilan ({filteredKajians.length})
                </label>
              </div>
            </div>

            {/* Render Rows */}
            {filteredKajians.map((kajian) => {
              const isEditing = editingId === kajian.id
              const isDeleting = deletingId === kajian.id
              const hasPoster = !!kajian.poster_url
              const isChecked = selectedIds.includes(kajian.id!)

              return (
                <div 
                  key={kajian.id} 
                  className={`p-5 sm:p-6 transition-all duration-300 flex flex-row gap-4 sm:gap-5
                    ${isEditing ? 'bg-primary/5 border-l-4 border-l-primary' : isChecked ? 'bg-primary/5' : 'hover:bg-secondary/20'}
                  `}
                >
                  {/* LEFT: Row Checkbox Multi-Select Selector */}
                  <div className="pt-1.5 sm:pt-1 shrink-0 flex flex-col items-center">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleSelectOne(kajian.id!)}
                      className="h-4 w-4 rounded-md border-border accent-primary hover:scale-105 transition-transform cursor-pointer mt-1"
                    />
                    {kajian.batch_id && (
                      <button
                        onClick={() => toggleSelectBatch(kajian.batch_id, filteredKajians)}
                        className="text-[8px] font-black uppercase text-primary/70 hover:text-primary mt-2 select-none"
                        title="Pilih semua data dari batch ini"
                      >
                        Pilih Batch
                      </button>
                    )}
                  </div>

                  {/* RIGHT: Record Content Box */}
                  <div className="flex-1 flex flex-col gap-4">
                    <div className="flex flex-col md:flex-row gap-4 justify-between">
                      
                      {/* Kiri: Thumbnail Mini & Info Rangkuman */}
                      <div className="flex gap-4 items-start flex-1">
                        {/* Mini Glass Thumbnail */}
                        <div className="relative h-16 w-16 rounded-2xl overflow-hidden shrink-0 border border-border bg-secondary flex items-center justify-center group shadow-inner">
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
                          {/* Dynamic Status Badges */}
                          <div className="flex flex-wrap gap-1.5 pb-0.5">
                            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground mr-1.5">
                              <Calendar className="h-3 w-3 text-primary" />
                              {formatDisplayDate(kajian.tanggal_masehi, true)}
                            </span>
                            {kajian.is_cancelled && (
                              <span className="inline-flex items-center rounded-md bg-red-500/15 px-2 py-0.5 text-[9px] font-black tracking-wider text-red-600 dark:text-red-400 uppercase border border-red-500/20 shadow-inner">
                                <Ban className="mr-1 h-2.5 w-2.5" /> {/batal/i.test(kajian.source_text || kajian.materi || '') ? 'Dibatalkan' : 'Diliburkan'}
                              </span>
                            )}
                            {!kajian.is_published ? (
                              <span className="inline-flex items-center rounded-md bg-yellow-500/15 px-2 py-0.5 text-[9px] font-black tracking-wider text-yellow-700 dark:text-yellow-400 uppercase border border-yellow-500/20">
                                <FileText className="mr-1 h-2.5 w-2.5" /> Draft Pending
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded-md bg-emerald-500/15 px-2 py-0.5 text-[9px] font-black tracking-wider text-emerald-600 dark:text-emerald-400 uppercase border border-emerald-500/20">
                                <CheckCircle2 className="mr-1 h-2.5 w-2.5" /> Published
                              </span>
                            )}
                          </div>

                          {isEditing ? (
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
                            <h4 className="text-sm font-extrabold text-foreground leading-snug line-clamp-2">
                              {kajian.is_cancelled && !/batal|libur/i.test(kajian.materi) ? (/batal/i.test(kajian.source_text || '') ? '(Kajian Dibatalkan)' : '(Kajian Diliburkan)') : scrubMateri(kajian.materi)}
                            </h4>
                          )}

                          <div className="flex flex-wrap gap-x-4 gap-y-1.5 pt-1">
                            {scrubPemateri(kajian.pemateri).trim() && scrubPemateri(kajian.pemateri).trim() !== '-' && (
                              <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                <User className="h-3 w-3" /> {scrubPemateri(kajian.pemateri)}
                              </span>
                            )}

                            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                              <MapPin className="h-3 w-3" /> {splitTempatAddress(kajian.tempat).cleanTempat} &middot; {kajian.kota}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Kanan: Action Toolbar */}
                      {!isEditing && !isDeleting && (
                        <div className="flex items-center gap-2 md:self-center shrink-0">
                          {!kajian.is_published && (
                            <Button 
                              variant="default" 
                              size="sm"
                              onClick={() => void handlePublishNow(kajian.id!)}
                              className="h-9 px-3.5 rounded-xl text-xs font-black flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white active:scale-95 shadow-md shadow-emerald-600/20"
                            >
                              <Check className="h-3.5 w-3.5" />
                              Publish
                            </Button>
                          )}
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

                    {/* Expansion A: Edit Panel */}
                    {isEditing && (
                      <div className="pt-3 border-t border-dashed border-border space-y-4">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                          <div className="space-y-2">
                            <label className="text-[9px] font-extrabold tracking-widest text-primary uppercase flex items-center gap-1.5 ml-1">
                              <FolderOpen className="h-3 w-3" /> Unggah File Poster Baru
                            </label>
                            <PosterUpload 
                              onUploadSuccess={(url) => setEditPosterUrl(url)}
                              currentUrl={editPosterUrl}
                            />
                          </div>

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
                                    className="h-9 w-9 rounded-xl hover:bg-background"
                                  >
                                    <X className="h-3.5 w-3.5 text-muted-foreground" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/40">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={cancelEdit} 
                            disabled={updating}
                            className="h-9 px-4 text-xs font-bold rounded-xl"
                          >
                            Batal
                          </Button>
                          <Button 
                            size="sm" 
                            onClick={() => void handleSaveUpdate(kajian.id!)} 
                            disabled={updating}
                            className="h-9 px-4 text-xs font-extrabold rounded-xl bg-foreground text-background hover:bg-foreground/90 shadow-lg flex items-center gap-1.5"
                          >
                            {updating ? <RefreshCcw className="h-3 w-3 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                            Simpan
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Expansion B: Deletion Safety Bar */}
                    {isDeleting && (
                      <div className="p-4 bg-destructive/5 border border-destructive/20 rounded-2xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 animate-in zoom-in-95">
                        <div className="flex items-center gap-2 text-destructive text-xs font-bold">
                          <AlertTriangle className="h-4 w-4 shrink-0" />
                          <span>Yakin menghapus data ini secara permanen?</span>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => setDeletingId(null)}
                            className="h-8 rounded-xl text-[11px] font-bold text-muted-foreground"
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
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
