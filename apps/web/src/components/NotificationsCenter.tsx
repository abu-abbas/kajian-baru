import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Bell, BellOff, Check, X, ArrowUpRight, CheckCheck, Loader2, MapPin, Calendar } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { DbNotification, Kajian } from '@kajian-baru/types'
import { useAuth } from '../hooks/use-auth'
import { Button } from './ui/button'

type NotificationsCenterProps = {
  pushEnabled: boolean
  onTogglePush: () => Promise<void>
  onSelectKajian: (kajian: Kajian) => void
}

export function NotificationsCenter({ pushEnabled, onTogglePush, onSelectKajian }: NotificationsCenterProps) {
  const { user } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [isAllOpen, setIsAllOpen] = useState(false)
  
  const [notifications, setNotifications] = useState<DbNotification[]>([])
  const [allNotifications, setAllNotifications] = useState<DbNotification[]>([])
  const [loadingAll, setLoadingAll] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  
  const dropdownRef = useRef<HTMLDivElement>(null)

  // 📡 1. PULL INITIAL LATEST 5 + COUNT
  const fetchLatest = async () => {
    if (!user) return
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const res = await fetch('/api/push/notifications?limit=5', {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      })
      const data = await res.json()
      if (data.success && data.data) {
        setNotifications(data.data)
        
        // Hitung unread
        const unreadRes = await supabase
          .from('notifications')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('read', false)
        
        setUnreadCount(unreadRes.count || 0)
      }
    } catch (err) {
      console.warn('⚠️ Gagal memuat notifikasi:', err)
    }
  }

  useEffect(() => {
    void fetchLatest()
  }, [user])

  // 📡 2. REALTIME LISTENER: Tangkap notif baru di latar belakang!
  useEffect(() => {
    if (!user) return

    const channel = supabase
      .channel(`realtime-user-notifications-${user.id}`)
      .on(
        'postgres_changes',
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'notifications', 
          filter: `user_id=eq.${user.id}` 
        },
        () => {
          // Ada notifikasi baru untuk user ini! Muat ulang & bunyikan lonceng visual
          void fetchLatest()
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [user])

  // 🧹 3. TUTUP DROPDOWN JIKA KLIK DI LUAR
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // 🏷️ 4. TANDAI DIBACA SEMUA ATAU SPESIFIK
  const handleMarkRead = async (notifId?: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      // Optimistic local update
      if (notifId) {
        setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, read: true } : n))
        setUnreadCount(prev => Math.max(0, prev - 1))
      } else {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })))
        setUnreadCount(0)
      }

      await fetch('/api/push/notifications/mark-read', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}` 
        },
        body: JSON.stringify({ notification_id: notifId })
      })
    } catch (err) {
      console.warn('⚠️ Gagal menandai dibaca:', err)
    }
  }

  // 🔍 5. KLIK ITEM NOTIF: TANDAI BACA & BUKA DETAIL KAJIAN
  const handleItemClick = async (notif: DbNotification) => {
    setIsOpen(false)
    setIsAllOpen(false)
    
    if (!notif.read) {
      void handleMarkRead(notif.id)
    }

    if (notif.kajian_id) {
      try {
        const { data } = await supabase
          .from('kajian')
          .select('*')
          .eq('id', notif.kajian_id)
          .maybeSingle()
        
        if (data) {
          onSelectKajian(data as Kajian)
        }
      } catch (err) {
        console.warn('⚠️ Gagal memuat data kajian terpilih:', err)
      }
    }
  }

  // 📑 6. LIHAT SEMUA: TARIK SELURUH RIWAYAT (Hingga 50)
  const handleOpenAll = async () => {
    setIsOpen(false)
    setIsAllOpen(true)
    setLoadingAll(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const res = await fetch('/api/push/notifications?limit=50', {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      })
      const data = await res.json()
      if (data.success && data.data) {
        setAllNotifications(data.data)
      }
    } catch (err) {
      console.warn('⚠️ Gagal memuat seluruh riwayat:', err)
    } finally {
      setLoadingAll(false)
    }
  }

  // 🎨 HELPER PARSER NOTIFIKASI: Konversi Unicode Emojis ke Lucide standard & parsing multiline!
  const renderNotificationBody = (bodyStr: string, isRead: boolean) => {
    const lines = bodyStr.split('\n')
    const cleanMateri = lines[0] ? lines[0].trim() : ''
    const cleanPlace = lines[1] ? lines[1].replace(/^📍\s*/, '').trim() : ''
    const cleanDate = lines[2] ? lines[2].replace(/^📅\s*/, '').trim() : ''

    return (
      <div className="space-y-1 mt-0.5">
        {cleanMateri && (
          <p className={`text-[11px] leading-relaxed ${!isRead ? 'text-foreground/90 font-extrabold dark:text-emerald-300' : 'text-muted-foreground/80 font-semibold'}`}>
            {cleanMateri}
          </p>
        )}
        
        <div className="flex flex-col gap-0.5 pt-0.5 overflow-hidden">
          {cleanPlace && (
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/80 shrink-0 overflow-hidden">
              <MapPin className="h-3 w-3 text-emerald-600 dark:text-emerald-500 shrink-0" />
              <span className="truncate">{cleanPlace}</span>
            </div>
          )}
          {cleanDate && (
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/80 shrink-0 overflow-hidden">
              <Calendar className="h-3 w-3 text-emerald-600 dark:text-emerald-500 shrink-0" />
              <span>{cleanDate}</span>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* 🔔 TOMBOL LONCENG UTAMA */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`relative p-2.5 rounded-full transition-all duration-300 active:scale-90 ${
          isOpen 
            ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 ring-2 ring-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.2)]' 
            : 'hover:bg-accent text-muted-foreground hover:text-emerald-600 dark:hover:text-emerald-300'
        }`}
        aria-label="Pusat Notifikasi"
      >
        {pushEnabled ? (
          <Bell className={`h-[20px] w-[20px] ${unreadCount > 0 ? 'animate-swing origin-top' : ''}`} />
        ) : (
          <BellOff className="h-[20px] w-[20px] opacity-50" />
        )}
        
        {/* 🔴 Lencana Angka Unread Count */}
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-rose-600 text-[9px] font-black text-white ring-2 ring-background shadow-lg animate-in zoom-in duration-200">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* 🌌 DYNAMIC THEMED DROPDOWN */}
      {isOpen && (
        <div className="absolute right-0 mt-3 w-80 origin-top-right bg-card dark:bg-[#060c08]/95 text-card-foreground backdrop-blur-2xl border border-border dark:border-emerald-500/20 rounded-2xl shadow-2xl dark:shadow-[#020503]/80 z-50 py-2 animate-in slide-in-from-top-3 duration-300 overflow-hidden">
          
          {/* Header Dropdown */}
          <div className="px-4 py-2.5 border-b border-border dark:border-emerald-500/10 flex items-center justify-between">
            <span className="text-xs font-black tracking-wider uppercase text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              Notifikasi
            </span>
            {unreadCount > 0 && (
              <button 
                onClick={() => handleMarkRead()}
                className="text-[10px] font-bold text-emerald-600 dark:text-emerald-500 hover:text-emerald-700 dark:hover:text-emerald-300 flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-emerald-500/10 transition-colors"
              >
                <CheckCheck className="h-3 w-3" /> Tandai Dibaca
              </button>
            )}
          </div>

          {/* List 5 Terakhir */}
          <div className="max-h-[340px] overflow-y-auto divide-y divide-border dark:divide-emerald-500/5 custom-scrollbar">
            {!user ? (
              <div className="px-6 py-10 text-center space-y-2">
                <BellOff className="h-8 w-8 mx-auto text-muted-foreground/60" />
                <p className="text-[11px] font-medium text-muted-foreground">Silakan login terlebih dahulu untuk mengaktifkan fitur notifikasi.</p>
              </div>
            ) : !pushEnabled ? (
              <div className="px-6 py-10 text-center space-y-3">
                <BellOff className="h-8 w-8 mx-auto text-rose-600/80 dark:text-rose-800/60" />
                <div className="space-y-1">
                  <p className="text-xs font-black uppercase text-rose-600 dark:text-rose-400 tracking-wide">Notifikasi Mati</p>
                  <p className="text-[10px] text-muted-foreground">Aktifkan tombol lonceng di bawah untuk berlangganan kajian favorit bos.</p>
                </div>
                <Button 
                  size="sm" 
                  onClick={() => { setIsOpen(false); void onTogglePush() }}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-[10px] font-black uppercase tracking-widest rounded-xl h-8 mt-2 text-white"
                >
                  Nyalakan Sekarang
                </Button>
              </div>
            ) : notifications.length === 0 ? (
              <div className="px-6 py-12 text-center space-y-2">
                <Bell className="h-8 w-8 mx-auto text-muted-foreground/40" />
                <p className="text-[11px] font-bold text-muted-foreground tracking-wide">Belum ada riwayat notifikasi.</p>
              </div>
            ) : (
              notifications.map((notif) => (
                <div 
                  key={notif.id}
                  onClick={() => handleItemClick(notif)}
                  className={`px-4 py-3 hover:bg-accent dark:hover:bg-emerald-500/[0.03] active:bg-accent/80 dark:active:bg-emerald-500/[0.06] transition-all cursor-pointer relative group flex gap-3 ${!notif.read ? 'bg-emerald-500/[0.04] dark:bg-emerald-500/[0.02]' : ''}`}
                >
                  {!notif.read && (
                    <span className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]" />
                  )}
                  
                  <div className="flex-1 space-y-0.5 overflow-hidden pl-1">
                    <p className={`text-xs truncate transition-colors group-hover:text-emerald-600 dark:group-hover:text-emerald-300 ${!notif.read ? 'font-black text-foreground' : 'font-semibold text-muted-foreground'}`}>
                      {notif.title.replace(/^📢\s*/, '')}
                    </p>
                    
                    {renderNotificationBody(notif.body, notif.read)}
                    
                    <p className="text-[9px] font-bold text-muted-foreground/60 dark:text-emerald-800 mt-1 flex items-center gap-1 pt-0.5 border-t border-border/20 dark:border-emerald-500/5 w-fit">
                      {new Date(notif.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
                    </p>
                  </div>
                  
                  {notif.kajian_id && (
                    <ArrowUpRight className="h-3 w-3 text-emerald-600 dark:text-emerald-700 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity translate-x-1 group-hover:translate-x-0 align-top mt-1" />
                  )}
                </div>
              ))
            )}
          </div>

          {/* 🛠️ FOOTER MULTI-FUNGSI */}
          {pushEnabled && user && (
            <div className="px-3 py-2 bg-muted/40 dark:bg-[#040905] border-t border-border dark:border-emerald-500/10 flex items-center justify-between text-[10px] mt-1 font-black uppercase tracking-widest">
              {/* KIRI: Stop Notifikasi */}
              <button 
                onClick={() => { setIsOpen(false); void onTogglePush() }}
                className="text-rose-600 dark:text-rose-500 hover:text-rose-500 hover:bg-rose-500/10 px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1"
              >
                <BellOff className="h-3 w-3" /> Nonaktifkan
              </button>

              {/* KANAN: Lihat Semua */}
              {notifications.length > 0 && (
                <button 
                  onClick={handleOpenAll}
                  className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 hover:bg-emerald-500/10 px-2.5 py-1.5 rounded-lg transition-colors"
                >
                  Lihat Semua
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* 🖥️ FULL DIALOG MODAL: LIHAT SEMUA RIWAYAT (Menggunakan Portal agar lepas dari jeratan sticky header!) */}
      {isAllOpen && createPortal(
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-8 animate-in fade-in duration-300">
          {/* Backdrop blur premium */}
          <div className="absolute inset-0 bg-background/80 dark:bg-[#020503]/80 backdrop-blur-md" onClick={() => setIsAllOpen(false)} />
          
          {/* Container Sheet (Diselaraskan dengan KajianDetailDialog, dengan penambahan padding & pembatasan tinggi agar tidak mentok di layar pendek!) */}
          <div className="relative bg-card dark:bg-[#060c08]/95 text-card-foreground border border-border dark:border-emerald-500/20 rounded-t-[36px] sm:rounded-[36px] shadow-2xl w-full sm:max-w-lg flex flex-col max-h-[90vh] sm:max-h-[75vh] overflow-hidden animate-in slide-in-from-bottom-12 duration-400 ease-out">
            
            {/* Header Dialog */}
            <div className="px-6 py-5 border-b border-border dark:border-emerald-500/10 flex items-center justify-between shrink-0 bg-card dark:bg-card/50 backdrop-blur-sm z-10">
              <div className="space-y-0.5">
                <h3 className="text-sm font-black tracking-wider uppercase text-foreground flex items-center gap-2.5">
                  <Bell className="h-4 w-4 text-emerald-600 dark:text-emerald-500 animate-swing origin-top" />
                  Riwayat Notifikasi
                </h3>
                <p className="text-[10px] font-medium text-muted-foreground">Menampilkan hingga 50 notifikasi terbaru bos.</p>
              </div>
              
              <button 
                onClick={() => setIsAllOpen(false)}
                className="h-8 w-8 rounded-full bg-muted dark:bg-emerald-950/40 border border-border dark:border-emerald-500/10 hover:bg-accent dark:hover:bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-500 active:scale-90 transition-all"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Content List */}
            <div className="flex-1 overflow-y-auto p-4 divide-y divide-border dark:divide-emerald-500/5 custom-scrollbar">
              {loadingAll ? (
                <div className="h-48 flex flex-col items-center justify-center gap-3">
                  <Loader2 className="h-6 w-6 text-emerald-600 dark:text-emerald-500 animate-spin" />
                  <p className="text-[11px] font-bold text-emerald-600 uppercase tracking-widest animate-pulse">Menarik Riwayat...</p>
                </div>
              ) : allNotifications.length === 0 ? (
                <div className="h-48 flex flex-col items-center justify-center text-center gap-2">
                  <Bell className="h-10 w-10 text-muted-foreground/30" />
                  <p className="text-xs font-bold text-muted-foreground">Tidak ada riwayat notifikasi tersimpan.</p>
                </div>
              ) : (
                allNotifications.map((notif) => (
                  <div 
                    key={notif.id}
                    onClick={() => handleItemClick(notif)}
                    className={`p-4 hover:bg-accent dark:hover:bg-emerald-500/[0.03] active:bg-accent/80 dark:active:bg-emerald-500/[0.05] transition-all cursor-pointer flex gap-4 group rounded-xl my-0.5 border border-transparent hover:border-border dark:hover:border-emerald-500/10 ${!notif.read ? 'bg-emerald-500/[0.04] dark:bg-emerald-500/[0.02]' : ''}`}
                  >
                    <div className="h-10 w-10 rounded-xl bg-muted dark:bg-emerald-950/30 border border-border dark:border-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-500 group-hover:scale-105 group-hover:bg-accent dark:group-hover:bg-emerald-500/10 transition-all shrink-0">
                      {notif.read ? <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-600" /> : <Bell className="h-4 w-4 text-emerald-600 dark:text-emerald-400 animate-swing origin-top" />}
                    </div>

                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-start justify-between gap-2 border-b border-border/20 dark:border-emerald-500/5 pb-1 mb-1">
                        <p className={`text-xs ${!notif.read ? 'font-black text-foreground' : 'font-bold text-muted-foreground'}`}>
                          {notif.title.replace(/^📢\s*/, '')}
                        </p>
                        <span className="text-[9px] font-black tracking-widest uppercase text-muted-foreground/70 shrink-0 pt-0.5">
                          {new Date(notif.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                        </span>
                      </div>
                      
                      {renderNotificationBody(notif.body, notif.read)}
                    </div>
                  </div>
                ))
              )}
            </div>
            
            {/* Action Footer */}
            {allNotifications.some(n => !n.read) && (
              <div className="p-4 border-t border-border dark:border-emerald-500/10 bg-muted/40 dark:bg-[#040905]/50 shrink-0 z-10">
                <Button
                  className="w-full bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-950/50 dark:hover:bg-emerald-950 border border-transparent dark:border-emerald-500/20 text-white dark:text-emerald-300 text-xs font-black tracking-widest uppercase h-10 rounded-2xl"
                  onClick={async () => {
                    await handleMarkRead()
                    setAllNotifications(prev => prev.map(n => ({ ...n, read: true })))
                  }}
                >
                  <CheckCheck className="h-3.5 w-3.5 mr-2" /> Tandai Semua Dibaca
                </Button>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
