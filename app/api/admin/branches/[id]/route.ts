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

// ── PATCH /api/admin/branches/[id] ───────────────────────────────────────────
// Update branch payout settings and/or partner VAT registration status.

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin()
  if (error) return NextResponse.json({ error }, { status: error === 'Unauthorized' ? 401 : 403 })

  const { id } = await params

  let body: {
    payout_type?: 'revenue_share' | 'fixed_rent'
    revenue_share_pct?: number
    fixed_rent_amount?: number
    fixed_rent_vat_mode?: 'exclusive' | 'inclusive'
    is_active?: boolean
    partner_is_vat_registered?: boolean
  }
  try { body = await request.json() }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const admin = createAdminClient()

  // Fetch current branch to know partner_id and current payout_type
  const { data: current, error: fetchErr } = await admin
    .from('branches')
    .select('id, partner_id, payout_type')
    .eq('id', id)
    .single()

  if (fetchErr || !current)
    return NextResponse.json({ error: 'Branch not found' }, { status: 404 })

  const payout_type = body.payout_type ?? current.payout_type

  // Validate payout-model fields if payout_type is being set
  if (payout_type === 'fixed_rent') {
    if (body.fixed_rent_amount != null && (typeof body.fixed_rent_amount !== 'number' || body.fixed_rent_amount < 0))
      return NextResponse.json({ error: 'fixed_rent_amount must be ≥ 0' }, { status: 400 })
    if (body.fixed_rent_vat_mode != null && !['exclusive', 'inclusive'].includes(body.fixed_rent_vat_mode))
      return NextResponse.json({ error: 'fixed_rent_vat_mode must be exclusive or inclusive' }, { status: 400 })
  }
  if (payout_type === 'revenue_share') {
    if (body.revenue_share_pct != null && (typeof body.revenue_share_pct !== 'number' || body.revenue_share_pct < 0 || body.revenue_share_pct > 100))
      return NextResponse.json({ error: 'revenue_share_pct must be 0–100' }, { status: 400 })
  }

  // Build branch update payload
  const branchUpdate: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (body.payout_type !== undefined) {
    branchUpdate.payout_type = body.payout_type
    // Switching model — require all fields for the new model explicitly
    if (body.payout_type === 'fixed_rent') {
      if (body.fixed_rent_amount == null || typeof body.fixed_rent_amount !== 'number')
        return NextResponse.json({ error: 'fixed_rent_amount is required when switching to fixed_rent' }, { status: 400 })
      if (!['exclusive', 'inclusive'].includes(body.fixed_rent_vat_mode ?? ''))
        return NextResponse.json({ error: 'fixed_rent_vat_mode (exclusive or inclusive) is required when switching to fixed_rent' }, { status: 400 })
      branchUpdate.fixed_rent_amount   = body.fixed_rent_amount
      branchUpdate.fixed_rent_vat_mode = body.fixed_rent_vat_mode
    } else {
      branchUpdate.revenue_share_pct   = body.revenue_share_pct ?? 50
      branchUpdate.fixed_rent_amount   = null
      branchUpdate.fixed_rent_vat_mode = null
    }
  } else {
    // Partial update within existing model
    if (body.revenue_share_pct  !== undefined) branchUpdate.revenue_share_pct  = body.revenue_share_pct
    if (body.fixed_rent_amount  !== undefined) branchUpdate.fixed_rent_amount  = body.fixed_rent_amount
    if (body.fixed_rent_vat_mode !== undefined) branchUpdate.fixed_rent_vat_mode = body.fixed_rent_vat_mode
  }
  if (body.is_active !== undefined) branchUpdate.is_active = body.is_active

  // Update branch
  const { data: updatedBranch, error: branchErr } = await admin
    .from('branches')
    .update(branchUpdate)
    .eq('id', id)
    .select('id, name, code, payout_type, revenue_share_pct, fixed_rent_amount, fixed_rent_vat_mode, is_active, partner_id, partners(id, name, is_vat_registered)')
    .single()

  if (branchErr || !updatedBranch)
    return NextResponse.json({ error: `Failed to update branch: ${branchErr?.message}` }, { status: 500 })

  // Update partner VAT registration if requested
  if (body.partner_is_vat_registered !== undefined) {
    const { error: partnerErr } = await admin
      .from('partners')
      .update({ is_vat_registered: body.partner_is_vat_registered, updated_at: new Date().toISOString() })
      .eq('id', current.partner_id)

    if (partnerErr)
      return NextResponse.json({ error: `Branch updated but failed to update partner VAT: ${partnerErr.message}` }, { status: 500 })
  }

  return NextResponse.json({ branch: updatedBranch })
}

// ── DELETE /api/admin/branches/[id] ──────────────────────────────────────────
// Soft-delete a branch by setting is_active = false.
// Hard delete is blocked if the branch has any monthly_reports.

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin()
  if (error) return NextResponse.json({ error }, { status: error === 'Unauthorized' ? 401 : 403 })

  const { id } = await params
  const admin = createAdminClient()

  // Check branch exists
  const { data: branch, error: fetchErr } = await admin
    .from('branches')
    .select('id, name')
    .eq('id', id)
    .single()

  if (fetchErr || !branch)
    return NextResponse.json({ error: 'Branch not found' }, { status: 404 })

  // Check for any monthly_reports linked to this branch
  const { count, error: countErr } = await admin
    .from('monthly_reports')
    .select('id', { count: 'exact', head: true })
    .eq('branch_id', id)

  if (countErr)
    return NextResponse.json({ error: 'Failed to check reports' }, { status: 500 })

  if ((count ?? 0) > 0) {
    // Has reports — soft delete only (deactivate)
    const { error: deactivateErr } = await admin
      .from('branches')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (deactivateErr)
      return NextResponse.json({ error: 'Failed to deactivate branch' }, { status: 500 })

    return NextResponse.json({
      deleted: false,
      deactivated: true,
      message: `Branch "${branch.name}" has ${count} report(s) and has been deactivated instead of deleted.`,
    })
  }

  // No reports — hard delete
  const { error: deleteErr } = await admin
    .from('branches')
    .delete()
    .eq('id', id)

  if (deleteErr)
    return NextResponse.json({ error: 'Failed to delete branch' }, { status: 500 })

  return NextResponse.json({ deleted: true, deactivated: false, message: `Branch "${branch.name}" deleted.` })
}
