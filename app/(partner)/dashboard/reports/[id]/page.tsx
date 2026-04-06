import type { ReactNode } from 'react'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { formatTHB } from '@/lib/utils/currency'
import { formatReportingPeriod, formatFullDate, formatDuration } from '@/lib/utils/date'
import Link from 'next/link'
import type { Metadata } from 'next'
import { DailyTrendChart } from '@/components/partner/DailyTrendChart'
import type { DayData } from '@/components/partner/DailyTrendChart'

export const metadata: Metadata = { title: 'Report Detail' }
export const dynamic = 'force-dynamic'

// ── Join types ────────────────────────────────────────────────────────────────

type PartnerJoin  = { name: string }
type BranchJoin   = {
  id: string; name: string; partner_id: string
  partnership_start_date: string | null
  partners: PartnerJoin | PartnerJoin[] | null
}

// ── Explicit select type — snapshot fields only for financials ─────────────────

type ReportRow = {
  id: string
  reporting_month: number
  reporting_year:  number
  status: string
  // Financials — snapshot-derived
  gross_sales:               number | string | null
  total_opn_fee:             number | string | null
  total_net:                 number | string | null
  total_refunds:             number | string | null
  adjusted_net:              number | string | null
  partner_share_base:        number | string | null
  vat_amount:                number | string | null
  final_payout:              number | string | null
  has_negative_adjusted_net: boolean | null
  // Payout model snapshots
  payout_type_snapshot:          'revenue_share' | 'fixed_rent'
  revenue_share_pct_snapshot:    number
  fixed_rent_snapshot:           number | string | null
  fixed_rent_vat_mode_snapshot:  'exclusive' | 'inclusive' | null
  is_vat_registered_snapshot:    boolean
  vat_rate_snapshot:             number
  // Counts
  total_transaction_count: number
  // Timestamps
  approved_at: string | null
  paid_at:     string | null
  // Join
  branches: BranchJoin | BranchJoin[] | null
}

