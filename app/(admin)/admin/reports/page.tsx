import { createClient } from '@/lib/supabase/server'
import { AdminHeader } from '@/components/admin/AdminHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { EmptyState } from '@/components/shared/EmptyState'
import { formatTHB } from '@/lib/utils/currency'
import { formatReportingPeriod } from '@/lib/utils/date'
import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Reports' }

export default async function AdminReportsPage() {
  const supabase = await createClient()

  const { data: reports } = await supabase
    .from('monthly_reports')
    .select(`
      id, reporting_month, reporting_year, status,
      gross_sales, total_net, total_refunds, adjusted_net,
      partner_share_base, vat_amount, final_payout,
      has_negative_adjusted_net, recalculated_at,
      branches ( name, code, revenue_share_pct,
        partners ( name, is_vat_registered )
      )
    `)
    .order('reporting_year',  { ascending: false })
    .order('reporting_month', { ascending: false })

  return (
    <div>
      <AdminHeader
        title="Monthly Reports"
        subtitle="All branch reports across all periods"
        actions={
          <Link href="/admin/upload" style={{
            padding:'10px 18px', borderRadius:'10px',
            background:'linear-gradient(135deg,#C4A35E 0%,#9A7A3A 100%)',
            color:'#080A10', fontSize:'13px', fontWeight:'700',
            textDecoration:'none', letterSpacing:'0.04em',
          }}>
            ↑ Upload CSV
          </Link>
        }
      />

      <div style={{
        background:'#0D0F1A', border:'1px solid rgba(255,255,255,0.06)',
        borderRadius:'16px', overflow:'hidden',
      }}>
        {!reports || reports.length === 0 ? (
          <EmptyState
            icon="◫"
            title="No reports yet"
            description="Upload a CSV file to generate monthly reports for each branch."
          />
        ) : (
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'13px' }}>
              <thead>
                <tr style={{ borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
                  {['Period','Branch','Partner','Gross Sales','NET','Refunds','Final Payout','Status',''].map(h => (
                    <th key={h} style={{
                      padding:'12px 20px', textAlign:'left',
                      fontSize:'11px', fontWeight:'600', letterSpacing:'0.08em',
                      textTransform:'uppercase', color:'rgba(240,236,228,0.35)',
                      whiteSpace:'nowrap',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reports.map(r => {
                  const branch  = Array.isArray(r.branches) ? r.branches[0] : r.branches
                  const partner = branch && (Array.isArray(branch.partners) ? branch.partners[0] : branch.partners)
                  return (
                    <tr key={r.id} style={{ borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding:'14px 20px', color:'#F0ECE4', whiteSpace:'nowrap' }}>
                        {formatReportingPeriod(r.reporting_month, r.reporting_year)}
                      </td>
                      <td style={{ padding:'14px 20px', color:'rgba(240,236,228,0.7)' }}>
                        {branch?.name ?? '—'}
                      </td>
                      <td style={{ padding:'14px 20px', color:'rgba(240,236,228,0.5)' }}>
                        {partner?.name ?? '—'}
                      </td>
                      <td style={{ padding:'14px 20px', color:'rgba(240,236,228,0.7)', whiteSpace:'nowrap' }}>
                        {formatTHB(Number(r.gross_sales))}
                      </td>
                      <td style={{ padding:'14px 20px', color:'rgba(240,236,228,0.7)', whiteSpace:'nowrap' }}>
                        {formatTHB(Number(r.total_net))}
                      </td>
                      <td style={{ padding:'14px 20px', color: Number(r.total_refunds) > 0 ? '#F59E0B' : 'rgba(240,236,228,0.4)', whiteSpace:'nowrap' }}>
                        {Number(r.total_refunds) > 0 ? `− ${formatTHB(Number(r.total_refunds))}` : '—'}
                      </td>
                      <td style={{ padding:'14px 20px', color:'#C4A35E', fontWeight:'700', whiteSpace:'nowrap' }}>
                        {formatTHB(Number(r.final_payout))}
                      </td>
                      <td style={{ padding:'14px 20px' }}>
                        <StatusBadge status={r.status as 'draft'} />
                      </td>
                      <td style={{ padding:'14px 20px' }}>
                        <Link href={`/admin/reports/${r.id}`} style={{
                          fontSize:'12px', color:'rgba(196,163,94,0.7)',
                          textDecoration:'none', fontWeight:'500',
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
