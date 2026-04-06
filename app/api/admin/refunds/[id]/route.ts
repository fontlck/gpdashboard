import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

// ── Recalculation helper (mirrored from POST route) ───────────────────────────

type ReportSnapshot = {
  payout_type_snapshot: 'revenue_share' | 'fixed_rent'
  revenue_share_pct_snapshot: number
  is_vat_registered_snapshot: boolean
  vat_rate_snapshot: number
  total_net: number | string
  partner_share_base: number | string
  vat_amount: number | string
  final_payout: number | string
}

function recalculate(report: ReportSnapshot, newRefundAmount: number) {
  const totalNet      = Number(report.total_net)
  const adjustedNet   = totalNet - newRefundAmount
  const hasNegative   = adjustedNet < 0

  const base: Record<string, unknown> = {
    total_refunds:             newRefundAmount,
    adjusted_net:              adjustedNet,
    has_negative_adjusted_net: hasNegative,
    recalculated_at:           new Date().toISOString(),
  }

  if (report.payout_type_snapshot === 'revenue_share') {
    const pct  = Number(report.revenue_share_pct_snapshot)
    const vatR = Number(report.vat_rate_snapshot)
    // total_net and total_refunds are VAT-inclusive amounts from OPN.
    // Strip embedded VAT before applying revenue share to avoid double-counting.
    // If adjusted_net < 0, clamp ex-VAT value to 0 so payout is never negative.
    const adjustedNetExVat = hasNegative ? 0 : adjustedNet / (1 + vatR)
    const partnerShareBase = adjustedNetExVat * (pct / 100)
    const vatAmount        = report.is_vat_registered_snapshot
      ? partnerShareBase * vatR
      : 0
    const finalPayout      = partnerShareBase + vatAmount

    base.partner_share_base = partnerShareBase
    base.vat_amount         = vatAmount
    base.final_payout       = finalPayout
  }
  // fixed_rent: payout fields unchanged

  return base
}

// ── PATCH /api/admin/refunds/:id ──────────────────────────────────────────────
// Updates an existing refund record (amount, reason, reference_number),
// immediately recalculates the linked monthly_report, and writes an audit log.
//
// Body: { amount?, reason?, reference_number? }
// At least one field must be supplied.

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: refundId } = await params

  // ── Auth: admin only ────────────────────────────────────────────────────────
  const userClient = await createClient()
  const { data: { user }, error: authError } = await userClient.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { data: profile } = await userClient
    .from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // ── Parse body ──────────────────────────────────────────────────────────────
  let body: { amount?: number; reason?: string; reference_number?: string | null }
  try { body = await request.json() }
  catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }) }

  const hasAmount    = typeof body.amount === 'number'
  const hasReason    = typeof body.reason === 'string'
  const hasReference = 'reference_number' in body

  if (!hasAmount && !hasReason && !hasReference) {
    return NextResponse.json(
      { error: 'Provide at least one of: amount, reason, reference_number' },
      { status: 400 }
    )
  }
  if (hasAmount && (body.amount! <= 0)) {
    return NextResponse.json({ error: 'amount must be positive' }, { status: 400 })
  }
  if (hasReason && !body.reason!.trim()) {
    return NextResponse.json({ error: 'reason cannot be empty' }, { status: 400 })
  }

  const admin = createAdminClient()

  // ── Fetch existing refund ───────────────────────────────────────────────────
  const { data: existingRefund, error: fetchErr } = await admin
    .from('refunds')
    .select('id, amount, reason, reference_number, monthly_report_id, branch_id, reporting_month, reporting_year')
    .eq('id', refundId)
    .single()

  if (fetchErr || !existingRefund) {
    return NextResponse.json({ error: 'Refund not found' }, { status: 404 })
  }

  // ── Build update payload ────────────────────────────────────────────────────
  const updatePayload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }
  if (hasAmount)    updatePayload.amount           = body.amount
  if (hasReason)    updatePayload.reason           = body.reason!.trim()
  if (hasReference) updatePayload.reference_number = body.reference_number?.trim() || null

  const { data: updatedRefund, error: updateErr } = await admin
    .from('refunds')
    .update(updatePayload)
    .eq('id', refundId)
    .select('*')
    .single()

  if (updateErr || !updatedRefund) {
    console.error('[PATCH /api/admin/refunds/:id] update error:', updateErr)
    return NextResponse.json({ error: 'Failed to update refund' }, { status: 500 })
  }

  // ── Recalculate linked monthly_report ──────────────────────────────────────
  let recalcResult: Record<string, unknown> | null = null
  const monthlyReportId = existingRefund.monthly_report_id

  if (monthlyReportId) {
    const { data: report } = await admin
      .from('monthly_reports')
      .select(`
        id,
        payout_type_snapshot, revenue_share_pct_snapshot,
        is_vat_registered_snapshot, vat_rate_snapshot,
        total_net, partner_share_base, vat_amount, final_payout
      `)
      .eq('id', monthlyReportId)
      .single()

    if (report) {
      const effectiveAmount = hasAmount ? body.amount! : Number(existingRefund.amount)
      const updates = recalculate(report as ReportSnapshot, effectiveAmount)

      const { error: recalcErr } = await admin
        .from('monthly_reports')
        .update(updates)
        .eq('id', monthlyReportId)

      if (recalcErr) {
        console.error('[PATCH /api/admin/refunds/:id] recalc error:', recalcErr)
      } else {
        recalcResult = updates
      }
    }
  }

  // ── Audit log ───────────────────────────────────────────────────────────────
  await admin.from('audit_logs').insert({
    actor_id:    user.id,
    action:      'refund_updated',
    entity_type: 'refund',
    entity_id:   refundId,
    before_state: {
      amount:           Number(existingRefund.amount),
      reason:           existingRefund.reason,
      reference_number: existingRefund.reference_number,
    },
    after_state: {
      amount:           updatedRefund.amount,
      reason:           updatedRefund.reason,
      reference_number: updatedRefund.reference_number,
    },
    metadata: {
      branch_id:           existingRefund.branch_id,
      reporting_month:     existingRefund.reporting_month,
      reporting_year:      existingRefund.reporting_year,
      monthly_report_id:   monthlyReportId,
      report_recalculated: !!recalcResult,
    },
  })

  return NextResponse.json({
    success:             true,
    refund_id:           refundId,
    monthly_report_id:   monthlyReportId,
    report_recalculated: !!recalcResult,
    recalc:              recalcResult,
    refund:              updatedRefund,
  })
}
