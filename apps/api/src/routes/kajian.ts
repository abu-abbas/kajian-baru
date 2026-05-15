import { Hono } from 'hono'
import { supabase } from '../lib/supabase.js'
import { parseMessage } from '@kajian-baru/parser'
import { authMiddleware, adminMiddleware } from '../middleware/auth.js'
import type { ApiResponse, Kajian } from '@kajian-baru/types'
import { triggerNotificationsForKajian } from './push.js'
import { safeIngestKajian } from '../lib/ingest.js'

export const kajianRoutes = new Hono()

/**
 * GET /kajian — List kajian with optional filters
 * Query params: tanggal, kota, audience
 */
kajianRoutes.get('/', async (c) => {
  const tanggal = c.req.query('tanggal')
  const kota = c.req.query('kota')
  const audience = c.req.query('audience')

  // Menangkap parameter paginasi (default: ambil 10 data pertama)
  const limit = parseInt(c.req.query('limit') ?? '10', 10)
  const offset = parseInt(c.req.query('offset') ?? '0', 10)

  const includeUnpublished = c.req.query('include_unpublished') === 'true'

  let query = supabase
    .from('kajian')
    .select('*')

  // 🔒 HANYA TAMPILKAN DATA YANG SUDAH PUBLISHED (Kecuali admin request draf!)
  if (!includeUnpublished) {
    query = query.eq('is_published', true)
  }

  // Filter hanya diaplikasikan JIKA dilewatkan oleh pengguna
  if (tanggal && tanggal.trim() !== '') {
    query = query.eq('tanggal_masehi', tanggal)
  }

  if (kota && kota.trim() !== '') {
    query = query.eq('kota', kota)
  }

  if (audience && audience.trim() !== '') {
    query = query.eq('audience', audience)
  }

  // Urutkan berdasarkan input TERBARU (Twitter style timeline)
  query = query.order('created_at', { ascending: false })

  // Terapkan batasan rentang data (pagination)
  query = query.range(offset, offset + limit - 1)

  const { data, error } = await query

  if (error) {
    const response: ApiResponse<null> = { success: false, data: null, error: error.message }
    return c.json(response, 500)
  }

  const response: ApiResponse<Kajian[]> = { success: true, data: data as Kajian[], error: null }
  return c.json(response)
})

/**
 * GET /kajian/filters — Mengambil daftar Kota dan Audience yang AKTIF (memiliki data riil di DB)
 * Mencegah filter kosong (Faceted Search UX).
 */
kajianRoutes.get('/filters', async (c) => {
  const { data, error } = await supabase
    .from('kajian')
    .select('kota, audience')

  if (error) {
    const response: ApiResponse<null> = { success: false, data: null, error: error.message }
    return c.json(response, 500)
  }

  // Ekstrak daftar unik kota (dan disortir alfabetis)
  const rawCities = (data ?? []).map((item) => item.kota).filter(Boolean)
  const activeCities = Array.from(new Set(rawCities)).sort()

  // Ekstrak daftar unik audience yang ada postingannya
  const rawAudiences = (data ?? []).map((item) => item.audience).filter(Boolean)
  const activeAudiences = Array.from(new Set(rawAudiences))

  const response = {
    success: true,
    data: {
      kota: activeCities,
      audience: activeAudiences,
    },
    error: null
  }

  return c.json(response)
})

/**
 * GET /kajian/:id — Get single kajian by ID
 */
kajianRoutes.get('/:id', async (c) => {
  const id = c.req.param('id')

  const { data, error } = await supabase
    .from('kajian')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !data) {
    const response: ApiResponse<null> = { success: false, data: null, error: 'Kajian not found' }
    return c.json(response, 404)
  }

  const response: ApiResponse<Kajian> = { success: true, data: data as Kajian, error: null }
  return c.json(response)
})

/**
 * POST /kajian/parse — Parse raw message text into kajian list
 * Body: { text: string }
 */
kajianRoutes.post('/parse', async (c) => {
  const body = await c.req.json<{ text: string }>()

  if (!body.text) {
    const response: ApiResponse<null> = { success: false, data: null, error: 'Missing text field' }
    return c.json(response, 400)
  }

  const result = parseMessage(body.text)
  return c.json({ success: result.success, data: result, error: null })
})

