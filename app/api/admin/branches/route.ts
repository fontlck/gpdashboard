import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/api/require-admin'

// ── GET /api/admin/branches ──────────────────────────────────────────────────
// Returns all active branches (with partner info) and all partners — scoped to current org.

export async function GET() {
  const auth = await requireAdmin()
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { orgId } = auth

  const admin = createAdminClient()

  const [{ data: branches }, { data: partners }] = await Promise.all([
    admin
      .from('branches')
      .select('id, name, code, payout_type, revenue_share_pct, fixed_rent_amount, fixed_rent_vat_mode, partner_id, partners(id, name, is_vat_registered)')
      .eq('organization_id', orgId)
      .eq('is_active', true)
      .order('name'),
    admin
      .from('partners')
      .select('id, name')
      .eq('organization_id', orgId)
      .eq('is_active', true)
      .order('name'),
  ])

  return NextResponse.json({ branches: branches ?? [], partners: partners ?? [] })
}

// ── POST /api/admin/branches ─────────────────────────────────────────────────
// Explicit admin action: create a new branch within the current org.

export async function POST(request: NextRequest) {
  const auth = await requireAdmin()
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { orgId } = auth

  let body: {
    branch_name: string
    code?: string
    payout_type?: 'revenue_share' | 'fixed_rent'
    revenue_share_pct?: number
    fixed_rent_amount?: number
    fixed_rent_vat_mode?: 'exclusive' | 'inclusive'
    partner_id?: string
    partner_name?: string
    partner_is_vat_registered?: boolean
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
    partner_is_vat_registered = false,
  } = body

  if (!branch_name?.trim())
    return NextResponse.json({ error: 'branch_name is required' }, { status: 400 })
  if (!partner_id && !partner_name?.trim())
    return NextResponse.json({ error: 'Either partner_id or partner_name is required' }, { status: 400 })
  if (!['revenue_share', 'fixed_rent'].includes(payout_type))
    return NextResponse.json({ error: 'payout_type must be revenue_share or fixed_rent' }, { status: 400 })

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

  // Resolve partner — must belong to same org
  let resolvedPartnerId: string = partner_id ?? ''

  if (partner_id) {
    // Verify the given partner belongs to this org
    const { data: existingPartner } = await admin
      .from('partners')
      .select('id')
      .eq('id', partner_id)
      .eq('organization_id', orgId)
      .maybeSingle()
    if (!existingPartner)
      return NextResponse.json({ error: 'Partner not found in this organization' }, { status: 404 })
  } else {
    // Create new partner in this org
    const { data: newPartner, error: partnerErr } = await admin
      .from('partners')
      .insert({ name: partner_name!.trim(), is_vat_registered: partner_is_vat_registered, is_active: true, organization_id: orgId })
      .select('id')
      .single()

    if (partnerErr || !newPartner)
      return NextResponse.json({ error: `Failed to create partner: ${partnerErr?.message}` }, { status: 500 })

    resolvedPartnerId = newPartner.id
  }

  // Derive a unique code — scoped to org
  const baseCode = (code?.trim() || (() => {
    const words = branch_name.trim().replace(/[^a-zA-Z0-9\s]/g, '').split(/\s+/)
    if (words.length === 1) return words[0].slice(0, 3).toUpperCase()
    return words.map((w: string) => w[0] ?? '').join('').toUpperCase().slice(0, 6)
  })()) || 'BR'

  const { data: existingCodes } = await admin
    .from('branches')
    .select('code')
    .eq('organization_id', orgId)

  const takenCodes = new Set((existingCodes ?? []).map((r: { code: string }) => r.code))

  let branchCode = baseCode
  if (takenCodes.has(branchCode)) {
    const namePart = branch_name.trim().replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
    let found = false
    for (let len = baseCode.length + 1; len <= Math.min(namePart.length, 6); len++) {
      const candidate = namePart.slice(0, len)
      if (!takenCodes.has(candidate)) { branchCode = candidate; found = true; break }
    }
    if (!found) {
      for (let i = 2; i <= 99; i++) {
        const candidate = `${baseCode}${i}`
        if (!takenCodes.has(candidate)) { branchCode = candidate; break }
      }
    }
  }

  const { data: newBranch, error: branchErr } = await admin
    .from('branches')
    .insert({
      organization_id:     orgId,
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
