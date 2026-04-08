import type { ReactNode } from 'react'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { formatTHB } from '@/lib/utils/currency'
import { formatReportingPeriod, formatFullDate, formatDuration } from '@/lib/utils/date'
import Link from 'next/link'
import type { Metadata } from 'next'
import { DailyTrendChart } from '@/components/partner/DailyTrendChart'
import type { DayData, ArtistDayEntry } from '@/components/partner/DailyTrendChart'
import { ArtistAvatar } from '@/components/shared/ArtistAvatar'

export const metadata: Metadata = { title: 'Report Detail' }
export const dynamic = 'force-dynamic'

// ── Join types ────────────────────────────────────────────────────────────────

type PartnerJoin = { name: string }
type BranchJoin  = {
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
  // Referred artist uplift
  referred_artist_uplift:          number | null
  referred_artist_uplift_vat:      number | null
  referred_artist_uplift_snapshot: unknown[] | null
  // Counts
  total_transaction_count: number
  // Timestamps
  approved_at: string | null
  paid_at:     string | null
  // Join
  branches: BranchJoin | BranchJoin[] | null
}

// ── UI primitives ─────────────────────────────────────────────────────────────

/** Plain label / value row used in the details card */
const ROW = ({ label, value, accent = false, warning = false, muted = false }: {
  label: string; value: ReactNode; accent?: boolean; warning?: boolean; muted?: boolean
}) => (
  <div style={{
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.05)',
  }}>
    <span style={{ fontSize: '13px', color: 'rgba(240,236,228,0.4)' }}>{label}</span>
    <span style={{
      fontSize: '14px', fontWeight: accent ? '700' : '500',
      color: warning ? '#EF4444'
           : accent  ? '#F1F5F9'
           : muted   ? 'rgba(241,245,249,0.28)'
           :           '#F1F5F9',
      fontVariantNumeric: 'tabular-nums',
    }}>{value}</span>
  </div>
)

/** One of the four top KPI metric cards */
const KpiCard = ({ label, value, muted = false, sub }: {
  label: string; value: string; muted?: boolean; sub?: string
}) => (
  <div style={{
    background: '#0D0F1A', border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '14px', padding: '20px 22px',
  }}>
    <div style={{
      fontSize: '10px', fontWeight: '600', letterSpacing: '0.11em',
      textTransform: 'uppercase', color: 'rgba(240,236,228,0.28)',
      marginBottom: '10px',
    }}>
      {label}
    </div>
    <div style={{
      fontSize: '20px', fontWeight: '700', letterSpacing: '-0.02em',
      fontVariantNumeric: 'tabular-nums',
      color: muted ? 'rgba(240,236,228,0.28)' : '#F0ECE4',
    }}>
      {value}
    </div>
    {sub && (
      <div style={{ fontSize: '11px', color: 'rgba(240,236,228,0.22)', marginTop: '5px' }}>
        {sub}
      </div>
    )}
  </div>
)

/** A single row in the step-by-step payout ledger */
const LEDGER = ({
  label, value,
  role   = 'normal',
  indent = false,
}: {
  label: string; value: string
  role?:   'normal' | 'muted' | 'warning' | 'subtotal'
  indent?: boolean
}) => {
  const labelColor =
    role === 'muted'    ? 'rgba(240,236,228,0.28)' :
    role === 'warning'  ? 'rgba(239,68,68,0.65)'   :
    role === 'subtotal' ? 'rgba(241,245,249,0.65)'  :
                          'rgba(241,245,249,0.45)'
  const valueColor =
    role === 'muted'    ? 'rgba(241,245,249,0.28)' :
    role === 'warning'  ? '#EF4444'                :
                          '#F0ECE4'
  const fontWeight = role === 'subtotal' ? '600' : '400'

  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: indent ? '9px 0 9px 18px' : '9px 0',
      borderBottom: '1px solid rgba(255,255,255,0.04)',
    }}>
      <span style={{ fontSize: '13px', color: labelColor }}>
        {indent && (
          <span style={{ color: 'rgba(255,255,255,0.15)', marginRight: '7px', fontStyle: 'normal' }}>→</span>
        )}
        {label}
      </span>
      <span style={{
        fontSize: '14px', fontWeight, color: valueColor,
        fontVariantNumeric: 'tabular-nums',
      }}>
        {value}
      </span>
    </div>
  )
}

const LedgerDivider = () => (
  <div style={{ height: '1px', background: 'rgba(255,255,255,0.07)', margin: '6px 0' }} />
)

