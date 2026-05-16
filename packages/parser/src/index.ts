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

// ---- Region & Source Mapping Helpers ----
const REGION_NORMALIZE_MAP: Record<string, string> = {
  'JAK-TIM': 'Jakarta Timur',
  'JAK TIM': 'Jakarta Timur',
  'JAK-SEL': 'Jakarta Selatan',
  'JAK SEL': 'Jakarta Selatan',
  'AK-SEL': 'Jakarta Selatan', // Handling typo/pemotongan huruf depan secara cerdas!
  'JAK-BAR': 'Jakarta Barat',
  'JAK BAR': 'Jakarta Barat',
  'JAK-UT': 'Jakarta Utara',
  'JAK UT': 'Jakarta Utara',
  'JAK-PUS': 'Jakarta Pusat',
  'JAK PUS': 'Jakarta Pusat',
  'TANG-SEL': 'Tangerang Selatan',
  'TANGSEL': 'Tangerang Selatan',
  'TANG SEL': 'Tangerang Selatan',
  'BOGOR': 'Bogor',
  'DEPOK': 'Depok',
  'TANGERANG': 'Tangerang',
  'BEKASI': 'Bekasi',
}

function normalizeRegion(raw: string): string {
  const cleaned = raw.trim().toUpperCase().replace(/[\*\•○●]/g, '')
  return REGION_NORMALIZE_MAP[cleaned] ?? raw.trim()
}

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

  // Step 1: Extract header info & global attributes (like kontributor)
  const header = extractHeader(text)

  // Step 2: Split into individual kajian blocks (includes smart sub-session expanding!)
  const blocks = splitIntoBlocks(text)

  if (blocks.length === 0) {
    return {
      success: false,
      kajian_list: [],
      errors: [{ block_index: 0, message: 'Teks kosong atau tidak valid', raw_block: text }],
      raw_text: rawText,
    }
  }

  // Track region context as iteration proceeds!
  let currentRegion = header.kota || 'Tangerang'

  // Step 3: Parse each block
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]
    if (!block) continue

    // 🗺️ DYNAMIC REGION HUNTER: Tangkap tag wilayah di awal blok seperti *○●JAK-SEL●○*
    const regionMatch = block.match(/○●\s*([^●○]+)\s*●○/)
    if (regionMatch && regionMatch[1]) {
      currentRegion = normalizeRegion(regionMatch[1])
    } else {
      // 🛡️ INTELLIGENT CITY INFERRING (Garis Pertahanan Kedua):
      // Jika blok berdiri sendiri (single payload via Telegram Bot) tanpa tag wilayah eksplisit,
      // pindai isi teks di dalam blok ini secara cerdas untuk mendeteksi kota/kecamatan kunci!
      const blockUpper = block.toUpperCase()
      let inferredCity = ''
      
      if (blockUpper.includes('JAKARTA TIMUR') || blockUpper.includes('JAK-TIM') || blockUpper.includes('JAK TIM')) inferredCity = 'Jakarta Timur'
      else if (blockUpper.includes('JAKARTA SELATAN') || blockUpper.includes('JAK-SEL') || blockUpper.includes('JAK SEL')) inferredCity = 'Jakarta Selatan'
      else if (blockUpper.includes('JAKARTA BARAT') || blockUpper.includes('JAK-BAR') || blockUpper.includes('JAK BAR')) inferredCity = 'Jakarta Barat'
      else if (blockUpper.includes('JAKARTA UTARA') || blockUpper.includes('JAK-UT') || blockUpper.includes('JAK UT')) inferredCity = 'Jakarta Utara'
      else if (blockUpper.includes('JAKARTA PUSAT') || blockUpper.includes('JAK-PUS') || blockUpper.includes('JAK PUS')) inferredCity = 'Jakarta Pusat'
      else if (blockUpper.includes('TANGERANG SELATAN') || blockUpper.includes('TANG-SEL') || blockUpper.includes('TANGSEL')) inferredCity = 'Tangerang Selatan'
      else if (blockUpper.includes('TANGERANG') || blockUpper.includes('TIGARAKSA') || blockUpper.includes('CIKUPA') || blockUpper.includes('CIPONDOH')) inferredCity = 'Tangerang'
      else if (blockUpper.includes('BOGOR') || blockUpper.includes('CIBINONG') || blockUpper.includes('CILEUNGSI') || blockUpper.includes('SENTUL')) inferredCity = 'Bogor'
      else if (blockUpper.includes('DEPOK') || blockUpper.includes('CINERE') || blockUpper.includes('SAWANGAN')) inferredCity = 'Depok'
      else if (blockUpper.includes('BEKASI') || blockUpper.includes('CIKARANG') || blockUpper.includes('TAMBUN') || blockUpper.includes('CIBITUNG')) inferredCity = 'Bekasi'

      if (inferredCity) {
        // 🔑 Aturan Emas: Overwrite hanya jika sedang mem-parse satu blok saja (single payload),
        // atau jika status currentRegion saat ini masih bertumpu pada default 'Tangerang'!
        if (blocks.length === 1 || currentRegion === 'Tangerang') {
          currentRegion = inferredCity
        }
      }
    }

    try {
      const kajian = parseBlock(block, header, currentRegion, i)
      
      // 🛡️ GHOST BLOCK FILTER: Jika 3 pilar utama (materi, pemateri, tempat) kosong melompong, 
      // ini dipastikan footer catatan kaki / disclaimer. Abaikan dari daftar! (Kecuali jika ini status Libur)
      if (!kajian.materi && !kajian.pemateri && !kajian.tempat && !kajian.is_cancelled) {
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
  kontributor: string
}

function extractHeader(text: string): HeaderInfo {
  // Batas header: bisa 📚 atau 🏡/🏢/🕌 pertama, atau '***' pertama
  const boundaryIdx = text.search(/(?:📚|🏡|🏢|🕌|\*\*\*)/)
  const header = boundaryIdx !== -1 ? text.slice(0, boundaryIdx) : text.slice(0, 500)

  // Extract tanggal masehi — e.g. "14 Mei 2026"
  const tanggalMatch = header.match(/(\d{1,2}\s+\w+\s+\d{4})/)
  const tanggal_masehi_raw = tanggalMatch?.[1] ?? ''
  
  // Konversi otomatis ke ISO agar bisa di-query & diurutkan di SQL
  const tanggal_masehi = convertToISODate(tanggal_masehi_raw)

  // Extract tanggal hijriyah — e.g. "17 Dzulqa'dah 1447 Hijriyah"
  const hijriMatch = header.match(/(\d{1,2}\s+\w+['']*\w*\s+\d{4})\s+[Hh]ijriyah/)
  const tanggal_hijriyah = hijriMatch?.[1] ?? ''

  // Extract kota — e.g. "daerah Bekasi dan sekitarnya" atau "Wilayah Jabodetabek"
  const kotaMatch = header.match(/(?:daerah|Wilayah)\s+([^&\n,]+?)(?:\s+dan\s+sekitarnya|\s+&|\n|$)/i)
  const kota = kotaMatch?.[1]?.trim() ?? ''

  // ✍️ EXTRACT KONTRIBUTOR: Ambil info 'Creative by' atau 'Creator'
  let kontributor = 'KajianBaru'
  const creatorMatch = header.match(/(?:Creative\s+by|Creator|Oleh|Sumber)\s*[:\-–]\s*([^`\n]+)/i)
  if (creatorMatch && creatorMatch[1]) {
    kontributor = creatorMatch[1].trim().replace(/[\`\*\_]/g, '')
  } else {
    // 🛡️ SMART FALLBACK FOR SPLITS: Jika pesan Telegram terpecah dan header awal hilang,
    // cari kata kunci 'Creative by' secara global di seluruh dokumen, atau tanda tangan komunitas di footer!
    const globalMatch = text.match(/(?:Creative\s+by|Creator|Sumber)\s*[:\-–]\s*([^`\n\•\>]+)/i)
    if (globalMatch && globalMatch[1]) {
      kontributor = globalMatch[1].trim().replace(/[\`\*\_]/g, '')
    } else if (/Jadwal\s+Kajian\s+Kaskus/i.test(text)) {
      kontributor = 'Tim Jadwal Kajian Kaskus'
    }
  }

  return { kota, tanggal_masehi, tanggal_hijriyah, kontributor }
}

// ---- Block splitting ----

function splitIntoBlocks(text: string): string[] {
  const hasTilde = text.includes('~')
  const hasBookEmoji = text.includes('📚')
  const hasTripleAsterisks = text.includes('***')

  let rawBlocks: string[] = []

  // 1. Pemisah Tiga Bintang (Format Rekapan Massal / Kaskus)
  if (hasTripleAsterisks) {
    rawBlocks = text
      .split('***')
      .map((b) => b.trim())
      .filter((b) => b.length > 0)
  }
  // 2. Pemisah Cacing (Format Monorepo Standar)
  else if (hasTilde) {
    rawBlocks = text
      .split('~')
      .map((b) => b.trim())
      .filter((b) => b.length > 0)
  }
  // 3. Pemisah per Buku (Format WhatsApp Massal)
  else if (hasBookEmoji) {
    const parts = text.split('📚')
    // Abaikan header pembuka sebelum buku pertama jika ada
    rawBlocks = parts.slice(1).map((p) => '📚' + p)
  } else {
    // 🧠 FALLBACK CERDAS: Tanpa pembatas formal sama sekali.
    rawBlocks = [text]
  }

  // ---- 🧠 ADVANCED: INTERNAL SUB-SESSION EXPANDER ----
  // Membelah otomatis blok yang mengandung multi-sesi (1, 2, 3, dst) menjadi entry virtual independen!
  const expandedBlocks: string[] = []

  for (const block of rawBlocks) {
    const sesiRegex = /(?:-?\s*)SESI\s*\d+/gi
    const matches = [...block.matchAll(sesiRegex)]

    if (matches.length > 1) {
      // Ambil bagian atas yang memuat nama masjid, alamat, gmaps sebelum sesi pertama dimulai
      const firstMatchIndex = matches[0]?.index ?? 0
      const commonHeader = block.slice(0, firstMatchIndex).trim()
      
      for (let i = 0; i < matches.length; i++) {
        const startIdx = matches[i]?.index ?? 0
        const endIdx = matches[i+1] ? matches[i+1]?.index : block.length
        const sesiContent = block.slice(startIdx, endIdx).trim()
        
        // Bentuk blok kajian utuh yang mewarisi info lokasi & gmaps yang sama!
        expandedBlocks.push(`${commonHeader}\n${sesiContent}`)
      }
    } else {
      expandedBlocks.push(block)
    }
  }

  return expandedBlocks
}

// ---- Per-block parsing ----

function parseBlock(block: string, header: HeaderInfo, currentRegion: string, _index: number): Kajian {
  // 🛑 Cek Pembatalan / Libur (Diliburkan / Dibatalkan)
  const isLibur = block.toUpperCase().includes('DILIBURKAN') || block.toUpperCase().includes('DIBATALKAN')

  const lines = block.split('\n').map((l) => l.trim())

  let materiRaw = ''
  let pemateriRaw = ''
  let waktuRaw = ''
  let tempatRaw = ''
  let kontakRaw = ''
  let alamatStandalone = ''
  let mapsStandalone = ''
  let himbauanRaw = ''
  let htmRaw = ''
  let registrasiRaw = ''

  let lastField = ''

  for (const l of lines) {
    if (!l) continue
    
    // 🧹 Sapu bersih spasi hantu zero-width & invisible characters sebelum deteksi field!
    const line = l.replace(/[\u200b-\u200d\ufeff\ufe00-\ufe0f]/g, '').trim()
    if (!line) continue

    // 🌍 Instant Maps Match: Jika baris murni berisi tautan Google Maps saja
    const mapsUrlMatch = line.match(/^(?:🌏\s*G-maps\s*[:\-–]\s*)?(https?:\/\/(?:maps\.google\.com|goo\.gl|maps\.app\.goo\.gl)\S+)/i)
    if (mapsUrlMatch && line.repl    // -- Field Detectors (Berbasis Emoji & Kata Kunci Indonesia) --
    // Perbaikan Regex: Menggunakan [^:：\-–]* agar karakter apapun (termasuk spasi hantu/titik) sebelum separator tetap tertangkap!
    const isMateri = line.includes('📚') || line.match(/^(?:[》>\-•]+[\s]*)?(?:Materi|Tema|Judul|Kajian|Sesi\s+\d)[^:：\-–]*[:：\-–]/i)
    const isPemateri = line.includes('🎙️') || line.includes('🎙') || line.match(/^(?:[》>\-•]+[\s]*)?(?:Pemateri|Penceramah|Narasumber|Bersama|Oleh)[^:：\-–]*[:：\-–]/i)
    const isWaktu = line.includes('🕰️') || line.includes('🕰') || line.match(/^(?:[》>\-•]+[\s]*)?(?:Waktu|Jam|Pukul)[^:：\-–]*[:：\-–]/i)
    const isTempat = line.includes('🕌') || line.includes('🏡') || line.includes('🏢') || line.includes('🏛️') || line.match(/^(?:[》>\-•]+[\s]*)?(?:Tempat|Lokasi)[^:：\-–]*[:：\-–]/i)
    const isAlamat = line.includes('📍') || line.includes('🗺️') || line.includes('🌏') || line.match(/^(?:[》>\-•]+[\s]*)?(?:Alamat|Maps|Google Maps|G-maps)[^:：\-–]*[:：\-–]/i)
    const isKontak = line.includes('📞') || line.match(/^(?:[》>\-•]+[\s]*)?(?:Info|Kontak|Hubungi|WA|Telp|CP)[^:：\-–]*[:：\-–]/i)
    const isHimbauan = line.includes('⚠️') || line.includes('📣') || line.includes('📢') || line.includes('🚫') || line.includes('💡') || line.match(/^(?:[》>\-•]+[\s]*)?(?:Himbauan|Catatan|NB|Perhatian)[^:：\-–]*[:：\-–]/i)
    const isHtm = line.match(/^(?:[》>\-•]+[\s]*)?(?:HTM|Biaya|Tiket|Infaq)[^:：\-–]*[:：\-–]/i)
    const isRegistrasi = line.match(/^(?:[》>\-•]+[\s]*)?(?:Registrasi|Daftar|Pendaftaran|Link)[^:：\-–]*[:：\-–]/i)atatan|NB|Perhatian)[\s\w]*[:：\-–]/i)
    const isHtm = line.match(/^(?:[》>\-•]+[\s]*)?(?:HTM|Biaya|Tiket|Infaq)[\s\w]*[:：\-–]/i)
    const isRegistrasi = line.match(/^(?:[》>\-•]+[\s]*)?(?:Registrasi|Daftar|Pendaftaran|Link)[\s\w]*[:：\-–]/i)

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
      const cleanedAlamat = line
        .replace(/^(?:[》>\-•]+[\s]*)?(?:Alamat|Maps|Google Maps|G-maps)\s*[:：\-–]?\s*/i, '')
        .replace(/(?:📍|🗺️|🌏)\s*/g, '')
        .replace(/(https?:\/\/\S+)/g, '')
        .trim()
      
      // Smart Merging: Jangan menimpa alamat yang sudah ada (misal dari baris continuation sebelumnya)
      alamatStandalone = alamatStandalone ? `${alamatStandalone}, ${cleanedAlamat}` : cleanedAlamat
      lastField = 'alamat'
    } else if (isKontak) {
      kontakRaw = line
      lastField = 'kontak'
    } else if (isHimbauan) {
      himbauanRaw = line
      lastField = 'himbauan'
    } else if (isHtm) {
      htmRaw = line
      lastField = 'htm'
    } else if (isRegistrasi) {
      registrasiRaw = line
      lastField = 'registrasi'
    } else {
      // Lanjutan baris (Continuation Falling back)
      if (lastField === 'materi') materiRaw += '\n' + line
      else if (lastField === 'pemateri') pemateriRaw += '\n' + line
      else if (lastField === 'waktu') waktuRaw += '\n' + line
      else if (lastField === 'tempat') tempatRaw += '\n' + line
      else if (lastField === 'alamat') alamatStandalone += '\n' + line
      else if (lastField === 'kontak') kontakRaw += '\n' + line
      else if (lastField === 'himbauan') himbauanRaw += '\n' + line
      else if (lastField === 'htm') htmRaw += '\n' + line
      else if (lastField === 'registrasi') registrasiRaw += '\n' + line
      else {
        // Deteksi audiens melayang di bawah blok kontak (dalam kurung)
        if (line.match(/^\([^)]+\)$/)) {
          kontakRaw += '\n' + line
        } else {
          // Jika di awal-awal baris tanpa field pendeteksi, besar kemungkinan itu alamat yang menempel di bawah Nama Tempat
          if (!materiRaw && !pemateriRaw && tempatRaw && !alamatStandalone) {
            alamatStandalone += '\n' + line
          }
        }
      }
    }
  }

  // 💡 FALLBACK LEGACY: Jika mesin pencari baris gagal total
  if (!materiRaw && !tempatRaw) {
    materiRaw = extractField(block, ['📚'], ['🎙️', '🎙'])
    pemateriRaw = extractField(block, ['🎙️', '🎙'], ['🕰️', '🕰'])
    waktuRaw = extractField(block, ['🕰️', '🕰'], ['🕌', '🏡', '🏢'])
    tempatRaw = extractField(block, ['🕌', '🏡', '🏢'], ['📞'])
    kontakRaw = extractField(block, ['📞'], [])
  }

  // Pencucian data akhir menggunakan utilitas yang sudah teruji
  const materi = cleanMateri(materiRaw)
  const pemateri = cleanPemateri(pemateriRaw)
  const { mulai, selesai } = parseWaktu(waktuRaw)
  const { tempat: parsedTempat, alamat: parsedAlamat, maps_url: parsedMaps } = parseTempat(tempatRaw)
  const { kontak } = parseKontak(kontakRaw)
  const audience = extractAudience(block) // 🕵️ SENSING AUDIENCE SECARA GLOBAL DI SELURUH BLOK!

  // Penggabungan ekstraksi inline dan standalone
  const finalAlamat = (alamatStandalone || parsedAlamat).trim().replace(/^[\s,]+|[\s,]+$/g, '')
  let finalMapsUrl = mapsStandalone || parsedMaps

  // 🌍 GLOBAL FALLBACK MAPS HUNTER
  if (!finalMapsUrl) {
    const fallbackMaps = block.match(/(https?:\/\/(?:maps\.google\.com|goo\.gl|maps\.app\.goo\.gl)\S+)/i)
    finalMapsUrl = fallbackMaps?.[1] ?? ''
  }

  // 📍 Penebalan Nama Tempat jika kosong tapi ada baris ikon gedung
  let finalTempat = parsedTempat
  if (!finalTempat) {
    const match = block.match(/(?:🕌|🏡|🏢|🏛️|🏫)\s*(.+)/i)
    finalTempat = match?.[1]?.split('\n')[0]?.trim() ?? ''
  }

  const gradient_config = generateGradient(finalTempat || 'Kajian Islam', audience)

  // Pencucian Himbauan Premium
  let finalHimbauan = himbauanRaw
    .replace(/^(?:[》>\-•]+[\s]*)?(?:Himbauan|Catatan|NB|Perhatian)\s*[:：\-–]?\s*/i, '')
    .replace(/(?:⚠️|📣|📢|🚫|💡)\s*/g, '')
    .trim()
 
  const finalHtm = htmRaw.replace(/^(?:[》>\-•]+[\s]*)?(?:HTM|Biaya|Tiket|Infaq)\s*[:：\-–]?\s*/i, '').trim()
  const finalRegistrasi = registrasiRaw.replace(/^(?:[》>\-•]+[\s]*)?(?:Registrasi|Daftar|Pendaftaran|Link)\s*[:：\-–]?\s*/i, '').trim()

  if (!finalHimbauan) {
    finalHimbauan = extractHimbauan(block)
  }

  // 🕵️ SMART PER-BLOCK KONTRIBUTOR SENSING:
  // Cek apakah blok spesifik ini memiliki sumber/kreator tersendiri (berguna untuk mixed batch!)
  let localKontributor = header.kontributor;
  const localCreatorMatch = block.match(/(?:Creative\s+by|Creator|Sumber)\s*[:\-–]\s*([^`\n\•\>]+)/i);
  if (localCreatorMatch && localCreatorMatch[1]) {
    localKontributor = localCreatorMatch[1].trim().replace(/[\`\*\_]/g, '');
  } else if (/Jadwal\s+Kajian\s+Kaskus/i.test(block)) {
    localKontributor = 'Tim Jadwal Kajian Kaskus';
  }

  const result: Kajian = {
    kota: currentRegion,
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
    kontributor: localKontributor,
    is_cancelled: isLibur, // 🔥 Membawa status pembatalan secara sah!
    is_published: true,   // Default published true (akan di-override API bila perlu, misal bot)
  }

  if (finalHtm) result.htm = finalHtm
  if (finalRegistrasi) result.registrasi = finalRegistrasi

  return result
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
  // Sapu bersih zero-width spaces (\u200b dll) yang sering ikut ter-copypaste dari WA/Telegram
  const cleanStr = str.replace(/[\u200b-\u200d\ufeff\ufe00-\ufe0f]/g, '').trim()
  return cleanStr
    .replace(/^(?:📚|🎙️|🎙|🕰️|🕰|🕌|🏡|🏢|🏛️|🏫|📞|📍|🗺️|🌏|⚠️|📣|📢|🚫|💡|[》>\-•]+[\s]*)\s*/gu, '')
    // 🔥 FIX RELIABILITY: Gunakan [^:：\-–]*? agar karakter apapun sebelum separator tertangkap & terhapus!
    .replace(new RegExp(`^(?:${keywordsPattern})[^:：\\-–]*?[:：\\-–]\\s*`, 'i'), '')
    .trim()
}

// ---- Pemateri cleaning ----

function cleanMateri(raw: string): string {
  return stripPrefixTags(raw, 'Materi|Tema|Judul|Kajian')
}

function cleanPemateri(raw: string): string {
  return stripPrefixTags(raw, 'Pemateri|Penceramah|Narasumber|Bersama|Oleh')
    // Normalisasi suffix (hilangkan tanda minus di sekitar teks tapi pertahankan isinya)
    .replace(/\s*-\s*(hafizh?ahull[ah]*|hafizhahuma?ull[ah]*|rahimahull[ah]*)\s*-\s*/gi, ' $1 ')
    .replace(/\s*-\s*(hafizh?ahull[ah]*|hafizhahuma?ull[ah]*|rahimahull[ah]*)\b/gi, ' $1')
    .replace(/\b(hafizh?ahull[ah]*|hafizhahuma?ull[ah]*|rahimahull[ah]*)\s*-\s*/gi, '$1 ')
    .replace(/\s+/g, ' ')
    .trim()
}

// ---- Waktu parsing ----

function parseWaktu(raw: string): { mulai: string; selesai: string } {
  // Buang label audiens yang sering menempel di akhir waktu seperti (kajian anak), (khusus akhwat), dll
  let baseRaw = raw.replace(/\((?:kajian anak|khusus akhwat|umum|ikhwan|akhwat|muslimah.*)\)/i, '').trim()

  // Bersihkan kata pengantar & normalisasi SEMUA jenis tanda pisah ke format standar 's/d'
  let cleaned = stripPrefixTags(baseRaw, 'Waktu|Jam|Pukul')
    .replace(/\s*(?:[–—]|\-|s\/d)\s*/gi, ' s/d ') // Mengamankan en-dash, em-dash, dan hyphen
    .replace(/(?:\s*s\/d\s*)+/gi, ' s/d ') // Mencegah duplikasi s/d ganda
    .replace(/\s*s\/d\s*$/i, '') // Hapus s/d gantung di ujung teks jika ada
    .trim()

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

  // 1. Deteksi Pemisah Baris Fisik (\n) - Paling akurat jika ada!
  if (cleaned.includes('\n')) {
    const lines = cleaned.split('\n').map(l => l.trim()).filter(Boolean)
    if (lines.length > 1) {
      const firstLine = lines[0] ?? ''
      const secondLine = lines[1] ?? ''
      
      // 💡 KECERDASAN TAMBAHAN: Jika baris ke-2 dibungkus kurung penjelas, misal "(SIT Al Ihsan Legenda)",
      // gabungkan langsung sebagai sub-keterangan Tempat, bukan dipaksa masuk ke Alamat Jalan!
      const isSubVenueInfo = secondLine.startsWith('(') && secondLine.endsWith(')')
      
      if (isSubVenueInfo) {
        return {
          tempat: `${firstLine} ${secondLine}`.trim(),
          alamat: lines.slice(2).join(', '),
          maps_url
        }
      }

      return {
        tempat: firstLine,
        alamat: lines.slice(1).join(', '),
        maps_url
      }
    }
  }

  // 2. Split tempat and alamat by parentheses — "Masjid X (Jl. Y)"
  const parenMatch = cleaned.match(/^(.+?)\s*\((.+)\)\s*$/)
  if (parenMatch) {
    return {
      tempat: (parenMatch[1] ?? '').trim(),
      alamat: (parenMatch[2] ?? '').trim(),
      maps_url,
    }
  }

  // 3. 🔥 PISAHKAN OTOMATIS MENGGUNAKAN PENANDA JALAN (Jl. / Jalan)
  // Mendeteksi transisi ke alamat jalan raya khas penulisan Indonesia
  const jlMatch = cleaned.match(/^(.+?)(?:\s+|,\s*)(Jl\.|Jalan)\s+(.+)$/i)
  if (jlMatch && jlMatch[1] && jlMatch[2] && jlMatch[3]) {
    return {
      tempat: jlMatch[1].trim().replace(/,$/, '').trim(),
      alamat: `${jlMatch[2]} ${jlMatch[3]}`.trim(),
      maps_url
    }
  }

  return { tempat: cleaned, alamat: '', maps_url }
}

// ---- Kontak + audience parsing ----

function parseKontak(raw: string): { kontak: string } {
  // ✂️ Cukur awalan label kontak seperti "Info Panitia Kajian :" atau "Hubungi :"
  const textWithoutPrefix = stripPrefixTags(raw, 'Info\\s+Panitia\\s+Kajian|Info\\s+Panitia|Info|Kontak|Hubungi|WA|Telp|CP|Registrasi')

  // Bersihkan sisa-sisa tag audience/kurung
  const kontak = textWithoutPrefix
    .replace(/\([^)]*\)\s*$/, '')
    .trim()

  return { kontak }
}

function extractAudience(text: string): Audience {
  const raw = text.toUpperCase()

  // 🔥 DETEKSI KAJIAN ANAK
  const isAnak = raw.includes('KAJIAN ANAK') || raw.includes('ANAK-ANAK') || raw.includes('ANAK ANAK')
  if (isAnak) return 'ANAK'

  // 🔥 DETEKSI EMOJI GENDER UNICODE (🚻, 🚹, 🚺)
  const hasAkhwatEmoji = text.includes('🚺')
  const hasIkhwanEmoji = text.includes('🚹')
  const hasUmumEmoji = text.includes('🚻')

  // 1. Cek kasus Khusus/Only terlebih dahulu
  const isAkhwatOnly = raw.includes('KHUSUS AKHWAT') || raw.includes('AKHWAT ONLY') || raw.includes('MUSLIMAH ONLY') || raw.includes('UNTUK AKHWAT')
  if (isAkhwatOnly) return 'AKHWAT'

  const hasAkhwatText = raw.includes('AKHWAT') || raw.includes('MUSLIMAH')
  const hasIkhwanText = raw.includes('IKHWAN')

  const hasAkhwat = hasAkhwatText || hasAkhwatEmoji
  const hasIkhwan = hasIkhwanText || hasIkhwanEmoji

  // 2. Jika mengandung keduanya atau simbol umum (🚻), maka untuk UMUM!
  if (hasUmumEmoji || (hasAkhwat && hasIkhwan)) return 'UMUM'
  
  // 3. Fallback parsial
  if (hasAkhwat) return 'AKHWAT'
  if (hasIkhwan) return 'IKHWAN'
  
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

/**
 * Menghasilkan Kunci Follow (entity_key) terstandarisasi untuk langganan push notification.
 * Menangani penormalan case, pembersihan gelar ustadz, dan pengamanan tabrakan nama masjid antar kota (Composite Key).
 */
export function generateFollowKey(
  type: 'USTADZ' | 'MASJID' | 'KOTA',
  value: string | null | undefined,
  extraValue?: string | null | undefined // Khusus MASJID, diisi kajian.kota untuk mencegah tabrakan antar wilayah
): string {
  if (!value) return ''

  // Fungsi normalisasi teks dasar (lowercase & alphanumeric saja)
  const cleanText = (v: string) => v.toLowerCase().trim()
    .replace(/-?\s*hafizh?ahull[aā]h\s*-?/g, '')
    .replace(/-?\s*hafizhahum[aā]ull[aā]h\s*-?/g, '')
    .replace(/-?\s*rahimahull[aā]h\s*-?/g, '')
    .replace(/[^a-z0-9]/g, '')

  if (type === 'USTADZ') {
    // Untuk Ustadz, kita bersihkan juga imbuhan gelar umum di ujung jika terdeteksi agar matching-nya tangguh
    const baseName = value
      .replace(/(?:\s*,\s*)(?:Lc|M\.A|Dr|Lc\.|M\.Pd|M\.Pd\.I|M\.Ag|B\.A|S\.Pd\.I|M\.Si|Ph\.D)\.?\s*$/gi, '')
      .trim()
    return cleanText(baseName)
  }

  if (type === 'MASJID') {
    // 🔥 ANTI-COLLISION COMPOSITE KEY:
    // 1. Sapu bersih sisa label internal seperti "SESI X" atau trailing dash
    let rawMasjid = value.replace(/\s*SESI\s*\d+$/gi, '').trim().replace(/\s*-$/, '').trim()

    // 2. Lakukan pemotongan alamat fisik dini secara cerdas (Sama persis seperti splitTempatAddress!)
    // Kasus A: Jika memuat pemisah baris fisik (\n), ambil baris pertama
    if (rawMasjid.includes('\n')) {
      rawMasjid = rawMasjid.split('\n')[0] || rawMasjid
    }
    
    // Kasus B: Deteksi tanda jalan resilient (Jl, Jalan, dkk)
    const jlMatch = rawMasjid.match(/^(.+?)(?:\s+|,\s*)(Jl[n\.]*|Jalan|Ji[.\s])\s+(.+)$/i)
    if (jlMatch && jlMatch[1]) {
      rawMasjid = jlMatch[1].trim().replace(/,$/, '').trim()
    } else {
      // Kasus C: Deteksi kata kunci alamat Indonesia
      const keywordMatch = rawMasjid.match(/^(.+?)(?:\s+|,\s*)(Kav\.?|Kavling|Ruko|Cluster|Komplek|Perum\.?|Perumahan|Blok|Block|Kp\.?|Kampung|Dusun|Desa|Gg\.?|Gang)\s+(.+)$/i)
      if (keywordMatch && keywordMatch[1]) {
        rawMasjid = keywordMatch[1].trim().replace(/,$/, '').trim()
      }
    }

    // 3. Hancurkan sisa-sisa tanda kurung keterangan agar kebal terhadap teks tambahan yang berubah-ubah!
    const baseMasjid = rawMasjid.replace(/\s*\([^)]*\)/g, '').trim()
    const cleanMasjid = cleanText(baseMasjid)

    // 4. Tempelkan KOTA (jika ada) di belakangnya sebagai pengaman namespace agar tidak bertabrakan antar daerah!
    const cleanKota = extraValue ? cleanText(extraValue) : ''
    return cleanKota ? `${cleanMasjid}${cleanKota}` : cleanMasjid
  }

  // Default / KOTA
  return cleanText(value)
}

