import type { ReactNode } from 'react'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { formatTHB } from '@/lib/utils/currency'
import { formatReportingPeriod, formatFullDate } from '@/lib/utils/date'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Report Detail' }

type PartnerReportJoin = { name: string }
type BranchReportJoin = {
  name: string; revenue_share_pct: number; partner_id: string
  partners: PartnerReportJoin | PartnerReportJoin[] | null
}
type PartnerReportDetailRow = {
  id: string; reporting_month: number; reporting_year: number; status: string
  gross_sales: number | string | null; total_net: number | string | null
  total_refunds: number | string | null; adjusted_net: number | string | null
  partner_share_base: number | string | null; vat_amount: number | string | null
  final_payout: number | string | null; has_negative_adjusted_net: boolean | null
  recalculated_at: string | null
  branches: BranchReportJoin | BranchReportJoin[] | null
}

const ROW = ({ label, value, accent = false, warning = false, muted = false }: {
  label: string; value: ReactNode; accent?: boolean; warning?: boolean; muted?: boolean
}) => (
  <div style={{
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '13px 0', borderBottom: '1px solid rgba(255,255,255,0.05)',
  }}>
    <span style={{ fontSize: '13px', color: 'rgba(240,236,228,0.45)' }}>{label}</span>
    <span style={{
      fontSize: '14px', fontWeight: accent ? '700' : '500',
      color: warning ? '#F59E0B' : accent ? '#C4A35E' : muted ? 'rgba(240,236,228,0.35)' : '#F0ECE4',
    }}>{value}</span>
  </div>
)

