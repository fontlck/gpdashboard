import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { AdminHeader } from '@/components/admin/AdminHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { formatTHB } from '@/lib/utils/currency'
import { formatReportingPeriod, formatFullDate } from '@/lib/utils/date'
import { OrdersTable } from '@/components/admin/OrdersTable'
import { ReportStatusActions } from '@/components/admin/ReportStatusActions'
import type { OrderRow } from '@/components/admin/OrdersTable'
import type { ReactNode } from 'react'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Report Detail' }
export const dynamic = 'force-dynamic'

// ── Join types (only fields we actually need from branches/partners) ──────────

type PartnerDetailJoin = { name: string; vat_number: string | null }
type BranchDetailJoin  = {
  name: string; code: string | null; location: string | null
  partners: PartnerDetailJoin | PartnerDetailJoin[] | null
}

// ── Explicit column list — no select('*') ─────────────────────────────────────

type ReportDetailRow = {
  id: string
  reporting_month: number
  reporting_year:  number
  status: string
  // Financials
  gross_sales:            number | string | null
  total_opn_fee:          number | string | null
  total_net:              number | string | null
  total_refunds:          number | string | null
  adjusted_net:           number | string | null
  partner_share_base:     number | string | null
  vat_amount:             number | string | null
  final_payout:           number | string | null
  has_negative_adjusted_net: boolean | null
  // Snapshots
  payout_type_snapshot:         'revenue_share' | 'fixed_rent'
  revenue_share_pct_snapshot:   number
  fixed_rent_snapshot:          number | string | null
  fixed_rent_vat_mode_snapshot: 'exclusive' | 'inclusive' | null
  is_vat_registered_snapshot:   boolean
  vat_rate_snapshot:            number
  // Counts
  total_transaction_count: number
  total_skipped_currency:  number
  total_skipped_date:      number
  // Timestamps
  recalculated_at: string | null
  approved_at:     string | null
  approved_by:     string | null
  paid_at:         string | null
  paid_by:         string | null
  // Join
  branches: BranchDetailJoin | BranchDetailJoin[] | null
}

