import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient }      from '@/lib/supabase/server'

const BUCKET = 'partner-documents'

const COL: Record<string, { name: string; path: string }> = {
  pp20:     { name: 'doc_pp20_name',     path: 'doc_pp20_path' },
  id_card:  { name: 'doc_id_card_name',  path: 'doc_id_card_path' },
  bookbank: { name: 'doc_bookbank_name', path: 'doc_bookbank_path' },
}

// GET /api/admin/partners/[id]/document-url?type=pp20|id_card|bookbank
// Returns a short-lived signed URL for admin to download a partner's document.

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const type = new URL(request.url).searchParams.get('type') ?? ''
  if (!COL[type]) {
    return NextResponse.json({ error: 'Invalid type. Use pp20, id_card, or bookbank' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const col = COL[type]
  const admin = createAdminClient()

  const { data: partner } = await admin
    .from('partners')
    .select(`${col.path}, ${col.name}`)
    .eq('id', id)
    .single()

  const path = (partner as Record<string, string | null> | null)?.[col.path]
  const name = (partner as Record<string, string | null> | null)?.[col.name]
  if (!path) return NextResponse.json({ error: 'No document uploaded' }, { status: 404 })

  const { data: signed, error: signErr } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(path, 3600)

  if (signErr || !signed?.signedUrl) {
    return NextResponse.json({ error: 'Could not generate download URL' }, { status: 500 })
  }

  return NextResponse.json({ url: signed.signedUrl, name: name ?? type })
}
