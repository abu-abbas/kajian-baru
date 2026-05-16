import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '../../apps/api/.env') })

const supabaseUrl = process.env.SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseKey)

async function checkData() {
  console.log('--- Checking data for 2026-05-16 ---')
  const { data, count, error } = await supabase
    .from('kajian')
    .select('id, materi, pemateri, tempat, kota, waktu_mulai, tanggal_masehi', { count: 'exact' })
    .eq('tanggal_masehi', '2026-05-16')

  if (error) {
    console.error('Error:', error)
    return
  }

  console.log(`Found ${count} rows for 2026-05-16:`)
  data?.forEach(k => {
    console.log(`- [${k.id}] ${k.tempat} (${k.kota}) | ${k.waktu_mulai} | ${k.materi}`)
  })
}

checkData()
