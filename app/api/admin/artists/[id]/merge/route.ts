import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

// ── POST /api/admin/artists/:id/merge ────────────────────────────────────────
// Merges the source artist (/:id) into the target artist.
// Body: { target_id: string }
//
// Steps:
//   1. Validate both artists exist and belong to the same branch.
//   2. Update report_rows.artist_name_raw: old name → target name (for this branch).
//   3. Delete the source artist record.
//
// The target artist's referral config is preserved.

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: sourceId } = await params

  // Auth
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: { target_id: string }
  try { body = await request.json() }
  catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }) }

  if (!body.target_id) {
    return NextResponse.json({ error: 'target_id is required' }, { status: 400 })
  }
  if (body.target_id === sourceId) {
    return NextResponse.json({ error: 'Cannot merge an artist into itself' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Fetch both artists
  const [sourceRes, targetRes] = await Promise.all([
    admin.from('artists').select('id, artist_name, branch_id').eq('id', sourceId).single(),
    admin.from('artists').select('id, artist_name, branch_id').eq('id', body.target_id).single(),
  ])

  if (sourceRes.error || !sourceRes.data) {
    return NextResponse.json({ error: 'Source artist not found' }, { status: 404 })
  }
  if (targetRes.error || !targetRes.data) {
    return NextResponse.json({ error: 'Target artist not found' }, { status: 404 })
  }

  const source = sourceRes.data
  const target = targetRes.data

  if (source.branch_id !== target.branch_id) {
    return NextResponse.json({ error: 'Artists must belong to the same branch to merge' }, { status: 400 })
  }

  // Get all monthly_report ids for this branch
  const { data: reports } = await admin
    .from('monthly_reports')
    .select('id')
    .eq('branch_id', source.branch_id)

  const reportIds = (reports ?? []).map((r: { id: string }) => r.id)

  // Rename report_rows that reference the source artist name → target artist name
  if (reportIds.length > 0) {
    const { error: rowsErr } = await admin
      .from('report_rows')
      .update({ artist_name_raw: target.artist_name })
      .eq('artist_name_raw', source.artist_name)
      .in('monthly_report_id', reportIds)

    if (rowsErr) {
      return NextResponse.json({ error: `Failed to update report rows: ${rowsErr.message}` }, { status: 500 })
    }

    // ── Sync artist_summaries (table — not auto-updated) ───────────────────
    const { data: sourceSummaries } = await admin
      .from('artist_summaries')
      .select('id, monthly_report_id, order_count, gross_sales, total_net')
      .eq('artist_name', source.artist_name)
      .in('monthly_report_id', reportIds)

    for (const src of sourceSummaries ?? []) {
      const { data: tgt } = await admin
        .from('artist_summaries')
        .select('id, order_count, gross_sales, total_net')
        .eq('monthly_report_id', src.monthly_report_id)
        .eq('artist_name', target.artist_name)
        .maybeSingle()

      const now = new Date().toISOString()
      if (tgt) {
        await Promise.all([
          admin.from('artist_summaries').update({
            order_count: tgt.order_count + src.order_count,
            gross_sales: Number(tgt.gross_sales) + Number(src.gross_sales),
            total_net:   Number(tgt.total_net)   + Number(src.total_net),
            updated_at:  now,
          }).eq('id', tgt.id),
          admin.from('artist_summaries').delete().eq('id', src.id),
        ])
      } else {
        await admin.from('artist_summaries')
          .update({ artist_name: target.artist_name, updated_at: now })
          .eq('id', src.id)
      }
    }
  }

  // Delete the source artist record
  const { error: deleteErr } = await admin
    .from('artists')
    .delete()
    .eq('id', sourceId)

  if (deleteErr) {
    return NextResponse.json({ error: `Failed to delete source artist: ${deleteErr.message}` }, { status: 500 })
  }

  return NextResponse.json({ merged: true, target_id: target.id, target_name: target.artist_name })
}
