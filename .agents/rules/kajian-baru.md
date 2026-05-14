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

## Project Structure
- Shared types live in `packages/types/src/index.ts` — import from there always
- Parser engine lives in `packages/parser/src/index.ts` — never duplicate parsing logic
- API routes in `apps/api/src/routes/` — one file per domain (kajian, admin, push)
- React components in `apps/web/src/components/` — one component per file

## Database Rules
- Always use Supabase client from a shared singleton, never instantiate inline
- Never expose Supabase service role key to frontend — only anon key
- All DB writes go through the API, never directly from frontend
- Use RLS policies as the security layer — always verify they are active

## Auth Rules
- Admin check: always verify against `admin_users` table, not just Supabase auth
- Never trust role from JWT alone — double check in DB
- Protect all `/admin` routes both on frontend (redirect) and backend (middleware)

## Parser Rules
- Parser engine must be pure functions — no side effects, no DB calls
- Parser must return `ParseResult` type always
- Never call Claude API for parsing — rules-based only
- Parser must handle these edge cases:
  - Emoji mepet tanpa spasi
  - Suffix "-hafizhahullah-" dan variasinya harus dibuang dari nama pemateri
  - Waktu "Ba'da Shalat X" tetap disimpan as-is sebagai string
  - Audience extracted dari tanda kurung di akhir teks kajian

## UI Rules
- UI must follow `shadcn-ui` principles FIRST — always use primitive UI components from `apps/web/src/components/ui/`
- Use luxury Dark Emerald theme with glassmorphism utilities (`.glass`, `.glass-hover`) — no arbitrary plain HTML inputs/dropdowns
- Mobile-first always — test di 375px width dulu
- Warna tema: nuansa hijau islami, tidak norak (gunakan primary `hsl(142 72% 29%)`)
- KajianCard tanpa poster: tampilkan gradient dari `gradient_config`
- KajianCard dengan poster: poster sebagai background dengan overlay gelap
- Loading state harus selalu ada untuk setiap async operation
- Error state harus selalu ditampilkan dengan pesan yang jelas
- Selalu gunakan ikon Lucide React untuk UI labels. Dilarang keras menggunakan emoji Unicode sistem (seperti 🏠, 📍, ⚠️, 📁) agar visual tetap berkelas!

## What NOT to do
- Jangan hardcode API keys — selalu dari environment variables
- Jangan bypass RLS dengan service role key di frontend
- Jangan duplikasi tipe — selalu import dari `packages/types`
- Jangan buat komponen lebih dari 200 baris — pecah jadi smaller components
- Jangan skip error handling dengan alasan "nanti aja"
- Jangan pernah menyisipkan emoji mentah sistem/Unicode ke dalam teks label/tombol UI — WAJIB gunakan ikon Lucide React!
