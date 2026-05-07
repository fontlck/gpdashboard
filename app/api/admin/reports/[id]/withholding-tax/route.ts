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
    .select('id, status, final_payout, vat_rate_snapshot')
    .eq('id', id)
    .single()

  if (repErr || !report)
    return NextResponse.json({ error: 'Report not found' }, { status: 404 })

  if (report.status === 'paid')
    return NextResponse.json({ error: 'Cannot modify a paid report' }, { status: 409 })

  // Calculate WHT
  // If manual amount provided use it; otherwise derive from final_payout ÷ (1+vat_rate)
  let whtAmount: number | null = null
  if (body.pct !== null) {
    if (body.amount !== undefined) {
      whtAmount = Math.round(body.amount * 100) / 100
    } else {
      const vatRate = Number(report.vat_rate_snapshot ?? 0.07)
      const base    = Math.round((Number(report.final_payout ?? 0) / (1 + vatRate)) * 100) / 100
      whtAmount     = Math.round(base * (body.pct / 100) * 100) / 100
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
