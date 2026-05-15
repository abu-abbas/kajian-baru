---
description: Workflow untuk deploy KajianBaru ke production. Jalankan dengan `/deploy`.
---

## Steps

### Step 1 — Typecheck semua
```bash
pnpm typecheck
```
Stop jika ada error.

### Step 2 — Build semua packages dulu
```bash
pnpm --filter @kajian-baru/types build
pnpm --filter @kajian-baru/parser build
```

### Step 3 — Build API
```bash
pnpm --filter api build
```
Pastikan `dist/index.js` terbentuk.

### Step 4 — Build Web
```bash
pnpm --filter web build
```
Pastikan `dist/` folder terbentuk.

### Step 5 — Verifikasi environment variables
Pastikan semua env vars sudah di-set di Railway dan Vercel:

Railway (api):
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY
- VAPID_PUBLIC_KEY
- VAPID_PRIVATE_KEY
- CORS_ORIGIN (URL Vercel app)

Vercel (web):
- VITE_SUPABASE_URL
- VITE_SUPABASE_ANON_KEY
- VITE_API_URL (URL Railway app)
- VITE_VAPID_PUBLIC_KEY

### Step 6 — Deploy API ke Railway
Push ke branch main — Railway auto-deploy dari GitHub.
Atau manual: `railway up` dari folder `apps/api`.

> [!IMPORTANT]
> **Monorepo Caveat (Watch-Paths Bypass)**: 
> Jika commit Anda **HANYA** mengubah file di `@kajian-baru/parser` atau `packages/types` tanpa menyentuh apapun di `apps/api`, Railway **akan men-SKIP build** (No changes to watched files).
> **Cara Mengatasinya**: Edit file `apps/api/src/routes/bot.ts`, tambahkan sebuah komentar dummy di baris paling atas (misal: `// REBUILD: update parser`), lalu commit & push untuk memicu paksa build runner.

### Step 7 — Deploy Web ke Vercel
Push ke branch main — Vercel auto-deploy dari GitHub.
Atau manual: `vercel --prod` dari folder `apps/web`.

### Step 8 — Smoke test production
- Buka URL Vercel — pastikan halaman utama load
- Login dengan Google — pastikan auth jalan
- Buka /admin — pastikan protected dengan benar
- Paste contoh copasan WA — pastikan parser jalan
- Cek Supabase dashboard — pastikan data masuk
