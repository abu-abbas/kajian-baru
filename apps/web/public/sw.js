// ============================================================
// KajianBaru — PWA Web Push Service Worker
// ============================================================

self.addEventListener('install', (event) => {
  self.skipWaiting()
  console.log('[Service Worker] Terinstalasi.')
})

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim())
  console.log('[Service Worker] Aktif dan Memegang Kendali.')
})

// 📡 Mendengar Tembakan Push Notification dari Backend
self.addEventListener('push', (event) => {
  if (!event.data) {
    console.warn('[Service Worker] Menerima Push Event tanpa muatan payload data.')
    return
  }

  try {
    const payload = event.data.json()
    console.log('[Service Worker] Payload Diterima:', payload)

    const title = payload.title || 'KajianBaru'
    
    const options = {
      body: payload.body || 'Ada pengumuman kajian baru untuk Anda!',
      icon: '/favicon.ico', // Icon default
      badge: '/favicon.ico',
      vibrate: [200, 100, 200], // Sensasi getar ritmis di HP Android
      data: {
        url: payload.url || '/'
      },
      tag: 'kajian-baru-push', // Grouping ID agar tidak menumpuk berlebihan
      requireInteraction: true // Memaksa tetap nongol sampai di-tap user
    }

    event.waitUntil(
      self.registration.showNotification(title, options)
    )
  } catch (e) {
    console.error('[Service Worker] Kesalahan saat parsing data payload push:', e)
  }
})

// 👆 Mendengar Aksi Ketuk/Klik pada Kotak Notifikasi
self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Notifikasi Diklik!')
  event.notification.close() // Tutup dialog notifnya

  const targetUrl = event.notification.data?.url || '/'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // 🔎 Scan: Apakah user sudah membuka tab aplikasi kita?
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i]
        // Jika ada tab yang URL-nya sama, langsung pindahkan fokus ke sana!
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus()
        }
      }
      // 🌐 Jika tidak ada, buka Tab Baru secara fresh!
      if (clients.openWindow) {
        return clients.openWindow(targetUrl)
      }
    })
  )
})
