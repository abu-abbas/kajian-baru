// ============================================================
// @kajian-baru/parser — Rules-based parser for WhatsApp/Telegram messages
// Pure functions only — no side effects, no DB calls
// ============================================================

import type {
  Kajian,
  ParseResult,
  ParseError,
  Audience,
  GradientConfig,
} from '@kajian-baru/types'

// ---- Gradient palettes ----
const GRADIENT_PALETTES: ReadonlyArray<{ from: string; to: string }> = [
  { from: '#1a4731', to: '#2d7a4f' },  // hijau tua
  { from: '#1e3a5f', to: '#2e6da4' },  // biru navy
  { from: '#2d1b4e', to: '#6b3fa0' },  // ungu
  { from: '#1a3a3a', to: '#2a7a6a' },  // teal islami
  { from: '#3a2a1a', to: '#8a6a3a' },  // coklat emas
  { from: '#1a2a3a', to: '#3a6a9a' },  // biru muda
  { from: '#2a1a2a', to: '#7a4a7a' },  // ungu muda
  { from: '#1a3a2a', to: '#4a9a6a' },  // hijau muda
]

// ---- Main parse function ----

/**
 * Parse raw WhatsApp/Telegram copas text into structured kajian data.
 * Returns ParseResult with list of kajian and any errors encountered.
 */
export function parseMessage(rawText: string): ParseResult {
  const errors: ParseError[] = []
  const kajianList: Kajian[] = []

  const text = rawText.trim()
  if (!text) {
    return {
      success: false,
      kajian_list: [],
      errors: [{ block_index: 0, message: 'Teks kosong', raw_block: '' }],
      raw_text: rawText,
    }
  }

  // Step 1: Extract header info
  const header = extractHeader(text)

  // Step 2: Split into individual kajian blocks
  const blocks = splitIntoBlocks(text)

  if (blocks.length === 0) {
    return {
      success: false,
      kajian_list: [],
      errors: [{ block_index: 0, message: 'Teks kosong atau tidak valid', raw_block: text }],
      raw_text: rawText,
    }
  }

  // Step 3: Parse each block
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]
    if (!block) continue

    try {
      const kajian = parseBlock(block, header, i)
      
      // 🛡️ GHOST BLOCK FILTER: Jika 3 pilar utama (materi, pemateri, tempat) kosong melompong, 
      // ini dipastikan footer catatan kaki / disclaimer. Abaikan dari daftar!
      if (!kajian.materi && !kajian.pemateri && !kajian.tempat) {
        console.log(`[Parser] Mengabaikan Blok #${i+1} karena terdeteksi sebagai teks sampah/footer non-kajian.`)
        continue
      }
      
      kajianList.push(kajian)
    } catch (err) {
      errors.push({
        block_index: i,
        message: err instanceof Error ? err.message : 'Unknown parse error',
        raw_block: block,
      })
    }
  }

  return {
    success: kajianList.length > 0,
    kajian_list: kajianList,
    errors,
    raw_text: rawText,
  }
}

// ---- Date parsing helpers ----
const MONTH_MAP: Record<string, string> = {
  januari: '01', februari: '02', maret: '03', april: '04', mei: '05', juni: '06',
  juli: '07', agustus: '08', september: '09', oktober: '10', november: '11', desember: '12',
  jan: '01', feb: '02', mar: '03', apr: '04', jun: '06', jul: '07', agu: '08', sep: '09', okt: '10', nov: '11', des: '12',
  may: '05', august: '08', october: '10', december: '12'
}

/**
 * Mengubah format tanggal Indonesia "14 Mei 2026" menjadi ISO "2026-05-14"
 */
function convertToISODate(indoDateStr: string): string {
  if (!indoDateStr) return ''
  
  // Jika sudah format ISO YYYY-MM-DD, langsung kembalikan
  if (/^\d{4}-\d{2}-\d{2}$/.test(indoDateStr)) return indoDateStr
  
  const parts = indoDateStr.trim().toLowerCase().split(/\s+/)
  if (parts.length === 3) {
    const day = (parts[0] ?? '').padStart(2, '0')
    const monthName = parts[1] ?? ''
    const year = parts[2] ?? ''
    const month = MONTH_MAP[monthName] ?? '01'
    
    if (/^\d{2}$/.test(day) && /^\d{4}$/.test(year)) {
      return `${year}-${month}-${day}`
    }
  }
  return indoDateStr
}

