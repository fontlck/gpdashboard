import { createAdminClient } from '@/lib/supabase/admin'
import { AdminHeader } from '@/components/admin/AdminHeader'
import { ArtistsClient } from '@/components/admin/ArtistsClient'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Artists' }
export const dynamic = 'force-dynamic'

export default async function AdminArtistsPage() {
  const admin = createAdminClient()

  const [artistsRes, partnersRes, summariesRes] = await Promise.all([
    admin
      .from('artists')
      .select('id, artist_name, branch_id, is_referral_eligible, referral_partner_id, referral_uplift_pct, branches(id, name)')
      .order('artist_name'),
    admin
      .from('partners')
      .select('id, name')
      .eq('is_active', true)
      .order('name'),
    admin
      .from('artist_summaries')
      .select('artist_name, branch_id, branches(name)')
      .order('artist_name'),
  ])

  const configured = (artistsRes.data ?? []) as unknown as {
    id: string
    artist_name: string
    branch_id: string
    is_referral_eligible: boolean
    referral_partner_id: string | null
    referral_uplift_pct: number | null
    branches: { id: string; name: string } | null
  }[]

  const partners = (partnersRes.data ?? []) as { id: string; name: string }[]

  // Build unconfigured list from artist_summaries
  const configuredKeys = new Set(configured.map(a => `${a.branch_id}::${a.artist_name}`))
  const seenKeys = new Set<string>()
  const unconfigured: { artist_name: string; branch_id: string; branch_name: string }[] = []
  for (const row of summariesRes.data ?? []) {
    const r = row as unknown as { artist_name: string; branch_id: string; branches: { name: string } | null }
    const key = `${r.branch_id}::${r.artist_name}`
    if (!configuredKeys.has(key) && !seenKeys.has(key)) {
      seenKeys.add(key)
      unconfigured.push({
        artist_name: r.artist_name,
        branch_id:   r.branch_id,
        branch_name: r.branches?.name ?? '—',
      })
    }
  }

  return (
    <div>
      <AdminHeader
        title="Artists"
        subtitle="Configure referral uplift for individual artists — additive commission on top of base payout"
      />
      <ArtistsClient
        initialConfigured={configured}
        initialUnconfigured={unconfigured}
        partners={partners}
      />
    </div>
  )
}
