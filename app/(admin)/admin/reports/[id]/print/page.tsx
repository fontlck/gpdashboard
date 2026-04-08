import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatTHB } from '@/lib/utils/currency'
import { formatReportingPeriod } from '@/lib/utils/date'
import { PrintTrigger } from '@/components/shared/PrintTrigger'

export const dynamic = 'force-dynamic'

export default async function AdminReportPrintPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const admin   = createAdminClient()

  const { data: raw } = await admin
    .from('monthly_reports')
    .select(`
      id, reporting_month, reporting_year, status,
      gross_sales, total_opn_fee, total_net, total_refunds, adjusted_net,
      partner_share_base, vat_amount, final_payout, has_negative_adjusted_net,
      payout_type_snapshot, revenue_share_pct_snapshot, fixed_rent_snapshot,
      fixed_rent_vat_mode_snapshot, is_vat_registered_snapshot, vat_rate_snapshot,
      referred_artist_uplift, referred_artist_uplift_vat, referred_artist_uplift_snapshot,
      withholding_tax_pct, withholding_tax_amount,
      total_transaction_count, approved_at, paid_at,
      branches ( name, partners ( name, vat_number ) )
    `)
    .eq('id', id)
    .single()

  if (!raw) notFound()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = raw as any
  const branch  = Array.isArray(r.branches) ? r.branches[0] : r.branches
  const partner = Array.isArray(branch?.partners) ? branch.partners[0] : branch?.partners
  const period  = formatReportingPeriod(r.reporting_month, r.reporting_year)
  const vatRate = Number(r.vat_rate_snapshot)
  const vatPct  = `${(vatRate * 100).toFixed(0)}%`
  const isFixed = r.payout_type_snapshot === 'fixed_rent'
  const hasNeg  = r.has_negative_adjusted_net ?? false
  const adjNetExVat = hasNeg ? 0 : Number(r.adjusted_net) / (1 + vatRate)

  const upliftBase  = Number(r.referred_artist_uplift ?? 0)
  const upliftVat   = Number(r.referred_artist_uplift_vat ?? 0)
  const upliftTotal = upliftBase + upliftVat
  type UE = { artist_name: string; uplift_pct: number; uplift_base: number; uplift_vat: number }
  const upliftEntries: UE[] = r.referred_artist_uplift_snapshot ?? []

  const whtPct    = Number(r.withholding_tax_pct    ?? 0)
  const whtAmount = Number(r.withholding_tax_amount ?? 0)

  const { data: artists } = await admin
    .from('artist_summaries')
    .select('artist_name, order_count, gross_sales, total_net')
    .eq('monthly_report_id', id)
    .order('order_count', { ascending: false })
    .limit(10)

  const printDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })

  return (
    <>
      <PrintTrigger />
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #fff; color: #111; font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 11pt; }
        @page { size: A4 portrait; margin: 18mm 20mm 18mm 20mm; }
        @media print { .no-print { display: none !important; } }
        .page { max-width: 680px; margin: 0 auto; padding: 28px 0; }
        table { width: 100%; border-collapse: collapse; }
        td, th { padding: 7px 10px; font-size: 10pt; }
      `}</style>

      <div className="page">

        <div className="no-print" style={{ marginBottom: '20px' }}>
          <a href={`/admin/reports/${id}`} style={{ fontSize: '12px', color: '#555', textDecoration: 'none' }}>
            ← Back to report
          </a>
        </div>

        {/* Header */}
        <div style={{ borderBottom: '2px solid #111', paddingBottom: '14px', marginBottom: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '8pt', fontWeight: '700', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#888', marginBottom: '4px' }}>
                Partner Earnings Report · Admin Copy
              </div>
              <div style={{ fontSize: '20pt', fontWeight: '700', letterSpacing: '-0.03em' }}>{period}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '14pt', fontWeight: '700' }}>{partner?.name ?? branch?.name}</div>
              {partner?.vat_number && <div style={{ fontSize: '9pt', color: '#666', marginTop: '2px' }}>VAT {partner.vat_number}</div>}
              <div style={{ fontSize: '9pt', color: '#666', marginTop: '2px' }}>{branch?.name}</div>
              <div style={{ fontSize: '9pt', color: '#aaa', marginTop: '2px' }}>Printed {printDate}</div>
              <div style={{ fontSize: '9pt', color: '#aaa', marginTop: '2px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>{r.status}</div>
            </div>
          </div>
        </div>

        {/* Summary */}
        <table style={{ marginBottom: '22px' }}>
          <tbody>
            {[
              { label: 'Payout Model',    value: isFixed ? 'Fixed Rent' : `Revenue Share (${r.revenue_share_pct_snapshot}%)` },
              { label: 'Total Orders',    value: Number(r.total_transaction_count).toLocaleString() },
              { label: 'Gross Sales',     value: formatTHB(Number(r.gross_sales)) },
              { label: 'Platform Fee',    value: `– ${formatTHB(Number(r.total_opn_fee))}` },
              { label: 'Net Revenue',     value: formatTHB(Number(r.total_net)) },
              ...(Number(r.total_refunds) > 0 ? [{ label: 'Refunds', value: `– ${formatTHB(Number(r.total_refunds))}` }] : []),
              ...(!isFixed ? [{ label: `Adjusted NET (ex-VAT ${vatPct})`, value: formatTHB(adjNetExVat) }] : []),
              { label: 'Partner Share',   value: formatTHB(Number(r.partner_share_base)) },
              ...(r.is_vat_registered_snapshot ? [{ label: `VAT ${vatPct}`, value: formatTHB(Number(r.vat_amount)) }] : []),
              ...(upliftTotal > 0 ? [{ label: 'Artist Uplift', value: `+ ${formatTHB(upliftTotal)}` }] : []),
              ...(whtAmount > 0 ? [{ label: `Withholding Tax (${whtPct}%)`, value: `– ${formatTHB(whtAmount)}` }] : []),
            ].map((row, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ color: '#555', width: '55%' }}>{row.label}</td>
                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#111' }}>{row.value}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td style={{ paddingTop: '12px', fontWeight: '700', fontSize: '12pt', borderTop: '2px solid #111' }}>Final Payout</td>
              <td style={{ paddingTop: '12px', textAlign: 'right', fontWeight: '700', fontSize: '14pt', fontVariantNumeric: 'tabular-nums', borderTop: '2px solid #111' }}>
                {formatTHB(Number(r.final_payout))}
              </td>
            </tr>
          </tfoot>
        </table>

        {/* Uplift detail */}
        {upliftEntries.length > 0 && (
          <>
            <div style={{ fontSize: '8pt', fontWeight: '700', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#888', marginBottom: '8px' }}>Artist Uplift Detail</div>
            <table style={{ marginBottom: '22px', border: '1px solid #eee' }}>
              <thead style={{ background: '#f7f7f7' }}>
                <tr>
                  {['Artist', 'Rate', 'Uplift (ex-VAT)', 'VAT', 'Total'].map(h => (
                    <th key={h} style={{ textAlign: h === 'Artist' ? 'left' : 'right', fontWeight: '600', fontSize: '9pt', color: '#555', borderBottom: '1px solid #ddd' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {upliftEntries.map((e, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f0f0f0' }}>
                    <td>{e.artist_name}</td>
                    <td style={{ textAlign: 'right' }}>{e.uplift_pct}%</td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatTHB(e.uplift_base)}</td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatTHB(e.uplift_vat)}</td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: '600' }}>{formatTHB(e.uplift_base + e.uplift_vat)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {/* Top Artists */}
        {artists && artists.length > 0 && (
          <>
            <div style={{ fontSize: '8pt', fontWeight: '700', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#888', marginBottom: '8px' }}>Artist Performance</div>
            <table style={{ marginBottom: '22px', border: '1px solid #eee' }}>
              <thead style={{ background: '#f7f7f7' }}>
                <tr>
                  {['#', 'Artist', 'Orders', 'Gross', 'NET'].map((h, i) => (
                    <th key={h} style={{ textAlign: ['Orders','Gross','NET'].includes(h) ? 'right' : 'left', fontWeight: '600', fontSize: '9pt', color: '#555', borderBottom: '1px solid #ddd', width: i === 0 ? '30px' : undefined }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {artists.map((a, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f0f0f0' }}>
                    <td style={{ color: '#aaa' }}>{i + 1}</td>
                    <td>{a.artist_name === '(Unknown)' ? '—' : a.artist_name}</td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{a.order_count}</td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatTHB(Number(a.gross_sales))}</td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatTHB(Number(a.total_net))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        <div style={{ borderTop: '1px solid #ddd', paddingTop: '12px', fontSize: '8pt', color: '#aaa', display: 'flex', justifyContent: 'space-between' }}>
          <span>{partner?.name ?? ''} · {branch?.name ?? ''} · {period}</span>
          <span>GP Dashboard · Admin Copy · Confidential</span>
        </div>
      </div>
    </>
  )
}
