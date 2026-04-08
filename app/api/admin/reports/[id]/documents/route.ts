import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const BUCKET = 'report-documents'
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'application/pdf']
const MAX_BYTES = 10 * 1024 * 1024 // 10 MB

// ── POST /api/admin/reports/[id]/documents ─────────────────────────────────
// Upload a payment slip or WHT certificate.
// Form fields: file (File), type ("slip" | "wht")

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  // ── Admin guard ────────────────────────────────────────────────────────────
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // ── Parse multipart form ───────────────────────────────────────────────────
  let formData: FormData
  try { formData = await req.formData() }
  catch { return NextResponse.json({ error: 'Invalid form data' }, { status: 400 }) }

  const file = formData.get('file') as File | null
  const type = formData.get('type') as string | null

  if (!file || !type) return NextResponse.json({ error: 'Missing file or type' }, { status: 400 })
  if (!['slip', 'wht'].includes(type)) return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
  if (!ALLOWED_TYPES.includes(file.type)) return NextResponse.json({ error: 'Only PNG, JPEG, PDF allowed' }, { status: 400 })
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'File too large (max 10 MB)' }, { status: 400 })

  // ── Verify report exists ───────────────────────────────────────────────────
  const { data: report } = await supabase.from('monthly_reports').select('id').eq('id', id).single()
  if (!report) return NextResponse.json({ error: 'Report not found' }, { status: 404 })

  // ── Build storage path and upload ─────────────────────────────────────────
  const ext  = file.name.split('.').pop() ?? 'bin'
  const path = `${id}/${type}/${Date.now()}.${ext}`
  const buf  = await file.arrayBuffer()

  // Delete old file if exists
  const colPath = type === 'slip' ? 'payment_slip_path' : 'wht_cert_path'
  const { data: existing } = await supabase.from('monthly_reports').select(colPath).eq('id', id).single()
  const oldPath = (existing as Record<string, unknown> | null)?.[colPath] as string | null
  if (oldPath) await supabase.storage.from(BUCKET).remove([oldPath])

  const { error: uploadErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, buf, { contentType: file.type, upsert: false })

  if (uploadErr) return NextResponse.json({ error: uploadErr.message }, { status: 500 })

  // ── Update report columns ──────────────────────────────────────────────────
  const now  = new Date().toISOString()
  const updatePayload = type === 'slip'
    ? { payment_slip_path: path, payment_slip_name: file.name, payment_slip_uploaded_at: now }
    : { wht_cert_path: path,     wht_cert_name: file.name,     wht_cert_uploaded_at: now }

  const { error: updateErr } = await supabase
    .from('monthly_reports')
    .update({ ...updatePayload, updated_at: now })
    .eq('id', id)

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  return NextResponse.json({ ok: true, path, name: file.name })
}

// ── DELETE /api/admin/reports/[id]/documents ───────────────────────────────
// Remove a document. Query param: type=slip|wht

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const type = new URL(req.url).searchParams.get('type')
  if (!['slip', 'wht'].includes(type ?? '')) return NextResponse.json({ error: 'Invalid type' }, { status: 400 })

  const colPath = type === 'slip' ? 'payment_slip_path' : 'wht_cert_path'
  const { data: existing } = await supabase.from('monthly_reports').select(colPath).eq('id', id).single()
  const oldPath = (existing as Record<string, unknown> | null)?.[colPath] as string | null
  if (oldPath) await supabase.storage.from(BUCKET).remove([oldPath])

  const now = new Date().toISOString()
  const clearPayload = type === 'slip'
    ? { payment_slip_path: null, payment_slip_name: null, payment_slip_uploaded_at: null }
    : { wht_cert_path: null,     wht_cert_name: null,     wht_cert_uploaded_at: null }

  await supabase.from('monthly_reports').update({ ...clearPayload, updated_at: now }).eq('id', id)

  return NextResponse.json({ ok: true })
}
