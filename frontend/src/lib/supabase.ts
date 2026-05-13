import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

// Only initialize if credentials are present (skipped in local dev)
export const supabase = supabaseUrl
  ? createClient(supabaseUrl, supabaseKey)
  : (null as any)
