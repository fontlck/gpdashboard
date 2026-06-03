import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

// ── POST /api/admin/reports/:id/rename-artist ────────────────────────────────
// Renames artist_name_raw in all report_rows for a specific report.
// Used when admin corrects a misspelled or inconsistently-cased artist name
// within a single report (e.g. "FLASHYOURMEME" → "Flashyourmeme").
//
// Body: { old_name: string, new_name: string }
//
// If new_name already exists in the same report, this effectively merges the
// two groups (all rows become the same artist name; the client handles UI merge).

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: reportId } = await params

  // Auth
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: { old_name: string; new_name: string }
  try { body = await request.json() }
  catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }) }

  const oldName = body.old_name?.trim()
  const newName = body.new_name?.trim()

  if (!oldName || !newName) {
    return NextResponse.json({ error: 'old_name and new_name are required' }, { status: 400 })
  }
  if (oldName === newName) {
    return NextResponse.json({ renamed: 0 }, { status: 200 })
  }

  const admin = createAdminClient()

  // Verify report exists and is not paid
  const { data: report, error: repErr } = await admin
    .from('monthly_reports')
    .select('id, status')
    .eq('id', reportId)
    .single()

  if (repErr || !report) {
    return NextResponse.json({ error: 'Report not found' }, { status: 404 })
  }
  if (report.status === 'paid') {
    return NextResponse.json({ error: 'Cannot modify a paid report' }, { status: 409 })
  }

  // Rename all matching rows in this report
  const { data: updated, error: updateErr } = await admin
    .from('report_rows')
    .update({ artist_name_raw: newName })
    .eq('monthly_report_id', reportId)
    .eq('artist_name_raw', oldName)
    .select('id')

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 })
  }

  // ── Sync artist_summaries (it's a table, not a view) ─────────────────────
  const [sourceRes, targetRes] = await Promise.all([
    admin.from('artist_summaries')
      .select('id, order_count, gross_sales, total_net')
      .eq('monthly_report_id', reportId).eq('artist_name', oldName).maybeSingle(),
    admin.from('artist_summaries')
      .select('id, order_count, gross_sales, total_net')
      .eq('monthly_report_id', reportId).eq('artist_name', newName).maybeSingle(),
  ])

  const src = sourceRes.data
  const tgt = targetRes.data
  const now = new Date().toISOString()

  if (src && tgt) {
    // Merge: add source totals into target, then delete source row
    await Promise.all([
      admin.from('artist_summaries').update({
        order_count: tgt.order_count + src.order_count,
        gross_sales: Number(tgt.gross_sales) + Number(src.gross_sales),
        total_net:   Number(tgt.total_net)   + Number(src.total_net),
        updated_at:  now,
      }).eq('id', tgt.id),
      admin.from('artist_summaries').delete().eq('id', src.id),
    ])
  } else if (src) {
    // Pure rename: just update the name
    await admin.from('artist_summaries')
      .update({ artist_name: newName, updated_at: now })
      .eq('id', src.id)
  }

  return NextResponse.json({ renamed: updated?.length ?? 0 })
}
