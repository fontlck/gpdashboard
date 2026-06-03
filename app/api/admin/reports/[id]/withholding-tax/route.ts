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

// ── PATCH /api/admin/reports/[id]/withholding-tax ─────────────────────────────
// Set or clear withholding tax on a report.
// WHT base = final_payout ÷ (1 + vat_rate_snapshot) — matches Thai tax document method.
// WHT amount is deducted from final_payout to give the net partner payout.
// The stored final_payout is NOT changed — WHT is a separate field so the
// gross payout remains auditable.

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin()
  if (error) return NextResponse.json({ error }, { status: error === 'Unauthorized' ? 401 : 403 })

  const { id } = await params
  const admin   = createAdminClient()

  let body: { pct: number | null; amount?: number }
  try { body = await request.json() }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  // Validate: pct must be null (clear WHT) or 3 or 5
  if (body.pct !== null && body.pct !== 3 && body.pct !== 5)
    return NextResponse.json({ error: 'pct must be 3, 5, or null' }, { status: 400 })

  // Validate manual amount override if provided
  if (body.amount !== undefined && (typeof body.amount !== 'number' || body.amount < 0 || !isFinite(body.amount)))
    return NextResponse.json({ error: 'amount must be a non-negative number' }, { status: 400 })

  // Fetch report
  const { data: report, error: repErr } = await admin
    .from('monthly_reports')
    .select(`
      id, status,
      partner_share_base, vat_amount, is_vat_registered_snapshot, vat_rate_snapshot,
      referred_artist_uplift, referred_artist_uplift_vat,
      service_fee_amount, service_fee_wht
    `)
    .eq('id', id)
    .single()

  if (repErr || !report)
    return NextResponse.json({ error: 'Report not found' }, { status: 404 })

  if (report.status === 'paid')
    return NextResponse.json({ error: 'Cannot modify a paid report' }, { status: 409 })

  // Calculate WHT
  // If manual amount provided use it; otherwise calculate from taxable base only.
  //
  // Taxable base = partner_share_base (already ex-VAT for non-VAT-registered)
  //   + vat_amount (for VAT-registered, payout includes VAT — but WHT is on ex-VAT)
  //   + service_fee_amount if service_fee_wht = true
  //   + referred_artist_uplift (always ex-VAT)
  //
  // For VAT-registered partners: partner_share_base is ex-VAT already (vat_amount added on top)
  // so WHT base = partner_share_base + uplift + (service_fee if wht=true)
  let whtAmount: number | null = null
  if (body.pct !== null) {
    if (body.amount !== undefined) {
      whtAmount = Math.round(body.amount * 100) / 100
    } else {
      const partnerBase  = Number(report.partner_share_base ?? 0)
      const uplift       = Number(report.referred_artist_uplift ?? 0)
      const serviceFee   = report.service_fee_wht ? Number(report.service_fee_amount ?? 0) : 0
      const taxableBase  = partnerBase + uplift + serviceFee
      whtAmount          = Math.round(taxableBase * (body.pct / 100) * 100) / 100
    }
  }

  const { error: updateErr } = await admin
    .from('monthly_reports')
    .update({
      withholding_tax_pct:    body.pct,
      withholding_tax_amount: whtAmount,
      updated_at:             new Date().toISOString(),
    })
    .eq('id', id)

  if (updateErr)
    return NextResponse.json({ error: `Failed to save: ${updateErr.message}` }, { status: 500 })

  return NextResponse.json({
    withholding_tax_pct:    body.pct,
    withholding_tax_amount: whtAmount,
  })
}
