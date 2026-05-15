import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// 💎 Helper Title Case: Membuat huruf depan setiap kata menjadi kapital secara elegan!
// Kebal terhadap singkatan/gelar akademis (seperti S.Pd.I, Lc., dll.)
export const toTitleCase = (str: string | null | undefined): string => {
  if (!str) return ''
  return str.split(/\s+/).map(word => {
    if (!word) return ''
    const hasDots = word.includes('.')
    const isAcronymOrTitle = /[A-Z].*[A-Z]/.test(word)
    if (hasDots || isAcronymOrTitle) return word.charAt(0).toUpperCase() + word.slice(1)
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  }).join(' ')
}

// 🧼 Retroactive Scrubbers: Sapu bersih data kotor warisan masa lalu demi visual premium secara runtime
export const cleanVisual = (val: string | null | undefined, pattern: string, shouldTitleCase = true): string => {
  if (!val) return ''
  const cleanStr = val
    .replace(/[\u200b-\u200d\ufeff\ufe00-\ufe0f]/g, '') // Hancurkan spasi hantu & sisa emoji (Variation Selectors)!
    .trim()
    .replace(/^(?:📚|🎙️|🎙|🕰️|🕰|🕌|📞|📍|🗺️|⚠️|📣|📢|🚫|💡)\s*/gu, '') // Sapu bersih emoji di awal teks!
    .replace(new RegExp(`^(?:${pattern})\\s*[:：\\-–]?\\s*`, 'i'), '')
    .trim()
  return shouldTitleCase ? toTitleCase(cleanStr) : cleanStr
}

// 💎 UI Styling & Branding Helpers
export const getAudienceVariant = (audience: string): 'pink' | 'blue' | 'success' => {
  if (audience === 'AKHWAT') return 'pink'
  if (audience === 'IKHWAN') return 'blue'
  return 'success'
}

export const getCategoryGradient = (audience: string | null | undefined, angle = 135): string => {
  if (audience === 'AKHWAT') {
    return `linear-gradient(${angle}deg, #4c0519, #9d174d)` // Deep luxurious rose to pink
  }
  if (audience === 'IKHWAN') {
    return `linear-gradient(${angle}deg, #0f172a, #1e3a8a)` // Deep luxurious navy to royal blue
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
