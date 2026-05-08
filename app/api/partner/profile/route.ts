import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

async function requirePartner() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, profile: null, error: 'Unauthorized' }
  const { data: profile } = await supabase
    .from('profiles').select('role, partner_id').eq('id', user.id).single()
  if (profile?.role !== 'partner') return { user: null, profile: null, error: 'Forbidden' }
  if (!profile.partner_id) return { user: null, profile: null, error: 'No partner linked' }
  return { user, profile, error: null }
}

// ── PATCH /api/partner/profile ────────────────────────────────────────────────
// Updates contact and bank info for the current partner.
// Body: { contact_email?, contact_phone?, bank_name?, bank_account_name?, bank_account_number? }

export async function PATCH(request: NextRequest) {
  const { profile, error } = await requirePartner()
  if (error || !profile) return NextResponse.json({ error }, { status: error === 'Unauthorized' ? 401 : 403 })

  let body: {
    contact_email?:       string | null
    contact_phone?:       string | null
    bank_name?:           string | null
    bank_account_name?:   string | null
    bank_account_number?: string | null
  }
  try { body = await request.json() }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const allowed = ['contact_email', 'contact_phone', 'bank_name', 'bank_account_name', 'bank_account_number']
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const key of allowed) {
    if (key in body) patch[key] = (body as Record<string, unknown>)[key] ?? null
  }
  if (Object.keys(patch).length === 1) {
    return NextResponse.json({ error: 'No valid fields provided' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error: updateErr } = await admin
    .from('partners')
    .update(patch)
    .eq('id', profile.partner_id)
    .select('contact_email, contact_phone, bank_name, bank_account_name, bank_account_number')
    .single()

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  return NextResponse.json({ partner: data })
}
