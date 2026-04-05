'use client'

import { createBrowserClient } from '@supabase/ssr'

/**
 * Browser (client-side) Supabase client.
 * Use in Client Components only.
 * Session is managed automatically via cookies.
 *
 * Note: Database generic omitted — see server.ts for explanation.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
