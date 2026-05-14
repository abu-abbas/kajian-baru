---
name: supabase-integration
description: Handles all Supabase-related code — client setup, queries, auth, and RLS. Use when writing database queries, setting up auth, or working with Supabase client in any app or package.
---

# Supabase Integration Skill

## Client setup (singleton pattern)
```typescript
// apps/api/src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/supabase'

export const supabase = createClient<Database>(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // API only — never frontend
)

// apps/web/src/lib/supabase.ts  
export const supabase = createClient<Database>(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY // Frontend — anon key only
)
```

## Auth pattern (Google OAuth)
```typescript
// Login
await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: { redirectTo: `${window.location.origin}/auth/callback` }
})

// Get current user
const { data: { user } } = await supabase.auth.getUser()

// Check if admin
const { data: adminUser } = await supabase
  .from('admin_users')
  .select('role, kota_access')
  .eq('id', user.id)
  .single()
```

## Query patterns
```typescript
// Kajian hari ini
const { data, error } = await supabase
  .from('kajian')
  .select('*')
  .eq('tanggal', new Date().toISOString().split('T')[0])
  .order('waktu_mulai', { ascending: true })

// Filter by kota
.eq('kota', kota)

// Batch insert hasil parse
const { error } = await supabase
  .from('kajian')
  .insert(kajianList)
```

## Auth middleware for Hono
```typescript
import { createMiddleware } from 'hono/factory'

export const authMiddleware = createMiddleware(async (c, next) => {
  const token = c.req.header('Authorization')?.replace('Bearer ', '')
  if (!token) return c.json({ error: 'Unauthorized' }, 401)

  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return c.json({ error: 'Unauthorized' }, 401)

  c.set('user', user)
  await next()
})

export const adminMiddleware = createMiddleware(async (c, next) => {
  const user = c.get('user')
  
  const { data: adminUser } = await supabase
    .from('admin_users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!adminUser) return c.json({ error: 'Forbidden' }, 403)
  
  c.set('adminUser', adminUser)
  await next()
})
```

## Environment variables needed
```env
# API (Railway)
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=xxx  # Never expose this

# Web (Vercel)
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=xxx
```
