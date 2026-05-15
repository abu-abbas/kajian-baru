# 🕌 KajianBaru

> **Platform Agregasi Jadwal Kajian Ilmiyyah, Modern & Presisi**
> *Dikembangkan khusus sebagai submission MVP untuk **HSI Vibathon 2026**.*

<p align="left">
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-100%25-3178c6?style=flat&logo=typescript&logoColor=white" alt="TypeScript"></a>
  <a href="https://react.dev/"><img src="https://img.shields.io/badge/React-18.x-61dafb?style=flat&logo=react&logoColor=black" alt="React"></a>
  <a href="https://hono.dev/"><img src="https://img.shields.io/badge/Hono-API-e36002?style=flat&logo=hono&logoColor=white" alt="Hono"></a>
  <a href="https://supabase.com/"><img src="https://img.shields.io/badge/Supabase-PostgreSQL-3ecf8e?style=flat&logo=supabase&logoColor=white" alt="Supabase"></a>
  <a href="https://t.me/KajianBaruHSIVibathonBot"><img src="https://img.shields.io/badge/Telegram-Bot-26a5e4?style=flat&logo=telegram&logoColor=white" alt="Telegram Bot"></a>
  <a href="https://kajian-baru.vercel.app/"><img src="https://img.shields.io/badge/Deploy-Vercel-000000?style=flat&logo=vercel&logoColor=white" alt="Vercel Status"></a>
  <img src="https://img.shields.io/badge/License-MIT-success?style=flat" alt="License">
</p>

---

## 🌟 Konsep Singkat

**KajianBaru** adalah platform agregator jadwal kajian ilmiyyah yang dirancang dengan pendekatan *mobile-first* dan mengutamakan kecepatan entri data bagi Admin, serta kenyamanan navigasi premium bagi Pengguna Akhir.

Masalah klasik pengumuman kajian di WhatsApp/Telegram yang terkadang sulit dicari, diselesaikan oleh platform ini melalui:
1. **Deterministic Rules-Based Hybrid Parser**: Mengubah teks acak/copasan pesan grup (WhatsApp/Telegram) menjadi data terstruktur dalam milidetik tanpa API AI mahal. Memiliki kecerdasan menyapu spasi hantu (Zero-Width), membuang Variation Selectors, ekstraksi otomatis label audience, serta sinkronisasi cerdas pendeteksi status kajian Diliburkan!
2. **Intelligent Input Manual Form**: Predictive Asynchronous Auto-Suggest dengan *lazy-loaded cascading autofill* untuk meminimalisir duplikasi data tempat & pemateri secara drastis.
3. **Modern Dark Emerald Glassmorphism UI**: Antarmuka super-mewah bernuansa Islami kelas premium yang ramah di mata dan mendukung instalasi instan lewat standar **PWA (Progressive Web App)**.

---

## 🛠️ Arsitektur & Teknologi Stack

Proyek ini dibangun menggunakan arsitektur **Monorepo** berbasis `pnpm workspaces` dan dijamin **Full TypeScript** dari hulu ke hilir.

| Lapisan / Domain | Teknologi Pilihan |
| :--- | :--- |
| **Package Manager** | `pnpm` Workspaces (Efisien & Terisolasi) |
| **Frontend Web** | `React 18` + `Vite` + `TailwindCSS` (Vibrant Dark Emerald Theme) |
| **Backend API** | `Hono` (Berjalan sangat cepat di `Railway`) |
| **Database & Auth** | `Supabase` (PostgreSQL, RLS Policies & Google OAuth) |
| **Notification** | Native `Web Push API` (Tanpa Firebase dependency) |
| **Telegram Bot** | `Grammy` (Bot Framework untuk manajemen otomatisasi) |
| **UI Utility** | `Lucide React` + Glassmorphism Utilities |

---

## 📂 Struktur Monorepo

```bash
├── apps/
│   ├── web/            # React Client (Mobile-first, Dark Emerald, PWA-ready)
│   └── api/            # Hono Backend (Router API domain kajian, push & admin)
├── packages/
│   ├── parser/         # Mesin Parser Teks Murni (Pure logic, 0 database calls)
│   └── types/          # Kumpulan Tipe TypeScript Bersama (Single source of truth)
├── supabase/
│   └── migrations/     # Skema Database PostgreSQL, RLS policies & triggers
├── .env.example        # Template konfigurasi environment variables
├── package.json        # Konfigurasi workspace root
└── pnpm-workspace.yaml # Peta alokasi pnpm workspaces
```

---

## 🚀 Cara Menjalankan Lokal

### 1. Persiapan Kode
Pastikan Node.js dan `pnpm` sudah terpasang di mesin Anda, lalu clone dan pasang dependensi:
```bash
pnpm install
```

### 2. Konfigurasi Environtment
Salin berkas `.env.example` di root dan di folder `apps/web` dan `apps/api`, lalu sesuaikan kunci Supabase & VAPID keys Anda.

### 3. Jalankan Mode Developer
Menjalankan seluruh platform (Web & API) secara bersamaan dengan satu perintah ajaib:
```bash
pnpm dev
```

Sistem akan hidup secara otomatis di:
* 🌐 **Frontend Client:** `http://localhost:5173`
* ⚙️ **API Server:** `http://localhost:3000`

---

## 💎 Fitur-Fitur MVP Unggulan

*   **PWA Powered**: Instalasi instan di Home Screen HP (Android & iOS) dengan ikon launcher emerald-gold berkualitas retina.
*   **Smart Suggestion Engine**: Dropdown prediktif debounced (400ms, min 3 huruf) dengan kecerdasan case-insensitive yang otomatis menggabungkan duplikasi tulisan (e.g. `Ustadz Fulan` vs `ustadz fulan`).
*   **Dynamic Theme Cards**: Poster kajian otomatis berubah tema gradiennya menyesuaikan Target Audience (Ikhwan, Akhwat, atau Umum).
*   **Web Push Native**: Memungkinkan user berlangganan update jadwal kajian baru secara langsung melalui browser mobile maupun desktop.
*   **Telegram Bot Ingestion & Command Center**: Integrasi penuh dengan bot Telegram interaktif (`@KajianBaruHSIVibathonBot`) untuk membantu proses input data, sinkronisasi notifikasi ke channel, serta manajemen otorisasi user bot langsung dari panel dashboard Admin.

---

> *"Barangsiapa yang menunjuki kepada kebaikan maka dia akan mendapatkan pahala seperti pahala orang yang mengerjakannya"* (HR. Muslim no. 1893)

**© 2026 HSI Vibathon MVP Submission.**
