import { Hono } from 'hono'
import webPush from 'web-push'
import { supabase } from '../lib/supabase.js'
import type { ApiResponse, PushSubscriptionData, FollowEntityType, UserFollow, Kajian, DbNotification } from '@kajian-baru/types'
import { generateFollowKey } from '@kajian-baru/parser'

import type { AuthVariables } from '../middleware/auth.js'

// Configure web-push with VAPID keys
const vapidPublicKey = process.env['VAPID_PUBLIC_KEY']
const vapidPrivateKey = process.env['VAPID_PRIVATE_KEY']
const vapidSubject = process.env['VAPID_SUBJECT']

if (vapidPublicKey && vapidPrivateKey && vapidSubject) {
  webPush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)
}

export const pushRoutes = new Hono<{ Variables: AuthVariables }>()

/**
 * POST /push/subscribe — Save push subscription for a user
 * Body: { subscription: PushSubscriptionJSON }
 */
pushRoutes.post('/subscribe', async (c) => {
  const user = c.get('user') as { id: string }
  const body = await c.req.json<{ subscription: PushSubscriptionData }>()

  if (!body.subscription) {
    const response: ApiResponse<null> = { success: false, data: null, error: 'Missing subscription data' }
    return c.json(response, 400)
  }

  const { error } = await supabase
    .from('push_subscriptions')
    .upsert({
      user_id: user.id,
      endpoint: body.subscription.endpoint,
      keys: body.subscription.keys,
    }, { onConflict: 'user_id' })

  if (error) {
    const response: ApiResponse<null> = { success: false, data: null, error: error.message }
    return c.json(response, 500)
  }

  const response: ApiResponse<null> = { success: true, data: null, error: null }
  return c.json(response)
})

/**
 * POST /push/unsubscribe — Remove push subscription for a user
 */
pushRoutes.post('/unsubscribe', async (c) => {
  const user = c.get('user') as { id: string }

  const { error } = await supabase
    .from('push_subscriptions')
    .delete()
    .eq('user_id', user.id)

  if (error) {
    const response: ApiResponse<null> = { success: false, data: null, error: error.message }
    return c.json(response, 500)
  }

  const response: ApiResponse<null> = { success: true, data: null, error: null }
  return c.json(response)
})

/**
 * POST /push/send — Send push notification to all subscribers (admin only)
 * Body: { title: string, body: string, url?: string }
 */
pushRoutes.post('/send', async (c) => {
  const body = await c.req.json<{ title: string; body: string; url?: string }>()

  if (!body.title || !body.body) {
    const response: ApiResponse<null> = { success: false, data: null, error: 'Missing title or body' }
    return c.json(response, 400)
  }

  const { data: subscriptions, error } = await supabase
    .from('push_subscriptions')
    .select('*')

  if (error) {
    const response: ApiResponse<null> = { success: false, data: null, error: error.message }
    return c.json(response, 500)
  }

  const payload = JSON.stringify({
    title: body.title,
    body: body.body,
    url: body.url ?? '/',
  })

  let sent = 0
  let failed = 0

  const sendPromises = (subscriptions ?? []).map(async (sub: { endpoint: string; keys: { p256dh: string; auth: string } }) => {
    try {
      await webPush.sendNotification(
        { endpoint: sub.endpoint, keys: sub.keys },
        payload,
      )
      sent++
    } catch {
      failed++
      // Optionally clean up expired subscriptions here
    }
  })

  await Promise.all(sendPromises)

  const response: ApiResponse<{ sent: number; failed: number }> = {
    success: true,
    data: { sent, failed },
    error: null,
  }
  return c.json(response)
})

/**
 * GET /push/vapid-key — Get the public VAPID key for frontend subscription
 */
pushRoutes.get('/vapid-key', async (c) => {
  if (!vapidPublicKey) {
    const response: ApiResponse<null> = { success: false, data: null, error: 'VAPID not configured' }
    return c.json(response, 500)
  }

  return c.json({ success: true, data: { publicKey: vapidPublicKey }, error: null })
})



/**
 * GET /push/follows — Get list of what the current user follows
 */