// ---- Header extraction ----

type HeaderInfo = {
  kota: string
  tanggal_masehi: string
  tanggal_hijriyah: string
}

function extractHeader(text: string): HeaderInfo {
  const headerEnd = text.indexOf('📚')
  const header = headerEnd !== -1 ? text.slice(0, headerEnd) : ''

  // Extract tanggal masehi — e.g. "14 Mei 2026"
  const tanggalMatch = header.match(/(\d{1,2}\s+\w+\s+\d{4})/)
  const tanggal_masehi_raw = tanggalMatch?.[1] ?? ''
  
  // Konversi otomatis ke ISO agar bisa di-query & diurutkan di SQL
  const tanggal_masehi = convertToISODate(tanggal_masehi_raw)

  // Extract tanggal hijriyah — e.g. "17 Dzulqa'dah 1447 Hijriyah"
  const hijriMatch = header.match(/(\d{1,2}\s+\w+['']*\w*\s+\d{4})\s+[Hh]ijriyah/)
  const tanggal_hijriyah = hijriMatch?.[1] ?? ''

  // Extract kota — e.g. "daerah Bekasi dan sekitarnya"
  const kotaMatch = header.match(/daerah\s+(.+?)\s+dan\s+sekitarnya/i)
  const kota = kotaMatch?.[1]?.trim() ?? ''

  return { kota, tanggal_masehi, tanggal_hijriyah }
}

// ---- Block splitting ----

function splitIntoBlocks(text: string): string[] {
  const hasTilde = text.includes('~')
  const hasBookEmoji = text.includes('📚')

  // 1. Pemisah Cacing (Format Monorepo Standar)
  if (hasTilde) {
    return text
      .split('~')
      .map((b) => b.trim())
      .filter((b) => b.length > 0)
  }

  // 2. Pemisah per Buku (Format WhatsApp Massal)
  if (hasBookEmoji) {
    const parts = text.split('📚')
    // Abaikan header pembuka sebelum buku pertama jika ada
    const blocks = parts.slice(1).map((p) => '📚' + p)
    if (blocks.length > 0) return blocks
  }

  // 3. 🧠 FALLBACK CERDAS: Tanpa pembatas formal sama sekali.
  // Anggap SELURUH teks input adalah 1 blok kajian utuh (untuk caption foto, dll)
  return [text]
}

// ---- Per-block parsing ----

