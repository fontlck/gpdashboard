import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, error: 'Unauthorized' }
  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return { user: null, error: 'Forbidden' }
  return { user, error: null }
}

// ── GET /api/admin/branches ──────────────────────────────────────────────────
// Returns all active branches (with partner info) and all partners.
// Used by the CSV upload branch-mapping step.

export async function GET() {
  const { error } = await requireAdmin()
  if (error) return NextResponse.json({ error }, { status: error === 'Unauthorized' ? 401 : 403 })

  const admin = createAdminClient()

  const [{ data: branches }, { data: partners }] = await Promise.all([
    admin
      .from('branches')
      .select('id, name, code, revenue_share_pct, partner_id, partners(id, name)')
      .eq('is_active', true)
      .order('name'),
    admin
      .from('partners')
      .select('id, name')
      .eq('is_active', true)
      .order('name'),
  ])

  return NextResponse.json({ branches: branches ?? [], partners: partners ?? [] })
}

// ── POST /api/admin/branches ─────────────────────────────────────────────────
// Explicit admin action: create a new branch.
// If partner_id is provided, use that partner.
// If partner_name is provided (and no partner_id), create that partner first.
// No implicit or automatic creation — this endpoint is only called when
// the admin explicitly clicks "Create Branch" in the mapping UI.

export async function POST(request: NextRequest) {
  const { error } = await requireAdmin()
  if (error) return NextResponse.json({ error }, { status: error === 'Unauthorized' ? 401 : 403 })

  let body: {
    branch_name: string
    code?: string
    revenue_share_pct: number
    partner_id?: string
    partner_name?: string
  }
  try { body = await request.json() }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { branch_name, code, revenue_share_pct, partner_id, partner_name } = body

  if (!branch_name?.trim())
    return NextResponse.json({ error: 'branch_name is required' }, { status: 400 })
  if (!partner_id && !partner_name?.trim())
    return NextResponse.json({ error: 'Either partner_id or partner_name is required' }, { status: 400 })
  if (typeof revenue_share_pct !== 'number' || revenue_share_pct < 0 || revenue_share_pct > 100)
    return NextResponse.json({ error: 'revenue_share_pct must be 0–100' }, { status: 400 })

  const admin = createAdminClient()

  // Resolve partner
  let resolvedPartnerId: string = partner_id ?? ''

  if (!resolvedPartnerId) {
    // Create new partner explicitly requested by admin
    const { data: newPartner, error: partnerErr } = await admin
      .from('partners')
      .insert({ name: partner_name!.trim(), is_vat_registered: false, is_active: true })
      .select('id')
      .single()

    if (partnerErr || !newPartner)
      return NextResponse.json({ error: `Failed to create partner: ${partnerErr?.message}` }, { status: 500 })

    resolvedPartnerId = newPartner.id
  }

  // Derive code if not provided
  const branchCode = (code?.trim() || branch_name.trim()
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .split(/\s+/)
    .map((w: string) => w[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 6)) || 'BR'

  // Create branch
  const { data: newBranch, error: branchErr } = await admin
    .from('branches')
    .insert({
      partner_id:       resolvedPartnerId,
      name:             branch_name.trim(),
      code:             branchCode,
      revenue_share_pct,
      is_active:        true,
    })
    .select('id, name, code, revenue_share_pct, partner_id, partners(id, name)')
    .single()

  if (branchErr || !newBranch)
    return NextResponse.json({ error: `Failed to create branch: ${branchErr?.message}` }, { status: 500 })

  return NextResponse.json({ branch: newBranch }, { status: 201 })
}
