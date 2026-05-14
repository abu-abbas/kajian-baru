---
description: Workflow untuk menambah fitur baru ke KajianBaru. Jalankan dengan /add-feature [nama fitur].
---

## Steps

### Step 1 — Tambah tipe baru (jika perlu)
Cek apakah fitur butuh tipe baru di `packages/types/src/index.ts`.
Kalau iya, tambahkan di sana dulu sebelum apapun.

### Step 2 — Tambah endpoint API (jika perlu)
Tambahkan route baru di `apps/api/src/routes/` yang relevan.
Pastikan middleware auth/admin dipasang sesuai kebutuhan.
Test endpoint dengan curl atau REST client.

### Step 3 — Tambah komponen frontend
Buat komponen baru di `apps/web/src/components/`.
Maksimal 200 baris per file — pecah kalau lebih.
Selalu sertakan loading state dan error state.

### Step 4 — Integrasi ke halaman
Pasang komponen ke halaman yang relevan di `apps/web/src/pages/`.

### Step 5 — Typecheck
Jalankan `pnpm typecheck` dari root.
Tidak boleh ada TypeScript error sebelum dianggap selesai.