function parseBlock(block: string, header: HeaderInfo, _index: number): Kajian {
  const lines = block.split('\n').map((l) => l.trim())

  let materiRaw = ''
  let pemateriRaw = ''
  let waktuRaw = ''
  let tempatRaw = ''
  let kontakRaw = ''
  let alamatStandalone = ''
  let mapsStandalone = ''
  let himbauanRaw = ''

  let lastField = ''

  for (const line of lines) {
    if (!line) continue

    // 🌍 Instant Maps Match: Jika baris murni berisi tautan Google Maps saja
    const mapsUrlMatch = line.match(/^(https?:\/\/(?:maps\.google\.com|goo\.gl|maps\.app\.goo\.gl)\S+)/i)
    if (mapsUrlMatch && line.replace(mapsUrlMatch[0], '').trim() === '') {
      mapsStandalone = mapsUrlMatch[0]
      continue
    }

    // -- Field Detectors (Berbasis Emoji & Kata Kunci Indonesia) --
    const isMateri = line.includes('📚') || line.match(/^(?:Materi|Tema|Judul|Kajian)[\s\w]*[:：\-–]/i)
    const isPemateri = line.includes('🎙️') || line.includes('🎙') || line.match(/^(?:Pemateri|Penceramah|Narasumber|Bersama|Oleh)[\s\w]*[:：\-–]/i)
    const isWaktu = line.includes('🕰️') || line.includes('🕰') || line.match(/^(?:Waktu|Jam|Pukul)[\s\w]*[:：\-–]/i)
    const isTempat = line.includes('🕌') || line.match(/^(?:Tempat|Lokasi)[\s\w]*[:：\-–]/i)
    const isAlamat = line.includes('📍') || line.includes('🗺️') || line.match(/^(?:Alamat|Maps|Google Maps)[\s\w]*[:：\-–]/i)
    const isKontak = line.includes('📞') || line.match(/^(?:Info|Kontak|Hubungi|WA|Telp)[\s\w]*[:：\-–]/i)
    const isHimbauan = line.includes('⚠️') || line.includes('📣') || line.includes('📢') || line.includes('🚫') || line.includes('💡') || line.match(/^(?:Himbauan|Catatan|NB|Perhatian)[\s\w]*[:：\-–]/i)

    if (isMateri) {
      materiRaw = line
      lastField = 'materi'
    } else if (isPemateri) {
      pemateriRaw = line
      lastField = 'pemateri'
    } else if (isWaktu) {
      waktuRaw = line
      lastField = 'waktu'
    } else if (isTempat) {
      tempatRaw = line
      lastField = 'tempat'
    } else if (isAlamat) {
      const innerMaps = line.match(/(https?:\/\/(?:maps\.google\.com|goo\.gl|maps\.app\.goo\.gl)\S+)/i)
      if (innerMaps) mapsStandalone = innerMaps[1] ?? ''
      alamatStandalone = line
        .replace(/^(?:Alamat|Maps|Google Maps)\s*[:：\-–]?\s*/i, '')
        .replace(/(?:📍|🗺️)\s*/g, '')
        .replace(/(https?:\/\/\S+)/g, '')
        .trim()
      lastField = 'alamat'
    } else if (isKontak) {
      kontakRaw = line
      lastField = 'kontak'
    } else if (isHimbauan) {
      himbauanRaw = line
      lastField = 'himbauan'
    } else {
      // Lanjutan baris (Continuation Falling back)
      if (lastField === 'materi') materiRaw += '\n' + line
      else if (lastField === 'pemateri') pemateriRaw += '\n' + line
      else if (lastField === 'waktu') waktuRaw += '\n' + line
      else if (lastField === 'tempat') tempatRaw += '\n' + line
      else if (lastField === 'alamat') alamatStandalone += '\n' + line
      else if (lastField === 'kontak') kontakRaw += '\n' + line
      else if (lastField === 'himbauan') himbauanRaw += '\n' + line
      else {
        // Deteksi audiens melayang di bawah blok kontak (dalam kurung)
        if (line.match(/^\([^)]+\)$/)) {
          kontakRaw += '\n' + line
        }
      }
    }
  }

  // 💡 FALLBACK LEGACY: Jika mesin pencari baris gagal total (materi & tempat nihil), 
  // kembalikan ke mode potong emoji substring klasik agar kompatibilitas terjaga!
  if (!materiRaw && !tempatRaw) {
    materiRaw = extractField(block, ['📚'], ['🎙️', '🎙'])
    pemateriRaw = extractField(block, ['🎙️', '🎙'], ['🕰️', '🕰'])
    waktuRaw = extractField(block, ['🕰️', '🕰'], ['🕌'])
    tempatRaw = extractField(block, ['🕌'], ['📞'])
    kontakRaw = extractField(block, ['📞'], [])
  }

  // Pencucian data akhir menggunakan utilitas yang sudah teruji
  const materi = cleanMateri(materiRaw)
  const pemateri = cleanPemateri(pemateriRaw)
  const { mulai, selesai } = parseWaktu(waktuRaw)
  const { tempat: parsedTempat, alamat: parsedAlamat, maps_url: parsedMaps } = parseTempat(tempatRaw)
  const { kontak, audience } = parseKontak(kontakRaw)

  // Penggabungan ekstraksi inline dan standalone
  const finalAlamat = (alamatStandalone || parsedAlamat).trim()
  let finalMapsUrl = mapsStandalone || parsedMaps

  // 🌍 GLOBAL FALLBACK MAPS HUNTER
  if (!finalMapsUrl) {
    const fallbackMaps = block.match(/(https?:\/\/(?:maps\.google\.com|goo\.gl|maps\.app\.goo\.gl)\S+)/i)
    finalMapsUrl = fallbackMaps?.[1] ?? ''
  }

  // 📍 Penebalan Nama Tempat jika kosong tapi ada baris Masjid
  let finalTempat = parsedTempat
  if (!finalTempat && block.includes('🕌')) {
    const match = block.match(/🕌\s*(.+)/i)
    finalTempat = match?.[1]?.split('\n')[0]?.trim() ?? ''
  }

  const gradient_config = generateGradient(finalTempat || 'Kajian Islam', audience)

  // Pencucian Himbauan Premium
  let finalHimbauan = himbauanRaw
    .replace(/^(?:Himbauan|Catatan|NB|Perhatian)\s*[:：\-–]?\s*/i, '')
    .replace(/(?:⚠️|📣|📢|🚫|💡)\s*/g, '')
    .trim()

  if (!finalHimbauan) {
    finalHimbauan = extractHimbauan(block)
  }

  return {
    kota: header.kota || 'Tangerang',
    tanggal_masehi: header.tanggal_masehi,
    tanggal_hijriyah: header.tanggal_hijriyah,
    materi,
    pemateri,
    waktu_mulai: mulai,
    waktu_selesai: selesai,
    tempat: finalTempat,
    alamat: finalAlamat,
    maps_url: finalMapsUrl,
    kontak,
    audience,
    poster_url: null,
    gradient_config,
    source_text: block,
    himbauan: finalHimbauan,
  }
}

