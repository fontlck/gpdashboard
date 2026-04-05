import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PartnerSidebar } from '@/components/partner/PartnerSidebar'
import { PartnershipHero } from '@/components/partner/PartnershipHero'
import type { ReactNode } from 'react'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: { default: 'Dashboard', template: '%s | Partner — GP Dashboard' },
}

type BranchHeroJoin = {
  name: string
  partnership_start_date: string | null
  partnership_start_date_source: string | null
  is_active: boolean
}
type PartnerHeroRow = {
  name: string
  branches: BranchHeroJoin | BranchHeroJoin[] | null
}

export default async function PartnerLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name, partner_id')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'partner') redirect('/admin')

  // Fetch the partner + their first branch for the hero section
  let partnerName     = profile?.full_name ?? 'Partner'
  let branchName: string | null = null
  let startDate:  string | null = null
  let startSource: string | null = null

  if (profile?.partner_id) {
    const { data: rawPartner } = await supabase
      .from('partners')
      .select(`
        name,
        branches ( name, partnership_start_date, partnership_start_date_source, is_active )
      `)
      .eq('id', profile.partner_id)
      .single()

    const partner = rawPartner as unknown as PartnerHeroRow | null

    if (partner) {
      partnerName = partner.name

      // Resolve branches — find the earliest partnership_start_date across active branches
      const branches = Array.isArray(partner.branches) ? partner.branches : (partner.branches ? [partner.branches] : [])
      const activeBranches = branches.filter((b: BranchHeroJoin) => b.is_active)

      if (activeBranches.length === 1) {
        branchName  = activeBranches[0].name
        startDate   = activeBranches[0].partnership_start_date ?? null
        startSource = activeBranches[0].partnership_start_date_source ?? null
      } else if (activeBranches.length > 1) {
        // Multiple branches — show earliest start date (show partner name, not branch name)
        const sorted = [...activeBranches].sort((a: BranchHeroJoin, b: BranchHeroJoin) => {
          if (!a.partnership_start_date) return 1
          if (!b.partnership_start_date) return -1
          return a.partnership_start_date.localeCompare(b.partnership_start_date)
        })
        startDate   = sorted[0].partnership_start_date ?? null
        startSource = sorted[0].partnership_start_date_source ?? null
      }
    }
  }

  return (
    <div style={{ display: 'flex', minHeight: '100dvh', background: '#080A10' }}>
      <PartnerSidebar />

      <main style={{
        flex:      1,
        overflowY: 'auto',
        minWidth:  0,
        display:   'flex',
        flexDirection: 'column',
        gap:       '0',
      }}>
        {/* Hero — full width at the top of every partner page */}
        <div style={{ padding: '32px 36px 0' }}>
          <PartnershipHero
            partnerName={partnerName}
            branchName={branchName}
            partnershipStartDate={startDate}
            partnershipStartDateSource={startSource}
          />
        </div>

        {/* Page content */}
        <div style={{ padding: '28px 36px 36px' }}>
          {children}
        </div>
      </main>
    </div>
  )
}
