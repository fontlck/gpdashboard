import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient }      from '@/lib/supabase/server'
import { getCurrentOrgId }   from '@/lib/org'

// PATCH /api/admin/settings
// Body: { key: string, value: string | null }
// Upserts a single key/value pair in the settings table for the current org.
// Admin-only.

const ALLOWED_KEYS = new Set<string>([
  'default_notification_cc_email',
])

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' as const }
  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return { error: 'Forbidden' as const }
  return { error: null }
}

export async function PATCH(request: NextRequest) {
  const { error } = await requireAdmin()
  if (error) return NextResponse.json({ error }, { status: error === 'Unauthorized' ? 401 : 403 })

  const orgId = await getCurrentOrgId()
  if (!orgId) return NextResponse.json({ error: 'No organization selected' }, { status: 400 })

  let body: { key?: string; value?: string | null }
  try { body = await request.json() }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  if (!body.key || !ALLOWED_KEYS.has(body.key)) {
    return NextResponse.json({ error: 'Invalid or disallowed key' }, { status: 400 })
  }

  const value = typeof body.value === 'string' ? body.value.trim() : null
  const admin = createAdminClient()

  const { error: upsertErr } = await admin
    .from('settings')
    .upsert({
      organization_id: orgId,
      key:             body.key,
      value:           value ?? null,
      updated_at:      new Date().toISOString(),
    }, { onConflict: 'key,organization_id' })

  if (upsertErr) return NextResponse.json({ error: upsertErr.message }, { status: 500 })

  return NextResponse.json({ key: body.key, value })
}
