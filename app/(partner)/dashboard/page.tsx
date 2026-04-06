import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { KpiCard } from '@/components/shared/KpiCard'
import { EmptyState } from '@/components/shared/EmptyState'
import { formatTHB } from '@/lib/utils/currency'
import { PartnerReportsFilter } from '@/components/partner/PartnerReportsFilter'
import type { FilterableReport } from '@/components/partner/PartnerReportsFilter'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Overview' }
export const dynamic = 'force-dynamic'

export default async function PartnerOverviewPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('partner_id')
    .eq('id', user.id)
    .single()

  if (!profile?.partner_id) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: 'rgba(240,236,228,0.4)', fontSize: '14px' }}>
        Your account has not been linked to a partner yet. Please contact your administrator.
      </div>
    )
  }

  // Fetch branches for this partner
  const { data: branches } = await supabase
    .from('branches')
    .select('id, name')
    .eq('partner_id', profile.partner_id)
    .eq('is_active', true)

  const branchIds   = (branches ?? []).map(b => b.id)
  const branchNames = Object.fromEntries((branches ?? []).map(b => [b.id, b.name]))

  if (branchIds.length === 0) {
    return (
      <EmptyState
        icon="◫"
        title="No active branches"
        description="Contact your administrator to set up your branch."
      />
    )
  }

  // Fetch only approved + paid reports — draft is never visible to partners
  const { data: rawReports } = await supabase
    .from('monthly_reports')
    .select(`
      id, reporting_month, reporting_year, status,
      final_payout, payout_type_snapshot,
      approved_at, paid_at,
      branch_id
    `)
    .in('branch_id', branchIds)
    .in('status', ['approved', 'paid'])
    .order('reporting_year',  { ascending: false })
    .order('reporting_month', { ascending: false })

  const reports: FilterableReport[] = (rawReports ?? []).map(r => ({
    id:                   r.id,
    reporting_month:      r.reporting_month,
    reporting_year:       r.reporting_year,
    status:               r.status,
    final_payout:         r.final_payout,
    payout_type_snapshot: r.payout_type_snapshot,
    approved_at:          r.approved_at,
    paid_at:              r.paid_at,
    branch_name:          branchNames[r.branch_id] ?? '—',
  }))

  // ── KPIs ──────────────────────────────────────────────────────────────────

  // Total Payout — sum of final_payout for PAID reports only
  const totalPayout = reports
    .filter(r => r.status === 'paid')
    .reduce((sum, r) => sum + Number(r.final_payout ?? 0), 0)

  // Awaiting Payment — sum of final_payout for APPROVED (not yet paid) reports
  const awaitingPayment = reports
    .filter(r => r.status === 'approved')
    .reduce((sum, r) => sum + Number(r.final_payout ?? 0), 0)

  // Paid Reports — count of paid
  const paidCount = reports.filter(r => r.status === 'paid').length

  // Total visible reports (approved + paid)
  const totalCount = reports.length

  return (
    <div>
      {/* ── KPI cards ──────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '28px' }}>
        <KpiCard
          label="Total Payout"
          value={formatTHB(totalPayout)}
          sub="Paid reports"
          accent="gold"
        />
        <KpiCard
          label="Awaiting Payment"
          value={formatTHB(awaitingPayment)}
          sub="Approved, not yet paid"
          accent="amber"
        />
        <KpiCard
          label="Paid Reports"
          value={paidCount}
          sub={paidCount === 1 ? 'report' : 'reports'}
          accent="green"
        />
        <KpiCard
          label="Total Reports"
          value={totalCount}
          sub="Approved + paid"
          accent="default"
        />
      </div>

      {/* ── Reports table with filter ───────────────────────────────────────────── */}
      {reports.length === 0 ? (
        <div style={{
          background: '#0D0F1A', border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '16px', padding: '60px 24px', textAlign: 'center',
        }}>
          <div style={{ fontSize: '32px', marginBottom: '12px', opacity: 0.4 }}>◫</div>
          <p style={{ fontSize: '14px', fontWeight: '600', color: 'rgba(240,236,228,0.4)', margin: 0 }}>
            No reports yet
          </p>
          <p style={{ fontSize: '12px', color: 'rgba(240,236,228,0.25)', marginTop: '6px' }}>
            Your monthly payout reports will appear here once they have been approved.
          </p>
        </div>
      ) : (
        <PartnerReportsFilter reports={reports} />
      )}
    </div>
  )
}
