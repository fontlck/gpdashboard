import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AdminHeader } from '@/components/admin/AdminHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { formatTHB } from '@/lib/utils/currency'
import { formatReportingPeriod, formatFullDate } from '@/lib/utils/date'
import type { ReactNode } from 'react'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Report Detail' }

type PartnerDetailJoin = { name: string; is_vat_registered: boolean | null; vat_number: string | null }
type BranchDetailJoin = {
  name: string; code: string | null; revenue_share_pct: number; location: string | null
  partners: PartnerDetailJoin | PartnerDetailJoin[] | null
}
type ReportDetailRow = {
  id: string; reporting_month: number; reporting_year: number; status: string
  gross_sales: number | string | null; total_net: number | string | null
  total_refunds: number | string | null; adjusted_net: number | string | null
  partner_share_base: number | string | null; vat_amount: number | string | null
  final_payout: number | string | null; has_negative_adjusted_net: boolean | null
  recalculated_at: string | null
  branches: BranchDetailJoin | BranchDetailJoin[] | null
}

export default async function AdminReportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: rawReport } = await supabase
    .from('monthly_reports')
    .select(`
      *,
      branches (
        name, code, revenue_share_pct, location,
        partners ( name, is_vat_registered, vat_number )
      )
    `)
    .eq('id', id)
    .single()

  const report = rawReport as unknown as ReportDetailRow | null
  if (!report) notFound()

  const [refundRes, artistRes] = await Promise.all([
    supabase.from('refunds').select('*').eq('monthly_report_id', id).maybeSingle(),
    supabase.from('artist_summaries').select('*').eq('monthly_report_id', id).order('order_count', { ascending: false }),
  ])

  const refund  = refundRes.data
  const artists = artistRes.data ?? []

  const branch  = Array.isArray(report.branches) ? report.branches[0] : report.branches
  const partner = branch && (Array.isArray(branch.partners) ? branch.partners[0] : branch.partners)

  const period = formatReportingPeriod(report.reporting_month, report.reporting_year)

  const ROW = ({ label, value, accent = false, warning = false }: {
    label: string; value: ReactNode; accent?: boolean; warning?: boolean
  }) => (
    <div style={{
      display:'flex', justifyContent:'space-between', alignItems:'center',
      padding:'14px 0', borderBottom:'1px solid rgba(255,255,255,0.05)',
    }}>
      <span style={{ fontSize:'13px', color:'rgba(240,236,228,0.5)' }}>{label}</span>
      <span style={{
        fontSize:'14px', fontWeight: accent ? '700' : '500',
        color: warning ? '#F59E0B' : accent ? '#C4A35E' : '#F0ECE4',
      }}>{value}</span>
    </div>
  )

  return (
    <div>
      <AdminHeader
        title={`${branch?.name ?? 'Branch'} — ${period}`}
        subtitle={`Partner: ${partner?.name ?? '—'}`}
        actions={<StatusBadge status={report.status as 'draft'} />}
      />

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'20px' }}>

        {/* Financial Breakdown */}
        <div style={{
          background:'#0D0F1A', border:'1px solid rgba(255,255,255,0.06)',
          borderRadius:'16px', padding:'24px',
        }}>
          <h2 style={{ fontSize:'14px', fontWeight:'600', color:'rgba(240,236,228,0.6)',
            letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:'16px' }}>
            Financial Breakdown
          </h2>
          <ROW label="Gross Sales"          value={formatTHB(Number(report.gross_sales))} />
          <ROW label="OPN Gateway Fee"      value={`− ${formatTHB(Number(report.total_opn_fee))}`} />
          <ROW label="NET (from OPN)"       value={formatTHB(Number(report.total_net))} />
          <ROW label="Business Refunds"     value={report.total_refunds > 0 ? `− ${formatTHB(Number(report.total_refunds))}` : '—'}
               warning={report.total_refunds > 0} />
          <ROW label="Adjusted NET"         value={formatTHB(Number(report.adjusted_net))}
               warning={report.has_negative_adjusted_net} />
          <div style={{ height:'8px' }}/>
          <ROW label={`Revenue Share (${report.revenue_share_pct_snapshot}%)`}
               value={formatTHB(Number(report.partner_share_base))} />
          <ROW label={`VAT ${(report.vat_rate_snapshot * 100).toFixed(0)}% ${report.is_vat_registered_snapshot ? '' : '(not registered)'}`}
               value={report.is_vat_registered_snapshot ? formatTHB(Number(report.vat_amount)) : '—'} />
          <div style={{ height:'8px' }}/>
          <ROW label="Final Payout"         value={formatTHB(Number(report.final_payout))} accent />

          {report.has_negative_adjusted_net && (
            <div style={{
              marginTop:'16px', padding:'12px', borderRadius:'10px',
              background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)',
              fontSize:'12px', color:'#EF4444',
            }}>
              ⚠ Refunds exceed NET revenue. Partner payout set to ฿0.00.
            </div>
          )}
        </div>

        {/* Report Info */}
        <div style={{ display:'flex', flexDirection:'column', gap:'20px' }}>
          <div style={{
            background:'#0D0F1A', border:'1px solid rgba(255,255,255,0.06)',
            borderRadius:'16px', padding:'24px',
          }}>
            <h2 style={{ fontSize:'14px', fontWeight:'600', color:'rgba(240,236,228,0.6)',
              letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:'16px' }}>
              Report Info
            </h2>
            <ROW label="Period"         value={period} />
            <ROW label="Transactions"   value={report.total_transaction_count.toLocaleString()} />
            <ROW label="Skipped (currency)" value={report.total_skipped_currency || '—'} />
            <ROW label="Skipped (date)" value={report.total_skipped_date || '—'} />
            <ROW label="Recalculated"   value={report.recalculated_at ? formatFullDate(report.recalculated_at) : '—'} />
            {report.approved_at && <ROW label="Approved" value={formatFullDate(report.approved_at)} />}
          </div>

          {/* Refund panel */}
          <div style={{
            background:'#0D0F1A', border:'1px solid rgba(255,255,255,0.06)',
            borderRadius:'16px', padding:'24px',
          }}>
            <h2 style={{ fontSize:'14px', fontWeight:'600', color:'rgba(240,236,228,0.6)',
              letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:'16px' }}>
              Refund
            </h2>
            {refund ? (
              <>
                <ROW label="Amount"    value={formatTHB(Number(refund.amount))} warning />
                <ROW label="Reason"    value={refund.reason} />
                {refund.reference_number && <ROW label="Reference" value={refund.reference_number} />}
              </>
            ) : (
              <p style={{ fontSize:'13px', color:'rgba(240,236,228,0.3)' }}>No refund for this period.</p>
            )}
          </div>
        </div>

        {/* Artist Summary */}
        {artists.length > 0 && (
          <div style={{
            background:'#0D0F1A', border:'1px solid rgba(255,255,255,0.06)',
            borderRadius:'16px', padding:'24px', gridColumn:'1 / -1',
          }}>
            <h2 style={{ fontSize:'14px', fontWeight:'600', color:'rgba(240,236,228,0.6)',
              letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:'16px' }}>
              Artist Breakdown
            </h2>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'13px' }}>
              <thead>
                <tr style={{ borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
                  {['Artist','Orders','Gross Sales','NET'].map(h => (
                    <th key={h} style={{
                      padding:'8px 0', textAlign:'left',
                      fontSize:'11px', fontWeight:'600', letterSpacing:'0.08em',
                      textTransform:'uppercase', color:'rgba(240,236,228,0.35)',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {artists.map(a => (
                  <tr key={a.id} style={{ borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding:'10px 0', color:'#F0ECE4' }}>{a.artist_name}</td>
                    <td style={{ padding:'10px 0', color:'rgba(240,236,228,0.7)' }}>{a.order_count}</td>
                    <td style={{ padding:'10px 0', color:'rgba(240,236,228,0.7)' }}>{formatTHB(Number(a.gross_sales))}</td>
                    <td style={{ padding:'10px 0', color:'rgba(240,236,228,0.7)' }}>{formatTHB(Number(a.total_net))}</td>
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
