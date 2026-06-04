import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { formatTHB } from '@/lib/utils/currency'
import { formatFullDate, formatDuration, formatReportingPeriod } from '@/lib/utils/date'
import { PartnerReportsFilter } from '@/components/partner/PartnerReportsFilter'
import { MonthlyTrendChart } from '@/components/partner/MonthlyTrendChart'
import { MonthPicker } from '@/components/admin/MonthPicker'
import { SwipeMonthWrapper } from '@/components/admin/SwipeMonthWrapper'
import type { FilterableReport } from '@/components/partner/PartnerReportsFilter'
import type { MonthPoint } from '@/components/partner/MonthlyTrendChart'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Overview' }
export const dynamic = 'force-dynamic'

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Parse "YYYY-MM-DD" as local midnight — avoids UTC-midnight timezone drift */
function parseLocalDate(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** Parse ?month=YYYY-MM. Returns null if missing/invalid so a fallback can be chosen. */
function parseMonthParam(raw: string | undefined): { year: number; month: number; value: string } | null {
  if (!raw || !/^\d{4}-\d{2}$/.test(raw)) return null
  const [y, m] = raw.split('-').map(Number)
  if (!y || !m || m < 1 || m > 12) return null
  return { year: y, month: m, value: raw }
}

function makeMonth(year: number, month: number) {
  return { year, month, value: `${year}-${String(month).padStart(2, '0')}` }
}

function currentMonth() {
  const now = new Date()
  return makeMonth(now.getFullYear(), now.getMonth() + 1)
}

function prevMonth(year: number, month: number) {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 }
}

function deltaBadge(current: number, prev: number): { label: string; color: string; bg: string } {
  if (prev === 0) return { label: 'No prev data', color: 'rgba(255,255,255,.3)', bg: 'rgba(255,255,255,.06)' }
  const pct = ((current - prev) / prev) * 100
  if (Math.abs(pct) < 0.5) return { label: 'Same as last month', color: 'rgba(255,255,255,.35)', bg: 'rgba(255,255,255,.06)' }
  const up = pct > 0
  return {
    label: `${up ? '+' : ''}${pct.toFixed(1)}% vs last month`,
    color: up ? '#34d399' : '#f87171',
    bg:    up ? 'rgba(16,185,129,.12)' : 'rgba(239,68,68,.12)',
  }
}

function monthLabel(year: number, month: number) {
  const d = new Date(year, month - 1, 1)
  return d.toLocaleString('en-US', { month: 'long', year: 'numeric' })
}

// ── Design tokens ─────────────────────────────────────────────────────────────

const CARD: React.CSSProperties = {
  background:   '#0C1018',
  border:       '1px solid rgba(255,255,255,0.07)',
  borderRadius: '12px',
  overflow:     'hidden',
  position:     'relative',
}