/**
 * POST /kajian/batch — Save parsed kajian list to database (admin only)
 * Body: { kajian_list: Kajian[] }
 */
kajianRoutes.post('/batch', authMiddleware, adminMiddleware, async (c) => {
  const body = await c.req.json<{ kajian_list: Kajian[] }>()

  if (!body.kajian_list || body.kajian_list.length === 0) {
    const response: ApiResponse<null> = { success: false, data: null, error: 'Empty kajian list' }
    return c.json(response, 400)
  }

  let savedData: Kajian[] = []
  
  try {
    // 🛡️ GUNAKAN ENGINE INGEST AMAN (Otomatis deduplikasi & rekonsiliasi status libur!)
    const { saved } = await safeIngestKajian(body.kajian_list, true)
    savedData = saved
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'Internal database error'
    const response: ApiResponse<null> = { success: false, data: null, error: errMsg }
    return c.json(response, 500)
  }

  // 🧼 SIDE EFFECT: Auto-Extract & Sync Unique Entities to Master Tables (Best Effort)
  try {
    const normalize = (val: string) => val.toLowerCase().trim().replace(/[^a-z0-9]/g, '')

    // 🎙️ Master Ustadz Sync
    const uniquePemateri = Array.from(new Set(body.kajian_list.map(k => k.pemateri).filter(Boolean)))
    const ustadzPayloads = uniquePemateri.map(name => ({
      nama: name.trim(),
      nama_normalized: normalize(name)
    })).filter(u => u.nama_normalized.length > 0)

    if (ustadzPayloads.length > 0) {
      // Run as background sync (don't await if we want maximum API speed, or await for safety)
      // We'll await to keep it stable, wrapped in try-catch so it never breaks primary insert
      await supabase.from('master_ustadz').upsert(ustadzPayloads, { onConflict: 'nama', ignoreDuplicates: true })
    }

    // 🕌 Master Masjid Sync
    const masjidPayloads = body.kajian_list
      .filter(k => k.tempat && k.tempat.trim())
      .reduce((acc: { nama: string; nama_normalized: string; kota: string }[], cur) => {
        const norm = normalize(cur.tempat)
        if (norm && !acc.some(x => x.nama_normalized === norm)) {
          acc.push({
            nama: cur.tempat.trim(),
            nama_normalized: norm,
            kota: cur.kota ? cur.kota.trim() : 'Tangerang'
          })
        }
        return acc
      }, [])

    if (masjidPayloads.length > 0) {
      await supabase.from('master_masjid').upsert(masjidPayloads, { onConflict: 'nama', ignoreDuplicates: true })
    }
  } catch (masterSyncErr) {
    console.error('⚠️ Master data synchronization encountered a non-fatal error:', masterSyncErr)
  }

  // 📢 TRIGGER PUSH: Kirim notifikasi web ke semua user yang memfollow Ustadz/Masjid/Kota terkait (Secara Background)
  if (savedData && savedData.length > 0) {
    void triggerNotificationsForKajian(savedData)
  }

  const response: ApiResponse<Kajian[]> = { success: true, data: savedData, error: null }
  return c.json(response, 201)
})

/**
 * PATCH /kajian/:id — Perbarui sebagian data kajian (admin only)
 * Memungkinkan edit poster, judul, dll dari dashboard daftar kajian.
 */
kajianRoutes.patch('/:id', authMiddleware, adminMiddleware, async (c) => {
  const id = c.req.param('id')
  const updatePayload = await c.req.json<Partial<Kajian>>()

  const { data, error } = await supabase
    .from('kajian')
    .update(updatePayload)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    const response: ApiResponse<null> = { success: false, data: null, error: error.message }
    return c.json(response, 500)
  }

  const response: ApiResponse<Kajian> = { success: true, data: data as Kajian, error: null }
  return c.json(response)
})

/**
 * DELETE /kajian/:id — Delete a kajian (admin only)
 */
kajianRoutes.delete('/:id', authMiddleware, adminMiddleware, async (c) => {
  const id = c.req.param('id')

  const { error } = await supabase
    .from('kajian')
    .delete()
    .eq('id', id)

  if (error) {
    const response: ApiResponse<null> = { success: false, data: null, error: error.message }
    return c.json(response, 500)
  }

  const response: ApiResponse<null> = { success: true, data: null, error: null }
  return c.json(response)
})
