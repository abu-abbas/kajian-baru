import { createMiddleware } from 'hono/factory'
import { supabase } from '../lib/supabase.js'
import type { User } from '@supabase/supabase-js'

// Extend Hono context variables
export type AuthVariables = {
  user: User
  adminUser: { role: string; kota_access: string[] }
}

/**
 * Auth middleware — verifies JWT token from Authorization header.
 * Sets `user` in context on success.
 */
export const authMiddleware = createMiddleware(async (c, next) => {
  const token = c.req.header('Authorization')?.replace('Bearer ', '')
  if (!token) {
    return c.json({ success: false, data: null, error: 'Unauthorized' }, 401)
  }

  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) {
    return c.json({ success: false, data: null, error: 'Unauthorized' }, 401)
  }

  c.set('user', user)
  await next()
})

/**
 * Admin middleware — must be used AFTER authMiddleware.
 * Verifies user is in admin_users table (never trust JWT role alone).
 */
export const adminMiddleware = createMiddleware(async (c, next) => {
  const user = c.get('user') as User

  const { data: adminUser, error } = await supabase
    .from('admin_users')
    .select('role, kota_access')
    .eq('id', user.id)
    .single()

  if (error || !adminUser) {
    return c.json({ success: false, data: null, error: 'Forbidden — admin access required' }, 403)
  }

  c.set('adminUser', adminUser)
  await next()
})
