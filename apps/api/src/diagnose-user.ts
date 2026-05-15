import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ ERROR: Env vars tidak ditemukan!')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

const TARGET_EMAIL = 'notificationfor.gitlabs@gmail.com'

async function runDiagnosis() {
  console.log('🔍 MEMULAI DIAGNOSIS AUTH...')
  console.log(`🎯 Target Email: ${TARGET_EMAIL}`)

  try {
    // 1. Cari User ID di Auth.Users
    console.log('📡 Mengambil data dari supabase.auth.admin...')
    const { data: usersData, error: authError } = await supabase.auth.admin.listUsers()

    if (authError) {
      console.error('❌ Gagal mengakses Auth Admin API:', authError.message)
      return
    }

    const matchedUser = usersData.users.find(u => u.email === TARGET_EMAIL)

    if (!matchedUser) {
      console.log(`❌ HASIL: User dengan email "${TARGET_EMAIL}" TIDAK DITEMUKAN di tabel Auth Supabase!`)
      console.log('💡 Solusi: Apakah sudah klik login dengan Google di app?')
      return
    }

    console.log(`✅ USER DITEMUKAN di Auth Supabase!`)
    console.log(`🆔 User ID: ${matchedUser.id}`)
    console.log(`📧 Email Terverifikasi: ${matchedUser.email_confirmed_at ? 'YA' : 'TIDAK'}`)

    // 2. Cari di tabel admin_users
    console.log('📡 Mencari ID tersebut di tabel "admin_users"...')
    const { data: adminData, error: dbError } = await supabase
      .from('admin_users')
      .select('*')
      .eq('id', matchedUser.id)
      .maybeSingle()

    if (dbError) {
      console.error('❌ Gagal melakukan query tabel "admin_users":', dbError.message)
      return
    }

    if (!adminData) {
      console.log('❌ HASIL DIAGNOSIS: User ID tersebut TIDAK ADA di tabel "admin_users"!')
      console.log('💡 INI PENYEBABNYA! Sistem menolak akses karena ID belum dimasukkan ke daftar admin resmi.')
      console.log('🚀 MENJALANKAN AUTO-FIX: Memasukkan ID ke tabel admin_users sekarang...')

      const { error: insertError } = await supabase
        .from('admin_users')
        .insert({
          id: matchedUser.id,
          email: TARGET_EMAIL,
          role: 'admin'
        })

      if (insertError) {
        console.error('❌ Gagal memasukkan data:', insertError.message)
      } else {
        console.log('✅ BERHASIL! Akun sudah dimasukkan ke tabel "admin_users" dengan role "admin".')
        console.log('👉 Silakan refresh browser sekarang, pintu dashboard seharusnya terbuka lebar!')
      }
    } else {
      console.log('✅ DIAGNOSIS: User ID SUDAH ADA di tabel admin_users!')
      console.log('📊 Data Row:', adminData)
      console.log('💡 Jika masih ditolak, mungkin ada masalah delay kueri atau policy.')
    }
  } catch (err) {
    console.error('🔥 Terjadi kegagalan skrip:', err)
  }
}

void runDiagnosis()
