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
      <div style={{ padding: '60px', textAlign: 'center', color: 'rgba(240,236,228,0.35)', fontSize: '14px' }}>
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

  // Earliest partnership start date across all active branches
  const partnerStartDate: string | null = (branches ?? [])
    .map(b => b.partnership_start_date)
    .filter((d): d is string => Boolean(d))
    .sort()[0] ?? null

  if (branchIds.length === 0) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', color: 'rgba(240,236,228,0.35)', fontSize: '14px' }}>
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

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>

      {/* ── Financial Hero Card ─────────────────────────────────────────────── */}
      <div style={{
        background:   'linear-gradient(140deg, #10132A 0%, #0D0F1A 55%, #12100C 100%)',
        border:       '1px solid rgba(196,163,94,0.16)',
        borderRadius: '20px',
        padding:      '32px 36px',
        position:     'relative',
        overflow:     'hidden',
      }}>
        {/* Ambient glow — top-right */}
        <div style={{
          position:      'absolute', top: '-80px', right: '60px',
          width:         '280px',   height: '280px',
          background:    'radial-gradient(ellipse, rgba(196,163,94,0.08) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
        {/* Gold bottom accent line */}
        <div style={{
          position:   'absolute', bottom: 0, left: '6%', right: '6%', height: '1px',
          background: 'linear-gradient(90deg, transparent, rgba(196,163,94,0.32), transparent)',
        }} />

        <div style={{
          display:    'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap:        '32px',
          flexWrap:   'wrap',
        }}>
          {/* Left — main earnings figure */}
          <div>
            <div style={{
              fontSize:      '10px',
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color:         'rgba(196,163,94,0.55)',
              marginBottom:  '10px',
              fontWeight:    '600',
            }}>
              Total Lifetime Earnings
            </div>
            <div style={{
              fontSize:           '54px',
              fontWeight:         '800',
              color:              '#C4A35E',
              letterSpacing:      '-0.03em',
              lineHeight:         1,
              fontVariantNumeric: 'tabular-nums',
            }}>
              {formatTHB(totalPayout)}
            </div>
            <div style={{
              marginTop: '10px',
              fontSize:  '13px',
              color:     'rgba(240,236,228,0.35)',
            }}>
              {paidCount} paid {paidCount === 1 ? 'report' : 'reports'} · paid out to date
            </div>
          </div>

          {/* Right — supplementary stats */}
          <div style={{ display: 'flex', gap: '36px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            {awaitingPayment > 0 && (
              <div>
                <div style={{
                  fontSize:      '10px',
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color:         'rgba(240,236,228,0.3)',
                  marginBottom:  '5px',
                }}>
                  Awaiting Payment
                </div>
                <div style={{
                  fontSize:           '22px',
                  fontWeight:         '700',
                  color:              '#F59E0B',
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {formatTHB(awaitingPayment)}
                </div>
                <div style={{ fontSize: '11px', color: 'rgba(240,236,228,0.25)', marginTop: '3px' }}>
                  {approvedReports.length} approved {approvedReports.length === 1 ? 'report' : 'reports'}
                </div>
              </div>
            )}

            {partnerStartDate && (
              <div>
                <div style={{
                  fontSize:      '10px',
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color:         'rgba(240,236,228,0.3)',
                  marginBottom:  '5px',
                }}>
                  Partner Since
                </div>
                <div style={{
                  fontSize:   '15px',
                  fontWeight: '600',
                  color:      'rgba(240,236,228,0.7)',
                }}>
                  {formatFullDate(parseLocalDate(partnerStartDate))}
                </div>
                <div style={{ fontSize: '12px', color: 'rgba(240,236,228,0.32)', marginTop: '3px' }}>
                  {formatDuration(partnerStartDate)}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── KPI Strip ───────────────────────────────────────────────────────── */}
      <div style={{
        display:             'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap:                 '12px',
      }}>
        {([
          {
            label:  'Total Earned',
            value:  formatTHB(totalPayout),
            sub:    'Paid reports only',
            accent: '#C4A35E' as const,
          },
          {
            label:  'Awaiting Payment',
            value:  awaitingPayment > 0 ? formatTHB(awaitingPayment) : '—',
            sub:    'Approved, not yet paid',
            accent: awaitingPayment > 0 ? '#F59E0B' as const : 'rgba(240,236,228,0.35)' as const,
          },
          {
            label:  'Total Reports',
            value:  String(totalCount),
            sub:    `${paidCount} paid · ${approvedReports.length} approved`,
            accent: 'rgba(240,236,228,0.6)' as const,
          },
          {
            label:  'Avg per Month',
            value:  paidCount > 0 ? formatTHB(avgPerMonth) : '—',
            sub:    'Based on paid months',
            accent: '#C4A35E' as const,
          },
        ] as { label: string; value: string; sub: string; accent: string }[]).map(({ label, value, sub, accent }) => (
          <div key={label} style={{
            background:   '#0D0F1A',
            border:       '1px solid rgba(255,255,255,0.06)',
            borderRadius: '16px',
            padding:      '22px 24px',
            position:     'relative',
            overflow:     'hidden',
          }}>
            {/* Top accent line */}
            <div style={{
              position:   'absolute',
              top:        0, left: '18%', right: '18%', height: '1px',
              background: `linear-gradient(90deg, transparent, ${accent}55, transparent)`,
            }} />
            <div style={{
              fontSize:      '10px',
              fontWeight:    '600',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color:         'rgba(240,236,228,0.35)',
              marginBottom:  '10px',
            }}>
              {label}
            </div>
            <div style={{
              fontSize:           '26px',
              fontWeight:         '700',
              color:              accent,
              letterSpacing:      '-0.02em',
              lineHeight:         1.1,
              fontVariantNumeric: 'tabular-nums',
            }}>
              {value}
            </div>
            <div style={{
              fontSize:  '11px',
              color:     'rgba(240,236,228,0.28)',
              marginTop: '6px',
            }}>
              {sub}
            </div>
          </div>
        ))}
      </div>

      {/* ── Monthly Trend Chart ─────────────────────────────────────────────── */}
      {trendData.length > 0 && (
        <MonthlyTrendChart data={trendData} />
      )}

      {/* ── Reports Table ───────────────────────────────────────────────────── */}
      <div>
        {/* Section header */}
        <div style={{
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
          marginBottom:   '14px',
        }}>
          <h2 style={{
            margin:        0,
            fontSize:      '11px',
            fontWeight:    '600',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color:         'rgba(240,236,228,0.35)',
          }}>
            Monthly Reports
          </h2>
          <div style={{ fontSize: '12px', color: 'rgba(240,236,228,0.22)' }}>
            {totalCount} {totalCount === 1 ? 'report' : 'reports'} total
          </div>
        </div>

        {/* Table or empty state */}
        {reports.length === 0 ? (
          <div style={{
            background:   '#0D0F1A',
            border:       '1px solid rgba(255,255,255,0.06)',
            borderRadius: '16px',
            padding:      '60px 24px',
            textAlign:    'center',
          }}>
            <div style={{ fontSize: '28px', marginBottom: '12px', opacity: 0.25 }}>◫</div>
            <p style={{ fontSize: '14px', fontWeight: '600', color: 'rgba(240,236,228,0.3)', margin: 0 }}>
              No reports yet
            </p>
            <p style={{ fontSize: '12px', color: 'rgba(240,236,228,0.18)', margin: '6px 0 0' }}>
              Your monthly payout reports will appear here once they have been approved.
            </p>
          </div>
        ) : (
          <PartnerReportsFilter reports={reports} />
        )}
      </div>

    </div>
  )
}
