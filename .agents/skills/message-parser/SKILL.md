---
name: message-parser
description: Builds or modifies the rules-based parser engine that extracts kajian data from WhatsApp/Telegram group copas text. Use when working on packages/parser/src/index.ts or when fixing parsing bugs.
---

# Message Parser Skill

## What this parser does
Converts raw WhatsApp/Telegram copas text into structured `ParseResult` containing an array of `Kajian` objects. No AI involved — pure regex and string manipulation.

## Input format pattern
```
Jadwal Kajian [DAY], [DATE_MASEHI] / [DATE_HIJRIYAH]. Untuk daerah [KOTA] dan sekitarnya.
📚 Materi : [MATERI]
🎙️ Pemateri : [PEMATERI] -hafizhahullah-
🕰️ Waktu : [WAKTU_MULAI] s/d [WAKTU_SELESAI] WIB
🕌 Tempat : [TEMPAT] ([ALAMAT])[MAPS_URL]
📞 Info Panitia Kajian : [KONTAK]([AUDIENCE])
~
[next kajian...]
```

## Parsing algorithm

### Step 1: Extract header
```typescript
// Header is everything before the first 📚
const headerEnd = text.indexOf('📚')
const header = text.slice(0, headerEnd)

// Extract tanggal masehi
const tanggalMatch = header.match(/(\d{1,2}\s+\w+\s+\d{4})/)

// Extract tanggal hijriyah
const hijriMatch = header.match(/(\d{1,2}\s+\w+\s+\d{4})\s+Hijriyah/)

// Extract kota
const kotaMatch = header.match(/daerah\s+([^d]+?)\s+dan\s+sekitarnya/)
```

### Step 2: Split into individual kajian
```typescript
const kajianBlocks = text.split('~').filter(block => block.includes('📚'))
```

### Step 3: Extract per field using emoji anchors
```typescript
function extractBetweenEmojis(text: string, startEmoji: string, endEmojis: string[]): string {
  const start = text.indexOf(startEmoji)
  if (start === -1) return ''

  let end = text.length
  for (const emoji of endEmojis) {
    const pos = text.indexOf(emoji, start + 1)
    if (pos !== -1 && pos < end) end = pos
  }

  return text.slice(start + startEmoji.length, end).replace(/^[\s:]+/, '').trim()
}
```

### Step 4: Clean pemateri
```typescript
function cleanPemateri(raw: string): string {
  return stripPrefixTags(raw, 'Pemateri|Penceramah|Narasumber|Bersama|Oleh')
    // Normalisasi suffix (hilangkan tanda minus di sekitar teks tapi pertahankan isinya!)
    .replace(/\s*-\s*(hafizh?ahull[ah]*|hafizhahuma?ull[ah]*|rahimahull[ah]*)\s*-\s*/gi, ' $1 ')
    .replace(/\s*-\s*(hafizh?ahull[ah]*|hafizhahuma?ull[ah]*|rahimahull[ah]*)\b/gi, ' $1')
    .replace(/\b(hafizh?ahull[ah]*|hafizhahuma?ull[ah]*|rahimahull[ah]*)\s*-\s*/gi, '$1 ')
    .replace(/\s+/g, ' ')
    .trim()
}
```

### Step 5: Parse waktu
```typescript
function parseWaktu(raw: string): { mulai: string; selesai: string } {
  // Bersihkan kata pengantar & normalisasi SEMUA jenis tanda pisah
  let cleaned = stripPrefixTags(raw, 'Waktu|Jam|Pukul')
    .replace(/\s*([–—]|\-|s\/d)\s*/gi, ' s/d ')
    .trim()

  if (!cleaned) return { mulai: '', selesai: 'Selesai' }

  // 1. Format: "10.00 s/d 12.00 WIB"
  const twoTimeMatch = cleaned.match(/(\d{1,2}[.:]\d{2})\s*(?:WIB|WITA|WIT)?\s+s\/d\s+(\d{1,2}[.:]\d{2})/i)
  if (twoTimeMatch) {
    return {
      mulai: (twoTimeMatch[1] ?? '').replace('.', ':'),
      selesai: (twoTimeMatch[2] ?? '').replace('.', ':'),
    }
  }

  // 2. Format: "10.00 WIB s/d Selesai"
  const oneTimeMatch = cleaned.match(/(\d{1,2}[.:]\d{2}(?:\s*(?:WIB|WITA|WIT))?)\s+s\/d\s+(.+)/i)
  if (oneTimeMatch) {
    return {
      mulai: (oneTimeMatch[1] ?? '').replace('.', ':'),
      selesai: (oneTimeMatch[2] ?? '').trim(),
    }
  }

  // 3. Format: "Ba'da Shalat Ashar s/d Selesai"
  const badaMatch = cleaned.match(/(Ba['''']da\s+Shalat\s+\w+)\s+s\/d\s+(.+)/i)
  if (badaMatch) {
    return { 
      mulai: badaMatch[1] ?? cleaned, 
      selesai: (badaMatch[2] ?? 'Selesai').trim() 
    }
  }

  return { mulai: cleaned, selesai: 'Selesai' }
}
```

