import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

// ── PATCH /api/admin/artists/:id ─────────────────────────────────────────────
// Updates referral config and/or artist name.
// Body: { artist_name?, is_referral_eligible?, referral_partner_id?, referral_uplift_pct? }
// At least one field must be present.
// When artist_name is changed, also renames artist_name_raw in report_rows for the same branch.

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  // Auth
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Body
  let body: {
    artist_name?:         string
    is_referral_eligible?: boolean
    referral_partner_id?:  string | null
    referral_uplift_pct?:  number | null
  }
  try { body = await request.json() }
  catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }) }

  const hasName      = 'artist_name'          in body
  const hasEligible  = 'is_referral_eligible' in body
  const hasPartner   = 'referral_partner_id'  in body
  const hasPct       = 'referral_uplift_pct'  in body

  if (!hasName && !hasEligible && !hasPartner && !hasPct) {
    return NextResponse.json(
      { error: 'Provide at least one of: artist_name, is_referral_eligible, referral_partner_id, referral_uplift_pct' },
      { status: 400 }
    )
  }
  if (hasName && !body.artist_name?.trim()) {
    return NextResponse.json({ error: 'artist_name cannot be empty' }, { status: 400 })
  }
  if (
    hasPct &&
    body.referral_uplift_pct !== null &&
    body.referral_uplift_pct !== undefined &&
    (body.referral_uplift_pct < 0 || body.referral_uplift_pct > 100)
  ) {
    return NextResponse.json({ error: 'referral_uplift_pct must be between 0 and 100' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Fetch current artist to get old name + branch_id (needed for report_rows rename)
  const { data: current, error: fetchErr } = await admin
    .from('artists')
    .select('id, artist_name, branch_id')
    .eq('id', id)
    .single()

  if (fetchErr || !current) {
    return NextResponse.json({ error: 'Artist not found' }, { status: 404 })
  }

  const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (hasName)      updatePayload.artist_name           = body.artist_name!.trim()
  if (hasEligible)  updatePayload.is_referral_eligible  = body.is_referral_eligible
  if (hasPartner)   updatePayload.referral_partner_id   = body.referral_partner_id ?? null
  if (hasPct)       updatePayload.referral_uplift_pct   = body.referral_uplift_pct ?? null

  const { data, error: updateErr } = await admin
    .from('artists')
    .update(updatePayload)
    .eq('id', id)
    .select('*')
    .single()

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 })
  }

  // If name changed, propagate to report_rows.artist_name_raw for this branch
  if (hasName && body.artist_name!.trim() !== current.artist_name) {
    const oldName = current.artist_name
    const newName = body.artist_name!.trim()

    // Get all monthly_report ids for this branch
    const { data: reports } = await admin
      .from('monthly_reports')
      .select('id')
      .eq('branch_id', current.branch_id)

    const reportIds = (reports ?? []).map((r: { id: string }) => r.id)

    if (reportIds.length > 0) {
      await Promise.all([
        // Rename in report_rows
        admin.from('report_rows')
          .update({ artist_name_raw: newName })
          .eq('artist_name_raw', oldName)
          .in('monthly_report_id', reportIds),
        // Rename in artist_summaries (table — not auto-updated)
        admin.from('artist_summaries')
          .update({ artist_name: newName, updated_at: new Date().toISOString() })
          .eq('artist_name', oldName)
          .in('monthly_report_id', reportIds),
      ])
    }
  }

  return NextResponse.json({ artist: data })
}
