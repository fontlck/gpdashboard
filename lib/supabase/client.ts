'use client'

import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/lib/types/database.types'

/**
 * Browser (client-side) Supabase client.
 * Use in Client Components only.
 * Session is managed automatically via cookies.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
