import { Hono } from 'hono'
import { supabase } from '../lib/supabase.js'
import type { ApiResponse, AdminUser, BotUser, BotUserStatus } from '@kajian-baru/types'

export const adminRoutes = new Hono()

/**
 * GET /admin/users — List all admin users
 */
adminRoutes.get('/users', async (c) => {
  const { data, error } = await supabase
    .from('admin_users')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    const response: ApiResponse<null> = { success: false, data: null, error: error.message }
    return c.json(response, 500)
  }

  const response: ApiResponse<AdminUser[]> = { success: true, data: data as AdminUser[], error: null }
  return c.json(response)
})

/**
 * POST /admin/users — Add a new admin user
 * Body: { email: string, role: string, kota_access: string[] }
 */
adminRoutes.post('/users', async (c) => {
  const body = await c.req.json<{ email: string; role: string; kota_access: string[] }>()

  if (!body.email || !body.role) {
    const response: ApiResponse<null> = { success: false, data: null, error: 'Missing email or role' }
    return c.json(response, 400)
  }

  // Look up user ID from auth.users by email
  const { data: users, error: lookupError } = await supabase.auth.admin.listUsers()
  if (lookupError) {
    const response: ApiResponse<null> = { success: false, data: null, error: lookupError.message }
    return c.json(response, 500)
  }

  const targetUser = users.users.find((u) => u.email === body.email)
  if (!targetUser) {
    const response: ApiResponse<null> = {
      success: false,
      data: null,
      error: 'User not found — they must sign in at least once first',
    }
    return c.json(response, 404)
  }

  const { data, error } = await supabase
    .from('admin_users')
    .insert({
      id: targetUser.id,
      email: body.email,
      role: body.role,
      kota_access: body.kota_access,
    })
    .select()
    .single()

  if (error) {
    const response: ApiResponse<null> = { success: false, data: null, error: error.message }
    return c.json(response, 500)
  }

  const response: ApiResponse<AdminUser> = { success: true, data: data as AdminUser, error: null }
  return c.json(response, 201)
})

/**
 * DELETE /admin/users/:id — Remove an admin user
 */
adminRoutes.delete('/users/:id', async (c) => {
  const id = c.req.param('id')

  const { error } = await supabase
    .from('admin_users')
    .delete()
    .eq('id', id)

  if (error) {
    const response: ApiResponse<null> = { success: false, data: null, error: error.message }
    return c.json(response, 500)
  }

  const response: ApiResponse<null> = { success: true, data: null, error: null }
  return c.json(response)
})

// ============================================================
// Bot User Management (Approve/Reject dari Web Admin)
// ============================================================

/**
 * GET /admin/bot-users — List semua user bot Telegram
 */
adminRoutes.get('/bot-users', async (c) => {
  const { data, error } = await supabase
    .from('bot_users')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    const response: ApiResponse<null> = { success: false, data: null, error: error.message }
    return c.json(response, 500)
  }

  const response: ApiResponse<BotUser[]> = { success: true, data: data as BotUser[], error: null }
  return c.json(response)
})

/**
 * PATCH /admin/bot-users/:telegramId — Update status user bot (approve/reject)
 * Body: { status: 'approved' | 'rejected' }
 */
adminRoutes.patch('/bot-users/:telegramId', async (c) => {
  const telegramId = Number(c.req.param('telegramId'))
  const body = await c.req.json<{ status: BotUserStatus }>()

  if (!['approved', 'rejected'].includes(body.status)) {
    const response: ApiResponse<null> = { success: false, data: null, error: 'Invalid status' }
    return c.json(response, 400)
  }

  const updatePayload: Record<string, unknown> = { status: body.status }
  if (body.status === 'approved') {
    updatePayload['approved_at'] = new Date().toISOString()
  }

  const { data, error } = await supabase
    .from('bot_users')
    .update(updatePayload)
    .eq('telegram_id', telegramId)
    .select()
    .single()

  if (error) {
    const response: ApiResponse<null> = { success: false, data: null, error: error.message }
    return c.json(response, 500)
  }

  const response: ApiResponse<BotUser> = { success: true, data: data as BotUser, error: null }
  return c.json(response)
})

/**
 * DELETE /admin/bot-users/:telegramId — Hapus user bot
 */
adminRoutes.delete('/bot-users/:telegramId', async (c) => {
  const telegramId = Number(c.req.param('telegramId'))

  const { error } = await supabase
    .from('bot_users')
    .delete()
    .eq('telegram_id', telegramId)

  if (error) {
    const response: ApiResponse<null> = { success: false, data: null, error: error.message }
    return c.json(response, 500)
  }

  const response: ApiResponse<null> = { success: true, data: null, error: null }
  return c.json(response)
})

