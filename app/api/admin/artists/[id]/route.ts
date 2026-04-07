import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

// ── PATCH /api/admin/artists/:id ─────────────────────────────────────────────
// Updates referral config for an existing artist record.
// Body: { is_referral_eligible?, referral_partner_id?, referral_uplift_pct? }
// At least one field must be present.

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
    is_referral_eligible?: boolean
    referral_partner_id?:  string | null
    referral_uplift_pct?:  number | null
  }
  try { body = await request.json() }
  catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }) }

  const hasEligible  = 'is_referral_eligible' in body
  const hasPartner   = 'referral_partner_id'  in body
  const hasPct       = 'referral_uplift_pct'  in body

  if (!hasEligible && !hasPartner && !hasPct) {
    return NextResponse.json(
      { error: 'Provide at least one of: is_referral_eligible, referral_partner_id, referral_uplift_pct' },
      { status: 400 }
    )
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

  const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (hasEligible) updatePayload.is_referral_eligible = body.is_referral_eligible
  if (hasPartner)  updatePayload.referral_partner_id  = body.referral_partner_id ?? null
  if (hasPct)      updatePayload.referral_uplift_pct  = body.referral_uplift_pct ?? null

  const { data, error: updateErr } = await admin
    .from('artists')
    .update(updatePayload)
    .eq('id', id)
    .select('*')
    .single()

  if (updateErr) {
    if (updateErr.code === 'PGRST116') {
      return NextResponse.json({ error: 'Artist not found' }, { status: 404 })
    }
    return NextResponse.json({ error: updateErr.message }, { status: 500 })
  }

  return NextResponse.json({ artist: data })
}
