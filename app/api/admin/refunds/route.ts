import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

// ── Recalculation helper ──────────────────────────────────────────────────────
// Given a monthly_report row and a new refund amount, return the updated
// financial fields. Fixed-rent reports only update refund/adjusted_net;
// revenue-share reports recalculate the full payout chain.

type ReportSnapshot = {
  payout_type_snapshot: 'revenue_share' | 'fixed_rent'
  revenue_share_pct_snapshot: number
  is_vat_registered_snapshot: boolean
  vat_rate_snapshot: number
  total_net: number | string
  // fixed_rent fields — payout unchanged but stored for completeness
  partner_share_base: number | string
  vat_amount: number | string
  final_payout: number | string
}

function recalculate(report: ReportSnapshot, newRefundAmount: number) {
  const totalNet      = Number(report.total_net)
  const adjustedNet   = totalNet - newRefundAmount
  const hasNegative   = adjustedNet < 0

  const base: Record<string, unknown> = {
    total_refunds:            newRefundAmount,
    adjusted_net:             adjustedNet,
    has_negative_adjusted_net: hasNegative,
    recalculated_at:          new Date().toISOString(),
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
  // fixed_rent: payout fields (partner_share_base, vat_amount, final_payout) unchanged

  return base
}

// ── POST /api/admin/refunds ───────────────────────────────────────────────────
// Creates a refund record, auto-links the monthly_report, immediately
// recalculates the report, and writes an audit_log entry.
//
// Body: { branch_id, reporting_month, reporting_year, amount, reason, reference_number? }
// Rules:
//   • Only one refund per branch per reporting month (unique constraint in DB).
//   • monthly_report_id is resolved from branch + month + year (may be null if
//     no report exists yet — refund is still recorded for later linkage).

export async function POST(request: NextRequest) {
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
  let body: {
    branch_id: string
    reporting_month: number
    reporting_year: number
    amount: number
    reason: string
    reference_number?: string
  }
  try { body = await request.json() }
  catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }) }

  const { branch_id, reporting_month, reporting_year, amount, reason, reference_number } = body

  if (!branch_id || !reporting_month || !reporting_year) {
    return NextResponse.json({ error: 'branch_id, reporting_month, reporting_year are required' }, { status: 400 })
  }
  if (typeof amount !== 'number' || amount <= 0) {
    return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 })
  }
  if (!reason?.trim()) {
    return NextResponse.json({ error: 'reason is required' }, { status: 400 })
  }

  const admin = createAdminClient()

  // ── Check uniqueness before insert (clearer error than DB constraint) ───────
  const { data: existing } = await admin
    .from('refunds')
    .select('id, amount, reason')
    .eq('branch_id', branch_id)
    .eq('reporting_month', reporting_month)
    .eq('reporting_year', reporting_year)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({
      error: 'A refund already exists for this branch and period. Use PATCH to edit it.',
      existing_refund_id: existing.id,
    }, { status: 409 })
  }

  // ── Resolve monthly_report (may not exist yet) ──────────────────────────────
  const { data: report } = await admin
    .from('monthly_reports')
    .select(`
      id,
      payout_type_snapshot, revenue_share_pct_snapshot,
      is_vat_registered_snapshot, vat_rate_snapshot,
      total_net, partner_share_base, vat_amount, final_payout
    `)
    .eq('branch_id', branch_id)
    .eq('reporting_month', reporting_month)
    .eq('reporting_year', reporting_year)
    .maybeSingle()

  // ── Create refund ───────────────────────────────────────────────────────────
  const { data: newRefund, error: insertErr } = await admin
    .from('refunds')
    .insert({
      branch_id,
      monthly_report_id: report?.id ?? null,
      reporting_month,
      reporting_year,
      amount,
      reason:           reason.trim(),
      reference_number: reference_number?.trim() || null,
      entered_by:       user.id,
    })
    .select('*')
    .single()

  if (insertErr || !newRefund) {
    console.error('[POST /api/admin/refunds] insert error:', insertErr)
    return NextResponse.json({ error: insertErr?.message ?? 'Failed to create refund' }, { status: 500 })
  }

  // ── Recalculate report if it exists ────────────────────────────────────────
  let recalcResult: Record<string, unknown> | null = null
  if (report) {
    const updates = recalculate(report as ReportSnapshot, amount)
    const { error: updateErr } = await admin
      .from('monthly_reports')
      .update(updates)
      .eq('id', report.id)

    if (updateErr) {
      console.error('[POST /api/admin/refunds] recalc error:', updateErr)
      // Don't fail the whole request — refund was created, just log the issue
    } else {
      recalcResult = updates
    }
  }

  // ── Audit log ───────────────────────────────────────────────────────────────
  await admin.from('audit_logs').insert({
    actor_id:    user.id,
    action:      'refund_created',
    entity_type: 'refund',
    entity_id:   newRefund.id,
    before_state: null,
    after_state: {
      amount,
      reason:           reason.trim(),
      reference_number: reference_number?.trim() || null,
      branch_id,
      reporting_month,
      reporting_year,
      monthly_report_id: report?.id ?? null,
    },
    metadata: {
      branch_id,
      reporting_month,
      reporting_year,
      monthly_report_id:  report?.id ?? null,
      report_recalculated: !!recalcResult,
    },
  })

  return NextResponse.json({
    success:             true,
    refund_id:           newRefund.id,
    monthly_report_id:   report?.id ?? null,
    report_recalculated: !!recalcResult,
    recalc:              recalcResult,
  }, { status: 201 })
}
