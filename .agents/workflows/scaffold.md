---
description: Workflow untuk setup monorepo KajianBaru dari nol. Jalankan dengan /scaffold.
---

## Steps

### Step 1 — Buat struktur folder
Buat semua folder yang dibutuhkan:
```
kajian-baru/
├── apps/api/src/routes/
├── apps/api/src/lib/
├── apps/api/src/middleware/
├── apps/web/src/components/
├── apps/web/src/pages/
├── apps/web/src/lib/
├── apps/web/src/hooks/
├── packages/types/src/
├── packages/parser/src/
```

### Step 2 — Buat config files di root
Buat file berikut di root:
- `package.json` (pnpm workspaces)
- `pnpm-workspace.yaml`
- `tsconfig.base.json`
- `.env.example`
- `.gitignore`

Gunakan skill @monorepo-setup untuk panduan lengkap.

### Step 3 — Setup packages/types
Buat `packages/types/package.json` dan `packages/types/src/index.ts`.
Pastikan semua tipe ada: `Kajian`, `ParseResult`, `UserPreference`, `AdminUser`, `Audience`, `GradientConfig`.

### Step 4 — Setup packages/parser
Buat `packages/parser/package.json` dan `packages/parser/src/index.ts`.
Gunakan skill @wa-parser untuk implementasi lengkap.
Sertakan `testParser()` function dan jalankan untuk verifikasi.

### Step 5 — Setup apps/api
Buat Hono app dengan:
- `src/index.ts` — entry point
- `src/lib/supabase.ts` — Supabase client (service role)
- `src/middleware/auth.ts` — auth + admin middleware
- `src/routes/kajian.ts` — CRUD kajian endpoints
- `src/routes/admin.ts` — admin user management
- `src/routes/push.ts` — push notification endpoints

Gunakan skill @supabase-integration untuk auth middleware pattern.

### Step 6 — Setup apps/web
Buat React app dengan:
- `src/main.tsx` — entry point
- `src/lib/supabase.ts` — Supabase client (anon key)
- `src/pages/Home.tsx` — halaman utama user
- `src/pages/Admin.tsx` — dashboard admin (protected)
- `src/components/KajianCard.tsx` — card dengan gradient/poster
- `src/components/FilterBar.tsx` — filter kota + tanggal
- `src/components/ParseInput.tsx` — textarea paste WA + preview
- `src/hooks/useAuth.ts` — hook untuk auth state

### Step 7 — Buat SQL schema
Buat file `supabase/schema.sql` dengan:
- Tabel: `kajian`, `admin_users`, `user_preferences`, `push_subscriptions`
- Index untuk: `tanggal`, `kota`, `pemateri`
- RLS policies untuk semua tabel
- Triggers untuk `updated_at`

### Step 8 — Verifikasi
Jalankan dari root:
```bash
pnpm install
pnpm typecheck
```
Pastikan tidak ada TypeScript error sebelum lanjut.

Call /workflow-dev setelah scaffold selesai untuk mulai development.
