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
// WHT base = partner_share_base + referred_artist_uplift (both ex-VAT).
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

  let body: { pct: number | null }
  try { body = await request.json() }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  // Validate: pct must be null (clear WHT) or 3 or 5
  if (body.pct !== null && body.pct !== 3 && body.pct !== 5)
    return NextResponse.json({ error: 'pct must be 3, 5, or null' }, { status: 400 })

  // Fetch report
  const { data: report, error: repErr } = await admin
    .from('monthly_reports')
    .select('id, status, partner_share_base, referred_artist_uplift')
    .eq('id', id)
    .single()

  if (repErr || !report)
    return NextResponse.json({ error: 'Report not found' }, { status: 404 })

  if (report.status === 'paid')
    return NextResponse.json({ error: 'Cannot modify a paid report' }, { status: 409 })

  // Calculate WHT
  // Base = partner_share_base + referred_artist_uplift (both already ex-VAT)
  let whtAmount: number | null = null
  if (body.pct !== null) {
    const base = Number(report.partner_share_base ?? 0) + Number(report.referred_artist_uplift ?? 0)
    whtAmount  = Math.round(base * (body.pct / 100) * 100) / 100
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
