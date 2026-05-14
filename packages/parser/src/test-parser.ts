// ============================================================
// Parser test — run with: pnpm test (from packages/parser)
// ============================================================

import { parseMessage } from './index.js'

const SAMPLE_TEXT = `Jadwal Kajian Rabu, 14 Mei 2026 / 17 Dzulqa'dah 1447 Hijriyah. Untuk daerah Bekasi dan sekitarnya.

📚 Materi : Kitab Tauhid
🎙️ Pemateri : Ustadz Abu Yahya Badrusalam -hafizhahullah-
🕰️ Waktu : 09.00 s/d 11.30 WIB
🕌 Tempat : Masjid Al-Ikhlas (Jl. Raya Bekasi No. 123) https://maps.app.goo.gl/abc123
📞 Info Panitia Kajian : 0813-1234-5678 (Umum)
~
📚 Materi : Fikih Wanita
🎙️ Pemateri : Ustadzah Siti Aminah -hafizhahullah-
🕰️ Waktu : Ba'da Shalat Dzuhur s/d Selesai
🕌 Tempat : Masjid An-Nur (Komplek Griya Asri Blok A)
📞 Info Panitia Kajian : 0812-9876-5432 (Akhwat)
`

function testParser(): void {
  console.log('🧪 Running parser tests...\n')

  const result = parseMessage(SAMPLE_TEXT)

  console.log(`✅ Success: ${String(result.success)}`)
  console.log(`📋 Parsed ${String(result.kajian_list.length)} kajian`)
  console.log(`❌ Errors: ${String(result.errors.length)}\n`)

  for (const kajian of result.kajian_list) {
    console.log('─'.repeat(50))
    console.log(`📍 Kota       : ${kajian.kota}`)
    console.log(`📅 Tanggal    : ${kajian.tanggal_masehi} / ${kajian.tanggal_hijriyah}`)
    console.log(`📚 Materi     : ${kajian.materi}`)
    console.log(`🎙️ Pemateri   : ${kajian.pemateri}`)
    console.log(`🕰️ Waktu      : ${kajian.waktu_mulai} - ${kajian.waktu_selesai}`)
    console.log(`🕌 Tempat     : ${kajian.tempat}`)
    console.log(`📍 Alamat     : ${kajian.alamat}`)
    console.log(`🗺️ Maps       : ${kajian.maps_url}`)
    console.log(`📞 Kontak     : ${kajian.kontak}`)
    console.log(`👥 Audience   : ${kajian.audience}`)
    console.log(`🎨 Gradient   : ${JSON.stringify(kajian.gradient_config)}`)
    console.log()
  }

  if (result.errors.length > 0) {
    console.log('⚠️ Errors:')
    for (const error of result.errors) {
      console.log(`  Block ${String(error.block_index)}: ${error.message}`)
    }
  }

  // Assertions
  const assertions = [
    { name: 'success is true', pass: result.success === true },
    { name: '2 kajian parsed', pass: result.kajian_list.length === 2 },
    { name: 'kota is Bekasi', pass: result.kajian_list[0]?.kota === 'Bekasi' },
    { name: 'pemateri cleaned (no hafizhahullah)', pass: !result.kajian_list[0]?.pemateri.includes('hafizhahullah') },
    { name: 'waktu parsed correctly', pass: result.kajian_list[0]?.waktu_mulai === '09:00' },
    { name: "bada shalat kept as-is", pass: result.kajian_list[1]?.waktu_mulai.includes("Ba'da") },
    { name: 'audience UMUM detected', pass: result.kajian_list[0]?.audience === 'UMUM' },
    { name: 'audience AKHWAT detected', pass: result.kajian_list[1]?.audience === 'AKHWAT' },
    { name: 'maps URL extracted', pass: (result.kajian_list[0]?.maps_url ?? '').length > 0 },
    { name: 'alamat extracted', pass: result.kajian_list[0]?.alamat.includes('Jl.') },
  ]

  console.log('─'.repeat(50))
  console.log('📊 Assertions:')
  let allPassed = true
  for (const a of assertions) {
    const icon = a.pass ? '✅' : '❌'
    console.log(`  ${icon} ${a.name}`)
    if (!a.pass) allPassed = false
  }

  console.log()
  if (allPassed) {
    console.log('🎉 All tests passed!')
  } else {
    console.log('💥 Some tests failed!')
    process.exit(1)
  }
}

testParser()
