import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ORG_COOKIE, getUserOrgs, verifyOrgAccess } from '@/lib/org'

// ── GET /api/auth/orgs ────────────────────────────────────────────────────────
// Returns all organizations the current user belongs to.

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const orgs = await getUserOrgs()
  return NextResponse.json({ orgs })
}

// ── POST /api/auth/orgs ───────────────────────────────────────────────────────
// Sets the current organization cookie.
// Body: { org_id: string }

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { org_id?: string }
  try { body = await request.json() }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  if (!body.org_id) {
    return NextResponse.json({ error: 'org_id is required' }, { status: 400 })
  }

  // Verify user actually belongs to this org
  const hasAccess = await verifyOrgAccess(body.org_id)
  if (!hasAccess) {
    return NextResponse.json({ error: 'Access denied to this organization' }, { status: 403 })
  }

  // Get the user's role in this org (to return for redirect logic)
  const admin = createAdminClient()
  const { data: membership } = await admin
    .from('org_memberships')
    .select('role')
    .eq('user_id', user.id)
    .eq('organization_id', body.org_id)
    .eq('is_active', true)
    .maybeSingle()

  const response = NextResponse.json({ ok: true, role: membership?.role ?? 'partner' })

  response.cookies.set(ORG_COOKIE, body.org_id, {
    path:     '/',
    httpOnly: true,
    sameSite: 'lax',
    maxAge:   60 * 60 * 24 * 30, // 30 days
  })

  return response
}
