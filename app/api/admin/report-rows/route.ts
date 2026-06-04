import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient }        from '@/lib/supabase/admin'
import { createClient }             from '@/lib/supabase/server'

// ── DELETE /api/admin/report-rows ─────────────────────────────────────────────
// Bulk-delete report_rows by id array, then rebuilds artist_summaries.
// Body: { ids: string[] }

export async function DELETE(request: NextRequest) {
  // Auth: admin only
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: { ids: string[] }
  try { body = await request.json() }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  if (!Array.isArray(body.ids) || body.ids.length === 0)
    return NextResponse.json({ error: 'ids must be a non-empty array' }, { status: 400 })

  const admin = createAdminClient()

  // Fetch rows to verify they exist + get monthly_report_id
  const { data: existingRows } = await admin
    .from('report_rows')
    .select('id, monthly_report_id')
    .in('id', body.ids)

  if (!existingRows || existingRows.length === 0)
    return NextResponse.json({ error: 'No rows found' }, { status: 404 })

  // Group by monthly_report_id
  const reportIds = [...new Set(existingRows.map(r => r.monthly_report_id))]

  // Verify reports are not approved/paid
  const { data: reports } = await admin
    .from('monthly_reports')
    .select('id, status, branch_id, reporting_month, reporting_year')
    .in('id', reportIds)

  for (const rep of reports ?? []) {
    if (rep.status === 'approved' || rep.status === 'paid') {
      return NextResponse.json(
        { error: `Report is locked (status: ${rep.status}). Cannot delete rows after approval.` },
        { status: 409 }
      )
    }
  }

  // Delete the rows
  const { error: deleteErr } = await admin
    .from('report_rows')
    .delete()
    .in('id', body.ids)

  if (deleteErr)
    return NextResponse.json({ error: deleteErr.message }, { status: 500 })

  // Rebuild artist_summaries for each affected report
  const reportsMap = Object.fromEntries((reports ?? []).map(r => [r.id, r]))

  for (const reportId of reportIds) {
    const rep = reportsMap[reportId]
    if (!rep) continue

    const { data: allRows } = await admin
      .from('report_rows')
      .select('artist_name_raw, artist_image_url, amount, net, opn_refunded')
      .eq('monthly_report_id', reportId)

    type ArtistStats = { order_count: number; gross_sales: number; total_net: number; artist_image_url: string | null }
    const artistMap: Record<string, ArtistStats> = {}

    for (const r of allRows ?? []) {
      const name  = r.artist_name_raw?.trim() || '(Unknown)'
      const entry = artistMap[name] ?? { order_count: 0, gross_sales: 0, total_net: 0, artist_image_url: null }
      if (!r.opn_refunded) { entry.order_count++; entry.gross_sales += Number(r.amount) }
      entry.total_net += Number(r.net)
      if (!entry.artist_image_url && r.artist_image_url) entry.artist_image_url = r.artist_image_url
      artistMap[name] = entry
    }

    const artistRows = Object.entries(artistMap).map(([artist_name, stats]) => ({
      monthly_report_id: reportId,
      branch_id:         rep.branch_id,
      reporting_month:   rep.reporting_month,
      reporting_year:    rep.reporting_year,
      artist_name,
      ...stats,
    }))

    await admin.from('artist_summaries').delete().eq('monthly_report_id', reportId)
    if (artistRows.length > 0) {
      await admin.from('artist_summaries').insert(artistRows)
    }
  }

  // Audit log
  await admin.from('audit_logs').insert({
    actor_id:    user.id,
    action:      'report_rows_deleted',
    entity_type: 'report_row',
    entity_id:   body.ids[0],
    before_state: { ids: body.ids },
    after_state:  { deleted: body.ids.length },
    metadata:    { report_ids: reportIds },
  })

  return NextResponse.json({ deleted: existingRows.length })
}
