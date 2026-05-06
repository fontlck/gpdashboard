// ── Organization context helpers ──────────────────────────────────────────────
// Stores the current organization in a cookie so every server request
// knows which org the user is operating in.
//
// Cookie name : gp_org_id
// Value       : UUID of the selected organization

import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const ORG_COOKIE = 'gp_org_id'

// ── Get current org_id from cookie ───────────────────────────────────────────

export async function getCurrentOrgId(): Promise<string | null> {
  const cookieStore = await cookies()
  return cookieStore.get(ORG_COOKIE)?.value ?? null
}

// ── Get current org_id, throwing if missing ───────────────────────────────────

export async function requireOrgId(): Promise<string> {
  const orgId = await getCurrentOrgId()
  if (!orgId) throw new Error('No organization selected')
  return orgId
}

// ── Get all orgs for the current user ─────────────────────────────────────────

export type OrgInfo = {
  id:     string
  name:   string
  slug:   string
  is_vat: boolean
  role:   string
}

export async function getUserOrgs(): Promise<OrgInfo[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const admin = createAdminClient()
  const { data } = await admin
    .from('org_memberships')
    .select('role, organizations ( id, name, slug, is_vat )')
    .eq('user_id', user.id)
    .eq('is_active', true)

  if (!data) return []

  return data.map(m => {
    const org = Array.isArray(m.organizations) ? m.organizations[0] : m.organizations
    return {
      id:     org?.id     ?? '',
      name:   org?.name   ?? '',
      slug:   org?.slug   ?? '',
      is_vat: org?.is_vat ?? true,
      role:   m.role,
    }
  }).filter(o => o.id)
}

// ── Verify user has access to a specific org ──────────────────────────────────

export async function verifyOrgAccess(orgId: string): Promise<boolean> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  const admin = createAdminClient()
  const { data } = await admin
    .from('org_memberships')
    .select('id')
    .eq('user_id', user.id)
    .eq('organization_id', orgId)
    .eq('is_active', true)
    .maybeSingle()

  return !!data
}

// ── Get org role for current user ─────────────────────────────────────────────

export async function getOrgRole(orgId: string): Promise<string | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const admin = createAdminClient()
  const { data } = await admin
    .from('org_memberships')
    .select('role')
    .eq('user_id', user.id)
    .eq('organization_id', orgId)
    .eq('is_active', true)
    .maybeSingle()

  return data?.role ?? null
}