// ── Shared row component ──────────────────────────────────────────────────────

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
      color: warning ? '#F59E0B' : accent ? '#C4A35E' : muted ? 'rgba(240,236,228,0.3)' : '#F0ECE4',
    }}>{value}</span>
  </div>
)

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function PartnerReportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  // ── Auth ──────────────────────────────────────────────────────────────────
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('partner_id')
    .eq('id', user.id)
    .single()

  if (!profile?.partner_id) redirect('/dashboard')

  // ── Fetch report — explicit columns only ─────────────────────────────────
  const { data: rawReport } = await supabase
    .from('monthly_reports')
    .select(`
      id, reporting_month, reporting_year, status,
      gross_sales, total_opn_fee, total_net, total_refunds, adjusted_net,
      partner_share_base, vat_amount, final_payout, has_negative_adjusted_net,
      payout_type_snapshot, revenue_share_pct_snapshot,
      fixed_rent_snapshot, fixed_rent_vat_mode_snapshot,
      is_vat_registered_snapshot, vat_rate_snapshot,
      total_transaction_count,
      approved_at, paid_at,
      branches (
        id, name, partner_id, partnership_start_date,
        partners ( name )
      )
    `)
    .eq('id', id)
    .single()

  const report = rawReport as unknown as ReportRow | null
  if (!report) notFound()

  // ── Ownership check — must come before status gate ───────────────────────
  const branch = Array.isArray(report.branches) ? report.branches[0] : report.branches
  if (branch?.partner_id !== profile.partner_id) notFound()

  // ── Status gate — draft reports are invisible to partners ─────────────────
  if (report.status !== 'approved' && report.status !== 'paid') notFound()

  // ── Partnership start date for this branch (with fallback) ───────────────
  let branchStartDate: string | null = branch?.partnership_start_date ?? null

  if (!branchStartDate && branch?.id) {
    // Fallback: derive from earliest transaction_date across this branch's reports
    const { data: branchReports } = await supabase
      .from('monthly_reports')
      .select('id')
      .eq('branch_id', branch.id)

    const reportIds = (branchReports ?? []).map((r: { id: string }) => r.id)

    if (reportIds.length > 0) {
      const { data: earliest } = await supabase
        .from('report_rows')
        .select('transaction_date')
        .in('monthly_report_id', reportIds)
        .order('transaction_date', { ascending: true })
        .limit(1)
        .maybeSingle()

      if (earliest?.transaction_date) {
        // Convert UTC timestamp → Bangkok (UTC+7) "YYYY-MM-DD"
        const bkkMs = new Date(earliest.transaction_date).getTime() + 7 * 60 * 60 * 1000
        const d     = new Date(bkkMs)
        branchStartDate = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
      }
    }
  }

  // ── Fetch refund + artist summaries + daily rows ─────────────────────────
  const [refundRes, artistRes, rowsRes] = await Promise.all([
    supabase.from('refunds').select('amount, reason, reference_number').eq('monthly_report_id', id).maybeSingle(),
    supabase.from('artist_summaries').select('id, artist_name, artist_image_url, order_count, gross_sales, total_net')
      .eq('monthly_report_id', id).order('order_count', { ascending: false }),
    supabase.from('report_rows').select('transaction_date, amount, net')
      .eq('monthly_report_id', id),
  ])

  const refund  = refundRes.data
  const artists = artistRes.data ?? []

  // ── Aggregate daily data (Bangkok UTC+7) ──────────────────────────────────
  const BKK_OFFSET_MS = 7 * 60 * 60 * 1000
  const dailyMap = new Map<number, { gross: number; net: number; orders: number }>()

  for (const row of rowsRes.data ?? []) {
    const bkkMs  = new Date(row.transaction_date).getTime() + BKK_OFFSET_MS
    const bkkDate = new Date(bkkMs)
    const day    = bkkDate.getUTCDate()
    const existing = dailyMap.get(day) ?? { gross: 0, net: 0, orders: 0 }
    existing.gross  += Number(row.amount)
    existing.net    += Number(row.net)
    existing.orders += 1
    dailyMap.set(day, existing)
  }

  // Generate all calendar days in the reporting month (including zero-days)
  const daysInMonth = new Date(report.reporting_year, report.reporting_month, 0).getDate()
  const dailyData: DayData[] = Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1
    const agg = dailyMap.get(day) ?? { gross: 0, net: 0, orders: 0 }
    return { day, ...agg }
  })

  // ── Derived values ────────────────────────────────────────────────────────
  const period      = formatReportingPeriod(report.reporting_month, report.reporting_year)
  const isFixedRent = report.payout_type_snapshot === 'fixed_rent'
  const vatRate     = Number(report.vat_rate_snapshot)
  const vatPct      = `${(vatRate * 100).toFixed(0)}%`
  const hasNeg      = report.has_negative_adjusted_net ?? false

  // For revenue share: strip embedded VAT from the OPN-settled adjusted NET
  // before applying the partner share percentage (same logic as admin).
  const adjustedNet      = Number(report.adjusted_net)
  const adjustedNetExVat = hasNeg ? 0 : adjustedNet / (1 + vatRate)

  // ── Financial breakdown — payout-model-aware ──────────────────────────────

  const RevenueShareBreakdown = () => (
    <>
      <ROW label="Gross Sales"
           value={formatTHB(Number(report.gross_sales))} />

      <ROW label="Platform Fee"
           value={`− ${formatTHB(Number(report.total_opn_fee))}`}
           muted />

      <ROW label="Your NET (VAT-incl.)"
           value={formatTHB(Number(report.total_net))} />

      {Number(report.total_refunds) > 0 && (
        <ROW label="Business Refunds"
             value={`− ${formatTHB(Number(report.total_refunds))}`}
             warning />
      )}

      <ROW label="Adjusted NET (VAT-incl.)"
           value={formatTHB(adjustedNet)}
           warning={hasNeg} />

      {/* Ex-VAT derivation — shown for transparency */}
      <ROW label={`÷ (1 + ${vatPct}) → ex-VAT`}
           value={formatTHB(adjustedNetExVat)}
           muted />

      <div style={{ height: '8px' }} />

      <ROW label={`Your Share (${report.revenue_share_pct_snapshot}%)`}
           value={formatTHB(Number(report.partner_share_base))} />

      {report.is_vat_registered_snapshot ? (
        <ROW label={`VAT ${vatPct} on your share`}
             value={formatTHB(Number(report.vat_amount))} />
      ) : (
        <ROW label={`VAT ${vatPct}`}
             value="Not applicable"
             muted />
      )}

      <div style={{ height: '8px' }} />

      <ROW label="Your Payout" value={formatTHB(Number(report.final_payout))} accent />

      {hasNeg && (
        <div style={{
          marginTop: '16px', padding: '12px 14px', borderRadius: '10px',
          background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)',
          fontSize: '12px', color: '#F59E0B',
        }}>
          Refunds exceeded revenue this month. Your payout for this period is ฿0.00.
        </div>
      )}

      <div style={{
        marginTop: '16px', padding: '10px 14px', borderRadius: '8px',
        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
        fontSize: '12px', color: 'rgba(240,236,228,0.35)',
      }}>
        Your payout is calculated as a percentage of monthly sales after fees and refunds.
      </div>
    </>
  )

  const FixedRentBreakdown = () => {
    const rent      = Number(report.fixed_rent_snapshot ?? 0)
    const vatAmount = Number(report.vat_amount ?? 0)
    const vatMode   = report.fixed_rent_vat_mode_snapshot

    const vatLabel = report.is_vat_registered_snapshot
      ? vatMode === 'exclusive'
        ? `VAT ${vatPct} (added on top)`
        : `VAT ${vatPct} (included in rent)`
      : `VAT ${vatPct}`

    return (
      <>
        <ROW label="Gross Sales (informational)"
             value={formatTHB(Number(report.gross_sales))}
             muted />

        <div style={{ height: '8px' }} />

        <ROW label="Fixed Monthly Rent"
             value={formatTHB(rent)} />

        {report.is_vat_registered_snapshot ? (
          <ROW label={vatLabel}
               value={formatTHB(vatAmount)} />
        ) : (
          <ROW label={vatLabel}
               value="Not applicable"
               muted />
        )}

        <div style={{ height: '8px' }} />

        <ROW label="Your Payout" value={formatTHB(Number(report.final_payout))} accent />

        <div style={{
          marginTop: '16px', padding: '10px 14px', borderRadius: '8px',
          background: 'rgba(196,163,94,0.05)', border: '1px solid rgba(196,163,94,0.12)',
          fontSize: '12px', color: 'rgba(196,163,94,0.7)',
        }}>
          Your payout is a fixed monthly amount — it does not vary with sales.
        </div>
      </>
    )
  }

  // Parse branchStartDate "YYYY-MM-DD" as a local (non-UTC) Date for display
  const branchStartLocal: Date | null = branchStartDate
    ? (() => { const [y, m, d] = branchStartDate.split('-').map(Number); return new Date(y, m - 1, d) })()
    : null

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Back link */}
      <div style={{ marginBottom: '20px' }}>
        <Link href="/dashboard" style={{
          fontSize: '13px', color: 'rgba(196,163,94,0.7)',
          textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px',
        }}>
          ← Back to Overview
        </Link>
      </div>

      {/* Page heading */}
      <div style={{
        marginBottom: '24px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        flexWrap: 'wrap', gap: '12px',
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '22px', fontWeight: '700', color: '#F0ECE4', letterSpacing: '-0.02em' }}>
            {branch?.name ?? 'Branch'} — {period}
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'rgba(240,236,228,0.4)' }}>
            {isFixedRent ? 'Fixed rent' : 'Revenue share'} · Monthly payout breakdown
          </p>
        </div>
        <StatusBadge status={report.status as 'approved'} />
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
            Payout Breakdown
          </h2>

          {isFixedRent ? <FixedRentBreakdown /> : <RevenueShareBreakdown />}
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Period Summary */}
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

            <ROW label="Reporting Period"     value={period} />
            <ROW label="Payout Model"         value={isFixedRent ? 'Fixed rent' : 'Revenue share'} />
            <ROW label="Total Transactions"   value={report.total_transaction_count.toLocaleString()} />
            {report.approved_at && (
              <ROW label="Approved on" value={formatFullDate(report.approved_at)} />
            )}
            {report.paid_at && (
              <ROW label="Paid on" value={formatFullDate(report.paid_at)} />
            )}
            {branchStartLocal && (
              <>
                <ROW label="Partner Since"        value={formatFullDate(branchStartLocal)} />
                <ROW label="Partnership Duration" value={formatDuration(branchStartLocal)} muted />
              </>
            )}
          </div>

          {/* Refund panel — only shown when a refund exists */}
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
              <ROW label="Refund Amount"
                   value={`− ${formatTHB(Number(refund.amount))}`}
                   warning />
              <ROW label="Reason" value={refund.reason} />
              {refund.reference_number && (
                <ROW label="Reference" value={refund.reference_number} />
              )}
              <p style={{
                marginTop: '12px', marginBottom: 0,
                fontSize: '12px', color: 'rgba(240,236,228,0.3)', lineHeight: '1.5',
              }}>
                This refund has been deducted from your revenue before calculating your payout.
              </p>
            </div>
          )}

        </div>

        {/* Artist Breakdown — full width, only for revenue share */}
        {!isFixedRent && artists.length > 0 && (
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
                    <td style={{ padding: '10px 0', color: 'rgba(240,236,228,0.6)' }}>{a.order_count}</td>
                    <td style={{ padding: '10px 0', color: 'rgba(240,236,228,0.6)' }}>{formatTHB(Number(a.gross_sales))}</td>
                    <td style={{ padding: '10px 0', color: 'rgba(240,236,228,0.6)' }}>{formatTHB(Number(a.total_net))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Daily Trend Chart — full width, shown for all reports with row data */}
        {dailyData.some(d => d.orders > 0) && (
          <DailyTrendChart
            data={dailyData}
            month={report.reporting_month}
            year={report.reporting_year}
          />
        )}

      </div>
    </div>
  )
}
