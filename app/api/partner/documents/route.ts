import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

const BUCKET = 'partner-documents'
const VALID_TYPES = ['pp20', 'id_card', 'bookbank'] as const
type DocType = typeof VALID_TYPES[number]

const COL: Record<DocType, { name: string; path: string }> = {
  pp20:     { name: 'doc_pp20_name',     path: 'doc_pp20_path' },
  id_card:  { name: 'doc_id_card_name',  path: 'doc_id_card_path' },
  bookbank: { name: 'doc_bookbank_name', path: 'doc_bookbank_path' },
}

async function requirePartner() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, profile: null, error: 'Unauthorized' }
  const { data: profile } = await supabase
    .from('profiles').select('role, partner_id').eq('id', user.id).single()
  if (profile?.role !== 'partner' && profile?.role !== 'admin')
    return { user: null, profile: null, error: 'Forbidden' }
  if (!profile.partner_id) return { user: null, profile: null, error: 'No partner linked' }
  return { user, profile, error: null }
}

// ── POST /api/partner/documents ───────────────────────────────────────────────
// Upload a partner document.
// FormData: { type: 'pp20'|'id_card'|'bookbank', file: File, partner_id?: string (admin only) }

export async function POST(request: NextRequest) {
  const { profile, error } = await requirePartner()
  if (error || !profile) return NextResponse.json({ error }, { status: error === 'Unauthorized' ? 401 : 403 })

  const formData = await request.formData()
  const typeRaw  = formData.get('type') as string
  const file     = formData.get('file') as File | null

  if (!VALID_TYPES.includes(typeRaw as DocType)) {
    return NextResponse.json({ error: 'type must be pp20, id_card, or bookbank' }, { status: 400 })
  }
  if (!file) return NextResponse.json({ error: 'file is required' }, { status: 400 })

  const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg']
  if (!allowed.includes(file.type)) {
    return NextResponse.json({ error: 'Only PDF, JPEG, or PNG files are allowed' }, { status: 400 })
  }
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: 'File size must be under 10 MB' }, { status: 400 })
  }

  const docType  = typeRaw as DocType
  const col      = COL[docType]
  const admin    = createAdminClient()
  const ext      = file.name.split('.').pop() ?? 'bin'
  const storagePath = `${profile.partner_id}/${docType}/${Date.now()}.${ext}`

  // Delete old file if exists
  const { data: currentPartner } = await admin
    .from('partners')
    .select(col.path)
    .eq('id', profile.partner_id)
    .single()

  const oldPath = (currentPartner as Record<string, string | null> | null)?.[col.path]
  if (oldPath) {
    await admin.storage.from(BUCKET).remove([oldPath])
  }

  // Upload new file
  const arrayBuffer = await file.arrayBuffer()
  const { error: uploadErr } = await admin.storage
    .from(BUCKET)
    .upload(storagePath, arrayBuffer, { contentType: file.type, upsert: true })

  if (uploadErr) return NextResponse.json({ error: `Upload failed: ${uploadErr.message}` }, { status: 500 })

  // Update partners table
  const { error: updateErr } = await admin
    .from('partners')
    .update({
      [col.name]: file.name,
      [col.path]: storagePath,
      updated_at: new Date().toISOString(),
    })
    .eq('id', profile.partner_id)

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  // Return a signed URL (1 hour)
  const { data: signed } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, 3600)

  return NextResponse.json({
    type:       docType,
    name:       file.name,
    path:       storagePath,
    signedUrl:  signed?.signedUrl ?? null,
  })
}

// ── DELETE /api/partner/documents?type=pp20 ───────────────────────────────────

export async function DELETE(request: NextRequest) {
  const { profile, error } = await requirePartner()
  if (error || !profile) return NextResponse.json({ error }, { status: error === 'Unauthorized' ? 401 : 403 })

  const type = request.nextUrl.searchParams.get('type') as DocType | null
  if (!type || !VALID_TYPES.includes(type)) {
    return NextResponse.json({ error: 'type must be pp20, id_card, or bookbank' }, { status: 400 })
  }

  const col   = COL[type]
  const admin = createAdminClient()

  const { data: partner } = await admin
    .from('partners')
    .select(col.path)
    .eq('id', profile.partner_id)
    .single()

  const storagePath = (partner as Record<string, string | null> | null)?.[col.path]
  if (storagePath) {
    await admin.storage.from(BUCKET).remove([storagePath])
  }

  await admin.from('partners').update({
    [col.name]: null,
    [col.path]: null,
    updated_at: new Date().toISOString(),
  }).eq('id', profile.partner_id)

  return NextResponse.json({ deleted: true })
}
