import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { KpiCard } from '@/components/shared/KpiCard'
import { EmptyState } from '@/components/shared/EmptyState'
import { formatTHB } from '@/lib/utils/currency'
import { formatReportingPeriod } from '@/lib/utils/date'
import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Overview' }

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
      <div style={{
        padding: '40px', textAlign: 'center',
        color: 'rgba(240,236,228,0.4)', fontSize: '14px',
      }}>
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

  const branchIds = (branches ?? []).map(b => b.id)

  if (branchIds.length === 0) {
    return (
      <EmptyState
        icon="◫"
        title="No active branches"
        description="Contact your administrator to set up your branch."
      />
    )
  }

  // Fetch reports for these branches
  const { data: reports } = await supabase
    .from('monthly_reports')
    .select(`
      id, reporting_month, reporting_year, status,
      gross_sales, total_net, total_refunds, adjusted_net,
      partner_share_base, vat_amount, final_payout,
      has_negative_adjusted_net,
      branches ( name )
    `)
    .in('branch_id', branchIds)
    .order('reporting_year',  { ascending: false })
    .order('reporting_month', { ascending: false })

  const allReports = reports ?? []

  // KPIs
  const totalApproved = allReports
    .filter(r => r.status === 'approved' || r.status === 'paid')
    .reduce((sum, r) => sum + Number(r.final_payout), 0)

  const totalPaid = allReports
    .filter(r => r.status === 'paid')
    .reduce((sum, r) => sum + Number(r.final_payout), 0)

  const pendingCount = allReports.filter(r => r.status === 'draft' || r.status === 'pending_review').length

  return (
    <div>

      {/* KPI row */}
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '28px' }}>
        <KpiCard label="Total Approved"  value={formatTHB(totalApproved)} accent="gold"    />
        <KpiCard label="Total Paid Out"  value={formatTHB(totalPaid)}     accent="green"   />
        <KpiCard label="Pending Reports" value={pendingCount}              accent="amber"   />
        <KpiCard label="Total Reports"   value={allReports.length}         accent="default" />
      </div>

      {/* Reports table */}
      <div style={{
        background: '#0D0F1A', border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '16px', overflow: 'hidden',
      }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <h2 style={{ margin: 0, fontSize: '15px', fontWeight: '600', color: '#F0ECE4' }}>
            Monthly Reports
          </h2>
        </div>

        {allReports.length === 0 ? (
          <EmptyState
            icon="◫"
            title="No reports yet"
            description="Your monthly payout reports will appear here after the admin uploads and processes CSV data."
          />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  {['Period', 'Branch', 'Gross Sales', 'NET', 'Your Share', 'Status', ''].map(h => (
                    <th key={h} style={{
                      padding: '12px 20px', textAlign: 'left',
                      fontSize: '11px', fontWeight: '600', letterSpacing: '0.08em',
                      textTransform: 'uppercase', color: 'rgba(240,236,228,0.35)',
                      whiteSpace: 'nowrap',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {allReports.map(r => {
                  const branch = Array.isArray(r.branches) ? r.branches[0] : r.branches
                  return (
                    <tr key={r.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '14px 20px', color: '#F0ECE4', whiteSpace: 'nowrap' }}>
                        {formatReportingPeriod(r.reporting_month, r.reporting_year)}
                      </td>
                      <td style={{ padding: '14px 20px', color: 'rgba(240,236,228,0.6)' }}>
                        {branch?.name ?? '—'}
                      </td>
                      <td style={{ padding: '14px 20px', color: 'rgba(240,236,228,0.6)', whiteSpace: 'nowrap' }}>
                        {formatTHB(Number(r.gross_sales))}
                      </td>
                      <td style={{ padding: '14px 20px', color: 'rgba(240,236,228,0.6)', whiteSpace: 'nowrap' }}>
                        {formatTHB(Number(r.total_net))}
                      </td>
                      <td style={{ padding: '14px 20px', color: '#C4A35E', fontWeight: '700', whiteSpace: 'nowrap' }}>
                        {formatTHB(Number(r.final_payout))}
                      </td>
                      <td style={{ padding: '14px 20px' }}>
                        <StatusBadge status={r.status as 'draft'} />
                      </td>
                      <td style={{ padding: '14px 20px' }}>
                        <Link href={`/dashboard/reports/${r.id}`} style={{
                          fontSize: '12px', color: 'rgba(196,163,94,0.7)',
                          textDecoration: 'none', fontWeight: '500',
                        }}>
                          View →
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
