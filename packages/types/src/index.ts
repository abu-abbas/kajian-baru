// ============================================================
// @kajian-baru/types — All shared types for KajianBaru
// ============================================================

/**
 * Audience target untuk kajian
 */
export type Audience = 'UMUM' | 'IKHWAN' | 'AKHWAT' | 'ANAK'

/**
 * Konfigurasi gradient untuk KajianCard tanpa poster
 */
export type GradientConfig = {
  from: string
  to: string
  angle: number
}

/**
 * Kajian — data satu kajian yang sudah diparsing
 */
export type Kajian = {
  id?: string
  kota: string
  tanggal_masehi: string
  tanggal_hijriyah: string
  materi: string
  pemateri: string
  waktu_mulai: string
  waktu_selesai: string
  tempat: string
  alamat: string
  maps_url: string
  kontak: string
  audience: Audience
  poster_url: string | null
  gradient_config: GradientConfig
  source_text: string
  himbauan?: string
  kontributor?: string
  htm?: string
  registrasi?: string
  is_cancelled: boolean
  is_published: boolean
  batch_id?: string
  created_at?: string
  updated_at?: string
}

/**
 * Hasil dari parsing satu pesan
 */
export type ParseResult = {
  success: boolean
  kajian_list: Kajian[]
  errors: ParseError[]
  raw_text: string
}

/**
 * Error detail saat parsing gagal untuk satu blok
 */
export type ParseError = {
  block_index: number
  message: string
  raw_block: string
}

/**
 * User preferences untuk notifikasi dan filter
 */
export type UserPreference = {
  id?: string
  user_id: string
  kota_list: string[]
  audience_filter: Audience[]
  push_enabled: boolean
  push_subscription: PushSubscriptionData | null
  created_at?: string
  updated_at?: string
}

/**
 * Push subscription data dari Web Push API
 */
export type PushSubscriptionData = {
  endpoint: string
  keys: {
    p256dh: string
    auth: string
  }
}

/**
 * Admin user — verified against admin_users table
 */
export type AdminUser = {
  id: string
  email: string
  role: AdminRole
  kota_access: string[]
  created_at?: string
}

/**
 * Role admin
 */
export type AdminRole = 'SUPER_ADMIN' | 'ADMIN_KOTA'

/**
 * API response wrapper
 */
export type ApiResponse<T> = {
  success: boolean
  data: T | null
  error: string | null
}

/**
 * Tipe Entitas Follow
 */
export type FollowEntityType = 'USTADZ' | 'MASJID' | 'KOTA'

/**
 * Representasi Relasi Follow User
 */
export type UserFollow = {
  id?: string
  user_id: string
  entity_type: FollowEntityType
  entity_name: string
  entity_key: string
  created_at?: string
}

/**
 * Representasi Riwayat Notifikasi DB
 */
export type DbNotification = {
  id: string
  user_id: string
  kajian_id: string | null
  title: string
  body: string
  read: boolean
  created_at: string
}

/**
 * Status akses user Telegram Bot
 */
export type BotUserStatus = 'pending' | 'approved' | 'rejected'

/**
 * User Telegram Bot yang terdaftar
 */
export type BotUser = {
  id?: number
  telegram_id: number
  telegram_username: string | null
  full_name: string
  status: BotUserStatus
  created_at?: string
  approved_at?: string | null
}
