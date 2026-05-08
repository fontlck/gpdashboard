import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const BUCKET      = 'report-documents'
const ALLOWED     = ['image/png', 'image/jpeg', 'application/pdf']
const MAX_BYTES   = 10 * 1024 * 1024 // 10 MB

// ── Auth helper — returns partner_id or error response ────────────────────────
async function requirePartnerOwner(reportId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }

  const { data: profile } = await supabase
    .from('profiles').select('role, partner_id').eq('id', user.id).single()

  if (profile?.role !== 'partner')
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  if (!profile.partner_id)
    return { error: NextResponse.json({ error: 'No partner linked' }, { status: 403 }) }

  // Verify report belongs to this partner and is approved/paid
  const { data: report } = await supabase
    .from('monthly_reports')
    .select('id, status, receipt_path, branches(partner_id)')
    .eq('id', reportId)
    .single()

  if (!report)
    return { error: NextResponse.json({ error: 'Report not found' }, { status: 404 }) }

  if (!['approved', 'paid'].includes(report.status))
    return { error: NextResponse.json({ error: 'Report not available' }, { status: 403 }) }

  const branch = report.branches as { partner_id: string } | { partner_id: string }[] | null
  const branchPartnerId = Array.isArray(branch) ? branch[0]?.partner_id : branch?.partner_id
  if (branchPartnerId !== profile.partner_id)
    return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) }

  return { partnerId: profile.partner_id, report, supabase }
}

// ── POST /api/partner/reports/[id]/receipt ────────────────────────────────────
// Partner uploads a receipt / tax invoice for their own report.

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const result = await requirePartnerOwner(id)
  if ('error' in result) return result.error

  const { report } = result
  const admin = createAdminClient()

  let formData: FormData
  try { formData = await req.formData() }
  catch { return NextResponse.json({ error: 'Invalid form data' }, { status: 400 }) }

  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'file is required' }, { status: 400 })
  if (!ALLOWED.includes(file.type))
    return NextResponse.json({ error: 'Only PNG, JPEG, PDF allowed' }, { status: 400 })
  if (file.size > MAX_BYTES)
    return NextResponse.json({ error: 'File too large (max 10 MB)' }, { status: 400 })

  // Delete old receipt if exists
  const oldPath = (report as unknown as Record<string, unknown>).receipt_path as string | null
  if (oldPath) await admin.storage.from(BUCKET).remove([oldPath])

  // Upload new file
  const ext  = file.name.split('.').pop() ?? 'bin'
  const path = `${id}/receipt/${Date.now()}.${ext}`
  const buf  = await file.arrayBuffer()

  const { error: uploadErr } = await admin.storage
    .from(BUCKET)
    .upload(path, buf, { contentType: file.type, upsert: false })

  if (uploadErr)
    return NextResponse.json({ error: uploadErr.message }, { status: 500 })

  // Update DB
  const now = new Date().toISOString()
  const { error: updateErr } = await admin
    .from('monthly_reports')
    .update({ receipt_name: file.name, receipt_path: path, receipt_uploaded_at: now, updated_at: now })
    .eq('id', id)

  if (updateErr) {
    await admin.storage.from(BUCKET).remove([path])
    return NextResponse.json({ error: updateErr.message }, { status: 500 })
  }

  // Return signed URL (1 hour)
  const { data: signed } = await admin.storage.from(BUCKET).createSignedUrl(path, 3600)

  return NextResponse.json({
    name:       file.name,
    path,
    signedUrl:  signed?.signedUrl ?? null,
    uploadedAt: now,
  })
}

// ── DELETE /api/partner/reports/[id]/receipt ──────────────────────────────────

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const result = await requirePartnerOwner(id)
  if ('error' in result) return result.error

  const { report } = result
  const admin  = createAdminClient()
  const oldPath = (report as unknown as Record<string, unknown>).receipt_path as string | null

  if (oldPath) await admin.storage.from(BUCKET).remove([oldPath])

  const now = new Date().toISOString()
  await admin
    .from('monthly_reports')
    .update({ receipt_name: null, receipt_path: null, receipt_uploaded_at: null, updated_at: now })
    .eq('id', id)

  return NextResponse.json({ deleted: true })
}
