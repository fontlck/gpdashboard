import { createClient } from '@/lib/supabase/server'
import { AdminHeader } from '@/components/admin/AdminHeader'
import { KpiCard } from '@/components/shared/KpiCard'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { formatTHB } from '@/lib/utils/currency'
import { formatReportingPeriod } from '@/lib/utils/date'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Overview' }

export default async function AdminOverviewPage() {
  const supabase = await createClient()

  // Fetch summary counts in parallel
  const [reportsRes, branchesRes, pendingRes] = await Promise.all([
    supabase.from('monthly_reports').select('status, final_payout, reporting_month, reporting_year'),
    supabase.from('branches').select('id', { count: 'exact' }).eq('is_active', true),
    supabase.from('monthly_reports').select('id', { count: 'exact' }).eq('status', 'pending_review'),
  ])

  const reports  = reportsRes.data  ?? []
  const branches = branchesRes.count ?? 0
  const pending  = pendingRes.count  ?? 0

  const totalPayout = reports
    .filter(r => r.status === 'approved')
    .reduce((sum, r) => sum + Number(r.final_payout), 0)

  return (
    <div>
      <AdminHeader
        title="Overview"
        subtitle="All branches — current reporting snapshot"
      />

      {/* KPI Row */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '24px' }}>
        <KpiCard label="Active Branches"  value={branches}               sub="All active locations"  accent="default" />
        <KpiCard label="Pending Approval" value={pending}                sub={pending > 0 ? 'Needs review' : 'All clear'} accent={pending > 0 ? 'amber' : 'default'} />
        <KpiCard label="Payouts Due"      value={formatTHB(totalPayout)} sub="Approved, unpaid"      accent={totalPayout > 0 ? 'amber' : 'default'} />
        <KpiCard label="Total Reports"    value={reports.length}         sub="All time"              accent="default" />
      </div>

      {/* Recent reports table */}
      <div style={{
        background:   '#0C1018',
        border:       '1px solid rgba(255,255,255,0.07)',
        borderRadius: '12px',
        overflow:     'hidden',
      }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '11px', fontWeight: '600', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(241,245,249,0.35)' }}>
            Recent Reports
          </span>
          <span style={{ fontSize: '11px', color: 'rgba(241,245,249,0.22)', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '999px', padding: '2px 8px' }}>
            {reports.length}
          </span>
        </div>

        {reports.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center', color: 'rgba(241,245,249,0.25)', fontSize: '13px' }}>
            No reports yet. Upload a CSV to get started.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Period', 'Final Payout', 'Status'].map(h => (
                    <th key={h} style={{
                      padding:       '14px 20px 10px',
                      textAlign:     'left',
                      fontSize:      '10px',
                      fontWeight:    '600',
                      letterSpacing: '0.12em',
                      textTransform: 'uppercase',
                      color:         'rgba(241,245,249,0.28)',
                      borderBottom:  '1px solid rgba(255,255,255,0.05)',
                      whiteSpace:    'nowrap',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reports.slice(0, 10).map((r, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '11px 20px', color: '#F1F5F9', fontSize: '13px', fontWeight: '500' }}>
                      {formatReportingPeriod(r.reporting_month, r.reporting_year)}
                    </td>
                    <td style={{ padding: '11px 20px', color: '#F1F5F9', fontSize: '13px', fontWeight: '700', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em' }}>
                      {formatTHB(Number(r.final_payout))}
                    </td>
                    <td style={{ padding: '11px 20px' }}>
                      <StatusBadge status={r.status as 'draft'} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
