import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const publishableKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  import.meta.env.VITE_SUPABASE_ANON_KEY) as string | undefined

/** The app is fully usable without a backend; analytics lights up only when configured. */
export const supabase: SupabaseClient | null =
  url && publishableKey ? createClient(url, publishableKey) : null
