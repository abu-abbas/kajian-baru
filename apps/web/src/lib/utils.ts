import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { Kajian } from '@kajian-baru/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// 💎 Helper Title Case: Membuat huruf depan setiap kata menjadi kapital secara elegan!
// Kebal terhadap singkatan/gelar akademis (seperti S.Pd.I, Lc., dll.)
export const toTitleCase = (str: string | null | undefined): string => {
  if (!str) return ''
  return str.split(/\s+/).map(word => {
    if (!word) return ''
    
    // Pertahankan singkatan bertitik (Lc., S.Pd.I) atau akronim kapital penuh (WIB)
    const hasDots = word.includes('.')
    const isAcronymOrTitle = /[A-Z].*[A-Z]/.test(word)
    if (hasDots || isAcronymOrTitle) return word
    
    // 🔥 Cari huruf alfabet pertama untuk dikapitalisasi (mengatasi tanda kurung seperti "(blok" => "(Blok")
    return word.replace(/([a-zA-Z])(.*)/, (_, firstLetter, rest) => {
      return firstLetter.toUpperCase() + rest.toLowerCase()
    })
  }).join(' ')
}

// 🧼 Retroactive Scrubbers: Sapu bersih data kotor warisan masa lalu demi visual premium secara runtime
export const cleanVisual = (val: string | null | undefined, pattern: string, shouldTitleCase = true): string => {
  if (!val) return ''
  let cleanStr = val
    .replace(/[\u200b-\u200d\ufeff\ufe00-\ufe0f]/g, '') // Hancurkan spasi hantu & sisa emoji (Variation Selectors)!
    .trim()
    .replace(/^(?:📚|🎙️|🎙|🕰️|🕰|🕌|📞|📍|🗺️|⚠️|📣|📢|🚫|💡)\s*/gu, '') // Sapu bersih emoji di awal teks!
    .replace(new RegExp(`^(?:${pattern})\\s*[:：\\-–]?\\s*`, 'i'), '')
    .trim()

  // 🔥 HANCURKAN EMOJI GENDER/TOILET ANNOYING YANG MENGOTORI VISUAL!
  // Menghapus 🚻, 🚹, 🚺, dan 🚼 (anak) secara global di manapun berada!
  cleanStr = cleanStr.replace(/[🚻🚹🚺🚼]/gu, '').trim()

  // 🔥 HANCURKAN REDUNDANSI STATUS "KAJIAN DILIBURKAN" DI RUNTIME!
  // Kartu kita sudah punya badge status 'DILIBURKAN' merah yang megah di atas, 
  // jadi teks duplikat di ekor kontak/materi ini wajib disikat bersih beserta simbol kurungnya!
  cleanStr = cleanStr.replace(/(?:\s*|,\s*)[⟫》»«《⟪\•\|\:\-]*\s*KAJIAN\s+DILIBURKAN/gi, '').trim()
  // Sapu juga simbol bracket tersesat jika masih ada sisa
  cleanStr = cleanStr.replace(/[⟫》»«《⟪]/gu, '').trim()

  // 🧼 CUCI GUDANG: Bersihkan sisa-sisa pembatas mengambang seperti "/", "-", "|" di ujung-ujung kalimat!
  // Berguna jika input tadinya " - 🚹/🚺" agar menjadi bersih mutlak dan row-nya menyembunyikan diri!
  cleanStr = cleanStr
    .replace(/^[\s\/\-\|]+/, '') // Hapus separator mengambang di depan
    .replace(/[\s\/\-\|]+$/, '') // Hapus separator mengambang di belakang
    .replace(/\/\s*\//g, '/')    // Bersihkan double slash berjejer
    .trim()

  // Jika setelah dibersihkan isinya cuma menyisakan sampah tunggal, kosongkan!
  if (cleanStr === '-' || cleanStr === '/' || cleanStr === '') return ''

  return shouldTitleCase ? toTitleCase(cleanStr) : cleanStr
}

// 💎 UI Styling & Branding Helpers
export const getAudienceVariant = (audience: string): 'pink' | 'blue' | 'success' | 'amber' => {
  if (audience === 'AKHWAT') return 'pink'
  if (audience === 'IKHWAN') return 'blue'
  if (audience === 'ANAK') return 'amber'
  return 'success'
}

export const getAudienceTextColor = (audience: string | null | undefined): string => {
  if (audience === 'AKHWAT') return 'text-rose-100'
  if (audience === 'IKHWAN') return 'text-blue-100'
  if (audience === 'ANAK') return 'text-amber-100'
  return 'text-emerald-50'
}

export const getCategoryGradient = (audience: string | null | undefined, angle = 135): string => {
  if (audience === 'AKHWAT') {
    return `linear-gradient(${angle}deg, #4c0519, #9d174d)` // Deep luxurious rose to pink
  }
  if (audience === 'IKHWAN') {
    return `linear-gradient(${angle}deg, #0f172a, #1e3a8a)` // Deep luxurious navy to royal blue
  }
  if (audience === 'ANAK') {
    return `linear-gradient(${angle}deg, #78350f, #d97706)` // Fun luxurious dark amber to gold
  }
  return `linear-gradient(${angle}deg, #1a4731, #2d7a4f)` // Premium standard emerald (Umum)
}

// 📅 Intelligent Universal Date Formatter (Toleran terhadap format bulan pendek di tabel admin!)
export const formatDisplayDate = (dateStr: string | null | undefined, shortMonth = false): string => {
  if (!dateStr) return shortMonth ? '-' : ''
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (match) {
    const monthsLong = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
    const monthsShort = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
    const months = shortMonth ? monthsShort : monthsLong
    
    const year = match[1]
    const month = months[parseInt(match[2] ?? '1', 10) - 1] ?? (shortMonth ? 'Jan' : 'Januari')
    const day = parseInt(match[3] ?? '1', 10).toString()
    return `${day} ${month} ${year}`
  }
  return dateStr
}

// 🔍 Redundancy Checkers
export const checkSelesaiRedundant = (waktuMulai: string | null | undefined, waktuSelesai: string | null | undefined): boolean => {
  if (!waktuSelesai || waktuSelesai.toLowerCase() !== 'selesai') return false
  if (!waktuMulai) return false
  
  const lowerMulai = waktuMulai.toLowerCase()
  return (
    waktuMulai.includes('-') || 
    waktuMulai.includes('–') || 
    waktuMulai.includes('—') || 
    lowerMulai.includes('s/d') || 
    lowerMulai.includes('sampai') ||
    lowerMulai.includes('selesai')
  )
}

/**
 * Mengelompokkan rentetan data Kajian berdasarkan Tempat (Normalized) & Tanggal,
 * berguna untuk menggabungkan Sesi 1 & Sesi 2 ke dalam satu card UI interaktif bertab.
 * Mempertahankan urutan kronologis asli dari Supabase.
 */
export function groupKajiansByLocation(list: Kajian[]): Kajian[][] {
  const result: Kajian[][] = []
  const seenKeys = new Map<string, number>() // Key -> Index penampungan di 'result'

  for (const k of list) {
    const tempatNorm = (k.tempat || '')
      .toLowerCase()
      .replace(/\s*sesi\s*\d+/gi, '') // Bersihkan label sesi agar group matching sempurna
      .replace(/[^a-z0-9]/g, '')
      .trim()

    const key = `${k.tanggal_masehi}::${tempatNorm}`

    if (seenKeys.has(key)) {
      const index = seenKeys.get(key)!
      result[index]?.push(k)
    } else {
      seenKeys.set(key, result.length)
      result.push([k])
    }
  }
  // Urutkan setiap grup secara internal berdasarkan waktu mulai (HH:MM) agar Sesi 1 selalu tampil duluan
  // Sangat berguna untuk menormalkan data legacy yang masuk bersamaan dengan created_at identik
  for (const group of result) {
    if (group.length > 1) {
      group.sort((a, b) => {
        // Coba temukan format jam HH:MM atau HH.MM
        const timeA = a.waktu_mulai.match(/(\d{1,2})[:.](\d{2})/);
        const timeB = b.waktu_mulai.match(/(\d{1,2})[:.](\d{2})/);
        
        if (timeA && timeB) {
          const minA = parseInt(timeA[1] || '0') * 60 + parseInt(timeA[2] || '0');
          const minB = parseInt(timeB[1] || '0') * 60 + parseInt(timeB[2] || '0');
          return minA - minB; // Ascending time
        }
        
        // Fallback: biarkan urutan apa adanya (biasanya sudah tersortir dari DB jika created_at tidak identik)
        return 0;
      });
    }
  }

  return result
}

/**
 * Memecah string 'Tempat' menjadi Nama Venue dan Alamat secara dinamis di level Runtime layer.
 * Sangat resilient terhadap data historis kotor/lama di DB yang belum terpecah kolomnya.
 * Sekaligus membabat habis label internal "SESI 1/2" yang menempel di ekor alamat.
 */
export function splitTempatAddress(
  tempat: string | null | undefined, 
  alamat?: string | null | undefined
): { cleanTempat: string; cleanAlamat: string } {
  let rawTempat = (tempat || '').trim()
  let rawAlamat = (alamat || '').trim()

  // Bersihkan data kotor seperti tanda hubung tunggal atau titik kosong di kolom alamat asli
  const isGarbage = (v: string) => !v || v === '-' || v === '.'
  if (isGarbage(rawAlamat)) rawAlamat = ''

  // Sapu bersih label internal sistem "SESI 1" atau dash hantu di ujung string
  const stripInternalSesi = (v: string) => v.replace(/\s*SESI\s*\d+$/gi, '').trim().replace(/\s*-$/, '').trim()
  
  rawTempat = stripInternalSesi(rawTempat)
  rawAlamat = stripInternalSesi(rawAlamat)

  // Kasus A: Jika kolom alamat di DB sudah terisi mapan, gunakan langsung
  if (rawAlamat) {
    return { cleanTempat: rawTempat, cleanAlamat: rawAlamat }
  }

  // Kasus B: Jika tempat memuat pemisah baris fisik (\n)
  if (rawTempat.includes('\n')) {
    const lines = rawTempat.split('\n').map(l => l.trim()).filter(Boolean)
    if (lines.length > 1) {
      return {
        cleanTempat: lines[0]!,
        cleanAlamat: lines.slice(1).join(', ')
      }
    }
  }

  // 🔥 STRATEGI 1: Deteksi Tanda Jalan Resilient (Jl., Jln, Jalan, JI., dll.)
  // Mendukung typo huruf l/I, singkatan variatif, dan variasi tanda titik.
  const jlMatch = rawTempat.match(/^(.+?)(?:\s+|,\s*)(Jl[n\.]*|Jalan|Ji[.\s])\s+(.+)$/i)
  if (jlMatch && jlMatch[1] && jlMatch[2] && jlMatch[3]) {
    return {
      cleanTempat: jlMatch[1].trim().replace(/,$/, '').trim(),
      cleanAlamat: `${jlMatch[2]} ${jlMatch[3]}`.trim()
    }
  }

  // 🔥 STRATEGI 2: Deteksi Kata Kunci Alamat Indonesia (Kavling, Ruko, Cluster, Blok, dll.)
  // Memecah string tepat sebelum dimulainya blok alamat perumahan/komersil.
  const keywordMatch = rawTempat.match(/^(.+?)(?:\s+|,\s*)(Kav\.?|Kavling|Ruko|Cluster|Komplek|Perum\.?|Perumahan|Blok|Block|Kp\.?|Kampung|Dusun|Desa|Gg\.?|Gang)\s+(.+)$/i)
  if (keywordMatch && keywordMatch[1] && keywordMatch[2] && keywordMatch[3]) {
    return {
      cleanTempat: keywordMatch[1].trim().replace(/,$/, '').trim(),
      cleanAlamat: `${keywordMatch[2]} ${keywordMatch[3]}`.trim()
    }
  }

  // 🔥 STRATEGI 3: Deteksi Teks Setelah Tanda Kurung (Parentheses Suffix Split)
  // Berguna jika masjid diakhiri kurung penjelasan, diikuti alamat mentah di belakangnya.
  // Contoh: "Masjid A (Green Park) Jatimelati, Bekasi"
  const parenSplitMatch = rawTempat.match(/^(.+?\))\s+([^()]{4,})$/)
  if (parenSplitMatch && parenSplitMatch[1] && parenSplitMatch[2]) {
    return {
      cleanTempat: parenSplitMatch[1].trim(),
      cleanAlamat: parenSplitMatch[2].trim()
    }
  }

  // 🔥 STRATEGI 4: Deteksi Pembatas Area Kecamatan/Kota/Kabupaten (Kec., Kel., Kab.)
  // Jurus pamungkas mendeteksi hirarki administratif di akhir string.
  const areaMatch = rawTempat.match(/^(.+?)(?:\s+|,\s*)(Kec\.?|Kecamatan|Kel\.?|Kelurahan|Kab\.?|Kabupaten|Rt\s*\d+)\s+(.+)$/i)
  if (areaMatch && areaMatch[1] && areaMatch[2] && areaMatch[3]) {
    return {
      cleanTempat: areaMatch[1].trim().replace(/,$/, '').trim(),
      cleanAlamat: `${areaMatch[2]} ${areaMatch[3]}`.trim()
    }
  }

  // Kasus Terakhir: Jika buntu, biarkan as-is
  return { cleanTempat: rawTempat, cleanAlamat: '' }
}


