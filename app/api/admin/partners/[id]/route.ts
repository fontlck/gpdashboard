import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient }      from '@/lib/supabase/server'

// PATCH /api/admin/partners/[id]
// Admin updates partner contact / VAT / bank info.

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' as const }
  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return { error: 'Forbidden' as const }
  return { error: null }
}

const ALLOWED_KEYS = [
  'name',
  'is_vat_registered',
  'vat_number',
  'contact_email',
  'contact_phone',
  'bank_name',
  'bank_account_name',
  'bank_account_number',
  'notes',
] as const

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin()
  if (error) return NextResponse.json({ error }, { status: error === 'Unauthorized' ? 401 : 403 })

  const { id } = await params

  let body: Record<string, unknown>
  try { body = await request.json() }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const key of ALLOWED_KEYS) {
    if (key in body) patch[key] = body[key] ?? null
  }
  if (Object.keys(patch).length === 1) {
    return NextResponse.json({ error: 'No valid fields provided' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error: updateErr } = await admin
    .from('partners')
    .update(patch)
    .eq('id', id)
    .select(`
      id, name, is_vat_registered, vat_number,
      contact_email, contact_phone,
      bank_name, bank_account_name, bank_account_number,
      notes
    `)
    .single()

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  return NextResponse.json({ partner: data })
}
