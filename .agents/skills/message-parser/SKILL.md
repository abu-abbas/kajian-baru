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
  return raw
    .replace(/-\s*hafizh?ahullah\s*-/gi, '')
    .replace(/-\s*hafizhahuma?ullah\s*-/gi, '')
    .replace(/-\s*rahimahullah\s*-/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
}
```

### Step 5: Parse waktu
```typescript
function parseWaktu(raw: string): { mulai: string; selesai: string } {
  // Format: "10.00 s/d 12.00 WIB"
  const timeMatch = raw.match(/(\d{1,2}[.:]\d{2})\s+s\/d\s+(\d{1,2}[.:]\d{2})/)
  if (timeMatch) {
    return {
      mulai: timeMatch[1].replace('.', ':'),
      selesai: timeMatch[2].replace('.', ':')
    }
  }

  // Format: "Ba'da Shalat Ashar s/d Selesai"
  const badaMatch = raw.match(/(Ba['']da\s+Shalat\s+\w+)\s+s\/d\s+(\w+)/)
  if (badaMatch) {
    return { mulai: badaMatch[1], selesai: badaMatch[2] }
  }

  return { mulai: raw, selesai: 'Selesai' }
}
```

### Step 6: Extract audience
```typescript
function extractAudience(text: string): Audience {
  const match = text.match(/\(([^)]+)\)\s*$/)
  if (!match) return 'UMUM'

  const raw = match[1].toUpperCase()
  if (raw.includes('AKHWAT') || raw.includes('MUSLIMAH')) return 'AKHWAT'
  if (raw.includes('IKHWAN') && !raw.includes('AKHWAT')) return 'IKHWAN'
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