// ---- Field extraction with emoji anchors ----

function extractField(text: string, startEmojis: string[], endEmojis: string[]): string {
  let start = -1
  let usedEmoji = ''

  for (const emoji of startEmojis) {
    const pos = text.indexOf(emoji)
    if (pos !== -1 && (start === -1 || pos < start)) {
      start = pos
      usedEmoji = emoji
    }
  }

  if (start === -1) return ''

  const afterEmoji = start + usedEmoji.length

  let end = text.length
  for (const emoji of endEmojis) {
    const pos = text.indexOf(emoji, afterEmoji)
    if (pos !== -1 && pos < end) {
      end = pos
    }
  }

  return text
    .slice(afterEmoji, end)
    .replace(/^[\s:：]+/, '')
    .trim()
}

// ---- Tag and Emoji Stripping Utility ----

function stripPrefixTags(str: string, keywordsPattern: string): string {
  return str
    .replace(/^(?:📚|🎙️|🎙|🕰️|🕰|🕌|📞|📍|🗺️|⚠️|📣|📢|🚫|💡)\s*/gu, '')
    .replace(new RegExp(`^(?:${keywordsPattern})[\\s\\w]*[:：\\-–]?\\s*`, 'i'), '')
    .trim()
}

// ---- Pemateri cleaning ----

function cleanMateri(raw: string): string {
  return stripPrefixTags(raw, 'Materi|Tema|Judul|Kajian')
}

function cleanPemateri(raw: string): string {
  return stripPrefixTags(raw, 'Pemateri|Penceramah|Narasumber|Bersama|Oleh')
    .replace(/\s+/g, ' ')
    .trim()
}

// ---- Waktu parsing ----

