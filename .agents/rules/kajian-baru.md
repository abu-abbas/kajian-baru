---
trigger: always_on
---

# KajianBaru — Project Rules


## Stack & Tech
- Full TypeScript everywhere — no JavaScript files
- Monorepo with pnpm workspaces
- Frontend: React + Vite + TailwindCSS
- Backend: Hono running on Railway
- Database + Auth: Supabase (PostgreSQL + Google OAuth)
- Push notifications: Web Push API (no Firebase)
- Bot (later): Telegram via grammy

## Code Style
- Always use named exports, never default exports except for React components
- Use `type` not `interface` for all TypeScript types
- No `any` type — ever. Use `unknown` and narrow it
- Async/await only — no `.then()` chains
- Always handle errors explicitly — no silent catches
- File names: kebab-case for files, PascalCase for React components
- **WAJIB DRY (Don't Repeat Yourself)**: Sentralisasikan semua shared display scrubbers, date formatters, visual styling generators, dan checker functions ke dalam `apps/web/src/lib/utils.ts`. JANGAN PERNAH menduplikasi logika atau fungsi pembantu yang sama di beberapa file komponen React terpisah!

## Project Structure
- Shared types live in `packages/types/src/index.ts` — import from there always
- Parser engine lives in `packages/parser/src/index.ts` — never duplicate parsing logic
- API routes in `apps/api/src/routes/` — one file per domain (kajian, admin, push)
- React components in `apps/web/src/components/` — one component per file
- Shared utility functions live in `apps/web/src/lib/utils.ts` — import from there always

## Database Rules
- Always use Supabase client from a shared singleton, never instantiate inline
- Never expose Supabase service role key to frontend — only anon key
- All DB writes go through the API, never directly from frontend
- Use RLS policies as the security layer — always verify they are active
- **Database Integrity**: Jangan pernah sengaja mengedit/mengubah data mentah di DB live secara "curang" (skrip migrasi pembersih ad-hoc) hanya untuk mengakomodasi inkonsistensi tampilan visual; semua inkonsistensi data historis di DB harus ditangani dengan ksatria di runtime layer UI menggunakan visual scrubbers yang tangguh!
- **Centralized Data Ingest Flow**: Seluruh jalur masuk data baru (dari bot telegram maupun admin panel bulk) WAJIB dilarikan ke API Ingest Engine (`apps/api/src/lib/ingest.ts`). JANGAN PERNAH memanggil Supabase `.insert()` mentahan di route endpoint! Pintu gerbang `safeIngestKajian` memikul tanggung jawab sakral mencegah data duplikat dan secara cerdas memperbarui flag `is_cancelled: true` jika data kajian lama disubmit ulang dengan status Diliburkan!
- **Unified Composite Follow Keys**: Sistem notifikasi langganan push (tabel `user_follows`) WAJIB menggunakan `generateFollowKey()` dari `@kajian-baru/parser` di kedua sisi (Frontend & API). Khusus entitas `MASJID`, kunci follow WAJIB digabungkan dengan data `KOTA` (Composite Key) dan tanda kurung keterangan dilucuti habis! Ini krusial untuk mencegah tabrakan nama masjid antar-kota yang sama, sekaligus menjamin kekebalan mutlak terhadap variasi teks ornamen dalam kurung!
- **Proactive Scaling Optimization**: Setiap kali membuat/memodifikasi API Endpoint yang memicu pencarian kata parsial liar (`.ilike("%keyword%")`), WAJIB hukumnya memprovisikan indeks **`pg_trgm` GIN** di file `supabase/schema.sql` untuk menjamin performa pencarian tetap kencang di bawah mikrodetik ketika baris data menyentuh ratusan ribu!

## Auth Rules
- Admin check: always verify against `admin_users` table, not just Supabase auth
- Never trust role from JWT alone — double check in DB
- Protect all `/admin` routes both on frontend (redirect) and backend (middleware)

## Parser Rules
- Parser engine must be pure functions — no side effects, no DB calls
- Parser must return `ParseResult` type always
- Never call Claude API for parsing — rules-based only
- Parser must handle ini dengan teliti:
  - Sapu bersih spasi hantu zero-width (`\u200b` dkk) DAN Variation Selectors (`\ufe00-\ufe0f`) di baris pertama agar filter regex tidak mental!
  - Suffix "-hafizhahullah-" dan variasinya harus dipertahankan dan dinormalisasi (buang tanda minus/dash di sekitarnya)
  - Waktu "Ba'da Shalat X" tetap disimpan as-is sebagai string
  - Audience extracted dari tanda kurung di akhir teks kajian
- **Synchronized Extraction Engine**: Seluruh jalur parsing data masuk (baik dari form Admin Website maupun pesan masuk Bot Telegram) WAJIB memanggil shared library terpusat `@kajian-baru/parser` guna menjamin konsistensi ekstraksi teks absolut!

## UI Rules
- UI must follow `shadcn-ui` principles FIRST — always use primitive UI components from `apps/web/src/components/ui/`
- Use luxury Dark Emerald theme with glassmorphism utilities (`.glass`, `.glass-hover`) — no arbitrary plain HTML inputs/dropdowns
- Mobile-first always — test di 375px width dulu
- Warna tema: nuansa hijau islami, tidak norak (gunakan primary `hsl(142 72% 29%)`)
- KajianCard tanpa poster: tampilkan gradient dari `gradient_config`
- KajianCard dengan poster: poster sebagai background dengan overlay gelap
- **Runtime Visual Scrubbing**: Setiap rendering field data kajian (Materi, Pemateri, Tempat, dll) harus dibersihkan menggunakan helper terpusat `cleanVisual()` untuk menghapus tag label warisan masa lalu secara case-insensitive dan toleran terhadap sisa emoji/variation selectors.
- **Smart Address Decoupler**: Setiap rendering `Tempat / Lokasi` di UI (kartu depan & dialog detail) WAJIB dilewatkan ke helper `splitTempatAddress()` di `utils.ts` untuk memisahkan Nama Venue (Bold) dari alamat fisik/jalan (Normal, Kecil, Tipis) secara dinamis! Ini sangat krusial agar keyword follow user tetap bersih dan visual terparkir sangat rapi!
- **Seamless Multi-Session Support**: Komponen visual utama seperti `KajianCard` dan `KajianDetailDialog` harus dirancang fleksibel untuk menerima data homogen tunggal `Kajian` ATAU array grup ganda `Kajian[]`. Gunakan internal `activeIdx` state untuk navigasi antar-sesi, dan pastikan tombol follow/aksi secara realtime mengikuti context sesi yang sedang aktif!
- Loading state harus selalu ada untuk setiap async operation
- Error state harus selalu ditampilkan dengan pesan yang jelas
- Selalu gunakan ikon Lucide React untuk UI labels. Dilarang keras menggunakan emoji Unicode sistem (seperti 🏠, 📍, ⚠️, 📁) agar visual tetap berkelas!
- **Adaptive Scroll-Triggered Clean Header**: Lindungi Navbar utama dari kepadatan padat. Elemen penunjang sekunder (seperti widget pencarian) sebaiknya tersembunyi saat awal muat layar (top = 0), dan baru diluncurkan/dihadirkan ke dalam Navbar dengan transisi indah ketika pengguna melakukan scroll ke bawah (`isScrolled`).
- **Branding Vector First**: Seluruh icon brand dan favicon WAJIB berbasis vector murni (`favicon.svg`) dan dipetakan ke icon PWA PNG 192x192 / 512x512 yang 100% simetris & transparan tanpa background samping kotak padat.
- **Command Spotlight Experience**: Pencarian global harus mengadopsi gaya MacOS Spotlight (dialog melayang tengah-atas dengan backdrop heavy blur, shortcut Meta+K, listener otomatis `Escape` key untuk tutup instan, dan auto-focus seketika saat terbuka).
- **Unified Telegram Visual Fidelity**: Desain visual format preview di Telegram Bot (`bot.ts`) WAJIB dirawat secara sinergi mengikuti kaidah keanggunan UI frontend:
  - Selalu sembunyikan baris field opsional jika bernilai kosong/`-` alih-alih menampilkan tanda strip jelek!
  - Selalu terapkan konversi tanggal dari format database ISO (`YYYY-MM-DD`) ke format ramah Indonesia (`DD-MM-YYYY`) pada tampilan chat preview!
  - Untuk pesan masuk bot tanpa tanggal eksplisit, WAJIB gunakan intelligent fallback ke tanggal pesan Telegram tersebut dikirimkan (WIB context).

## Deployment & Monorepo Rules
- **Monorepo Watch-Path Force Trigger**: Karena Railway disetel hanya memantau `apps/api/**`, perubahan yang HANYA menyentuh *shared package* seperti `@kajian-baru/parser` atau `packages/types` akan otomatis **DI-SKIP** oleh trigger GitHub. 
- **WAJIB HACK KOMENTAR**: Setiap kali merilis pembaruan di shared package tanpa menyentuh folder `apps/api`, tambahkan komentar pemicu dummy di baris paling atas `apps/api/src/routes/bot.ts` (misal: `// FORCE_REBUILD: update parser`) lalu push untuk memaksa CI/CD Railway membangun ulang sistem secara menyeluruh!

## What NOT to do
- Jangan hardcode API keys — selalu dari environment variables
- Jangan bypass RLS dengan service role key di frontend
- Jangan duplikasi tipe — selalu import dari `packages/types`
- Jangan buat komponen lebih dari 200 baris — pecah jadi smaller components
- Jangan skip error handling dengan alasan "nanti aja"
- Jangan pernah menyisipkan emoji mentah sistem/Unicode ke dalam teks label/tombol UI — WAJIB gunakan ikon Lucide React!
- **JANGAN MELANGGAR DRY**: Jangan mendefinisikan fungsi utilitas lokal (misal format tanggal, gradient generator) di dalam komponen jika fungsinya berpotensi dipakai di tempat lain; segera dorong masuk ke `apps/web/src/lib/utils.ts`!
- Jangan curang mengubah data orisinil database secara serampangan hanya demi mengatasi bug visual frontend. Lawan bug visual di level rendering secara ksatria!

