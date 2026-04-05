import 'server-only'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/database.types'

/**
 * Service-role Supabase client — bypasses ALL RLS policies.
 *
 * ⚠️  SERVER ONLY — never import this in Client Components or
 *     expose SUPABASE_SERVICE_ROLE_KEY to the browser.
 *
 * Use for:
 *   - Bulk inserts (csv import, report_rows)
 *   - Writing audit_logs (app-level auditing)
 *   - Admin operations that must bypass RLS
 */
export function createAdminClient() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is not set. ' +
      'Add it to .env.local (server-only, never expose to browser).'
    )
  }

  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession:   false,
      },
    }
  )
}