export default async function AdminReportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const admin = createAdminClient()

  const { data: rawReport } = await admin
    .from('monthly_reports')
    .select(`
      id, reporting_month, reporting_year, status,
      gross_sales, total_opn_fee, total_net, total_refunds, adjusted_net,
      partner_share_base, vat_amount, final_payout, has_negative_adjusted_net,
      payout_type_snapshot, revenue_share_pct_snapshot,
      fixed_rent_snapshot, fixed_rent_vat_mode_snapshot,
      is_vat_registered_snapshot, vat_rate_snapshot,
      total_transaction_count, total_skipped_currency, total_skipped_date,
      recalculated_at, approved_at, approved_by, paid_at, paid_by,
      branches (
        name, code, location,
        partners ( name, vat_number )
      )
    `)
    .eq('id', id)
    .single()

  const report = rawReport as unknown as ReportDetailRow | null
  if (!report) notFound()

  const [refundRes, artistRes, rowsRes] = await Promise.all([
    admin.from('refunds').select('*').eq('monthly_report_id', id).maybeSingle(),
    admin.from('artist_summaries').select('*').eq('monthly_report_id', id).order('order_count', { ascending: false }),
    admin.from('report_rows')
      .select('id, row_number, charge_id, transaction_date, amount, net, opn_refunded, artist_name_raw, artist_image_url')
      .eq('monthly_report_id', id)
      .order('transaction_date', { ascending: true })
      .order('row_number',       { ascending: true }),
  ])

  const refund  = refundRes.data
  const artists = artistRes.data ?? []
  const orderRows: OrderRow[] = (rowsRes.data ?? []).map(r => ({
    id:               r.id,
    row_number:       r.row_number,
    charge_id:        r.charge_id,
    transaction_date: r.transaction_date,
    amount:           Number(r.amount),
    net:              Number(r.net),
    opn_refunded:     r.opn_refunded,
    artist_name_raw:  r.artist_name_raw  ?? null,
    artist_image_url: r.artist_image_url ?? null,
  }))

  const branch  = Array.isArray(report.branches) ? report.branches[0] : report.branches
  const partner = branch && (Array.isArray(branch.partners) ? branch.partners[0] : branch.partners)

  const period       = formatReportingPeriod(report.reporting_month, report.reporting_year)
  const isFixedRent  = report.payout_type_snapshot === 'fixed_rent'
  const vatPct       = `${(report.vat_rate_snapshot * 100).toFixed(0)}%`
  // Reports are locked for editing once approved or paid
  const locked       = report.status === 'approved' || report.status === 'paid'

  // ── Shared row component ────────────────────────────────────────────────────

  const ROW = ({ label, value, accent = false, warning = false, muted = false }: {
    label: string; value: ReactNode; accent?: boolean; warning?: boolean; muted?: boolean
  }) => (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '14px 0', borderBottom: '1px solid rgba(255,255,255,0.05)',
    }}>
      <span style={{ fontSize: '13px', color: 'rgba(240,236,228,0.5)' }}>{label}</span>
      <span style={{
        fontSize: '14px',
        fontWeight: accent ? '700' : '500',
        color: warning ? '#F59E0B' : accent ? '#C4A35E' : muted ? 'rgba(240,236,228,0.35)' : '#F0ECE4',
      }}>{value}</span>
    </div>
  )

  // ── Financial breakdown — payout-model-aware ────────────────────────────────

  const FinancialBreakdown = () => {
    if (isFixedRent) {
      const rent       = Number(report.fixed_rent_snapshot ?? 0)
      const vatAmount  = Number(report.vat_amount ?? 0)
      const vatMode    = report.fixed_rent_vat_mode_snapshot
      const vatLabel   = report.is_vat_registered_snapshot
        ? vatMode === 'exclusive'
          ? `VAT ${vatPct} (exclusive — added on top)`
          : `VAT ${vatPct} (inclusive — extracted)`
        : `VAT ${vatPct} (not registered)`

      return (
        <>
          {/* Informational gross sales line — fixed rent ignores sales for payout */}
          <ROW label="Gross Sales (informational)" value={formatTHB(Number(report.gross_sales))} muted />
          <div style={{ height: '8px' }} />
          <ROW label="Fixed Rent"  value={formatTHB(rent)} />
          <ROW label={vatLabel}    value={report.is_vat_registered_snapshot ? formatTHB(vatAmount) : '—'} />
          <div style={{ height: '8px' }} />
          <ROW label="Final Payout" value={formatTHB(Number(report.final_payout))} accent />

          <div style={{
            marginTop: '16px', padding: '10px 14px', borderRadius: '10px',
            background: 'rgba(196,163,94,0.06)', border: '1px solid rgba(196,163,94,0.15)',
            fontSize: '12px', color: 'rgba(196,163,94,0.7)',
          }}>
            Fixed rent model — payout is not affected by sales or refunds.
          </div>

          {report.has_negative_adjusted_net && (
            <div style={{
              marginTop: '10px', padding: '12px', borderRadius: '10px',
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
              fontSize: '12px', color: '#EF4444',
            }}>
              ⚠ Adjusted NET is negative — note that this does not affect the fixed rent payout.
            </div>
          )}
        </>
      )
    }

    // Revenue share breakdown
    // NET and refunds from OPN are VAT-inclusive. We strip VAT before applying
    // the revenue share percentage so VAT is not double-counted.
    const adjustedNet      = Number(report.adjusted_net)
    const vatR             = Number(report.vat_rate_snapshot)
    const hasNeg           = report.has_negative_adjusted_net ?? false
    const adjustedNetExVat = hasNeg ? 0 : adjustedNet / (1 + vatR)

    return (
      <>
        <ROW label="Gross Sales"                   value={formatTHB(Number(report.gross_sales))} />
        <ROW label="OPN Gateway Fee"               value={`− ${formatTHB(Number(report.total_opn_fee))}`} />
        <ROW label="NET from OPN (VAT-incl.)"      value={formatTHB(Number(report.total_net))} />
        <ROW
          label="Business Refunds (VAT-incl.)"
          value={Number(report.total_refunds) > 0 ? `− ${formatTHB(Number(report.total_refunds))}` : '—'}
          warning={Number(report.total_refunds) > 0}
        />
        <ROW
          label="Adjusted NET (VAT-incl.)"
          value={formatTHB(adjustedNet)}
          warning={hasNeg}
        />
        <ROW
          label={`÷ (1 + ${vatPct}) → ex-VAT`}
          value={formatTHB(adjustedNetExVat)}
          muted
        />
        <div style={{ height: '8px' }} />
        <ROW
          label={`Revenue Share (${report.revenue_share_pct_snapshot}%)`}
          value={formatTHB(Number(report.partner_share_base))}
        />
        <ROW
          label={`VAT ${vatPct} on partner share${report.is_vat_registered_snapshot ? '' : ' (not registered)'}`}
          value={report.is_vat_registered_snapshot ? formatTHB(Number(report.vat_amount)) : '—'}
        />
        <div style={{ height: '8px' }} />
        <ROW label="Final Payout" value={formatTHB(Number(report.final_payout))} accent />

        {hasNeg && (
          <div style={{
            marginTop: '16px', padding: '12px', borderRadius: '10px',
            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
            fontSize: '12px', color: '#EF4444',
          }}>
            ⚠ Refunds exceed NET revenue. Partner payout set to ฿0.00.
          </div>
        )}
      </>
    )
  }

  return (
    <div>
      <AdminHeader
        title={`${branch?.name ?? 'Branch'} — ${period}`}
        subtitle={`Partner: ${partner?.name ?? '—'}`}
        actions={<StatusBadge status={report.status as 'draft'} />}
      />

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
          <FinancialBreakdown />
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
              Report Info
            </h2>
            <ROW label="Period"              value={period} />
            <ROW label="Payout model"        value={isFixedRent ? 'Fixed rent' : 'Revenue share'} />
            <ROW label="Transactions"        value={report.total_transaction_count.toLocaleString()} />
            <ROW label="Skipped (currency)"  value={report.total_skipped_currency || '—'} />
            <ROW label="Skipped (date)"      value={report.total_skipped_date || '—'} />
            {branch?.location && <ROW label="Location" value={branch.location} />}
            <ROW label="Recalculated"        value={report.recalculated_at ? formatFullDate(report.recalculated_at) : '—'} />
          </div>

          {/* Status & Approval actions */}
          <ReportStatusActions
            reportId={id}
            status={report.status as 'draft' | 'approved' | 'paid'}
            approvedAt={report.approved_at}
            paidAt={report.paid_at}
          />

          {/* Refund panel */}
          <div style={{
            background: '#0D0F1A', border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '16px', padding: '24px',
          }}>
            <h2 style={{
              fontSize: '14px', fontWeight: '600', color: 'rgba(240,236,228,0.6)',
              letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '16px',
            }}>
              Refund
            </h2>
            {refund ? (
              <>
                <ROW label="Amount"    value={formatTHB(Number(refund.amount))} warning />
                <ROW label="Reason"    value={refund.reason} />
                {refund.reference_number && <ROW label="Reference" value={refund.reference_number} />}
              </>
            ) : (
              <p style={{ fontSize: '13px', color: 'rgba(240,236,228,0.3)' }}>No refund for this period.</p>
            )}
          </div>
        </div>

        {/* Artist Summary */}
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
                  {['', 'Artist', 'Orders', 'Gross Sales', 'NET'].map(h => (
                    <th key={h} style={{
                      padding: '8px 0', textAlign: 'left',
                      fontSize: '11px', fontWeight: '600', letterSpacing: '0.08em',
                      textTransform: 'uppercase', color: 'rgba(240,236,228,0.35)',
                      width: h === '' ? 44 : undefined,
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {artists.map(a => (
                  <tr key={a.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '8px 0' }}>
                      {a.artist_image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={a.artist_image_url}
                          alt=""
                          style={{
                            width: 36, height: 36, borderRadius: '50%',
                            objectFit: 'cover', border: '1px solid rgba(255,255,255,0.1)',
                            display: 'block',
                          }}
                        />
                      ) : (
                        <div style={{
                          width: 36, height: 36, borderRadius: '50%',
                          background: 'rgba(255,255,255,0.06)',
                          border: '1px solid rgba(255,255,255,0.08)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '12px', color: 'rgba(240,236,228,0.2)',
                        }}>?</div>
                      )}
                    </td>
                    <td style={{ padding: '10px 0', color: '#F0ECE4' }}>{a.artist_name}</td>
                    <td style={{ padding: '10px 0', color: 'rgba(240,236,228,0.7)' }}>{a.order_count}</td>
                    <td style={{ padding: '10px 0', color: 'rgba(240,236,228,0.7)' }}>{formatTHB(Number(a.gross_sales))}</td>
                    <td style={{ padding: '10px 0', color: 'rgba(240,236,228,0.7)' }}>{formatTHB(Number(a.total_net))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Order Rows — inline artist correction */}
        {orderRows.length > 0 && (
          <div style={{
            background: '#0D0F1A', border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '16px', padding: '24px', gridColumn: '1 / -1',
          }}>
            <OrdersTable rows={orderRows} locked={locked} />
          </div>
        )}
      </div>
    </div>
  )
}
