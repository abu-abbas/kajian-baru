import { Hono } from 'hono'
import { supabase } from '../lib/supabase.js'
import type { ApiResponse, AdminUser } from '@kajian-baru/types'

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
