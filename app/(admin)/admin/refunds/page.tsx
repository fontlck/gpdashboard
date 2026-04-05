import { createClient } from '@/lib/supabase/server'
import { AdminHeader } from '@/components/admin/AdminHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { formatTHB } from '@/lib/utils/currency'
import { formatReportingPeriod, formatFullDate } from '@/lib/utils/date'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Refunds' }

type BranchRefundJoin = { name: string }
type ReportRefundJoin = {
  id: string
  reporting_month: number
  reporting_year: number
  status: string
  branches: BranchRefundJoin | BranchRefundJoin[] | null
}
type RefundRow = {
  id: string
  amount: number | string
  reason: string | null
  reference_number: string | null
  created_at: string
  monthly_reports: ReportRefundJoin | ReportRefundJoin[] | null
}

export default async function AdminRefundsPage() {
  const supabase = await createClient()

  const { data: rawRefunds } = await supabase
    .from('refunds')
    .select(`
      id, amount, reason, reference_number, created_at,
      monthly_reports (
        id, reporting_month, reporting_year, status,
        branches ( name )
      )
    `)
    .order('created_at', { ascending: false })

  const refunds = (rawRefunds as unknown as RefundRow[] | null) ?? []

  return (
    <div>
      <AdminHeader
        title="Refunds"
        subtitle="Business refunds deducted from monthly partner payouts"
        actions={
          <button style={{
            padding: '10px 18px', borderRadius: '10px',
            background: 'rgba(239,68,68,0.12)',
            color: '#EF4444', fontSize: '13px', fontWeight: '700',
            border: '1px solid rgba(239,68,68,0.25)', cursor: 'pointer',
            letterSpacing: '0.04em',
          }}>
            + Record Refund
          </button>
        }
      />

      <div style={{
        background: '#0D0F1A', border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '16px', overflow: 'hidden',
      }}>
        {refunds.length === 0 ? (
          <EmptyState
            icon="↩"
            title="No refunds recorded"
            description="Refunds reduce the adjusted NET before calculating partner payout."
          />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  {['Period', 'Branch', 'Amount', 'Reason', 'Reference', 'Report Status', 'Recorded'].map(h => (
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
                {refunds.map(r => {
                  const report = Array.isArray(r.monthly_reports) ? r.monthly_reports[0] : r.monthly_reports
                  const branch = report && (Array.isArray(report.branches) ? report.branches[0] : report.branches)

                  return (
                    <tr key={r.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '14px 20px', color: '#F0ECE4', whiteSpace: 'nowrap' }}>
                        {report ? formatReportingPeriod(report.reporting_month, report.reporting_year) : '—'}
                      </td>
                      <td style={{ padding: '14px 20px', color: 'rgba(240,236,228,0.7)' }}>
                        {branch?.name ?? '—'}
                      </td>
                      <td style={{ padding: '14px 20px', color: '#EF4444', fontWeight: '600', whiteSpace: 'nowrap' }}>
                        − {formatTHB(Number(r.amount))}
                      </td>
                      <td style={{ padding: '14px 20px', color: 'rgba(240,236,228,0.6)', maxWidth: '220px' }}>
                        <span style={{
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical', overflow: 'hidden',
                        }}>
                          {r.reason}
                        </span>
                      </td>
                      <td style={{ padding: '14px 20px', color: 'rgba(240,236,228,0.4)', fontFamily: 'monospace', fontSize: '12px' }}>
                        {r.reference_number ?? '—'}
                      </td>
                      <td style={{ padding: '14px 20px' }}>
                        {report ? <StatusBadge status={report.status as 'draft'} /> : '—'}
                      </td>
                      <td style={{ padding: '14px 20px', color: 'rgba(240,236,228,0.4)', whiteSpace: 'nowrap' }}>
                        {formatFullDate(r.created_at)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Info note */}
      <div style={{
        marginTop: '16px', padding: '14px 20px', borderRadius: '10px',
        background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.1)',
        fontSize: '12px', color: 'rgba(239,100,100,0.7)',
      }}>
        MVP: one refund per branch per reporting month. The refund amount is subtracted from NET before applying the revenue share percentage.
        If the refund exceeds NET, the partner payout is set to ฿0.00.
      </div>
    </div>
  )
}
