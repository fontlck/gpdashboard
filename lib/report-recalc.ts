import type { SupabaseClient } from '@supabase/supabase-js'

// ── Shared financial recalculation for a monthly_report ──────────────────────
// Used after order rows are deleted (or edited) to bring all derived numbers
// in sync. Preserves existing snapshots (payout model, VAT, uplift %, WHT %).
//
// Recalculates:
//   • gross_sales, total_opn_fee, total_net, total_refunds, adjusted_net
//   • partner_share_base, vat_amount, final_payout (per payout model)
//   • referred_artist_uplift / _vat / _snapshot (using existing uplift_pct)
//   • withholding_tax_amount (using existing pct, if set)
//   • artist_summaries table (full rebuild)
//
// Does NOT recalculate WHT pct, uplift pct, or VAT rate — those are user-set.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = SupabaseClient<any, any, any>

export async function recalcReport(admin: SB, reportId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  // Fetch report (with all snapshots needed for recalculation)
  const { data: report, error: repErr } = await admin
    .from('monthly_reports')
    .select(`
      id, status, branch_id, reporting_month, reporting_year,
      payout_type_snapshot, revenue_share_pct_snapshot,
      fixed_rent_snapshot, fixed_rent_vat_mode_snapshot,
      is_vat_registered_snapshot, vat_rate_snapshot,
      referred_artist_uplift_snapshot,
      service_fee_amount, service_fee_wht,
      withholding_tax_pct
    `)
    .eq('id', reportId)
    .single()

  if (repErr || !report) return { ok: false, error: 'Report not found' }

  // Fetch all remaining rows
  const { data: rows, error: rowsErr } = await admin
    .from('report_rows')
    .select('artist_name_raw, artist_image_url, amount, net, opn_fee, opn_refunded, opn_refunded_amount')
    .eq('monthly_report_id', reportId)

  if (rowsErr) return { ok: false, error: rowsErr.message }

  const allRows = rows ?? []

  // ── Aggregate row totals ────────────────────────────────────────────────────
  const gross_sales   = allRows.reduce((s, r) => s + (r.opn_refunded ? 0 : Number(r.amount)), 0)
  const total_opn_fee = allRows.reduce((s, r) => s + Number(r.opn_fee ?? 0), 0)
  const total_net     = allRows.reduce((s, r) => s + Number(r.net), 0)
  const total_refunds = allRows.reduce((s, r) => s + Number(r.opn_refunded_amount ?? 0), 0)
  const adjusted_net  = total_net - total_refunds

  // ── Payout model ────────────────────────────────────────────────────────────
  const payoutType      = (report.payout_type_snapshot ?? 'revenue_share') as 'revenue_share' | 'fixed_rent'
  const revenueSharePct = Number(report.revenue_share_pct_snapshot ?? 50)
  const fixedRent       = report.fixed_rent_snapshot != null ? Number(report.fixed_rent_snapshot) : 0
  const fixedRentMode   = (report.fixed_rent_vat_mode_snapshot ?? null) as 'exclusive' | 'inclusive' | null
  const isVatRegistered = Boolean(report.is_vat_registered_snapshot)
  const vatRate         = Number(report.vat_rate_snapshot ?? 0.07)

  let partner_share: number
  let vat_amount:    number
  let final_payout:  number

  if (payoutType === 'fixed_rent') {
    if (!isVatRegistered || fixedRent === 0) {
      partner_share = fixedRent
      vat_amount    = 0
      final_payout  = fixedRent
    } else if (fixedRentMode === 'inclusive') {
      const base    = fixedRent / (1 + vatRate)
      partner_share = base
      vat_amount    = fixedRent - base
      final_payout  = fixedRent
    } else {
      partner_share = fixedRent
      vat_amount    = fixedRent * vatRate
      final_payout  = fixedRent + vat_amount
    }
  } else {
    const adjustedNetExVat = adjusted_net < 0 ? 0 : adjusted_net / (1 + vatRate)
    partner_share = adjustedNetExVat * (revenueSharePct / 100)
    vat_amount    = isVatRegistered ? partner_share * vatRate : 0
    final_payout  = partner_share + vat_amount
  }

  // ── Per-artist aggregation (for uplift recalc + artist_summaries rebuild) ──
  type ArtistStats = { order_count: number; gross_sales: number; total_net: number; artist_image_url: string | null }
  const artistMap: Record<string, ArtistStats> = {}
  for (const r of allRows) {
    const name  = r.artist_name_raw?.trim() || '(Unknown)'
    const entry = artistMap[name] ?? { order_count: 0, gross_sales: 0, total_net: 0, artist_image_url: null }
    if (!r.opn_refunded) {
      entry.order_count++
      entry.gross_sales += Number(r.amount)
    }
    entry.total_net += Number(r.net)
    if (!entry.artist_image_url && r.artist_image_url) entry.artist_image_url = r.artist_image_url
    artistMap[name] = entry
  }

  // ── Recalculate referred-artist uplift using existing snapshot (pct only) ──
  let referred_artist_uplift     = 0
  let referred_artist_uplift_vat = 0
  type UpliftSnap = { artist_name: string; uplift_pct: number; uplift_base: number; uplift_vat: number; uplift_total: number; total_net?: number }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existingSnap = (report.referred_artist_uplift_snapshot as any[]) ?? []
  const newSnap: UpliftSnap[] = []

  for (const entry of existingSnap) {
    const pct = Number(entry.uplift_pct ?? 0)
    if (pct <= 0) continue
    const stats = artistMap[entry.artist_name]
    if (!stats) continue   // artist no longer has any orders — skip
    const netExVat   = stats.total_net < 0 ? 0 : stats.total_net / (1 + vatRate)
    const upliftBase = netExVat * (pct / 100)
    const upliftVat  = isVatRegistered ? upliftBase * vatRate : 0
    referred_artist_uplift     += upliftBase
    referred_artist_uplift_vat += upliftVat
    newSnap.push({
      artist_name:  entry.artist_name,
      uplift_pct:   pct,
      uplift_base:  Math.round(upliftBase  * 100) / 100,
      uplift_vat:   Math.round(upliftVat   * 100) / 100,
      uplift_total: Math.round((upliftBase + upliftVat) * 100) / 100,
      total_net:    stats.total_net,
    })
  }

  // Add uplift to final_payout
  final_payout += referred_artist_uplift + referred_artist_uplift_vat

  // Round all monetary values
  const r2 = (n: number) => Math.round(n * 100) / 100

  // ── Recalculate WHT if pct is set (taxable base = partner_share + uplift + optional service_fee) ──
  let withholding_tax_amount: number | null = null
  const whtPct = report.withholding_tax_pct != null ? Number(report.withholding_tax_pct) : null
  if (whtPct !== null && whtPct > 0) {
    const serviceFee = report.service_fee_wht ? Number(report.service_fee_amount ?? 0) : 0
    const taxBase    = r2(partner_share) + r2(referred_artist_uplift) + serviceFee
    withholding_tax_amount = r2(taxBase * (whtPct / 100))
  }

  // ── Update report ──────────────────────────────────────────────────────────
  const { error: updateErr } = await admin
    .from('monthly_reports')
    .update({
      gross_sales:                     r2(gross_sales),
      total_opn_fee:                   r2(total_opn_fee),
      total_net:                       r2(total_net),
      total_refunds:                   r2(total_refunds),
      adjusted_net:                    r2(adjusted_net),
      has_negative_adjusted_net:       adjusted_net < 0,
      partner_share_base:              r2(partner_share),
      vat_amount:                      r2(vat_amount),
      final_payout:                    r2(final_payout),
      referred_artist_uplift:          r2(referred_artist_uplift),
      referred_artist_uplift_vat:      r2(referred_artist_uplift_vat),
      referred_artist_uplift_snapshot: newSnap,
      withholding_tax_amount,
      recalculated_at:                 new Date().toISOString(),
      updated_at:                      new Date().toISOString(),
    })
    .eq('id', reportId)

  if (updateErr) return { ok: false, error: updateErr.message }

  // ── Rebuild artist_summaries ───────────────────────────────────────────────
  await admin.from('artist_summaries').delete().eq('monthly_report_id', reportId)
  const artistRows = Object.entries(artistMap).map(([artist_name, stats]) => ({
    monthly_report_id: reportId,
    branch_id:         report.branch_id,
    reporting_month:   report.reporting_month,
    reporting_year:    report.reporting_year,
    artist_name,
    order_count:       stats.order_count,
    gross_sales:       r2(stats.gross_sales),
    total_net:         r2(stats.total_net),
    artist_image_url:  stats.artist_image_url,
  }))
  if (artistRows.length > 0) {
    await admin.from('artist_summaries').insert(artistRows)
  }

  return { ok: true }
}