pushRoutes.get('/follows', async (c) => {
  const user = c.get('user') as { id: string }

  const { data, error } = await supabase
    .from('user_follows')
    .select('*')
    .eq('user_id', user.id)

  if (error) {
    const response: ApiResponse<null> = { success: false, data: null, error: error.message }
    return c.json(response, 500)
  }

  const response: ApiResponse<UserFollow[]> = { success: true, data: data as UserFollow[], error: null }
  return c.json(response)
})

/**
 * POST /push/follows/toggle — Toggle follow status for a specific entity
 * Body: { entity_type: 'USTADZ' | 'MASJID' | 'KOTA', entity_name: string }
 */
pushRoutes.post('/follows/toggle', async (c) => {
  const user = c.get('user') as { id: string }
  const body = await c.req.json<{ 
    entity_type: FollowEntityType; 
    entity_name: string;
    entity_extra?: string; // Menyimpan Nama Kota untuk Composite Key pengaman bentrokan Masjid
  }>()

  if (!body.entity_type || !body.entity_name) {
    const response: ApiResponse<null> = { success: false, data: null, error: 'Missing entity_type or entity_name' }
    return c.json(response, 400)
  }

  const entityKey = generateFollowKey(body.entity_type, body.entity_name, body.entity_extra)

  // Check if follow already exists
  const { data: existing, error: checkError } = await supabase
    .from('user_follows')
    .select('id')
    .eq('user_id', user.id)
    .eq('entity_type', body.entity_type)
    .eq('entity_key', entityKey)
    .maybeSingle()

  if (checkError) {
    const response: ApiResponse<null> = { success: false, data: null, error: checkError.message }
    return c.json(response, 500)
  }

  if (existing) {
    // Unfollow operation
    const { error: deleteError } = await supabase
      .from('user_follows')
      .delete()
      .eq('id', existing.id)

    if (deleteError) {
      const response: ApiResponse<null> = { success: false, data: null, error: deleteError.message }
      return c.json(response, 500)
    }

    const response = { success: true, data: { status: 'UNFOLLOWED', key: entityKey }, error: null }
    return c.json(response)
  } else {
    // Follow operation
    const { data: inserted, error: insertError } = await supabase
      .from('user_follows')
      .insert({
        user_id: user.id,
        entity_type: body.entity_type,
        entity_name: body.entity_name.trim(),
        entity_key: entityKey,
      })
      .select()
      .single()

    if (insertError) {
      const response: ApiResponse<null> = { success: false, data: null, error: insertError.message }
      return c.json(response, 500)
    }

    const response = { success: true, data: { status: 'FOLLOWED', follow: inserted as UserFollow }, error: null }
    return c.json(response)
  }
})

/**
 * GET /push/notifications — Mengambil daftar riwayat notifikasi user
 * Query Params: ?limit=5
 */
pushRoutes.get('/notifications', async (c) => {
  const user = c.get('user') as { id: string }
  const limit = Number(c.req.query('limit') || '50')

  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    const response: ApiResponse<null> = { success: false, data: null, error: error.message }
    return c.json(response, 500)
  }

  const response: ApiResponse<DbNotification[]> = { success: true, data: data as DbNotification[], error: null }
  return c.json(response)
})

/**
 * POST /push/notifications/mark-read — Menandai seluruh/spesifik notifikasi telah dibaca
 */
pushRoutes.post('/notifications/mark-read', async (c) => {
  const user = c.get('user') as { id: string }
  
  let body: { notification_id?: string } = {}
  try {
    body = await c.req.json()
  } catch {
    // Biarkan kosong jika tidak ada body
  }

  let query = supabase
    .from('notifications')
    .update({ read: true })
    .eq('user_id', user.id)

  if (body.notification_id) {
    query = query.eq('id', body.notification_id)
  }

  const { error } = await query

  if (error) {
    const response: ApiResponse<null> = { success: false, data: null, error: error.message }
    return c.json(response, 500)
  }

  return c.json({ success: true, data: null, error: null })
})

/**
 * 📡 CORE ENGINE: Trigger Notifications For Kajian List
 * Scans for matching follows and dispatches Web Push notifications to users!
 */
