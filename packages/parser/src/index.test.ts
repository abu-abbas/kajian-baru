import { describe, it, expect } from 'vitest'
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

describe('Parser Engine Tests', () => {
  it('should correctly parse sample WhatsApp messages', () => {
    const result = parseMessage(SAMPLE_TEXT)

    expect(result.success).toBe(true)
    expect(result.kajian_list).toHaveLength(2)
    expect(result.errors).toHaveLength(0)
  })

  it('should extract basic header information correctly', () => {
    const result = parseMessage(SAMPLE_TEXT)
    const kajian = result.kajian_list[0]

    expect(kajian?.kota).toBe('Bekasi')
    expect(kajian?.tanggal_masehi).toBe('2026-05-14')
    expect(kajian?.tanggal_hijriyah).toContain('17 Dzulqa\'dah 1447')
  })

  it('should normalize pemateri name (preserving hafizhahullah without hyphens)', () => {
    const result = parseMessage(SAMPLE_TEXT)
    
    // Test first block
    const kajian1 = result.kajian_list[0]
    expect(kajian1?.pemateri).toBe('Ustadz Abu Yahya Badrusalam hafizhahullah')

    // Test second block
    const kajian2 = result.kajian_list[1]
    expect(kajian2?.pemateri).toBe('Ustadzah Siti Aminah hafizhahullah')
  })

  it('should parse different time formats correctly', () => {
    const result = parseMessage(SAMPLE_TEXT)

    // Normal time
    expect(result.kajian_list[0]?.waktu_mulai).toBe('09:00')
    expect(result.kajian_list[0]?.waktu_selesai).toBe('11:30')

    // Ba'da time
    expect(result.kajian_list[1]?.waktu_mulai).toContain('Ba\'da')
  })

  it('should detect and parse target audience correctly', () => {
    const result = parseMessage(SAMPLE_TEXT)

    expect(result.kajian_list[0]?.audience).toBe('UMUM')
    expect(result.kajian_list[1]?.audience).toBe('AKHWAT')
  })

  it('should parse location, address, and Google Maps URLs', () => {
    const result = parseMessage(SAMPLE_TEXT)
    const kajian1 = result.kajian_list[0]

    expect(kajian1?.tempat).toBe('Masjid Al-Ikhlas')
    expect(kajian1?.alamat).toBe('Jl. Raya Bekasi No. 123')
    expect(kajian1?.maps_url).toBe('https://maps.app.goo.gl/abc123')
  })
})