// Shared glow layer elements (rendered inside each card)
const GRID_BG: React.CSSProperties = {
  position:        'absolute',
  inset:           0,
  backgroundImage: [
    'linear-gradient(rgba(59,130,246,0.055) 1px, transparent 1px)',
    'linear-gradient(90deg, rgba(59,130,246,0.055) 1px, transparent 1px)',
  ].join(','),
  backgroundSize:        '28px 28px',
  WebkitMaskImage:       'linear-gradient(to top, rgba(0,0,0,0.5) 0%, transparent 60%)',
  maskImage:             'linear-gradient(to top, rgba(0,0,0,0.5) 0%, transparent 60%)',
  pointerEvents:         'none',
  borderRadius:          'inherit',
}
const GLOW_SPREAD: React.CSSProperties = {
  position:      'absolute',
  bottom:        0,
  left:          0,
  right:         0,
  height:        '72px',
  background:    'radial-gradient(ellipse at 50% 100%, rgba(59,130,246,0.13) 0%, transparent 70%)',
  pointerEvents: 'none',
}
const GLOW_LINE: React.CSSProperties = {
  position:      'absolute',
  bottom:        '-1px',
  left:          '12%',
  right:         '12%',
  height:        '1px',
  background:    'linear-gradient(90deg, transparent, rgba(59,130,246,0.7), transparent)',
  pointerEvents: 'none',
}
const TOP_SHIMMER: React.CSSProperties = {
  position:      'absolute',
  top:           0,
  left:          0,
  right:         0,
  height:        '1px',
  background:    'linear-gradient(90deg, transparent, rgba(255,255,255,0.07), transparent)',
  pointerEvents: 'none',
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function PartnerOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { month: monthParam } = await searchParams
  const monthFromUrl = parseMonthParam(monthParam)

  const { data: profile } = await supabase
    .from('profiles')
    .select('partner_id')
    .eq('id', user.id)
    .single()

  if (!profile?.partner_id) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', color: 'rgba(240,236,228,0.3)', fontSize: '14px' }}>
        Your account has not been linked to a partner yet. Please contact your administrator.
      </div>
    )
  }

  // ── Branches ────────────────────────────────────────────────────────────────
  const { data: branches } = await supabase
    .from('branches')
    .select('id, name, partnership_start_date')
    .eq('partner_id', profile.partner_id)
    .eq('is_active', true)

  const branchIds   = (branches ?? []).map(b => b.id)
  const branchNames = Object.fromEntries((branches ?? []).map(b => [b.id, b.name]))

  const partnerStartDate: string | null = (branches ?? [])
    .map(b => b.partnership_start_date)
    .filter((d): d is string => Boolean(d))
    .sort()[0] ?? null

  if (branchIds.length === 0) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', color: 'rgba(240,236,228,0.3)', fontSize: '14px' }}>
        No active branches. Contact your administrator to set up your branch.
      </div>
    )
  }

  // ── Reports ─────────────────────────────────────────────────────────────────
  const { data: rawReports } = await supabase
    .from('monthly_reports')
    .select(`
      id, reporting_month, reporting_year, status,
      final_payout, payout_type_snapshot,
      approved_at, paid_at,
      branch_id
    `)
    .in('branch_id', branchIds)
    .in('status', ['approved', 'paid'])
    .order('reporting_year',  { ascending: false })
    .order('reporting_month', { ascending: false })

  const reports: FilterableReport[] = (rawReports ?? []).map(r => ({
    id:                   r.id,
    reporting_month:      r.reporting_month,
    reporting_year:       r.reporting_year,
    status:               r.status,
    final_payout:         r.final_payout,
    payout_type_snapshot: r.payout_type_snapshot,
    approved_at:          r.approved_at,
    paid_at:              r.paid_at,
    branch_name:          branchNames[r.branch_id] ?? '—',
  }))

  // ── Default month selection ─────────────────────────────────────────────────
  // Priority: URL param > latest month with an approved/paid report > current month
  const latestReport = rawReports?.[0]
  const sel  = monthFromUrl
    ?? (latestReport ? makeMonth(latestReport.reporting_year, latestReport.reporting_month) : currentMonth())
  const prev = prevMonth(sel.year, sel.month)

  // ── Monthly-filtered KPIs (selected month + prev month MoM) ─────────────────
  const currMonthReports = reports.filter(r => r.reporting_year === sel.year && r.reporting_month === sel.month)
  const prevMonthReports = reports.filter(r => r.reporting_year === prev.year && r.reporting_month === prev.month)

  const currMonthPayout = currMonthReports.reduce((s, r) => s + Number(r.final_payout ?? 0), 0)
  const prevMonthPayout = prevMonthReports.reduce((s, r) => s + Number(r.final_payout ?? 0), 0)
  const momDelta = deltaBadge(currMonthPayout, prevMonthPayout)

  // ── KPI aggregates ───────────────────────────────────────────────────────────
  const paidReports     = reports.filter(r => r.status === 'paid')
  const approvedReports = reports.filter(r => r.status === 'approved')

  const totalPayout     = paidReports.reduce((s, r) => s + Number(r.final_payout ?? 0), 0)
  const awaitingPayment = approvedReports.reduce((s, r) => s + Number(r.final_payout ?? 0), 0)
  const paidCount       = paidReports.length
  const totalCount      = reports.length
  const avgPerMonth     = paidCount > 0 ? totalPayout / paidCount : 0

  // ── Monthly trend ────────────────────────────────────────────────────────────
  const monthMap = new Map<string, { paid: number; approved: number; month: number; year: number }>()

  for (const r of reports) {
    const key = `${r.reporting_year}-${String(r.reporting_month).padStart(2, '0')}`
    if (!monthMap.has(key)) {
      monthMap.set(key, { paid: 0, approved: 0, month: r.reporting_month, year: r.reporting_year })
    }
    const entry = monthMap.get(key)!
    const payout = Number(r.final_payout ?? 0)
    if (r.status === 'paid') entry.paid     += payout
    else                     entry.approved += payout
  }

  const trendData: MonthPoint[] = Array.from(monthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => ({
      label:          formatReportingPeriod(v.month, v.year),
      shortLabel:     new Date(v.year, v.month - 1, 1).toLocaleString('en-US', { month: 'short' }),
      paidPayout:     v.paid,
      approvedPayout: v.approved,
      totalPayout:    v.paid + v.approved,
    }))

  // ── KPI metric definitions ────────────────────────────────────────────────────
  const kpis = [
    {
      label: 'Total Earned',
      value: formatTHB(totalPayout),
      sub:   'Paid reports only',
      color: '#F1F5F9',
    },
    {
      label: 'Awaiting Payment',
      value: awaitingPayment > 0 ? formatTHB(awaitingPayment) : '—',
      sub:   `${approvedReports.length} approved, unpaid`,
      color: awaitingPayment > 0 ? '#F1F5F9' : 'rgba(241,245,249,0.35)',
    },
    {
      label: 'Total Reports',
      value: String(totalCount),
      sub:   `${paidCount} paid · ${approvedReports.length} approved`,
      color: 'rgba(241,245,249,0.75)',
    },
    {
      label: 'Avg / Month',
      value: paidCount > 0 ? formatTHB(avgPerMonth) : '—',
      sub:   'Based on paid months',
      color: '#F1F5F9',
    },
  ]

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <SwipeMonthWrapper currentMonth={sel.value}>
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>

      {/* ── Monthly Selector + MoM Card ──────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <MonthPicker selectedMonth={sel.value} />
        <div style={{
          marginLeft: 'auto', fontSize: '11px', color: 'rgba(241,245,249,0.25)',
          letterSpacing: '0.04em', textTransform: 'uppercase', whiteSpace: 'nowrap',
        }}>
          Swipe ← → to change month
        </div>
      </div>

      {/* Monthly payout card */}
      <div style={{ ...CARD, padding: '20px 24px' }}>
        <div style={GRID_BG} />
        <div style={GLOW_SPREAD} />
        <div style={GLOW_LINE} />
        <div style={TOP_SHIMMER} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(241,245,249,0.35)', marginBottom: '4px', fontWeight: 600 }}>
            {monthLabel(sel.year, sel.month)}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ fontSize: '36px', fontWeight: 800, color: currMonthPayout > 0 ? '#F1F5F9' : 'rgba(241,245,249,0.2)', letterSpacing: '-0.03em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
              {currMonthPayout > 0 ? formatTHB(currMonthPayout) : 'No data'}
            </div>
            <span style={{ fontSize: '12px', fontWeight: 600, padding: '3px 10px', borderRadius: '20px', background: momDelta.bg, color: momDelta.color, whiteSpace: 'nowrap' }}>
              {momDelta.label}
            </span>
          </div>
          <div style={{ marginTop: '6px', fontSize: '12px', color: 'rgba(241,245,249,0.3)' }}>
            {currMonthReports.length} {currMonthReports.length === 1 ? 'report' : 'reports'} this month
            {prevMonthPayout > 0 && (
              <span style={{ marginLeft: '12px', color: 'rgba(241,245,249,0.18)' }}>
                Prev: {formatTHB(prevMonthPayout)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Layer 2: Unified Hero + KPI Card ────────────────────────────────── */}
      <div style={CARD}>
        <div style={GRID_BG} />
        <div style={GLOW_SPREAD} />
        <div style={GLOW_LINE} />
        <div style={TOP_SHIMMER} />

        {/* Hero section */}
        <div className="hero-section" style={{ padding: '24px 28px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '24px', flexWrap: 'wrap', position: 'relative', zIndex: 1 }}>

          {/* Left — primary earnings figure */}
          <div>
            <div style={{
              fontSize:      '10px',
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color:         'rgba(241,245,249,0.35)',
              marginBottom:  '8px',
              fontWeight:    '600',
            }}>
              Total Lifetime Earnings
            </div>
            <div className="hero-amount" style={{
              fontSize:           '44px',
              fontWeight:         '800',
              color:              '#F1F5F9',
              letterSpacing:      '-0.03em',
              lineHeight:         1,
              fontVariantNumeric: 'tabular-nums',
            }}>
              {formatTHB(totalPayout)}
            </div>
            <div style={{ marginTop: '6px', fontSize: '11px', color: 'rgba(241,245,249,0.25)', letterSpacing: '0.01em' }}>
              {paidCount} paid {paidCount === 1 ? 'report' : 'reports'} · cumulative paid out
            </div>
          </div>

          {/* Right — secondary stats */}
          <div className="hero-right-stats" style={{ display: 'flex', gap: '32px', flexWrap: 'wrap', paddingTop: '4px' }}>

            {awaitingPayment > 0 && (
              <div>
                <div style={{ fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(241,245,249,0.3)', marginBottom: '6px' }}>
                  Awaiting Payment
                </div>
                <div style={{ fontSize: '20px', fontWeight: '700', color: '#F1F5F9', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>
                  {formatTHB(awaitingPayment)}
                </div>
                <div style={{ fontSize: '11px', color: 'rgba(241,245,249,0.22)', marginTop: '3px' }}>
                  {approvedReports.length} {approvedReports.length === 1 ? 'report' : 'reports'} approved
                </div>
              </div>
            )}

            {partnerStartDate && (
              <div>
                <div style={{ fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(241,245,249,0.3)', marginBottom: '6px' }}>
                  Partner Since
                </div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: 'rgba(241,245,249,0.6)', letterSpacing: '-0.01em' }}>
                  {formatFullDate(parseLocalDate(partnerStartDate))}
                </div>
                <div style={{ fontSize: '11px', color: 'rgba(241,245,249,0.25)', marginTop: '3px' }}>
                  {formatDuration(partnerStartDate)}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── KPI metric row — inside the card, separated by hairline ── */}
        <div style={{ height: '1px', background: 'rgba(255,255,255,0.05)', margin: '0', position: 'relative', zIndex: 1 }} />

        <div className="kpi-mini-row" style={{ position: 'relative', zIndex: 1 }}>
          {kpis.map(({ label, value, sub, color }, idx) => (
            <div key={label} style={{
              padding:     '16px 24px',
              borderRight: idx < 3 ? '1px solid rgba(255,255,255,0.05)' : 'none',
            }}>
              <div style={{
                fontSize:      '10px',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color:         'rgba(241,245,249,0.3)',
                marginBottom:  '6px',
                fontWeight:    '500',
              }}>
                {label}
              </div>
              <div style={{
                fontSize:           '22px',
                fontWeight:         '700',
                color,
                letterSpacing:      '-0.02em',
                lineHeight:         1.1,
                fontVariantNumeric: 'tabular-nums',
                marginBottom:       '4px',
              }}>
                {value}
              </div>
              <div style={{ fontSize: '11px', color: 'rgba(241,245,249,0.22)' }}>
                {sub}
              </div>
            </div>
          ))}
        </div>

      </div>

      {/* ── Layer 2: Monthly Trend Chart ────────────────────────────────────── */}
      {trendData.length > 0 && (
        <MonthlyTrendChart data={trendData} />
      )}

      {/* ── Layer 2: Reports Table ───────────────────────────────────────────── */}
      {reports.length === 0 ? (
        <div style={{ ...CARD, padding: '64px 32px', textAlign: 'center' }}>
          <div style={GRID_BG} />
          <div style={GLOW_SPREAD} />
          <div style={GLOW_LINE} />
          <div style={{ fontSize: '24px', marginBottom: '12px', opacity: 0.2, position: 'relative', zIndex: 1 }}>◫</div>
          <p style={{ fontSize: '14px', fontWeight: '600', color: 'rgba(241,245,249,0.28)', margin: 0, position: 'relative', zIndex: 1 }}>
            No reports yet
          </p>
          <p style={{ fontSize: '12px', color: 'rgba(241,245,249,0.18)', margin: '6px 0 0', position: 'relative', zIndex: 1 }}>
            Monthly payout reports appear here once approved.
          </p>
        </div>
      ) : (
        <PartnerReportsFilter reports={reports} totalCount={totalCount} />
      )}

    </div>
    </SwipeMonthWrapper>
  )
}