export async function triggerNotificationsForKajian(kajianList: Kajian[]): Promise<void> {
  try {

    const toTitleCase = (str: string): string => {
      if (!str) return ''
      return str.split(/\s+/).map(word => {
        if (!word) return ''
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      }).join(' ')
    }

    const formatHumanDate = (dateStr: string): string => {
      if (!dateStr) return ''
      const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/)
      if (match) {
        const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
        const year = match[1]
        const month = months[parseInt(match[2] ?? '1', 10) - 1] ?? 'Januari'
        const day = parseInt(match[3] ?? '1', 10).toString()
        return `${day} ${month} ${year}`
      }
      return dateStr
    }

    for (const kajian of kajianList) {
      const ustadzKey = generateFollowKey('USTADZ', kajian.pemateri)
      const masjidKey = generateFollowKey('MASJID', kajian.tempat, kajian.kota)
      const kotaKey = generateFollowKey('KOTA', kajian.kota)

      if (!ustadzKey && !masjidKey && !kotaKey) continue

      // 1. Find matching follows using a robust OR match filter (alphanumeric only, completely safe)
      const filters = [
        ustadzKey ? `and(entity_type.eq.USTADZ,entity_key.eq.${ustadzKey})` : '',
        masjidKey ? `and(entity_type.eq.MASJID,entity_key.eq.${masjidKey})` : '',
        kotaKey ? `and(entity_type.eq.KOTA,entity_key.eq.${kotaKey})` : ''
      ].filter(Boolean).join(',')

      const { data: follows, error: followErr } = await supabase
        .from('user_follows')
        .select('user_id')
        .or(filters)

      if (followErr || !follows || follows.length === 0) continue

      // Deduplicate user IDs to prevent spamming users who follow multiple items in the same study
      const uniqueUserIds = Array.from(new Set(follows.map(f => f.user_id)))
      if (uniqueUserIds.length === 0) continue

      // 2. Retrieve push subscription keys for these users
      const { data: subs, error: subsErr } = await supabase
        .from('push_subscriptions')
        .select('endpoint, keys')
        .in('user_id', uniqueUserIds)

      if (subsErr || !subs || subs.length === 0) continue

      // 3. Prepare payload beautifully!
      const displaySpeaker = toTitleCase(kajian.pemateri)
      const displayMateri = toTitleCase(kajian.materi)
      const displayPlace = toTitleCase(kajian.tempat)
      const displayDate = formatHumanDate(kajian.tanggal_masehi ?? '')
      
      const payloadTitle = `📢 Kajian Sunnah: ${displaySpeaker}`
      const payloadBody = `${displayMateri}\n📍 ${displayPlace}\n📅 ${displayDate}`

      const payload = JSON.stringify({
        title: payloadTitle,
        body: payloadBody,
        url: kajian.id ? `/?kajianId=${kajian.id}` : '/', // Deep linking url!
      })

      // 3b. Catat riwayat notifikasi ke database agar Tombol Lonceng bisa melacak daftar riwayatnya!
      try {
        const notificationRecords = uniqueUserIds.map(uid => ({
          user_id: uid,
          kajian_id: kajian.id || null,
          title: payloadTitle,
          body: payloadBody,
          read: false
        }))
        
        // Gunakan background async operation agar tidak memperlambat kecepatan tembakan notifikasi push!
        void supabase
          .from('notifications')
          .insert(notificationRecords)
          .then(({ error }) => {
            if (error) console.error('⚠️ Gagal mencatat riwayat notifikasi ke database:', error.message)
          })
      } catch (err) {
        console.error('⚠️ Terjadi kegagalan parsing riwayat notifikasi:', err)
      }

      // 4. Emit all web pushes concurrently!
      const pushPromises = subs.map(async (sub) => {
        try {
          await webPush.sendNotification(
            { endpoint: sub.endpoint, keys: sub.keys as any },
            payload
          )
        } catch (pushErr) {
          // Optional: Clean up dead tokens here to maintain push table hygiene
        }
      })

      await Promise.all(pushPromises)
    }
  } catch (triggerErr) {
    console.error('🚨 Notification trigger fatal system failure:', triggerErr)
  }
}


