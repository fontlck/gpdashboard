import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/api/require-admin'

// PATCH /api/admin/reports/[id]/extras
// Body: {
//   compensation_amount?:  number | null
//   compensation_note?:    string | null
//   service_fee_amount?:   number | null
//   service_fee_note?:     string | null
//   service_fee_wht?:      boolean
//   fee_deduction_amount?: number | null
//   fee_deduction_note?:   string | null
// }
// Saves extra line items and recalculates final_payout.

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = await params
  const admin   = createAdminClient()

  let body: {
    compensation_amount?:  number | null
    compensation_note?:    string | null
    service_fee_amount?:   number | null
    service_fee_note?:     string | null
    service_fee_wht?:      boolean
    fee_deduction_amount?: number | null
    fee_deduction_note?:   string | null
  }
  try { body = await request.json() }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  // Fetch current report to get base payout (before extras)
  const { data: report, error: fetchErr } = await admin
    .from('monthly_reports')
    .select(`
      id, status,
      partner_share_base, vat_amount,
      referred_artist_uplift, referred_artist_uplift_vat,
      compensation_amount, service_fee_amount, service_fee_wht, fee_deduction_amount
    `)
    .eq('id', id)
    .single()

  if (fetchErr || !report)
    return NextResponse.json({ error: 'Report not found' }, { status: 404 })

  if (report.status === 'paid')
    return NextResponse.json({ error: 'Cannot edit a paid report' }, { status: 400 })

  // New extra values from body
  const newComp   = body.compensation_amount  != null ? Number(body.compensation_amount)  : 0
  const newSvc    = body.service_fee_amount   != null ? Number(body.service_fee_amount)   : 0
  const newSvcWht = (body.service_fee_wht ?? false) ? newSvc * 0.03 : 0
  const newFee    = body.fee_deduction_amount != null ? Number(body.fee_deduction_amount) : 0
  const newAdj    = newComp + newSvc - newSvcWht - newFee

  // Compute final_payout from first-principles so it is always correct,
  // regardless of whether final_payout was previously stale.
  const basePayoutClean = Math.round((
    Number(report.partner_share_base       ?? 0) +
    Number(report.vat_amount               ?? 0) +
    Number(report.referred_artist_uplift   ?? 0) +
    Number(report.referred_artist_uplift_vat ?? 0)
  ) * 100) / 100
  const newFinalPayout = Math.round((basePayoutClean + newAdj) * 100) / 100

  const { error: updateErr } = await admin
    .from('monthly_reports')
    .update({
      compensation_amount:  body.compensation_amount  ?? null,
      compensation_note:    body.compensation_note    ?? null,
      service_fee_amount:   body.service_fee_amount   ?? null,
      service_fee_note:     body.service_fee_note     ?? null,
      service_fee_wht:      body.service_fee_wht      ?? false,
      fee_deduction_amount: body.fee_deduction_amount ?? null,
      fee_deduction_note:   body.fee_deduction_note   ?? null,
      final_payout:         newFinalPayout,
    })
    .eq('id', id)

  if (updateErr)
    return NextResponse.json({ error: updateErr.message }, { status: 500 })

  return NextResponse.json({ ok: true, final_payout: newFinalPayout })
}
