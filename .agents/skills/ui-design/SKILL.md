---
name: ui-design
description: Defines the standard UI/UX design principles for KajianBaru. Mandates a Shadcn-UI FIRST approach, consistent luxurious dark-emerald palettes, and responsive high-end mobile visuals.
---

# UI Design Skill (Shadcn-UI First)

## The Core Philosophy: Premium & Minimalist
We avoid standard/native HTML components at all costs. All visuals MUST look premium, modern, and responsive. We achieve this by putting **shadcn/ui** first.

## 1. Shadcn-UI First Rule
- Before building a component, check if a primitive exists in `apps/web/src/components/ui/` (e.g., `Button`, `Card`, `Badge`, `Input`).
- If you need a new primitive (e.g., `Dialog`, `Tabs`), copy the standard Tailwind-Radix shadcn code directly into `apps/web/src/components/ui/[component-name].tsx` using the utility helper `cn` from `@/lib/utils`.
- NEVER use arbitrary utility classes for UI primitives; ALWAYS build them as configurable variants using `class-variance-authority` (CVA).

## 2. Visual Themes & Palette
We use a custom-tailored **Dark Emerald/Teal (Islamic Green)** luxury aesthetic.

### Key CSS Variables (Defined in index.css):
- **Background**: Ultra-dark greenish black (`hsl(150 30% 3%)`).
- **Card**: High-glass transparent dark card (`hsl(150 25% 6%)`).
- **Primary**: Vivid emerald green (`hsl(142 72% 29%)`).
- **Accent**: Muted success overlay (`hsl(142 50% 18%)`).
- **Radius**: 0.75rem (Smooth, large rounded corners).

### Standard Tailwinds classes to use:
- **Glassmorphism Effects**: `.glass` and `.glass-hover` utilities for containers.
- **Gradients**: Use `bg-gradient-to-br from-emerald-500 to-teal-600` for focal points.

## 3. Component Best Practices

### Typography
- Titles: Use `font-extrabold` or `font-black` with `tracking-tight`.
- Body: Use `text-muted-foreground` for supporting text.

### Icons
- ALWAYS use `lucide-react` icons. Do not use generic emoji as primary indicators unless combined with styled icon primitives.

### Hover & Active States
- All interactive components must have defined transition timings (`duration-300` or `duration-500`).
- Use micro-animations like `active:scale-[0.98]` or `hover:-translate-y-0.5` to make the interface feel alive.

### Audience Colors (Gender)
- `AKHWAT` / `MUSLIMAH`: Pink (`bg-pink-500/20 text-pink-400 border-pink-500/30`).
- `IKHWAN`: Blue (`bg-blue-500/20 text-blue-400 border-blue-500/30`).
- `UMUM`: Emerald (`bg-emerald-500/20 text-emerald-400 border-emerald-500/30`).

## 4. Advanced Layout Patterns

### Adaptive Scroll-Triggered Navigation
Navbar utama (`sticky top-0`) harus dijaga agar tetap longgar dan bersih pada kondisi muatan awal (saat screen scroll y = 0). Kontrol padat seperti Search pill sebaiknya hanya diletakkan di body feed. Saat pengguna mulai scroll ke bawah (`isScrolled` hook aktif), hadirkan elemen pencarian sekunder secara dinamis ke dalam Navbar dengan transisi `animate-in fade-in slide-in-from-top-2`.

### The Command Spotlight Box
Dialog pencarian masif harus meniru pengalaman MacOS Spotlight:
- Posisi: Melayang di tengah-atas layar dengan gap atas yang proposional.
- Backdrop: Berat blur (`backdrop-blur-2xl`).
- Interaksi: Shortcut Meta+K global, auto-focus instan saat mounting, dan listener kunci `Escape` untuk proses penutupan instan.