export default async function PartnerReportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('partner_id')
    .eq('id', user.id)
    .single()

  if (!profile?.partner_id) redirect('/dashboard')

  // Verify this report belongs to a branch of the partner (RLS also enforces this)
  const { data: rawReport } = await supabase
    .from('monthly_reports')
    .select(`
      *,
      branches (
        name, revenue_share_pct, partner_id,
        partners ( name )
      )
    `)
    .eq('id', id)
    .single()

  const report = rawReport as unknown as PartnerReportDetailRow | null
  if (!report) notFound()

  // Extra ownership check (belt-and-suspenders on top of RLS)
  const branch  = Array.isArray(report.branches) ? report.branches[0] : report.branches
  if (branch?.partner_id !== profile.partner_id) notFound()

  const [refundRes, artistRes] = await Promise.all([
    supabase.from('refunds').select('*').eq('monthly_report_id', id).maybeSingle(),
    supabase.from('artist_summaries').select('*').eq('monthly_report_id', id).order('order_count', { ascending: false }),
  ])

  const refund  = refundRes.data
  const artists = artistRes.data ?? []

  const period = formatReportingPeriod(report.reporting_month, report.reporting_year)

  return (
    <div>
      {/* Page heading */}
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '22px', fontWeight: '700', color: '#F0ECE4', letterSpacing: '-0.02em' }}>
            {branch?.name ?? 'Branch'} — {period}
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'rgba(240,236,228,0.4)' }}>
            Monthly payout breakdown
          </p>
        </div>
        <StatusBadge status={report.status as 'draft'} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>

        {/* Financial Breakdown */}
        <div style={{
          background: '#0D0F1A', border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '16px', padding: '24px',
        }}>
          <h2 style={{
            fontSize: '14px', fontWeight: '600', color: 'rgba(240,236,228,0.6)',
            letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '16px',
          }}>
            Financial Breakdown
          </h2>

          <ROW label="Gross Sales"      value={formatTHB(Number(report.gross_sales))} />
          <ROW label="OPN Gateway Fee"  value={`− ${formatTHB(Number(report.total_opn_fee))}`} muted />
          <ROW label="NET (from OPN)"   value={formatTHB(Number(report.total_net))} />
          {Number(report.total_refunds) > 0 && (
            <ROW label="Business Refunds"
                 value={`− ${formatTHB(Number(report.total_refunds))}`}
                 warning />
          )}
          <ROW label="Adjusted NET"
               value={formatTHB(Number(report.adjusted_net))}
               warning={report.has_negative_adjusted_net} />

          <div style={{ height: '8px' }} />

          <ROW label={`Your Share (${report.revenue_share_pct_snapshot}%)`}
               value={formatTHB(Number(report.partner_share_base))} />

          {report.is_vat_registered_snapshot && (
            <ROW label={`VAT ${(report.vat_rate_snapshot * 100).toFixed(0)}%`}
                 value={formatTHB(Number(report.vat_amount))} />
          )}

          <div style={{ height: '8px' }} />

          <ROW label="Your Payout" value={formatTHB(Number(report.final_payout))} accent />

          {report.has_negative_adjusted_net && (
            <div style={{
              marginTop: '16px', padding: '12px', borderRadius: '10px',
              background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)',
              fontSize: '12px', color: '#F59E0B',
            }}>
              Refunds exceeded NET revenue this month. Your payout for this period is ฿0.00.
            </div>
          )}
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Report Info */}
          <div style={{
            background: '#0D0F1A', border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '16px', padding: '24px',
          }}>
            <h2 style={{
              fontSize: '14px', fontWeight: '600', color: 'rgba(240,236,228,0.6)',
              letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '16px',
            }}>
              Period Summary
            </h2>
            <ROW label="Reporting Period" value={period} />
            <ROW label="Total Transactions" value={report.total_transaction_count.toLocaleString()} />
            {report.approved_at && (
              <ROW label="Approved on" value={formatFullDate(report.approved_at)} />
            )}
          </div>

          {/* Refund panel — only show if there is one */}
          {refund && (
            <div style={{
              background: '#0D0F1A',
              border: '1px solid rgba(239,68,68,0.15)',
              borderRadius: '16px', padding: '24px',
            }}>
              <h2 style={{
                fontSize: '14px', fontWeight: '600', color: 'rgba(240,236,228,0.6)',
                letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '16px',
              }}>
                Refund Applied
              </h2>
              <ROW label="Amount"  value={`− ${formatTHB(Number(refund.amount))}`} warning />
              <ROW label="Reason"  value={refund.reason} />
              {refund.reference_number && (
                <ROW label="Reference" value={refund.reference_number} />
              )}
            </div>
          )}

          {/* Status info */}
          {(report.status === 'draft' || report.status === 'pending_review') && (
            <div style={{
              padding: '16px 20px', borderRadius: '12px',
              background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.15)',
              fontSize: '12px', color: 'rgba(245,158,11,0.8)',
            }}>
              This report is currently being reviewed by the GP team. You will be notified once it is approved.
            </div>
          )}
        </div>

        {/* Artist Breakdown — full width */}
        {artists.length > 0 && (
          <div style={{
            background: '#0D0F1A', border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '16px', padding: '24px', gridColumn: '1 / -1',
          }}>
            <h2 style={{
              fontSize: '14px', fontWeight: '600', color: 'rgba(240,236,228,0.6)',
              letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '16px',
            }}>
              Artist Breakdown
            </h2>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  {['Artist', 'Orders', 'Gross Sales', 'NET'].map(h => (
                    <th key={h} style={{
                      padding: '8px 0', textAlign: 'left',
                      fontSize: '11px', fontWeight: '600', letterSpacing: '0.08em',
                      textTransform: 'uppercase', color: 'rgba(240,236,228,0.35)',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {artists.map(a => (
                  <tr key={a.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '10px 0', color: '#F0ECE4' }}>{a.artist_name}</td>
                    <td style={{ padding: '10px 0', color: 'rgba(240,236,228,0.6)' }}>{a.order_count}</td>
                    <td style={{ padding: '10px 0', color: 'rgba(240,236,228,0.6)' }}>{formatTHB(Number(a.gross_sales))}</td>
                    <td style={{ padding: '10px 0', color: 'rgba(240,236,228,0.6)' }}>{formatTHB(Number(a.total_net))}</td>
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
