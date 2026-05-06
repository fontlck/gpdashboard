// ── Shared admin auth + org context helper ────────────────────────────────────
// Use in every admin API route instead of the local requireAdmin() pattern.
//
// Returns { user, orgId } or { error } if auth/org check fails.

import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ORG_COOKIE } from '@/lib/org'

type RequireAdminResult =
  | { user: { id: string }; orgId: string; error: null }
  | { user: null; orgId: null; error: string; status: 401 | 403 }

export async function requireAdmin(): Promise<RequireAdminResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, orgId: null, error: 'Unauthorized', status: 401 }

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return { user: null, orgId: null, error: 'Forbidden', status: 403 }

  // Get org from cookie
  const cookieStore = await cookies()
  const orgId = cookieStore.get(ORG_COOKIE)?.value

  if (!orgId) return { user: null, orgId: null, error: 'No organization selected', status: 403 }

  // Verify user belongs to this org
  const admin = createAdminClient()
  const { data: membership } = await admin
    .from('org_memberships')
    .select('id')
    .eq('user_id', user.id)
    .eq('organization_id', orgId)
    .eq('is_active', true)
    .maybeSingle()

  if (!membership) return { user: null, orgId: null, error: 'Access denied to this organization', status: 403 }

  return { user, orgId, error: null }
}
