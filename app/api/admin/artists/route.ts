import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, error: 'Unauthorized' }
  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return { user: null, error: 'Forbidden' }
  return { user, error: null }
}

// ── GET /api/admin/artists ───────────────────────────────────────────────────
// Returns:
//   artists      — all rows from the artists config table (with branch + partner names)
//   partners     — active partners (for the assignment dropdown)
//   unconfigured — artist names seen in artist_summaries but not yet in artists table
//
// The admin UI merges these to show a complete list of all known artists.

export async function GET() {
  const { error } = await requireAdmin()
  if (error) return NextResponse.json({ error }, { status: error === 'Unauthorized' ? 401 : 403 })

  const admin = createAdminClient()

  const [artistsRes, partnersRes, summariesRes] = await Promise.all([
    admin
      .from('artists')
      .select(`
        id, artist_name, branch_id, is_referral_eligible,
        referral_partner_id, referral_uplift_pct, updated_at,
        branches(id, name)
      `)
      .order('artist_name'),
    admin
      .from('partners')
      .select('id, name')
      .eq('is_active', true)
      .order('name'),
    // Distinct (branch_id, artist_name) from artist_summaries for discovery
    admin
      .from('artist_summaries')
      .select('artist_name, branch_id, branches(name)')
      .order('artist_name'),
  ])

  const artists  = artistsRes.data  ?? []
  const partners = partnersRes.data ?? []

  // Determine which artists have already been configured
  const configuredKeys = new Set(artists.map(a => `${a.branch_id}::${a.artist_name}`))

  const seenKeys = new Set<string>()
  const unconfigured: { artist_name: string; branch_id: string; branch_name: string }[] = []
  for (const row of summariesRes.data ?? []) {
    if (row.artist_name === '(Unknown)') continue   // unassigned orders — not configurable
    const key = `${row.branch_id}::${row.artist_name}`
    if (!configuredKeys.has(key) && !seenKeys.has(key)) {
      seenKeys.add(key)
      unconfigured.push({
        artist_name: row.artist_name,
        branch_id:   row.branch_id,
        branch_name: (row.branches as { name?: string } | null)?.name ?? '—',
      })
    }
  }

  return NextResponse.json({ artists, partners, unconfigured })
}

// ── POST /api/admin/artists ──────────────────────────────────────────────────
// Creates or upserts an artist record (by branch_id + artist_name).
// Used when the admin configures an unconfigured artist from the summaries list.
//
// Body: { artist_name, branch_id, is_referral_eligible?, referral_partner_id?, referral_uplift_pct? }

export async function POST(request: NextRequest) {
  const { user, error } = await requireAdmin()
  if (error || !user) return NextResponse.json({ error }, { status: error === 'Unauthorized' ? 401 : 403 })

  let body: {
    artist_name:          string
    branch_id:            string
    is_referral_eligible?: boolean
    referral_partner_id?:  string | null
    referral_uplift_pct?:  number | null
  }
  try { body = await request.json() }
  catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }) }

  if (!body.artist_name?.trim() || !body.branch_id) {
    return NextResponse.json({ error: 'artist_name and branch_id are required' }, { status: 400 })
  }
  if (body.artist_name.trim() === '(Unknown)') {
    return NextResponse.json({ error: 'Unassigned orders cannot be configured for uplift' }, { status: 400 })
  }
  if (
    body.referral_uplift_pct !== undefined &&
    body.referral_uplift_pct !== null &&
    (body.referral_uplift_pct < 0 || body.referral_uplift_pct > 100)
  ) {
    return NextResponse.json({ error: 'referral_uplift_pct must be between 0 and 100' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data, error: upsertErr } = await admin
    .from('artists')
    .upsert(
      {
        artist_name:          body.artist_name.trim(),
        branch_id:            body.branch_id,
        is_referral_eligible: body.is_referral_eligible ?? false,
        referral_partner_id:  body.referral_partner_id  ?? null,
        referral_uplift_pct:  body.referral_uplift_pct  ?? null,
      },
      { onConflict: 'branch_id,artist_name' }
    )
    .select('*')
    .single()

  if (upsertErr) {
    return NextResponse.json({ error: upsertErr.message }, { status: 500 })
  }

  return NextResponse.json({ artist: data }, { status: 201 })
}
