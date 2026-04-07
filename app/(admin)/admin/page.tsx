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
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '32px' }}>
        <KpiCard label="Active Branches"    value={branches}          accent="default" />
        <KpiCard label="Pending Approval"   value={pending}           accent={pending > 0 ? 'amber' : 'default'} />
        <KpiCard label="Payouts Due"        value={formatTHB(totalPayout)} accent="default" />
        <KpiCard label="Total Reports"      value={reports.length}    accent="default" />
      </div>

      {/* Recent reports table */}
      <div style={{
        background:'#0D0F1A', border:'1px solid rgba(255,255,255,0.06)',
        borderRadius:'16px', overflow:'hidden',
      }}>
        <div style={{ padding:'20px 24px', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
          <h2 style={{ fontSize:'15px', fontWeight:'600', color:'#F0ECE4' }}>Recent Reports</h2>
        </div>

        {reports.length === 0 ? (
          <div style={{ padding:'40px', textAlign:'center', color:'rgba(240,236,228,0.3)', fontSize:'13px' }}>
            No reports yet. Upload a CSV to get started.
          </div>
        ) : (
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'13px' }}>
              <thead>
                <tr style={{ borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
                  {['Period','Final Payout','Status'].map(h => (
                    <th key={h} style={{
                      padding:'12px 24px', textAlign:'left',
                      fontSize:'11px', fontWeight:'600', letterSpacing:'0.08em',
                      textTransform:'uppercase', color:'rgba(240,236,228,0.35)',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reports.slice(0, 10).map((r, i) => (
                  <tr key={i} style={{ borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding:'14px 24px', color:'#F0ECE4' }}>
                      {formatReportingPeriod(r.reporting_month, r.reporting_year)}
                    </td>
                    <td style={{ padding:'14px 24px', color:'#F1F5F9', fontWeight:'600' }}>
                      {formatTHB(Number(r.final_payout))}
                    </td>
                    <td style={{ padding:'14px 24px' }}>
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
