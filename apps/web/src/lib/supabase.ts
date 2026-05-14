import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env['VITE_SUPABASE_URL'] as string
const supabaseAnonKey = import.meta.env['VITE_SUPABASE_ANON_KEY'] as string

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️ Supabase environment variables not set — auth will not work')
}

// Singleton Supabase client for frontend (anon key only — never service role)
export const supabase = createClient(
  supabaseUrl ?? '',
  supabaseAnonKey ?? '',
)
