import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { kajianRoutes } from './routes/kajian.js'
import { adminRoutes } from './routes/admin.js'
import { pushRoutes } from './routes/push.js'
import { authMiddleware, adminMiddleware } from './middleware/auth.js'

const app = new Hono()

// Global middleware
app.use('*', logger())
app.use('*', cors({
  origin: ['http://localhost:5173', 'https://kajianbaru.id'],
  credentials: true,
}))

// Health check
app.get('/', (c) => c.json({ status: 'ok', service: 'kajian-baru-api' }))

// Public routes
app.route('/kajian', kajianRoutes)

// Push routes (require auth)
app.use('/push/*', authMiddleware)
app.route('/push', pushRoutes)

// Admin routes (require auth + admin check)
app.use('/admin/*', authMiddleware)
app.use('/admin/*', adminMiddleware)
app.route('/admin', adminRoutes)

// Start server
const port = Number(process.env['PORT'] ?? 3000)

console.log(`🚀 KajianBaru API running on http://localhost:${String(port)}`)

serve({ 
  fetch: app.fetch, 
  port,
  hostname: '0.0.0.0' // Wajib untuk routing publik Railway!
})

export { app }
