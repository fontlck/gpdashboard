import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient }        from '@/lib/supabase/admin'
import { createClient }             from '@/lib/supabase/server'
import { recalcReport }             from '@/lib/report-recalc'

// ── DELETE /api/admin/report-rows ─────────────────────────────────────────────
// Bulk-delete report_rows by id array, then recalculates all financials and
// rebuilds artist_summaries for each affected monthly_report.
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

  const reportIds = [...new Set(existingRows.map(r => r.monthly_report_id))]

  // Verify reports are not approved/paid
  const { data: reports } = await admin
    .from('monthly_reports')
    .select('id, status')
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

  // Recalculate financials + rebuild summaries for each affected report
  for (const reportId of reportIds) {
    const result = await recalcReport(admin, reportId)
    if (!result.ok) {
      console.error(`[report-rows DELETE] recalc failed for ${reportId}:`, result.error)
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
