import { createClient } from '@supabase/supabase-js'
import { createBrowserClient } from '@supabase/ssr'

let supabaseInstance: any = null

// Client-side Supabase client that uses cookies (syncs with middleware)
export function getSupabaseClient() {
  if (typeof window !== 'undefined' && !supabaseInstance) {
    supabaseInstance = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  } else if (!supabaseInstance) {
    // Fallback for server-side
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey)
  }
  return supabaseInstance
}

export const supabase = getSupabaseClient()