function parseWaktu(raw: string): { mulai: string; selesai: string } {
  // Bersihkan kata pengantar yang sering diketik kontributor
  let cleaned = stripPrefixTags(raw, 'Waktu|Jam|Pukul')

  if (!cleaned) return { mulai: '', selesai: 'Selesai' }

  // 1. Format: "10.00 s/d 12.00 WIB" (Dua angka jam pasti)
  const twoTimeMatch = cleaned.match(/(\d{1,2}[.:]\d{2})\s*(?:WIB|WITA|WIT)?\s+s\/d\s+(\d{1,2}[.:]\d{2})/i)
  if (twoTimeMatch) {
    return {
      mulai: (twoTimeMatch[1] ?? '').replace('.', ':'),
      selesai: (twoTimeMatch[2] ?? '').replace('.', ':'),
    }
  }

  // 2. Format: "10.00 WIB s/d Selesai" (Jam di depan, teks keterangan di belakang)
  const oneTimeMatch = cleaned.match(/(\d{1,2}[.:]\d{2}(?:\s*(?:WIB|WITA|WIT))?)\s+s\/d\s+(.+)/i)
  if (oneTimeMatch) {
    return {
      mulai: (oneTimeMatch[1] ?? '').replace('.', ':'),
      selesai: (oneTimeMatch[2] ?? '').trim(),
    }
  }

  // 3. Format: "Ba'da Shalat Ashar s/d Selesai"
  const badaMatch = cleaned.match(/(Ba[''']da\s+Shalat\s+\w+)\s+s\/d\s+(.+)/i)
  if (badaMatch) {
    return { 
      mulai: badaMatch[1] ?? cleaned, 
      selesai: (badaMatch[2] ?? 'Selesai').trim() 
    }
  }

  // 4. Fallback Cerdas: Jika mengandung "s/d" tapi pola di atas meleset, belah manual!
  if (cleaned.toLowerCase().includes('s/d')) {
    const parts = cleaned.split(/\s+s\/d\s+/i)
    if (parts.length === 2) {
      return {
        mulai: (parts[0] ?? '').trim().replace('.', ':'),
        selesai: (parts[1] ?? '').trim()
      }
    }
  }

  return { mulai: cleaned.replace('.', ':'), selesai: 'Selesai' }
}

// ---- Tempat parsing ----

function parseTempat(raw: string): { tempat: string; alamat: string; maps_url: string } {
  // ✂️ Cukur awalan label generik seperti "Tempat :" atau "Lokasi :"
  let textWithoutPrefix = stripPrefixTags(raw, 'Tempat|Lokasi')

  // Extract maps URL first (may be at end or embedded)
  const mapsMatch = textWithoutPrefix.match(/(https?:\/\/(?:maps\.google\.com|goo\.gl|maps\.app\.goo\.gl)\S+)/i)
  const maps_url = mapsMatch?.[1] ?? ''

  // Remove maps URL from text
  let cleaned = textWithoutPrefix.replace(/(https?:\/\/\S+)/g, '').trim()

  // Split tempat and alamat by parentheses — "Masjid X (Jl. Y)"
  const parenMatch = cleaned.match(/^(.+?)\s*\((.+)\)\s*$/)
  if (parenMatch) {
    return {
      tempat: (parenMatch[1] ?? '').trim(),
      alamat: (parenMatch[2] ?? '').trim(),
      maps_url,
    }
  }

  return { tempat: cleaned, alamat: '', maps_url }
}

// ---- Kontak + audience parsing ----

function parseKontak(raw: string): { kontak: string; audience: Audience } {
  const audience = extractAudience(raw)

  // ✂️ Cukur awalan label kontak seperti "Info Panitia Kajian :" atau "Hubungi :"
  const textWithoutPrefix = stripPrefixTags(raw, 'Info\\s+Panitia\\s+Kajian|Info\\s+Panitia|Info|Kontak|Hubungi|WA|Telp')

  // Remove audience marker from kontak text
  const kontak = textWithoutPrefix
    .replace(/\([^)]*\)\s*$/, '')
    .trim()

  return { kontak, audience }
}

function extractAudience(text: string): Audience {
  const match = text.match(/\(([^)]+)\)\s*$/)
  if (!match) return 'UMUM'

  const raw = (match[1] ?? '').toUpperCase()
  if (raw.includes('AKHWAT') || raw.includes('MUSLIMAH')) return 'AKHWAT'
  if (raw.includes('IKHWAN') && !raw.includes('AKHWAT')) return 'IKHWAN'
  return 'UMUM'
}

// ---- Gradient generation (deterministic) ----

function generateGradient(tempat: string, audience: Audience): GradientConfig {
  const hash = tempat.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  const angle = (hash * 37) % 360

  if (audience === 'AKHWAT') {
    return { from: '#4c0519', to: '#9d174d', angle } // Deep luxurious rose to pink
  }
  if (audience === 'IKHWAN') {
    return { from: '#0f172a', to: '#1e3a8a', angle } // Deep luxurious navy to royal blue
  }
  // Default standard Emerald (UMUM)
  return { from: '#1a4731', to: '#2d7a4f', angle }
}

// ---- Himbauan extraction (smart heuristics) ----

function extractHimbauan(block: string): string {
  // 🚨 Cari himbauan berbasis emoji (⚠️, 📣, 📢, 🚫, 💡)
  const emojiRegex = /(?:⚠️|📣|📢|🚫|💡)\s*(.+)/i
  const emojiMatch = block.match(emojiRegex)
  if (emojiMatch && emojiMatch[1]) {
    return emojiMatch[1].split('\n')[0]?.trim() || ''
  }

  // 📝 Cari himbauan berbasis kata kunci
  const keywordRegex = /(?:Himbauan|Catatan|NB|Perhatian|Himbauan Jemaah)\s*[:\-–]?\s*(.+)/i
  const keywordMatch = block.match(keywordRegex)
  if (keywordMatch && keywordMatch[1]) {
    return keywordMatch[1].split('\n')[0]?.trim() || ''
  }

  return ''
}
