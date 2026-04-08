import { createClient } from '@/lib/supabase/server'
import { formatTHB } from '@/lib/utils/currency'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { formatReportingPeriod } from '@/lib/utils/date'
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Overview' }

// Month name helper
function monthName(m: number) {
  return ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m - 1] ?? ''
}

export default async function AdminOverviewPage() {
  const supabase = await createClient()

  const [reportsRes, branchesRes, pendingRes, recentRes] = await Promise.all([
    supabase
      .from('monthly_reports')
      .select('id, status, final_payout, total_net, reporting_month, reporting_year'),
    supabase
      .from('branches')
      .select('id', { count: 'exact' })
      .eq('is_active', true),
    supabase
      .from('monthly_reports')
      .select('id', { count: 'exact' })
      .eq('status', 'pending_review'),
    supabase
      .from('monthly_reports')
      .select('id, status, final_payout, reporting_month, reporting_year, branches(name, partners(name))')
      .order('reporting_year',  { ascending: false })
      .order('reporting_month', { ascending: false })
      .limit(6),
  ])

  const reports  = reportsRes.data  ?? []
  const branches = branchesRes.count ?? 0
  const pending  = pendingRes.count  ?? 0
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recent   = (recentRes.data ?? []) as any[]

  // ── Aggregates ──
  const totalRevenue = reports.reduce((s, r) => s + Number(r.total_net    ?? 0), 0)
  const totalPayout  = reports
    .filter(r => ['approved', 'paid'].includes(r.status))
    .reduce((s, r) => s + Number(r.final_payout ?? 0), 0)
  const netProfit    = totalRevenue - totalPayout

  // ── Payouts due (approved but not yet paid) ──
  const payoutsDue = reports
    .filter(r => r.status === 'approved')
    .reduce((s, r) => s + Number(r.final_payout ?? 0), 0)

  // ── Status counts ──
  const statusCount = reports.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1
    return acc
  }, {})
  const totalReports = reports.length

  // ── Monthly trend (last 6 months) ──
  const now   = new Date()
  const trendMonths: { label: string; year: number; month: number }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    trendMonths.push({ label: monthName(d.getMonth() + 1), year: d.getFullYear(), month: d.getMonth() + 1 })
  }
  const trendValues = trendMonths.map(tm => {
    const sum = reports
      .filter(r => r.reporting_year === tm.year && r.reporting_month === tm.month)
      .reduce((s, r) => s + Number(r.final_payout ?? 0), 0)
    return sum
  })
  const trendMax = Math.max(...trendValues, 1)

  // Build SVG polyline points (600 × 90 viewBox)
  const SVG_W = 600; const SVG_H = 90
  const pts = trendValues.map((v, i) => {
    const x = i === 0 ? 0 : Math.round((i / (trendMonths.length - 1)) * SVG_W)
    const y = Math.round(SVG_H - (v / trendMax) * SVG_H * 0.85 - 4)
    return `${x},${y}`
  }).join(' ')
  const areaPath = `M0,${SVG_H} L${pts.split(' ').map(p => p).join(' L')} L${SVG_W},${SVG_H} Z`
  const linePath = `M${pts.split(' ').join(' L')}`

  // Partner initials helper
  function initial(name: string) { return (name?.[0] ?? '?').toUpperCase() }
  const avatarColors: Record<string, string> = {
    Q: 'rgba(99,102,241,.25)', F: 'rgba(37,99,235,.25)', G: 'rgba(16,185,129,.15)',
    B: 'rgba(245,158,11,.2)', D: 'rgba(239,68,68,.15)', A: 'rgba(139,92,246,.2)',
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700;9..40,800&family=DM+Mono:wght@400;500&display=swap');
        .ov * { font-family: 'DM Sans', sans-serif; box-sizing: border-box; }
        .ov { display: flex; flex-direction: column; gap: 14px; }

        /* Top bar */
        .ov-topbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px; }
        .ov-topbar .t { font-size: 22px; font-weight: 800; letter-spacing: -.03em; color: #fff; }
        .ov-topbar .s { font-size: 12px; color: rgba(255,255,255,.28); margin-top: 2px; }
        .ov-topbar .date-pill { background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.08); border-radius: 20px; padding: 6px 14px; font-size: 11px; color: rgba(255,255,255,.35); }
        .ov-topbar .upload-btn { background: linear-gradient(135deg,#2563eb,#1d4ed8); border: none; border-radius: 20px; padding: 8px 18px; font-size: 12px; font-weight: 700; color: #fff; cursor: pointer; text-decoration: none; box-shadow: 0 4px 20px rgba(37,99,235,.35); display: inline-block; }

        /* Hero row */
        .hero-row { display: grid; grid-template-columns: 1.3fr 1fr 1fr 1fr 1fr; gap: 12px; }

        /* Hero card */
        .hero-card { position: relative; border-radius: 18px; overflow: hidden; padding: 22px 24px; display: flex; flex-direction: column; justify-content: space-between; min-height: 148px; background: #080b18; border: 1px solid rgba(37,99,235,.25); }
        .hero-card .aurora { position: absolute; inset: 0; pointer-events: none; background: radial-gradient(ellipse 100% 80% at 110% 130%, rgba(37,99,235,.6) 0%, transparent 55%), radial-gradient(ellipse 60% 60% at -10% 90%, rgba(99,102,241,.3) 0%, transparent 55%), radial-gradient(ellipse 50% 50% at 50% 120%, rgba(14,165,233,.2) 0%, transparent 55%); }
        .hero-card .lbl { font-size: 9px; font-weight: 700; letter-spacing: .16em; text-transform: uppercase; color: rgba(147,197,253,.6); position: relative; z-index: 1; }
        .hero-card .amt { font-size: 30px; font-weight: 800; letter-spacing: -.04em; color: #fff; line-height: 1.1; position: relative; z-index: 1; text-shadow: 0 0 30px rgba(96,165,250,.4); }
        .hero-card .amt .sym { font-size: 17px; font-weight: 600; color: rgba(255,255,255,.45); margin-right: 1px; }
        .hero-card .foot { display: flex; align-items: center; justify-content: space-between; position: relative; z-index: 1; }
        .hero-card .foot .sub { font-size: 10px; color: rgba(147,197,253,.45); }
        .hero-card .foot .bdg { background: rgba(37,99,235,.3); border: 1px solid rgba(96,165,250,.22); border-radius: 20px; padding: 3px 9px; font-size: 9px; font-weight: 700; color: #93c5fd; }

        /* KPI card */
        .kpi-card { background: #080b18; border: 1px solid rgba(255,255,255,.07); border-radius: 18px; padding: 18px 20px; display: flex; flex-direction: column; justify-content: space-between; position: relative; overflow: hidden; min-height: 148px; }
        .kpi-card .glow { position: absolute; width: 70px; height: 70px; border-radius: 50%; pointer-events: none; filter: blur(24px); opacity: .3; top: -16px; right: -16px; }
        .kpi-card .k { font-size: 9px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; color: rgba(255,255,255,.28); margin-bottom: 8px; }
        .kpi-card .v { font-size: 26px; font-weight: 800; letter-spacing: -.03em; color: #fff; line-height: 1; }
        .kpi-card .v.sm { font-size: 18px; }
        .kpi-card .tag { display: inline-flex; align-items: center; font-size: 10px; font-weight: 600; padding: 3px 9px; border-radius: 20px; margin-top: 10px; }
        .tag-warn  { background: rgba(245,158,11,.12); color: #fbbf24; }
        .tag-ok    { background: rgba(16,185,129,.1);  color: #34d399; }
        .tag-muted { background: rgba(255,255,255,.05); color: rgba(255,255,255,.3); }
        .tag-blue  { background: rgba(37,99,235,.15); color: #93c5fd; }
        .tag-profit { background: rgba(16,185,129,.1); color: #34d399; }

        /* Mid row */
        .mid-row { display: grid; grid-template-columns: 1fr 260px; gap: 12px; }

        /* Chart card */
        .chart-card { background: #080b18; border: 1px solid rgba(255,255,255,.07); border-radius: 18px; padding: 22px 24px; position: relative; overflow: hidden; }
        .chart-card .aurora2 { position: absolute; bottom: -40px; right: -40px; width: 280px; height: 180px; background: radial-gradient(ellipse, rgba(37,99,235,.12) 0%, transparent 70%); pointer-events: none; }
        .chart-card .hd { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px; }
        .chart-card .ttl { font-size: 14px; font-weight: 700; color: #fff; letter-spacing: -.01em; }
        .chart-card .sub { font-size: 11px; color: rgba(255,255,255,.28); margin-top: 2px; }
        .chart-card .big { font-size: 26px; font-weight: 800; letter-spacing: -.04em; color: #fff; margin: 6px 0 2px; }
        .chart-card .big .sym { font-size: 15px; font-weight: 600; color: rgba(255,255,255,.4); margin-right: 1px; }
        .chart-svg { display: block; width: 100%; margin-top: 12px; }
        .x-labels { display: flex; justify-content: space-between; margin-top: 4px; }
        .x-labels span { font-size: 10px; color: rgba(255,255,255,.22); }
        .x-labels span:last-child { color: rgba(56,189,248,.65); }

        /* Status card */
        .status-card { background: #080b18; border: 1px solid rgba(255,255,255,.07); border-radius: 18px; padding: 20px 20px; }
        .status-card .ttl { font-size: 14px; font-weight: 700; color: #fff; margin-bottom: 16px; letter-spacing: -.01em; }
        .s-item { margin-bottom: 14px; }
        .s-item:last-child { margin-bottom: 0; }
        .s-item .row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px; }
        .s-item .lbl { display: flex; align-items: center; gap: 7px; font-size: 12px; color: rgba(255,255,255,.5); font-weight: 500; }
        .s-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
        .s-item .ct { font-size: 13px; font-weight: 700; color: #fff; }
        .bar-track { background: rgba(255,255,255,.06); border-radius: 4px; height: 5px; overflow: hidden; }
        .bar-fill  { height: 100%; border-radius: 4px; }

        /* Table card */
        .table-card { background: #080b18; border: 1px solid rgba(255,255,255,.07); border-radius: 18px; overflow: hidden; }
        .table-card .t-hd { padding: 16px 22px 14px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,.05); }
        .table-card .t-ttl { font-size: 14px; font-weight: 700; color: #fff; letter-spacing: -.01em; }
        .table-card .t-sub { font-size: 11px; color: rgba(255,255,255,.25); margin-top: 1px; }
        .table-card .t-link { font-size: 11px; font-weight: 600; color: #60a5fa; text-decoration: none; }
        .table-card .t-link:hover { color: #93c5fd; }
        .ov-table { width: 100%; border-collapse: collapse; }
        .ov-table thead th { padding: 10px 22px 8px; font-size: 9px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: rgba(255,255,255,.2); text-align: left; }
        .ov-table thead th.r { text-align: right; }
        .ov-table tbody tr { border-top: 1px solid rgba(255,255,255,.04); transition: background .12s; }
        .ov-table tbody tr:hover { background: rgba(37,99,235,.04); }
        .ov-table tbody td { padding: 12px 22px; font-size: 12px; color: rgba(255,255,255,.5); }
        .ov-table tbody td.hi { color: #fff; font-weight: 500; }
        .ov-table tbody td.pay { text-align: right; font-weight: 700; font-variant-numeric: tabular-nums; color: #fff; font-family: 'DM Mono', monospace; font-size: 12px; }
        .ov-table tbody td.r { text-align: right; }
        .partner-cell { display: flex; align-items: center; gap: 9px; }
        .avatar { width: 26px; height: 26px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 700; flex-shrink: 0; }
      `}</style>

      <div className="ov">

        {/* ── Top bar ── */}
        <div className="ov-topbar">
          <div>
            <div className="t">Overview</div>
            <div className="s">All branches · current reporting snapshot</div>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <div className="date-pill">
              {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}
            </div>
            <Link href="/admin/upload" className="upload-btn">+ Upload CSV</Link>
          </div>
        </div>

        {/* ── Hero row ── */}
        <div className="hero-row">

          {/* 1 · Total Revenue (hero) */}
          <div className="hero-card">
            <div className="aurora" />
            <div className="lbl">Total Revenue</div>
            <div className="amt"><span className="sym">฿</span>{totalRevenue.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <div className="foot">
              <span className="sub">Sum of net · all reports</span>
              <span className="bdg">{totalReports} reports</span>
            </div>
          </div>

          {/* 2 · Total Payout */}
          <div className="kpi-card">
            <div className="glow" style={{ background: '#2563eb' }} />
            <div>
              <div className="k">Total Payout</div>
              <div className="v sm">{formatTHB(totalPayout)}</div>
            </div>
            <span className="tag tag-blue">Approved + Paid</span>
          </div>

          {/* 3 · Net Profit */}
          <div className="kpi-card">
            <div className="glow" style={{ background: '#10b981' }} />
            <div>
              <div className="k">Net Profit</div>
              <div className="v sm" style={{ color: netProfit >= 0 ? '#34d399' : '#f87171' }}>
                {formatTHB(netProfit)}
              </div>
            </div>
            <span className="tag tag-profit">Revenue − Payouts</span>
          </div>

          {/* 4 · Active Branches */}
          <div className="kpi-card">
            <div className="glow" style={{ background: '#6366f1' }} />
            <div>
              <div className="k">Active Branches</div>
              <div className="v">{branches}</div>
            </div>
            <span className="tag tag-ok">All active</span>
          </div>

          {/* 5 · Pending Approval */}
          <div className="kpi-card">
            <div className="glow" style={{ background: pending > 0 ? '#f59e0b' : '#10b981' }} />
            <div>
              <div className="k">Pending Approval</div>
              <div className="v">{pending}</div>
            </div>
            {pending > 0
              ? <span className="tag tag-warn">⚠ Needs review</span>
              : <span className="tag tag-ok">All clear</span>
            }
          </div>
        </div>

        {/* ── Mid row: chart + status ── */}
        <div className="mid-row">

          {/* Payout trend chart */}
          <div className="chart-card">
            <div className="aurora2" />
            <div className="hd">
              <div>
                <div className="ttl">Payout Trend</div>
                <div className="sub">Last 6 months · final payout</div>
              </div>
            </div>
            <div className="big">
              <span className="sym">฿</span>
              {totalPayout.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>

            <svg
              className="chart-svg"
              viewBox={`0 0 ${SVG_W} ${SVG_H + 4}`}
              xmlns="http://www.w3.org/2000/svg"
              style={{ overflow: 'visible' }}
            >
              <defs>
                <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity=".22" />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                </linearGradient>
                <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#6366f1" />
                  <stop offset="100%" stopColor="#38bdf8" />
                </linearGradient>
              </defs>
              {/* grid */}
              {[0.25, 0.5, 0.75].map((p, i) => (
                <line key={i} x1={0} y1={SVG_H * (1 - p)} x2={SVG_W} y2={SVG_H * (1 - p)}
                  stroke="rgba(255,255,255,.04)" strokeWidth={1} />
              ))}
              <line x1={0} y1={SVG_H} x2={SVG_W} y2={SVG_H} stroke="rgba(255,255,255,.07)" strokeWidth={1} />
              {/* area */}
              {trendValues.some(v => v > 0) && (
                <path d={areaPath} fill="url(#areaGrad)" />
              )}
              {/* line */}
              {trendValues.some(v => v > 0) && (
                <path d={linePath} fill="none" stroke="url(#lineGrad)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
              )}
              {/* dots */}
              {trendValues.map((v, i) => {
                const x = i === 0 ? 0 : Math.round((i / (trendMonths.length - 1)) * SVG_W)
                const y = Math.round(SVG_H - (v / trendMax) * SVG_H * 0.85 - 4)
                return v > 0 ? (
                  <g key={i}>
                    <circle cx={x} cy={y} r={3.5} fill="#38bdf8" />
                    {i === trendValues.length - 1 && (
                      <circle cx={x} cy={y} r={7} fill="rgba(56,189,248,.18)" />
                    )}
                  </g>
                ) : null
              })}
            </svg>

            <div className="x-labels">
              {trendMonths.map((m, i) => (
                <span key={i}>{m.label}</span>
              ))}
            </div>
          </div>

          {/* Status breakdown */}
          <div className="status-card">
            <div className="ttl">Status Breakdown</div>
            {[
              { key: 'paid',           label: 'Paid',           color: '#34d399', glow: 'rgba(52,211,153,.5)',  grad: 'linear-gradient(90deg,#10b981,#34d399)' },
              { key: 'approved',       label: 'Approved',       color: '#60a5fa', glow: 'rgba(96,165,250,.5)',  grad: 'linear-gradient(90deg,#2563eb,#60a5fa)' },
              { key: 'pending_review', label: 'Pending Review', color: '#fbbf24', glow: 'rgba(251,191,36,.45)', grad: 'linear-gradient(90deg,#d97706,#fbbf24)' },
              { key: 'draft',          label: 'Draft',          color: 'rgba(255,255,255,.3)', glow: '', grad: 'rgba(255,255,255,.15)' },
            ].map(({ key, label, color, glow, grad }) => {
              const ct = statusCount[key] ?? 0
              const pct = totalReports > 0 ? Math.round((ct / totalReports) * 100) : 0
              return (
                <div key={key} className="s-item">
                  <div className="row">
                    <div className="lbl">
                      <span className="s-dot" style={{ background: color, boxShadow: glow ? `0 0 6px ${glow}` : 'none' }} />
                      {label}
                    </div>
                    <span className="ct">{ct}</span>
                  </div>
                  <div className="bar-track">
                    <div className="bar-fill" style={{ width: `${pct}%`, background: grad }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Reports table ── */}
        <div className="table-card">
          <div className="t-hd">
            <div>
              <div className="t-ttl">Recent Reports</div>
              <div className="t-sub">Latest {recent.length} of {totalReports} total</div>
            </div>
            <Link href="/admin/reports" className="t-link">View all →</Link>
          </div>
          <table className="ov-table">
            <thead>
              <tr>
                <th>Period</th>
                <th>Partner</th>
                <th>Branch</th>
                <th className="r">Final Payout</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((r, i) => {
                const branch  = Array.isArray(r.branches) ? r.branches[0] : r.branches
                const partner = Array.isArray(branch?.partners) ? branch.partners[0] : branch?.partners
                const name    = partner?.name ?? branch?.name ?? '—'
                const ini     = initial(name)
                const bg      = avatarColors[ini] ?? 'rgba(255,255,255,.08)'
                return (
                  <tr key={i}>
                    <td className="hi">
                      <Link href={`/admin/reports/${r.id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                        {formatReportingPeriod(r.reporting_month, r.reporting_year)}
                      </Link>
                    </td>
                    <td>
                      <div className="partner-cell">
                        <div className="avatar" style={{ background: bg, color: '#fff' }}>{ini}</div>
                        {name}
                      </div>
                    </td>
                    <td>{branch?.name ?? '—'}</td>
                    <td className="pay">{formatTHB(Number(r.final_payout))}</td>
                    <td><StatusBadge status={r.status as 'draft'} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

      </div>
    </>
  )
}
