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
      .select('id, name, code, payout_type, revenue_share_pct, fixed_rent_amount, fixed_rent_vat_mode, partner_id, partners(id, name, is_vat_registered)')
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
    payout_type?: 'revenue_share' | 'fixed_rent'
    revenue_share_pct?: number
    fixed_rent_amount?: number
    fixed_rent_vat_mode?: 'exclusive' | 'inclusive'
    partner_id?: string
    partner_name?: string
  }
  try { body = await request.json() }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const {
    branch_name, code,
    payout_type = 'revenue_share',
    revenue_share_pct,
    fixed_rent_amount,
    fixed_rent_vat_mode,
    partner_id, partner_name,
  } = body

  if (!branch_name?.trim())
    return NextResponse.json({ error: 'branch_name is required' }, { status: 400 })
  if (!partner_id && !partner_name?.trim())
    return NextResponse.json({ error: 'Either partner_id or partner_name is required' }, { status: 400 })
  if (!['revenue_share', 'fixed_rent'].includes(payout_type))
    return NextResponse.json({ error: 'payout_type must be revenue_share or fixed_rent' }, { status: 400 })

  // Validate payout-model-specific fields
  if (payout_type === 'revenue_share') {
    const pct = revenue_share_pct ?? 50
    if (typeof pct !== 'number' || pct < 0 || pct > 100)
      return NextResponse.json({ error: 'revenue_share_pct must be 0–100' }, { status: 400 })
  }
  if (payout_type === 'fixed_rent') {
    if (fixed_rent_amount == null || typeof fixed_rent_amount !== 'number' || fixed_rent_amount < 0)
      return NextResponse.json({ error: 'fixed_rent_amount is required and must be ≥ 0 for fixed_rent branches' }, { status: 400 })
    if (!['exclusive', 'inclusive'].includes(fixed_rent_vat_mode ?? ''))
      return NextResponse.json({ error: 'fixed_rent_vat_mode must be exclusive or inclusive for fixed_rent branches' }, { status: 400 })
  }

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
      partner_id:          resolvedPartnerId,
      name:                branch_name.trim(),
      code:                branchCode,
      payout_type,
      revenue_share_pct:   payout_type === 'revenue_share' ? (revenue_share_pct ?? 50) : 50,
      fixed_rent_amount:   payout_type === 'fixed_rent' ? fixed_rent_amount : null,
      fixed_rent_vat_mode: payout_type === 'fixed_rent' ? (fixed_rent_vat_mode ?? null) : null,
      is_active:           true,
    })
    .select('id, name, code, payout_type, revenue_share_pct, fixed_rent_amount, fixed_rent_vat_mode, partner_id, partners(id, name, is_vat_registered)')
    .single()

  if (branchErr || !newBranch)
    return NextResponse.json({ error: `Failed to create branch: ${branchErr?.message}` }, { status: 500 })

  return NextResponse.json({ branch: newBranch }, { status: 201 })
}
