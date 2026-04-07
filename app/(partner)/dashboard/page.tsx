import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { formatTHB } from '@/lib/utils/currency'
import { formatFullDate, formatDuration, formatReportingPeriod } from '@/lib/utils/date'
import { PartnerReportsFilter } from '@/components/partner/PartnerReportsFilter'
import { MonthlyTrendChart } from '@/components/partner/MonthlyTrendChart'
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

// ── Design tokens ─────────────────────────────────────────────────────────────

const CARD: React.CSSProperties = {
  background:   '#0D0F1A',
  border:       '1px solid rgba(255,255,255,0.06)',
  borderRadius: '20px',
  boxShadow:    '0 1px 0 rgba(255,255,255,0.05) inset, 0 12px 40px rgba(0,0,0,0.4)',
  overflow:     'hidden',
  position:     'relative',
}

// ── Page ──────────────────────────────────────────────────────────────────────

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

      {/* ── Layer 2: Unified Hero + KPI Card ────────────────────────────────── */}
      <div style={CARD}>

        {/* Ambient radial glow — top right corner */}
        <div style={{
          position:      'absolute', top: '-60px', right: '-20px',
          width:         '340px',   height: '260px',
          background:    'radial-gradient(ellipse at top right, rgba(59,130,246,0.05) 0%, transparent 65%)',
          pointerEvents: 'none',
        }} />

        {/* Hero section */}
        <div style={{ padding: '32px 32px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '24px', flexWrap: 'wrap' }}>

          {/* Left — primary earnings figure */}
          <div>
            <div style={{
              fontSize:      '10px',
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              color:         'rgba(241,245,249,0.35)',
              marginBottom:  '10px',
              fontWeight:    '600',
            }}>
              Total Lifetime Earnings
            </div>
            <div style={{
              fontSize:           '52px',
              fontWeight:         '800',
              color:              '#F1F5F9',
              letterSpacing:      '-0.03em',
              lineHeight:         1,
              fontVariantNumeric: 'tabular-nums',
            }}>
              {formatTHB(totalPayout)}
            </div>
            <div style={{ marginTop: '9px', fontSize: '12px', color: 'rgba(240,236,228,0.28)', letterSpacing: '0.01em' }}>
              {paidCount} paid {paidCount === 1 ? 'report' : 'reports'} · cumulative paid out
            </div>
          </div>

          {/* Right — secondary stats */}
          <div style={{ display: 'flex', gap: '40px', flexWrap: 'wrap', paddingTop: '2px' }}>

            {awaitingPayment > 0 && (
              <div>
                <div style={{ fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(240,236,228,0.28)', marginBottom: '7px' }}>
                  Awaiting Payment
                </div>
                <div style={{ fontSize: '22px', fontWeight: '700', color: '#F1F5F9', fontVariantNumeric: 'tabular-nums' }}>
                  {formatTHB(awaitingPayment)}
                </div>
                <div style={{ fontSize: '11px', color: 'rgba(240,236,228,0.24)', marginTop: '4px' }}>
                  {approvedReports.length} {approvedReports.length === 1 ? 'report' : 'reports'} approved
                </div>
              </div>
            )}

            {partnerStartDate && (
              <div>
                <div style={{ fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(240,236,228,0.28)', marginBottom: '7px' }}>
                  Partner Since
                </div>
                <div style={{ fontSize: '15px', fontWeight: '600', color: 'rgba(240,236,228,0.65)', letterSpacing: '-0.01em' }}>
                  {formatFullDate(parseLocalDate(partnerStartDate))}
                </div>
                <div style={{ fontSize: '11px', color: 'rgba(240,236,228,0.28)', marginTop: '4px' }}>
                  {formatDuration(partnerStartDate)}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Layer 3: KPI metric row — inside the card, separated by divider ── */}
        <div style={{ height: '1px', background: 'rgba(255,255,255,0.055)', margin: '0' }} />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)' }}>
          {kpis.map(({ label, value, sub, color }, idx) => (
            <div key={label} style={{
              padding:     '22px 28px',
              borderRight: idx < 3 ? '1px solid rgba(255,255,255,0.05)' : 'none',
            }}>
              <div style={{
                fontSize:      '10px',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color:         'rgba(240,236,228,0.3)',
                marginBottom:  '8px',
                fontWeight:    '500',
              }}>
                {label}
              </div>
              <div style={{
                fontSize:           '24px',
                fontWeight:         '700',
                color,
                letterSpacing:      '-0.02em',
                lineHeight:         1.1,
                fontVariantNumeric: 'tabular-nums',
                marginBottom:       '5px',
              }}>
                {value}
              </div>
              <div style={{ fontSize: '11px', color: 'rgba(240,236,228,0.24)' }}>
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
          <div style={{ fontSize: '24px', marginBottom: '12px', opacity: 0.2 }}>◫</div>
          <p style={{ fontSize: '14px', fontWeight: '600', color: 'rgba(240,236,228,0.28)', margin: 0 }}>
            No reports yet
          </p>
          <p style={{ fontSize: '12px', color: 'rgba(240,236,228,0.18)', margin: '6px 0 0' }}>
            Monthly payout reports appear here once approved.
          </p>
        </div>
      ) : (
        <PartnerReportsFilter reports={reports} totalCount={totalCount} />
      )}

    </div>
  )
}