### Step 6: Extract audience
```typescript
function extractAudience(text: string): Audience {
  const raw = text.toUpperCase()

  // 🕵️ DETEKSI EMOJI GENDER UNICODE (🚻, 🚹, 🚺)
  const hasAkhwatEmoji = text.includes('🚺')
  const hasIkhwanEmoji = text.includes('🚹')
  const hasUmumEmoji = text.includes('🚻')

  // 1. Cek kasus Khusus/Only
  const isAkhwatOnly = raw.includes('KHUSUS AKHWAT') || raw.includes('AKHWAT ONLY') || raw.includes('MUSLIMAH ONLY') || raw.includes('UNTUK AKHWAT')
  if (isAkhwatOnly) return 'AKHWAT'

  const hasAkhwatText = raw.includes('AKHWAT') || raw.includes('MUSLIMAH')
  const hasIkhwanText = raw.includes('IKHWAN')

  const hasAkhwat = hasAkhwatText || hasAkhwatEmoji
  const hasIkhwan = hasIkhwanText || hasIkhwanEmoji

  if (hasUmumEmoji || (hasAkhwat && hasIkhwan)) return 'UMUM'
  if (hasAkhwat) return 'AKHWAT'
  if (hasIkhwan) return 'IKHWAN'
  return 'UMUM'
}
```

### Step 7: Generate gradient config
```typescript
function generateGradient(tempat: string): GradientConfig {
  const palettes = [
    { from: '#1a4731', to: '#2d7a4f' },  // hijau tua
    { from: '#1e3a5f', to: '#2e6da4' },  // biru navy
    { from: '#2d1b4e', to: '#6b3fa0' },  // ungu
    { from: '#1a3a3a', to: '#2a7a6a' },  // teal islami
    { from: '#3a2a1a', to: '#8a6a3a' },  // coklat emas
    { from: '#1a2a3a', to: '#3a6a9a' },  // biru muda
    { from: '#2a1a2a', to: '#7a4a7a' },  // ungu muda
    { from: '#1a3a2a', to: '#4a9a6a' },  // hijau muda
  ]

  // Deterministic hash from tempat name
  const hash = tempat.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  const palette = palettes[hash % palettes.length]
  const angle = (hash * 37) % 360

  return { ...palette, angle }
}
```

## Common edge cases to handle
- Emoji mepet: `"...Rambe)https://maps..."` — URL langsung setelah kurung tutup
- Maps URL kadang di tengah, kadang di akhir blok
- Kontak format bervariasi: `0813-xxxx`, `+62813xxxx`, ada yang `(Whatsapp Chat Only)`
- Beberapa kajian tidak punya maps URL sama sekali
- Nama tempat kadang ada dalam kurung: `Masjid X (Komplek Y)`
- **Cancellation Flag (`is_cancelled`)**: Jika blok kajian mengandung frasa `DILIBURKAN` secara case-insensitive, parser WAJIB mendeteksinya dan menetapkan flag `is_cancelled: true` alih-alih membuang blok data tersebut!
- **Dynamic Place Splitter**: Di level parser engine (`packages/parser/src/index.ts`), parser harus pintar membagi teks `tempat` dan `alamat` secara dini:
  1. Cek pembatas baris fisik (`\n`) -> Baris pertama Nama Venue, sisanya Alamat.
  2. Cek transisi menuju penanda jalan (`Jl.` / `Jalan`) -> Belah kalimat di titik transisi tersebut!