/** Final payout emphasis row at the bottom of the ledger */
const LedgerPayout = ({ value }: { value: string }) => (
  <div style={{
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '18px 0 4px',
    borderTop: '2px solid rgba(255,255,255,0.1)',
    marginTop: '10px',
  }}>
    <span style={{
      fontSize: '12px', fontWeight: '600', letterSpacing: '0.1em',
      textTransform: 'uppercase', color: 'rgba(241,245,249,0.45)',
    }}>
      Final Payout
    </span>
    <span style={{
      fontSize: '24px', fontWeight: '700', color: '#F1F5F9',
      letterSpacing: '-0.025em', fontVariantNumeric: 'tabular-nums',
    }}>
      {value}
    </span>
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
      referred_artist_uplift, referred_artist_uplift_vat, referred_artist_uplift_snapshot,
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
        const bkkMs = new Date(earliest.transaction_date).getTime() + 7 * 60 * 60 * 1000
        const d     = new Date(bkkMs)
        branchStartDate = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
      }
    }
  }

  // ── Fetch refund + artist summaries + daily rows ─────────────────────────
  const [refundRes, artistRes, rowsRes] = await Promise.all([
    supabase.from('refunds').select('amount, reason, reference_number').eq('monthly_report_id', id).maybeSingle(),
    supabase.from('artist_summaries').select('id, artist_name, artist_image_url, order_count, gross_sales, total_net, referral_uplift_amount, referral_uplift_pct_snapshot')
      .eq('monthly_report_id', id).order('order_count', { ascending: false }),
    supabase.from('report_rows').select('transaction_date, amount, net, artist_name_raw')
      .eq('monthly_report_id', id),
  ])

  const refund  = refundRes.data
  const artists = artistRes.data ?? []

  // ── Aggregate daily data (Bangkok UTC+7) — with per-artist breakdown ───────
  const BKK_OFFSET_MS = 7 * 60 * 60 * 1000
  type DayAgg = { gross: number; net: number; orders: number; byArtist: Map<string, { gross: number; net: number; orders: number }> }
  const dailyMap = new Map<number, DayAgg>()

  for (const row of rowsRes.data ?? []) {
    const bkkMs   = new Date(row.transaction_date).getTime() + BKK_OFFSET_MS
    const day     = new Date(bkkMs).getUTCDate()
    const gross   = Number(row.amount)
    const net     = Number(row.net)
    const artist  = (row as { artist_name_raw?: string | null }).artist_name_raw?.trim() || '(Unknown)'

    const existing = dailyMap.get(day) ?? { gross: 0, net: 0, orders: 0, byArtist: new Map() }
    existing.gross  += gross
    existing.net    += net
    existing.orders += 1

    const aEntry = existing.byArtist.get(artist) ?? { gross: 0, net: 0, orders: 0 }
    aEntry.gross  += gross
    aEntry.net    += net
    aEntry.orders += 1
    existing.byArtist.set(artist, aEntry)

    dailyMap.set(day, existing)
  }

  // Generate all calendar days in the reporting month (including zero-days)
  const daysInMonth = new Date(report.reporting_year, report.reporting_month, 0).getDate()
  const dailyData: DayData[] = Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1
    const agg = dailyMap.get(day)
    if (!agg) return { day, gross: 0, net: 0, orders: 0, artists: [] }
    const artistEntries: ArtistDayEntry[] = [...agg.byArtist.entries()].map(([artist, v]) => ({
      artist, gross: v.gross, net: v.net, orders: v.orders,
    }))
    return { day, gross: agg.gross, net: agg.net, orders: agg.orders, artists: artistEntries }
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

  // Referred artist uplift — additive layer, zero when no eligible artists
  const upliftBase = Number(report.referred_artist_uplift    ?? 0)
  const upliftVat  = Number(report.referred_artist_uplift_vat ?? 0)
  const upliftTotal = upliftBase + upliftVat
  type UpliftEntry = { artist_name: string; uplift_pct: number; uplift_base: number; uplift_vat: number; uplift_total: number; total_net: number }
  const upliftEntries = (report.referred_artist_uplift_snapshot ?? []) as UpliftEntry[]
  const hasUplift = upliftTotal > 0

  // Parse branchStartDate "YYYY-MM-DD" as a local (non-UTC) Date for display
  const branchStartLocal: Date | null = branchStartDate
    ? (() => { const [y, m, d] = branchStartDate.split('-').map(Number); return new Date(y, m - 1, d) })()
    : null

  // ── Payout breakdown flows ────────────────────────────────────────────────

  const RevenueShareFlow = () => (
    <>
      <LEDGER label="Gross Sales"          value={formatTHB(Number(report.gross_sales))} />
      <LEDGER label="Platform Fee"         value={`− ${formatTHB(Number(report.total_opn_fee))}`} role="muted" indent />
      <LedgerDivider />
      <LEDGER label="Your NET (VAT-incl.)" value={formatTHB(Number(report.total_net))} role="subtotal" />

      {Number(report.total_refunds) > 0 && (
        <>
          <LEDGER label="Business Refunds" value={`− ${formatTHB(Number(report.total_refunds))}`} role="warning" indent />
          <LedgerDivider />
          <LEDGER label="Adjusted NET"     value={formatTHB(adjustedNet)} role={hasNeg ? 'warning' : 'subtotal'} />
        </>
      )}

      <LEDGER label={`÷ (1 + ${vatPct}) → ex-VAT`} value={formatTHB(adjustedNetExVat)} role="muted" indent />
      <LedgerDivider />
      <LEDGER label={`Your Share (${report.revenue_share_pct_snapshot}%)`} value={formatTHB(Number(report.partner_share_base))} role="subtotal" />

      {report.is_vat_registered_snapshot ? (
        <LEDGER label={`+ VAT ${vatPct} on your share`} value={formatTHB(Number(report.vat_amount))} indent />
      ) : (
        <LEDGER label={`VAT ${vatPct}`} value="Not applicable" role="muted" />
      )}

      {hasNeg && (
        <div style={{
          margin: '14px 0 0', padding: '11px 14px', borderRadius: '8px',
          background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.18)',
          fontSize: '12px', color: '#EF4444', lineHeight: '1.55',
        }}>
          Refunds exceeded revenue this month — payout is ฿0.00
        </div>
      )}

      {hasUplift && (
        <>
          <LedgerDivider />
          <LEDGER label="Referred Artist Uplift" value={`+ ${formatTHB(upliftBase)}`} role="subtotal" />
          {upliftEntries.map(e => (
            <LEDGER
              key={e.artist_name}
              label={`${e.artist_name} (${e.uplift_pct}%)`}
              value={formatTHB(e.uplift_base)}
              indent
            />
          ))}
          {report.is_vat_registered_snapshot && upliftVat > 0 && (
            <LEDGER label={`+ VAT ${vatPct} on uplift`} value={formatTHB(upliftVat)} indent />
          )}
        </>
      )}

      <LedgerPayout value={formatTHB(Number(report.final_payout))} />

      <div style={{
        marginTop: '16px', padding: '10px 14px', borderRadius: '8px',
        background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)',
        fontSize: '11px', color: 'rgba(240,236,228,0.28)', lineHeight: '1.65',
      }}>
        Your payout is calculated as a percentage of monthly sales after fees and refunds.
      </div>
    </>
  )

  const FixedRentFlow = () => {
    const rent      = Number(report.fixed_rent_snapshot ?? 0)
    const vatAmount = Number(report.vat_amount ?? 0)
    const vatMode   = report.fixed_rent_vat_mode_snapshot

    const vatLabel = report.is_vat_registered_snapshot
      ? vatMode === 'exclusive'
        ? `+ VAT ${vatPct} (added on top)`
        : `VAT ${vatPct} (included in rent)`
      : `VAT ${vatPct}`

    return (
      <>
        <LEDGER label="Gross Sales (informational)" value={formatTHB(Number(report.gross_sales))} role="muted" />
        <LedgerDivider />
        <LEDGER label="Fixed Monthly Rent" value={formatTHB(rent)} role="subtotal" />

        {report.is_vat_registered_snapshot ? (
          <LEDGER label={vatLabel} value={formatTHB(vatAmount)} indent />
        ) : (
          <LEDGER label={vatLabel} value="Not applicable" role="muted" />
        )}

        {hasUplift && (
          <>
            <LedgerDivider />
            <LEDGER label="Referred Artist Uplift" value={`+ ${formatTHB(upliftBase)}`} role="subtotal" />
            {upliftEntries.map(e => (
              <LEDGER
                key={e.artist_name}
                label={`${e.artist_name} (${e.uplift_pct}%)`}
                value={formatTHB(e.uplift_base)}
                indent
              />
            ))}
            {report.is_vat_registered_snapshot && upliftVat > 0 && (
              <LEDGER label={`+ VAT ${vatPct} on uplift`} value={formatTHB(upliftVat)} indent />
            )}
          </>
        )}

        <LedgerPayout value={formatTHB(Number(report.final_payout))} />

        <div style={{
          marginTop: '16px', padding: '10px 14px', borderRadius: '8px',
          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
          fontSize: '11px', color: 'rgba(241,245,249,0.4)', lineHeight: '1.65',
        }}>
          Your payout is a fixed monthly amount — it does not vary with sales.
        </div>
      </>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div>

      {/* ── Back link ──────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: '28px' }}>
        <Link href="/dashboard" style={{
          fontSize: '13px', color: 'rgba(59,130,246,0.7)',
          textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px',
          letterSpacing: '0.01em',
        }}>
          ← Back to Overview
        </Link>
      </div>

      {/* ── Hero card ──────────────────────────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(140deg, #10132A 0%, #0D0F1A 55%, #12152B 100%)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: '20px',
        padding: '32px 36px 30px',
        marginBottom: '14px',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Ambient radial glow */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'radial-gradient(ellipse at 80% 0%, rgba(59,130,246,0.04) 0%, transparent 58%)',
        }} />
        {/* Gold bottom accent line */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: '2px',
          background: 'linear-gradient(90deg, transparent 0%, rgba(59,130,246,0.3) 40%, rgba(59,130,246,0.3) 60%, transparent 100%)',
        }} />

        <div style={{ position: 'relative', zIndex: 1 }}>

          {/* Top: branch name + status badge */}
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            alignItems: 'flex-start', marginBottom: '22px',
          }}>
            <div>
              <div style={{
                fontSize: '11px', fontWeight: '600', letterSpacing: '0.12em',
                textTransform: 'uppercase', color: 'rgba(241,245,249,0.35)',
                marginBottom: '5px',
              }}>
                {branch?.name ?? 'Branch'}
              </div>
              <div style={{
                fontSize: '19px', fontWeight: '600', color: '#F0ECE4',
                letterSpacing: '-0.015em',
              }}>
                {period}
              </div>
              <div style={{ fontSize: '12px', color: 'rgba(240,236,228,0.36)', marginTop: '4px' }}>
                {isFixedRent ? 'Fixed rent' : 'Revenue share'}
                {report.is_vat_registered_snapshot ? ` · VAT ${vatPct} registered` : ''}
              </div>
            </div>
            <StatusBadge status={report.status as 'approved'} />
          </div>

          {/* Thin divider */}
          <div style={{ height: '1px', background: 'rgba(255,255,255,0.07)', marginBottom: '26px' }} />

          {/* Payout hero number */}
          <div>
            <div style={{
              fontSize: '11px', fontWeight: '600', letterSpacing: '0.12em',
              textTransform: 'uppercase', color: 'rgba(240,236,228,0.3)',
              marginBottom: '10px',
            }}>
              Final Payout
            </div>
            <div style={{
              fontSize: '54px', fontWeight: '700', color: '#F1F5F9',
              letterSpacing: '-0.035em', lineHeight: '1',
              fontVariantNumeric: 'tabular-nums',
            }}>
              {formatTHB(Number(report.final_payout))}
            </div>
            {hasNeg && (
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                marginTop: '12px', padding: '5px 12px',
                background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)',
                borderRadius: '6px', fontSize: '12px', color: '#F59E0B',
              }}>
                Refunds exceeded revenue — payout reduced to ฿0.00
              </div>
            )}
          </div>

          {/* Approval / payment timestamps */}
          {(report.approved_at || report.paid_at) && (
            <div style={{ display: 'flex', gap: '24px', marginTop: '22px', flexWrap: 'wrap' }}>
              {report.approved_at && (
                <span style={{ fontSize: '12px', color: 'rgba(240,236,228,0.3)' }}>
                  Approved{' '}
                  <span style={{ color: 'rgba(240,236,228,0.52)' }}>{formatFullDate(report.approved_at)}</span>
                </span>
              )}
              {report.paid_at && (
                <span style={{ fontSize: '12px', color: 'rgba(240,236,228,0.3)' }}>
                  Paid{' '}
                  <span style={{ color: 'rgba(240,236,228,0.52)' }}>{formatFullDate(report.paid_at)}</span>
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Partnership banner ─────────────────────────────────────────────── */}
      {branchStartLocal && (
        <div style={{
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: '14px', padding: '14px 20px',
          marginBottom: '14px',
          display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap',
        }}>
          <div style={{
            width: '6px', height: '6px', borderRadius: '50%',
            background: 'rgba(59,130,246,0.55)', flexShrink: 0,
          }} />
          <span style={{ fontSize: '13px', color: 'rgba(241,245,249,0.4)', fontWeight: '500' }}>
            Partner since
          </span>
          <span style={{ fontSize: '13px', color: '#F1F5F9', fontWeight: '600' }}>
            {formatFullDate(branchStartLocal)}
          </span>
          <span style={{ fontSize: '12px', color: 'rgba(241,245,249,0.3)', marginLeft: '2px' }}>
            · {formatDuration(branchStartLocal)}
          </span>
        </div>
      )}

      {/* ── KPI strip ─────────────────────────────────────────────────────── */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '12px', marginBottom: '14px',
      }}>
        <KpiCard
          label="Gross Sales"
          value={formatTHB(Number(report.gross_sales))}
        />
        <KpiCard
          label="Platform Fee"
          value={`− ${formatTHB(Number(report.total_opn_fee))}`}
          muted
        />
        {isFixedRent ? (
          <KpiCard
            label="Fixed Rent"
            value={formatTHB(Number(report.fixed_rent_snapshot ?? 0))}
          />
        ) : (
          <KpiCard
            label="Your NET"
            value={formatTHB(Number(report.total_net))}
          />
        )}
        <KpiCard
          label="Transactions"
          value={report.total_transaction_count.toLocaleString()}
          sub="orders this month"
        />
      </div>

      {/* ── Daily Trend Chart — below KPI strip ──────────────────────────── */}
      {dailyData.some(d => d.orders > 0) && (
        <div style={{ marginBottom: '14px' }}>
          <DailyTrendChart
            data={dailyData}
            month={report.reporting_month}
            year={report.reporting_year}
          />
        </div>
      )}

      {/* ── Two-column: breakdown + details ───────────────────────────────── */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr',
        gap: '14px', marginBottom: '14px',
      }}>

        {/* Payout calculation ledger */}
        <div style={{
          background: '#0D0F1A', border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '16px', padding: '28px',
        }}>
          <h2 style={{
            margin: '0 0 20px', fontSize: '11px', fontWeight: '600',
            letterSpacing: '0.1em', textTransform: 'uppercase',
            color: 'rgba(240,236,228,0.3)',
          }}>
            Payout Calculation
          </h2>
          {isFixedRent ? <FixedRentFlow /> : <RevenueShareFlow />}
        </div>

        {/* Right column: report details + optional refund */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

          {/* Report details */}
          <div style={{
            background: '#0D0F1A', border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '16px', padding: '28px', flex: 1,
          }}>
            <h2 style={{
              margin: '0 0 20px', fontSize: '11px', fontWeight: '600',
              letterSpacing: '0.1em', textTransform: 'uppercase',
              color: 'rgba(240,236,228,0.3)',
            }}>
              Report Details
            </h2>
            <ROW label="Reporting Period" value={period} />
            <ROW label="Payout Model"     value={isFixedRent ? 'Fixed rent' : 'Revenue share'} />
            <ROW label="VAT"              value={
              report.is_vat_registered_snapshot
                ? `Registered (${vatPct})`
                : 'Not registered'
            } />
            <ROW label="Transactions"     value={report.total_transaction_count.toLocaleString()} />
            {report.approved_at && (
              <ROW label="Approved" value={formatFullDate(report.approved_at)} />
            )}
            {report.paid_at && (
              <ROW label="Paid" value={formatFullDate(report.paid_at)} />
            )}
          </div>

          {/* Refund card — only when a refund exists */}
          {refund && (
            <div style={{
              background: '#0D0F1A',
              border: '1px solid rgba(239,68,68,0.15)',
              borderRadius: '16px', padding: '28px',
            }}>
              <h2 style={{
                margin: '0 0 20px', fontSize: '11px', fontWeight: '600',
                letterSpacing: '0.1em', textTransform: 'uppercase',
                color: 'rgba(239,68,68,0.5)',
              }}>
                Business Refund Applied
              </h2>
              <ROW label="Amount"    value={`− ${formatTHB(Number(refund.amount))}`} warning />
              <ROW label="Reason"    value={refund.reason} />
              {refund.reference_number && (
                <ROW label="Reference" value={refund.reference_number} />
              )}
              <p style={{
                marginTop: '14px', marginBottom: 0,
                fontSize: '11px', color: 'rgba(240,236,228,0.28)', lineHeight: '1.65',
              }}>
                Deducted from your revenue before calculating your payout.
              </p>
            </div>
          )}

        </div>
      </div>

      {/* ── Artist Breakdown ───────────────────────────────────────────────── */}
      {artists.length > 0 && (
        <div style={{
          background: '#0D0F1A', border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '16px', padding: '28px', marginBottom: '14px',
        }}>
          <h2 style={{
            margin: '0 0 20px', fontSize: '11px', fontWeight: '600',
            letterSpacing: '0.1em', textTransform: 'uppercase',
            color: 'rgba(240,236,228,0.3)',
          }}>
            Artist Performance
          </h2>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                {[
                  { h: '#',          align: 'left'  as const, w: '36px'  },
                  { h: 'Artist',     align: 'left'  as const, w: undefined },
                  { h: 'Orders',     align: 'right' as const, w: '80px'  },
                  { h: 'Gross',      align: 'right' as const, w: '120px' },
                  { h: 'NET',        align: 'right' as const, w: '120px' },
                  ...(hasUplift ? [{ h: 'Uplift', align: 'right' as const, w: '120px' }] : []),
                ].map(col => (
                  <th key={col.h} style={{
                    padding: '0 0 12px', textAlign: col.align,
                    fontSize: '10px', fontWeight: '600', letterSpacing: '0.08em',
                    textTransform: 'uppercase', color: 'rgba(240,236,228,0.28)',
                    width: col.w,
                  }}>
                    {col.h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {artists.map((a, idx) => {
                // Use the admin-set snapshot (referred_artist_uplift_snapshot on the report)
                // rather than artist_summaries.referral_uplift_amount which is never populated
                const upliftEntry  = upliftEntries.find(e => e.artist_name === a.artist_name)
                const artistUplift = upliftEntry ? (upliftEntry.uplift_base + upliftEntry.uplift_vat) : 0
                return (
                <tr key={a.id} style={{
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                  background: idx === 0 ? 'rgba(59,130,246,0.025)' : 'transparent',
                }}>
                  {/* Rank */}
                  <td style={{ padding: '15px 0', verticalAlign: 'middle' }}>
                    <span style={{
                      fontSize: '12px', fontWeight: '700',
                      color: idx === 0 ? '#F1F5F9' : 'rgba(241,245,249,0.18)',
                    }}>
                      {idx + 1}
                    </span>
                  </td>
                  {/* Artist name + avatar */}
                  <td style={{ padding: '15px 16px 15px 0', verticalAlign: 'middle' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '13px' }}>
                      <ArtistAvatar name={a.artist_name} imageUrl={a.artist_image_url} size={42} />
                      <span style={{
                        fontSize: '14px',
                        fontWeight: idx === 0 ? '600' : '400',
                        color: idx === 0 ? '#F0ECE4' : 'rgba(240,236,228,0.75)',
                      }}>
                        {a.artist_name === '(Unknown)' ? '—' : a.artist_name}
                      </span>
                    </div>
                  </td>
                  {/* Orders */}
                  <td style={{
                    padding: '15px 0', textAlign: 'right', verticalAlign: 'middle',
                    fontSize: '14px', color: 'rgba(240,236,228,0.55)',
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    {a.order_count}
                  </td>
                  {/* Gross */}
                  <td style={{
                    padding: '15px 0', textAlign: 'right', verticalAlign: 'middle',
                    fontSize: '14px', color: 'rgba(240,236,228,0.55)',
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    {formatTHB(Number(a.gross_sales))}
                  </td>
                  {/* NET */}
                  <td style={{
                    padding: '15px 0', textAlign: 'right', verticalAlign: 'middle',
                    fontSize: '14px', color: 'rgba(240,236,228,0.55)',
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    {formatTHB(Number(a.total_net))}
                  </td>
                  {/* Uplift (only shown when hasUplift) */}
                  {hasUplift && (
                    <td style={{
                      padding: '15px 0', textAlign: 'right', verticalAlign: 'middle',
                      fontSize: '14px', fontVariantNumeric: 'tabular-nums',
                      color: artistUplift > 0 ? 'rgba(59,130,246,0.85)' : 'rgba(241,245,249,0.2)',
                    }}>
                      {artistUplift > 0 ? `+${formatTHB(artistUplift)}` : '—'}
                    </td>
                  )}
                </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}


    </div>
  )
}
