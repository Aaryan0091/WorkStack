import { createClient } from '@supabase/supabase-js'
import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

let clientSideInstance: SupabaseClient | null = null

// Validate required environment variables
function validateEnvVars() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    throw new Error('Missing required Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set')
  }

  return { url, key }
}

// Client-side Supabase client that uses cookies (syncs with middleware)
// This is a singleton on the client (browser), which is safe
export function getSupabaseClient(): SupabaseClient {
  const { url, key } = validateEnvVars()

  // On server-side, always create a new client to avoid state leakage
  if (typeof window === 'undefined') {
    return createClient(url, key)
  }

  // On client-side, use singleton to share across components
  if (!clientSideInstance) {
    clientSideInstance = createBrowserClient(url, key)
  }
  return clientSideInstance
}

// Lazy initialization - only create client when actually used
// For client-side use, import this directly
export const supabase = getSupabaseClient()

// Utility for server-side code to get fresh instances
export function createServerClient(): SupabaseClient {
  const { url, key } = validateEnvVars()
  return createClient(url, key)
}
