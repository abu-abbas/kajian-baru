import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// 🔇 GAG CONTROL: Matikan semua console.log jika env VITE_SHOW_CONSOLE_LOG tidak bernilai "true"
const showConsoleLog = import.meta.env.VITE_SHOW_CONSOLE_LOG === 'true'
if (!showConsoleLog) {
  console.log = () => {}
  console.info = () => {}
}
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Home } from './pages/Home'
import { Admin } from './pages/Admin'
import './index.css'

import { ThemeProvider } from './components/theme-provider'

const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('Root element not found')

createRoot(rootEl).render(
  <StrictMode>
    <ThemeProvider defaultTheme="system" storageKey="kajian-baru-theme">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/admin" element={<Admin />} />
          {/* Rescue Route: Melontarkan user kembali ke home jika terlempar ke link callback */}
          <Route path="/auth/callback" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>,
)
// 🚀 Register Service Worker for full PWA functionality instantly!
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const registerSW = async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js')
        console.log('KajianBaru PWA Active:', reg.scope)
      } catch (err) {
        console.warn('KajianBaru PWA Error:', err)
      }
    }
    void registerSW()
  })
}
