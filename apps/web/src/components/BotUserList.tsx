import { useState, useEffect } from 'react'
import { Button } from './ui/button'
import type { BotUser } from '@kajian-baru/types'
import { UserCheck, UserX, Trash2, Loader2, Bot, Clock, CheckCircle2, XCircle, RefreshCw, AlertTriangle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog'

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession()
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session?.access_token ?? ''}`,
  }
}

export function BotUserList() {
  const [users, setUsers] = useState<BotUser[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<number | null>(null)
  const [userToDelete, setUserToDelete] = useState<number | null>(null)

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const headers = await getAuthHeaders()
      const res = await fetch('/api/admin/bot-users', { headers })
      const data = await res.json() as { success: boolean; data: BotUser[] | null }
      if (data.success && data.data) {
        setUsers(data.data)
      }
    } catch (err) {
      console.error('Gagal memuat daftar bot users:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchUsers()
  }, [])

  const handleUpdateStatus = async (telegramId: number, status: 'approved' | 'rejected') => {
    setActionLoading(telegramId)
    try {
      const headers = await getAuthHeaders()
      await fetch(`/api/admin/bot-users/${String(telegramId)}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ status }),
      })
      await fetchUsers()
    } catch (err) {
      console.error('Gagal mengubah status:', err)
    } finally {
      setActionLoading(null)
    }
  }

  const handleDelete = async (telegramId: number) => {
    setActionLoading(telegramId)
    try {
      const headers = await getAuthHeaders()
      await fetch(`/api/admin/bot-users/${String(telegramId)}`, { method: 'DELETE', headers })
      await fetchUsers()
    } catch (err) {
      console.error('Gagal menghapus user:', err)
    } finally {
      setActionLoading(null)
      setUserToDelete(null)
    }
  }

  const statusConfig = {
    pending: { label: 'Menunggu', icon: Clock, color: 'text-amber-500 bg-amber-500/10 border-amber-500/20' },
    approved: { label: 'Disetujui', icon: CheckCircle2, color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' },
    rejected: { label: 'Ditolak', icon: XCircle, color: 'text-red-500 bg-red-500/10 border-red-500/20' },
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-3">
        <div className="h-8 w-8 border-4 border-t-primary border-emerald-950/30 rounded-full animate-spin" />
        <span className="text-xs text-muted-foreground font-medium">Memuat daftar pengguna bot...</span>
      </div>
    )
  }

  if (users.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center space-y-4 rounded-2xl border border-dashed border-border bg-card/30 px-6">
        <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
          <Bot className="h-7 w-7" />
        </div>
        <div className="space-y-1.5">
          <p className="text-sm font-bold text-foreground">Belum Ada Pengguna Bot</p>
          <p className="text-xs text-muted-foreground max-w-[260px] mx-auto">
            Pengguna akan muncul di sini setelah mereka mengirim /start ke bot Telegram.
          </p>
        </div>
      </div>
    )
  }

  const pendingCount = users.filter(u => u.status === 'pending').length
  const userObjectToDelete = users.find(u => u.telegram_id === userToDelete)

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
            {String(users.length)} pengguna terdaftar
          </span>
          {pendingCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20 text-[10px] font-black">
              {String(pendingCount)} menunggu
            </span>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={() => void fetchUsers()} className="text-xs gap-1.5 h-8 rounded-lg">
          <RefreshCw className="h-3 w-3" />
          Refresh
        </Button>
      </div>

      {/* User cards */}
      <div className="grid gap-3">
        {users.map((user) => {
          const cfg = statusConfig[user.status]
          const StatusIcon = cfg.icon
          const isLoading = actionLoading === user.telegram_id

          return (
            <div
              key={user.telegram_id}
              className="flex items-center justify-between gap-3 p-4 rounded-2xl border border-border/60 bg-card/50 backdrop-blur-sm hover:bg-card/80 transition-all duration-200"
            >
              {/* Left: User info */}
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/10 shrink-0">
                  <Bot className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-foreground truncate">{user.full_name || 'Tanpa Nama'}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {user.telegram_username && (
                      <span className="text-[11px] text-muted-foreground font-medium">@{user.telegram_username}</span>
                    )}
                    <span className="text-[10px] text-muted-foreground/60 font-mono">{String(user.telegram_id)}</span>
                  </div>
                </div>
              </div>

              {/* Right: Status + Actions */}
              <div className="flex items-center gap-2 shrink-0">
                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[10px] font-black uppercase tracking-wider ${cfg.color}`}>
                  <StatusIcon className="h-3 w-3" />
                  {cfg.label}
                </span>

                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : (
                  <div className="flex items-center gap-1">
                    {user.status !== 'approved' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => void handleUpdateStatus(user.telegram_id, 'approved')}
                        title="Setujui"
                        className="h-8 w-8 rounded-lg text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-500"
                      >
                        <UserCheck className="h-4 w-4" />
                      </Button>
                    )}
                    {user.status !== 'rejected' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => void handleUpdateStatus(user.telegram_id, 'rejected')}
                        title="Tolak"
                        className="h-8 w-8 rounded-lg text-red-600 hover:bg-red-500/10 hover:text-red-500"
                      >
                        <UserX className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setUserToDelete(user.telegram_id)}
                      title="Hapus"
                      className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Modern Glassmorphism Confirmation Dialog */}
      <AlertDialog open={userToDelete !== null} onOpenChange={(open) => !open && setUserToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="h-12 w-12 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mb-2">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <AlertDialogTitle>Konfirmasi Hapus Pengguna</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus <strong className="text-foreground">{userObjectToDelete?.full_name || 'user ini'}</strong> dari daftar bot? 
              Aksi ini tidak dapat dibatalkan dan user tersebut harus mendaftar ulang jika ingin mengirim kajian lagi.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-2">
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => userToDelete && void handleDelete(userToDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-md shadow-destructive/10"
            >
              Ya, Hapus User
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
