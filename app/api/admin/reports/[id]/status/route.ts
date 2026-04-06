import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

// ── PATCH /api/admin/reports/:id/status ──────────────────────────────────────
// Advances a monthly_report through the forward-only status workflow:
//   draft → approved → paid
//
// Body: { action: 'approve' | 'mark_paid' }
//
// Rules:
//   • approve   — only valid when status === 'draft'
//   • mark_paid — only valid when status === 'approved'
//   • No reversals. Locked reports cannot be re-submitted for import.

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: reportId } = await params

  // ── Auth: admin only ────────────────────────────────────────────────────────
  const userClient = await createClient()
  const { data: { user }, error: authError } = await userClient.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { data: profile } = await userClient
    .from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // ── Parse body ──────────────────────────────────────────────────────────────
  let body: { action?: string }
  try { body = await request.json() }
  catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }) }

  if (body.action !== 'approve' && body.action !== 'mark_paid') {
    return NextResponse.json(
      { error: 'action must be "approve" or "mark_paid"' },
      { status: 400 }
    )
  }

  const admin = createAdminClient()

  // ── Fetch current report ────────────────────────────────────────────────────
  const { data: report, error: fetchErr } = await admin
    .from('monthly_reports')
    .select('id, status, reporting_month, reporting_year, branch_id')
    .eq('id', reportId)
    .single()

  if (fetchErr || !report) {
    return NextResponse.json({ error: 'Report not found' }, { status: 404 })
  }

  // ── Validate transition ─────────────────────────────────────────────────────
  if (body.action === 'approve' && report.status !== 'draft') {
    return NextResponse.json(
      { error: `Cannot approve — report is already "${report.status}".` },
      { status: 409 }
    )
  }
  if (body.action === 'mark_paid' && report.status !== 'approved') {
    return NextResponse.json(
      { error: `Cannot mark as paid — report must be "approved" first (currently "${report.status}").` },
      { status: 409 }
    )
  }

  // ── Build update payload ────────────────────────────────────────────────────
  const now = new Date().toISOString()
  const updatePayload =
    body.action === 'approve'
      ? { status: 'approved', approved_by: user.id, approved_at: now }
      : { status: 'paid',     paid_by:     user.id, paid_at:     now }

  const { data: updated, error: updateErr } = await admin
    .from('monthly_reports')
    .update(updatePayload)
    .eq('id', reportId)
    .select('id, status, approved_at, approved_by, paid_at, paid_by')
    .single()

  if (updateErr || !updated) {
    console.error('[PATCH /api/admin/reports/:id/status] update error:', updateErr)
    return NextResponse.json({ error: 'Failed to update report status' }, { status: 500 })
  }

  // ── Audit log ───────────────────────────────────────────────────────────────
  const auditAction = body.action === 'approve' ? 'report_approved' : 'report_marked_paid'

  await admin.from('audit_logs').insert({
    actor_id:    user.id,
    action:      auditAction,
    entity_type: 'monthly_report',
    entity_id:   reportId,
    before_state: { status: report.status },
    after_state:  { status: updated.status },
    metadata: {
      branch_id:       report.branch_id,
      reporting_month: report.reporting_month,
      reporting_year:  report.reporting_year,
    },
  })

  return NextResponse.json({
    success:    true,
    report_id:  reportId,
    old_status: report.status,
    new_status: updated.status,
    report:     updated,
  })
}
