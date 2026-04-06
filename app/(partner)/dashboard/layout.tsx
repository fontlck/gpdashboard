import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PartnerSidebar } from '@/components/partner/PartnerSidebar'
import { formatFullDate, formatDuration } from '@/lib/utils/date'
import type { ReactNode } from 'react'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: { default: 'Dashboard', template: '%s | Partner — GP Dashboard' },
}

type BranchHeroJoin = {
  id: string
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
  let cachedActiveBranches: BranchHeroJoin[] = []

  if (profile?.partner_id) {
    const { data: rawPartner } = await supabase
      .from('partners')
      .select(`
        name,
        branches ( id, name, partnership_start_date, partnership_start_date_source, is_active )
      `)
      .eq('id', profile.partner_id)
      .single()

    const partner = rawPartner as unknown as PartnerHeroRow | null

    if (partner) {
      partnerName = partner.name

      // Resolve branches — find the earliest partnership_start_date across active branches
      const branches = Array.isArray(partner.branches) ? partner.branches : (partner.branches ? [partner.branches] : [])
      const activeBranches = branches.filter((b: BranchHeroJoin) => b.is_active)
      cachedActiveBranches = activeBranches

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

  // ── Fallback: if no manual start date, derive from earliest transaction ──────
  // Converts a UTC timestamp to a Bangkok (UTC+7) "YYYY-MM-DD" date string.
  function utcToBkkDateStr(utcTs: string): string {
    const ms  = new Date(utcTs).getTime() + 7 * 60 * 60 * 1000
    const d   = new Date(ms)
    const y   = d.getUTCFullYear()
    const mo  = String(d.getUTCMonth() + 1).padStart(2, '0')
    const day = String(d.getUTCDate()).padStart(2, '0')
    return `${y}-${mo}-${day}`
  }

  if (!startDate && profile?.partner_id) {
    const activeBranches = cachedActiveBranches

    if (activeBranches.length > 0) {
      const branchIds = activeBranches.map((b: BranchHeroJoin) => b.id)

      // Get all report IDs for these branches
      const { data: branchReports } = await supabase
        .from('monthly_reports')
        .select('id')
        .in('branch_id', branchIds)

      const reportIds = (branchReports ?? []).map((r: { id: string }) => r.id)

      if (reportIds.length > 0) {
        const { data: earliest } = await supabase
          .from('report_rows')
          .select('transaction_date')
          .in('monthly_report_id', reportIds)
          .order('transaction_date', { ascending: true })
          .limit(1)
          .maybeSingle()

        if (earliest?.transaction_date) {
          startDate = utcToBkkDateStr(earliest.transaction_date)
        }
      }
    }
  }

  // Parse "YYYY-MM-DD" as local midnight to avoid UTC drift
  function parseLocalDate(ymd: string): Date {
    const [y, m, d] = ymd.split('-').map(Number)
    return new Date(y, m - 1, d)
  }

  return (
    <div style={{ display: 'flex', minHeight: '100dvh', background: '#080A10' }}>
      <PartnerSidebar />

      <main style={{
        flex:          1,
        overflowY:     'auto',
        minWidth:      0,
        display:       'flex',
        flexDirection: 'column',
        gap:           '0',
      }}>
        {/* Compact partnership line */}
        <div style={{ padding: '24px 36px 0' }}>
          <span style={{ fontSize: '13px', color: 'rgba(240,236,228,0.38)', letterSpacing: '0.01em' }}>
            <span style={{ color: 'rgba(196,163,94,0.65)', marginRight: '8px' }}>✦</span>
            {partnerName}
            {startDate && (
              <>
                <span style={{ margin: '0 8px', opacity: 0.35 }}>·</span>
                Partner since {formatFullDate(parseLocalDate(startDate))}
                <span style={{ margin: '0 8px', opacity: 0.35 }}>·</span>
                {formatDuration(startDate)}
              </>
            )}
          </span>
        </div>

        {/* Page content */}
        <div style={{ padding: '16px 36px 36px' }}>
          {children}
        </div>
      </main>
    </div>
  )
}
