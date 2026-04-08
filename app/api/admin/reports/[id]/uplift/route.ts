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

// ── PATCH /api/admin/reports/[id]/uplift ─────────────────────────────────────
// Recalculates referred-artist uplift from a new per-artist configuration and
// writes the result back to monthly_reports.

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin()
  if (error) return NextResponse.json({ error }, { status: error === 'Unauthorized' ? 401 : 403 })

  const { id } = await params
  const admin   = createAdminClient()

  let body: { entries: { artist_name: string; uplift_pct: number }[] }
  try { body = await request.json() }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  // Validate entries
  if (!Array.isArray(body.entries))
    return NextResponse.json({ error: 'entries must be an array' }, { status: 400 })

  for (const e of body.entries) {
    if (typeof e.artist_name !== 'string' || typeof e.uplift_pct !== 'number' || e.uplift_pct < 0 || e.uplift_pct > 100)
      return NextResponse.json({ error: 'Each entry must have a valid artist_name and uplift_pct (0–100)' }, { status: 400 })
    if (e.artist_name.trim() === '(Unknown)')
      return NextResponse.json({ error: 'Cannot assign uplift to (Unknown)' }, { status: 400 })
  }

  // Fetch report
  const { data: report, error: repErr } = await admin
    .from('monthly_reports')
    .select('id, status, partner_share_base, vat_amount, is_vat_registered_snapshot, vat_rate_snapshot')
    .eq('id', id)
    .single()

  if (repErr || !report)
    return NextResponse.json({ error: 'Report not found' }, { status: 404 })

  if (report.status === 'paid')
    return NextResponse.json({ error: 'Cannot modify a paid report' }, { status: 409 })

  // Fetch artist summaries for this report to get actual NET values
  const { data: artistRows, error: artistErr } = await admin
    .from('artist_summaries')
    .select('artist_name, total_net')
    .eq('monthly_report_id', id)

  if (artistErr || !artistRows)
    return NextResponse.json({ error: 'Failed to load artist data' }, { status: 500 })

  const vatRate       = Number(report.vat_rate_snapshot)
  const isVatReg      = Boolean(report.is_vat_registered_snapshot)

  // Calculate uplift per artist using the same formula as import-csv
  type SnapEntry = { artist_name: string; uplift_pct: number; uplift_base: number; uplift_vat: number; uplift_total: number }
  const snapshot: SnapEntry[] = []
  let totalUpliftBase = 0
  let totalUpliftVat  = 0

  for (const entry of body.entries) {
    if (entry.uplift_pct <= 0) continue

    const artistRow = artistRows.find(r => r.artist_name === entry.artist_name)
    if (!artistRow) continue

    const netExVat   = Number(artistRow.total_net) / (1 + vatRate)
    const upliftBase = netExVat * (entry.uplift_pct / 100)
    const upliftVat  = isVatReg ? upliftBase * vatRate : 0
    const upliftTotal = upliftBase + upliftVat

    snapshot.push({
      artist_name:  entry.artist_name,
      uplift_pct:   entry.uplift_pct,
      uplift_base:  Math.round(upliftBase  * 100) / 100,
      uplift_vat:   Math.round(upliftVat   * 100) / 100,
      uplift_total: Math.round(upliftTotal * 100) / 100,
    })

    totalUpliftBase += upliftBase
    totalUpliftVat  += upliftVat
  }

  const roundedUpliftBase = Math.round(totalUpliftBase * 100) / 100
  const roundedUpliftVat  = Math.round(totalUpliftVat  * 100) / 100
  const newFinalPayout    = Math.round(
    (Number(report.partner_share_base) + Number(report.vat_amount) + roundedUpliftBase + roundedUpliftVat) * 100
  ) / 100

  const { error: updateErr } = await admin
    .from('monthly_reports')
    .update({
      referred_artist_uplift:          roundedUpliftBase,
      referred_artist_uplift_vat:      roundedUpliftVat,
      referred_artist_uplift_snapshot: snapshot,
      final_payout:                    newFinalPayout,
      recalculated_at:                 new Date().toISOString(),
      updated_at:                      new Date().toISOString(),
    })
    .eq('id', id)

  if (updateErr)
    return NextResponse.json({ error: `Failed to save: ${updateErr.message}` }, { status: 500 })

  return NextResponse.json({
    referred_artist_uplift:     roundedUpliftBase,
    referred_artist_uplift_vat: roundedUpliftVat,
    final_payout:               newFinalPayout,
    snapshot,
  })
}
