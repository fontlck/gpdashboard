import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient as createServerClient } from '@/lib/supabase/server'

// ── PATCH /api/admin/report-rows/:id ─────────────────────────────────────────
// Updates artist_name_raw and/or artist_image_url for a single report_row,
// rebuilds artist_summaries for the parent monthly_report, and writes an
// audit_log entry. Admin-only. Financial calculations are NOT affected.

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: rowId } = await params

  // ── Auth: admin only ────────────────────────────────────────────────────────
  const userClient = await createServerClient()
  const { data: { user }, error: authError } = await userClient.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await userClient
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // ── Parse body ──────────────────────────────────────────────────────────────
  let body: { artist_name?: string; artist_image_url?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const rawName    = typeof body.artist_name === 'string'      ? body.artist_name.trim()      : undefined
  const rawImage   = typeof body.artist_image_url === 'string' ? body.artist_image_url.trim()  : undefined

  const artistName     = rawName  !== undefined ? (rawName  || null) : undefined
  const artistImageUrl = rawImage !== undefined ? (rawImage || null) : undefined

  // At least one field must be supplied
  if (artistName === undefined && artistImageUrl === undefined) {
    return NextResponse.json({ error: 'Provide at least one of: artist_name, artist_image_url' }, { status: 400 })
  }

  // ── Fetch the existing row ──────────────────────────────────────────────────
  const admin = createAdminClient()

  const { data: existingRow, error: rowErr } = await admin
    .from('report_rows')
    .select('id, monthly_report_id, artist_name_raw, artist_image_url')
    .eq('id', rowId)
    .single()

  if (rowErr || !existingRow) {
    return NextResponse.json({ error: 'Row not found' }, { status: 404 })
  }

  const monthlyReportId = existingRow.monthly_report_id
  const previousArtist  = existingRow.artist_name_raw
  const previousImage   = existingRow.artist_image_url

  // ── Fetch the parent monthly_report for artist_summaries metadata ───────────
  const { data: report, error: reportErr } = await admin
    .from('monthly_reports')
    .select('id, branch_id, reporting_month, reporting_year')
    .eq('id', monthlyReportId)
    .single()

  if (reportErr || !report) {
    return NextResponse.json({ error: 'Monthly report not found' }, { status: 404 })
  }

  // ── Build update payload (only patch fields that were supplied) ─────────────
  const updatePayload: Record<string, string | null> = {}
  if (artistName     !== undefined) updatePayload.artist_name_raw   = artistName
  if (artistImageUrl !== undefined) updatePayload.artist_image_url  = artistImageUrl

  const { error: updateErr } = await admin
    .from('report_rows')
    .update(updatePayload)
    .eq('id', rowId)

  if (updateErr) {
    console.error('[report-rows PATCH] update error:', updateErr)
    return NextResponse.json({ error: 'Failed to update row' }, { status: 500 })
  }

  // ── Rebuild artist_summaries from all rows for this monthly_report ──────────
  const { data: allRows, error: rowsErr } = await admin
    .from('report_rows')
    .select('artist_name_raw, artist_image_url, amount, net, opn_refunded')
    .eq('monthly_report_id', monthlyReportId)

  if (rowsErr || !allRows) {
    console.error('[report-rows PATCH] failed to fetch rows for rebuild:', rowsErr)
    return NextResponse.json({ error: 'Failed to rebuild artist summaries' }, { status: 500 })
  }

  type ArtistStats = {
    order_count: number; gross_sales: number; total_net: number
    artist_image_url: string | null
  }
  const artistMap: Record<string, ArtistStats> = {}

  for (const r of allRows) {
    const name  = (r.artist_name_raw?.trim() || '(Unknown)')
    const entry = artistMap[name] ?? { order_count: 0, gross_sales: 0, total_net: 0, artist_image_url: null }
    if (!r.opn_refunded) {
      entry.order_count++
      entry.gross_sales += Number(r.amount)
    }
    entry.total_net += Number(r.net)
    // First non-null image URL wins
    if (!entry.artist_image_url && r.artist_image_url) entry.artist_image_url = r.artist_image_url
    artistMap[name] = entry
  }

  const artistRows = Object.entries(artistMap).map(([artist_name, stats]) => ({
    monthly_report_id: monthlyReportId,
    branch_id:         report.branch_id,
    reporting_month:   report.reporting_month,
    reporting_year:    report.reporting_year,
    artist_name,
    order_count:       stats.order_count,
    gross_sales:       stats.gross_sales,
    total_net:         stats.total_net,
    artist_image_url:  stats.artist_image_url,
  }))

  await admin.from('artist_summaries').delete().eq('monthly_report_id', monthlyReportId)
  if (artistRows.length > 0) {
    const { error: insertErr } = await admin.from('artist_summaries').insert(artistRows)
    if (insertErr) {
      console.error('[report-rows PATCH] artist_summaries insert error:', insertErr)
      return NextResponse.json({ error: 'Failed to rebuild artist summaries' }, { status: 500 })
    }
  }

  // ── Audit log ───────────────────────────────────────────────────────────────
  const newArtist = artistName     !== undefined ? artistName     : previousArtist
  const newImage  = artistImageUrl !== undefined ? artistImageUrl : previousImage

  await admin.from('audit_logs').insert({
    actor_id:     user.id,
    action:       'artist_correction',
    entity_type:  'report_row',
    entity_id:    rowId,
    before_state: { artist_name_raw: previousArtist, artist_image_url: previousImage },
    after_state:  { artist_name_raw: newArtist,      artist_image_url: newImage },
    metadata: {
      monthly_report_id: monthlyReportId,
      branch_id:         report.branch_id,
      reporting_month:   report.reporting_month,
      reporting_year:    report.reporting_year,
    },
  })

  return NextResponse.json({
    success:           true,
    row_id:            rowId,
    artist_name_raw:   newArtist,
    artist_image_url:  newImage,
    summaries_rebuilt: artistRows.length,
  })
}
