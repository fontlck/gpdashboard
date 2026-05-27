import { createClient } from '@/lib/supabase/server'
import { requireOrgId } from '@/lib/org'
import { formatTHB } from '@/lib/utils/currency'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { formatReportingPeriod } from '@/lib/utils/date'
import { BranchDropdown } from '@/components/admin/BranchDropdown'
import { MonthPicker } from '@/components/admin/MonthPicker'
import { SwipeMonthWrapper } from '@/components/admin/SwipeMonthWrapper'
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Overview' }

function monthName(m: number) {
  return ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m - 1] ?? ''
}

function parseMonthParam(raw: string | undefined): { year: number; month: number; value: string } {
  const now = new Date()
  const defaultYear  = now.getFullYear()
  const defaultMonth = now.getMonth() + 1
  if (!raw || !/^\d{4}-\d{2}$/.test(raw)) {
    return { year: defaultYear, month: defaultMonth, value: `${defaultYear}-${String(defaultMonth).padStart(2, '0')}` }
  }
  const [y, m] = raw.split('-').map(Number)
  if (!y || !m || m < 1 || m > 12) {
    return { year: defaultYear, month: defaultMonth, value: `${defaultYear}-${String(defaultMonth).padStart(2, '0')}` }
  }
  return { year: y, month: m, value: raw }
}

function prevMonth(year: number, month: number): { year: number; month: number } {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 }
}

function deltaBadge(current: number, prev: number): { pct: number | null; label: string; color: string; bg: string } {
  if (prev === 0) return { pct: null, label: 'No prev data', color: 'rgba(255,255,255,.3)', bg: 'rgba(255,255,255,.06)' }
  const pct = ((current - prev) / prev) * 100
  if (Math.abs(pct) < 0.5) return { pct: 0, label: 'Same as last month', color: 'rgba(255,255,255,.35)', bg: 'rgba(255,255,255,.06)' }
  const up = pct > 0
  return {
    pct,
    label: `${up ? '+' : ''}${pct.toFixed(1)}% vs last month`,
    color: up ? '#34d399' : '#f87171',
    bg: up ? 'rgba(16,185,129,.12)' : 'rgba(239,68,68,.12)',
  }
}

export default async function AdminOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ branch?: string; month?: string; page?: string }>
}) {
  const supabase = await createClient()
  const orgId    = await requireOrgId()
  const { branch: branchParam, month: monthParam, page: pageParam } = await searchParams

  const PAGE_SIZE   = 10
  const currentPage = Math.max(1, parseInt(pageParam ?? '1', 10) || 1)

  // ── Month parsing ──
  const sel  = parseMonthParam(monthParam)
  const prev = prevMonth(sel.year, sel.month)

  // ── Fetch all active branches for the dropdown ──
  const { data: allBranches } = await supabase
    .from('branches')
    .select('id, name')
    .eq('organization_id', orgId)
    .eq('is_active', true)
    .order('name', { ascending: true })

  const branchList = allBranches ?? []

  const selectedBranchId = branchList.some(b => b.id === branchParam) ? (branchParam ?? null) : null
  const selectedBranch   = branchList.find(b => b.id === selectedBranchId) ?? null

  // ── Base query builders ──
  function baseReports() {
    let q = supabase.from('monthly_reports')
      .select('id, status, final_payout, total_net, reporting_month, reporting_year')
      .eq('organization_id', orgId)
    if (selectedBranchId) q = q.eq('branch_id', selectedBranchId)
    return q
  }

  const [
    currMonthRes,
    prevMonthRes,
    branchesRes,
    pendingRes,
    recentRes,
    branchCurrRes,
    branchPrevRes,
    ytdRes,
  ] = await Promise.all([
    // Current selected month (aggregate)
    baseReports()
      .eq('reporting_year', sel.year)
      .eq('reporting_month', sel.month),

    // Previous month aggregate (for MoM KPI delta)
    baseReports()
      .eq('reporting_year', prev.year)
      .eq('reporting_month', prev.month),

    // Active branch count
    supabase.from('branches')
      .select('id', { count: 'exact' })
      .eq('organization_id', orgId)
      .eq('is_active', true),

    // Pending approval count for selected month
    (() => {
      let q = supabase.from('monthly_reports')
        .select('id', { count: 'exact' })
        .eq('organization_id', orgId)
        .eq('status', 'pending_review')
        .eq('reporting_year', sel.year)
        .eq('reporting_month', sel.month)
      if (selectedBranchId) q = q.eq('branch_id', selectedBranchId)
      return q
    })(),

    // Recent reports (paginated)
    (() => {
      const offset = (currentPage - 1) * PAGE_SIZE
      let q = supabase.from('monthly_reports')
        .select('id, status, final_payout, reporting_month, reporting_year, branches(name, partners(name))', { count: 'exact' })
        .eq('organization_id', orgId)
        .order('reporting_year', { ascending: false })
        .order('reporting_month', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1)
      if (selectedBranchId) q = q.eq('branch_id', selectedBranchId)
      return q
    })(),

    // Branch breakdown — current month (with names)
    (() => {
      let q = supabase.from('monthly_reports')
        .select('id, branch_id, status, final_payout, total_net, branches(name, partners(name))')
        .eq('organization_id', orgId)
        .eq('reporting_year', sel.year)
        .eq('reporting_month', sel.month)
        .order('final_payout', { ascending: false })
      if (selectedBranchId) q = q.eq('branch_id', selectedBranchId)
      return q
    })(),

    // Branch breakdown — previous month (for delta only)
    (() => {
      let q = supabase.from('monthly_reports')
        .select('branch_id, final_payout, total_net')
        .eq('organization_id', orgId)
        .eq('reporting_year', prev.year)
        .eq('reporting_month', prev.month)
      if (selectedBranchId) q = q.eq('branch_id', selectedBranchId)
      return q
    })(),

    // YTD — Jan through selected month of selected year
    (() => {
      let q = supabase.from('monthly_reports')
        .select('status, final_payout, total_net, reporting_month')
        .eq('organization_id', orgId)
        .eq('reporting_year', sel.year)
        .lte('reporting_month', sel.month)
      if (selectedBranchId) q = q.eq('branch_id', selectedBranchId)
      return q
    })(),
  ])

  const currReports = currMonthRes.data ?? []
  const prevReports = prevMonthRes.data ?? []
  const branches    = branchesRes.count ?? 0
  const pending     = pendingRes.count  ?? 0
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recent            = (recentRes.data    ?? []) as any[]
  const recentTotal       = recentRes.count ?? 0
  const totalPages        = Math.ceil(recentTotal / PAGE_SIZE)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const branchCurrRows    = (branchCurrRes.data ?? []) as any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const branchPrevRows    = (branchPrevRes.data ?? []) as any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ytdRows           = (ytdRes.data        ?? []) as any[]

  // ── YTD aggregates ──
  const ytdRevenue   = ytdRows.reduce((s: number, r: any) => s + Number(r.total_net ?? 0), 0)
  const ytdPayout    = ytdRows
    .filter((r: any) => ['approved', 'paid'].includes(r.status))
    .reduce((s: number, r: any) => s + Number(r.final_payout ?? 0), 0)
  const ytdProfit    = ytdRevenue - ytdPayout
  // How many distinct months actually have data
  const ytdMonthsWithData = new Set(ytdRows.map((r: any) => r.reporting_month as number)).size
  const ytdMonthsElapsed  = sel.month  // Jan=1 … selected month
  const ytdAvgRevenue     = ytdMonthsWithData > 0 ? ytdRevenue / ytdMonthsWithData : 0
  // Year progress (how many months have passed out of 12)
  const yearProgressPct   = Math.round((ytdMonthsElapsed / 12) * 100)

  // ── Branch performance table ──
  // Build a map of prev month payout keyed by branch_id
  const prevPayoutByBranch: Record<string, number> = {}
  for (const r of branchPrevRows) {
    prevPayoutByBranch[r.branch_id] = Number(r.final_payout ?? 0)
  }

  type BranchRow = {
    id: string
    branchName: string
    partnerName: string
    revenue: number
    payout: number
    prevPayout: number
    status: string
    delta: ReturnType<typeof deltaBadge>
  }

  const branchTableRows: BranchRow[] = branchCurrRows.map((r: any) => {
    const branch  = Array.isArray(r.branches) ? r.branches[0] : r.branches
    const partner = Array.isArray(branch?.partners) ? branch.partners[0] : branch?.partners
    const payout  = ['approved','paid'].includes(r.status) ? Number(r.final_payout ?? 0) : 0
    const prev    = prevPayoutByBranch[r.branch_id] ?? 0
    return {
      id:          r.id,
      branchName:  branch?.name  ?? '—',
      partnerName: partner?.name ?? '—',
      revenue:     Number(r.total_net ?? 0),
      payout,
      prevPayout:  prev,
      status:      r.status,
      delta:       deltaBadge(payout, prev),
    }
  }).sort((a: BranchRow, b: BranchRow) => b.revenue - a.revenue)

  // ── Best / Most-declined branch ──
  const bestBranch = branchTableRows[0] ?? null
  const declinedBranch = branchTableRows
    .filter(r => r.delta.pct !== null && r.delta.pct < -0.5)
    .sort((a, b) => (a.delta.pct ?? 0) - (b.delta.pct ?? 0))[0] ?? null
  const fastestGrowing = branchTableRows
    .filter(r => r.delta.pct !== null && r.delta.pct > 0.5)
    .sort((a, b) => (b.delta.pct ?? 0) - (a.delta.pct ?? 0))[0] ?? null

  // ── Aggregates for selected month ──
  const currRevenue = currReports.reduce((s, r) => s + Number(r.total_net    ?? 0), 0)
  const currPayout  = currReports
    .filter(r => ['approved', 'paid'].includes(r.status))
    .reduce((s, r) => s + Number(r.final_payout ?? 0), 0)
  const currProfit  = currRevenue - currPayout
  const currCount   = currReports.length

  // ── Aggregates for previous month ──
  const prevRevenue = prevReports.reduce((s, r) => s + Number(r.total_net    ?? 0), 0)
  const prevPayout  = prevReports
    .filter(r => ['approved', 'paid'].includes(r.status))
    .reduce((s, r) => s + Number(r.final_payout ?? 0), 0)
  const prevProfit  = prevRevenue - prevPayout
  const prevCount   = prevReports.length

  // ── MoM deltas ──
  const dRevenue = deltaBadge(currRevenue, prevRevenue)
  const dPayout  = deltaBadge(currPayout,  prevPayout)
  const dProfit  = deltaBadge(currProfit,  prevProfit)
  const dCount   = deltaBadge(currCount,   prevCount)

  // ── Payouts due (approved but not yet paid) for selected month ──
  const payoutsDue = currReports
    .filter(r => r.status === 'approved')
    .reduce((s, r) => s + Number(r.final_payout ?? 0), 0)

  // ── Status counts for selected month ──
  const statusCount = currReports.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1
    return acc
  }, {})
  const totalReports = currReports.length

  // ── Payout trend (last 6 months from selected month) ──
  const trendMonths: { label: string; year: number; month: number }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(sel.year, sel.month - 1 - i, 1)
    trendMonths.push({ label: monthName(d.getMonth() + 1), year: d.getFullYear(), month: d.getMonth() + 1 })
  }

  // Fetch trend data for all 6 months
  const trendRes = await (() => {
    const oldest = trendMonths[0]
    let q = supabase.from('monthly_reports')
      .select('final_payout, reporting_month, reporting_year, status')
      .eq('organization_id', orgId)
      .in('status', ['approved', 'paid'])
      .or(
        trendMonths.map(tm => `and(reporting_year.eq.${tm.year},reporting_month.eq.${tm.month})`).join(',')
      )
    if (selectedBranchId) q = q.eq('branch_id', selectedBranchId)
    return q
  })()

  const trendData = trendRes.data ?? []
  const trendValues = trendMonths.map(tm => {
    return trendData
      .filter(r => r.reporting_year === tm.year && r.reporting_month === tm.month)
      .reduce((s, r) => s + Number(r.final_payout ?? 0), 0)
  })
  const trendMax = Math.max(...trendValues, 1)

  // Build SVG polyline
  const SVG_W = 600; const SVG_H = 90
  const pts = trendValues.map((v, i) => {
    const x = i === 0 ? 0 : Math.round((i / (trendMonths.length - 1)) * SVG_W)
    const y = Math.round(SVG_H - (v / trendMax) * SVG_H * 0.85 - 4)
    return `${x},${y}`
  }).join(' ')
  const areaPath = `M0,${SVG_H} L${pts.split(' ').map(p => p).join(' L')} L${SVG_W},${SVG_H} Z`
  const linePath = `M${pts.split(' ').join(' L')}`

  function initial(name: string) { return (name?.[0] ?? '?').toUpperCase() }
  const avatarColors: Record<string, string> = {
    Q: 'rgba(99,102,241,.25)', F: 'rgba(37,99,235,.25)', G: 'rgba(16,185,129,.15)',
    B: 'rgba(245,158,11,.2)',  D: 'rgba(239,68,68,.15)', A: 'rgba(139,92,246,.2)',
  }

  const prevLabel = new Date(prev.year, prev.month - 1, 1)
    .toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700;9..40,800&family=DM+Mono:wght@400;500&display=swap');
        .ov * { font-family: 'DM Sans', sans-serif; box-sizing: border-box; }
        .ov { display: flex; flex-direction: column; gap: 14px; }

        .ov-topbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px; }
        .ov-topbar .t { font-size: 22px; font-weight: 800; letter-spacing: -.03em; color: #fff; }
        .ov-topbar .s { font-size: 12px; color: rgba(255,255,255,.28); margin-top: 2px; }
        .ov-topbar .date-pill { background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.08); border-radius: 20px; padding: 6px 14px; font-size: 11px; color: rgba(255,255,255,.35); }
        .ov-topbar .upload-btn { background: linear-gradient(135deg,#2563eb,#1d4ed8); border: none; border-radius: 20px; padding: 8px 18px; font-size: 12px; font-weight: 700; color: #fff; cursor: pointer; text-decoration: none; box-shadow: 0 4px 20px rgba(37,99,235,.35); display: inline-block; }

        .hero-row { display: grid; grid-template-columns: 1.3fr 1fr 1fr 1fr 1fr; gap: 12px; }

        .hero-card { position: relative; border-radius: 18px; overflow: hidden; padding: 22px 24px; display: flex; flex-direction: column; justify-content: space-between; min-height: 148px; background: #080b18; border: 1px solid rgba(37,99,235,.25); }
        .hero-card .aurora { position: absolute; inset: 0; pointer-events: none; background: radial-gradient(ellipse 100% 80% at 110% 130%, rgba(37,99,235,.6) 0%, transparent 55%), radial-gradient(ellipse 60% 60% at -10% 90%, rgba(99,102,241,.3) 0%, transparent 55%), radial-gradient(ellipse 50% 50% at 50% 120%, rgba(14,165,233,.2) 0%, transparent 55%); }
        .hero-card .lbl { font-size: 9px; font-weight: 700; letter-spacing: .16em; text-transform: uppercase; color: rgba(147,197,253,.6); position: relative; z-index: 1; }
        .hero-card .amt { font-size: 30px; font-weight: 800; letter-spacing: -.04em; color: #fff; line-height: 1.1; position: relative; z-index: 1; text-shadow: 0 0 30px rgba(96,165,250,.4); }
        .hero-card .amt .sym { font-size: 17px; font-weight: 600; color: rgba(255,255,255,.45); margin-right: 1px; }
        .hero-card .foot { display: flex; align-items: center; justify-content: space-between; position: relative; z-index: 1; }
        .hero-card .foot .sub { font-size: 10px; color: rgba(147,197,253,.45); }
        .hero-card .foot .bdg { background: rgba(37,99,235,.3); border: 1px solid rgba(96,165,250,.22); border-radius: 20px; padding: 3px 9px; font-size: 9px; font-weight: 700; color: #93c5fd; }

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

        /* MoM delta badge */
        .mom-badge { display: inline-flex; align-items: center; gap: 4px; font-size: 10px; font-weight: 700; padding: 3px 8px; border-radius: 20px; margin-top: 8px; }
        .mom-prev  { font-size: 9px; color: rgba(255,255,255,.22); margin-top: 4px; }

        .mid-row { display: grid; grid-template-columns: 1fr 260px; gap: 12px; }

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
        .x-labels span.active { color: rgba(56,189,248,.65); }

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

        /* Empty state for month */
        .month-empty { background: rgba(255,255,255,.03); border: 1px dashed rgba(255,255,255,.08); border-radius: 12px; padding: 16px 20px; font-size: 12px; color: rgba(255,255,255,.25); text-align: center; margin-top: 4px; }

        /* Branch delta pill */
        .delta-pill { display: inline-flex; align-items: center; gap: 3px; font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 20px; white-space: nowrap; }
        /* Revenue bar */
        .rev-bar-wrap { display: flex; align-items: center; gap: 8px; }
        .rev-bar-track { flex: 1; background: rgba(255,255,255,.05); border-radius: 3px; height: 4px; overflow: hidden; min-width: 60px; }
        .rev-bar-fill { height: 100%; border-radius: 3px; background: linear-gradient(90deg, #2563eb, #38bdf8); }

        /* Best/Worst cards */
        .spotlight-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .spotlight-card { position: relative; background: #080b18; border-radius: 18px; padding: 18px 22px; overflow: hidden; display: flex; flex-direction: column; gap: 10px; }
        .spotlight-card .sp-glow { position: absolute; width: 120px; height: 120px; border-radius: 50%; filter: blur(40px); opacity: .18; top: -20px; right: -20px; pointer-events: none; }
        .spotlight-card .sp-tag { display: inline-flex; align-items: center; gap: 5px; font-size: 9px; font-weight: 700; letter-spacing: .13em; text-transform: uppercase; padding: 3px 10px; border-radius: 20px; width: fit-content; }
        .spotlight-card .sp-name { font-size: 16px; font-weight: 800; color: #fff; letter-spacing: -.02em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .spotlight-card .sp-partner { font-size: 11px; color: rgba(255,255,255,.3); margin-top: -6px; }
        .spotlight-card .sp-stats { display: flex; gap: 18px; }
        .spotlight-card .sp-stat { display: flex; flex-direction: column; gap: 2px; }
        .spotlight-card .sp-stat-lbl { font-size: 9px; font-weight: 600; letter-spacing: .1em; text-transform: uppercase; color: rgba(255,255,255,.25); }
        .spotlight-card .sp-stat-val { font-size: 14px; font-weight: 700; color: #fff; font-variant-numeric: tabular-nums; }
        .spotlight-card .sp-empty { font-size: 12px; color: rgba(255,255,255,.2); }
        @media (max-width: 767px) { .spotlight-row { grid-template-columns: 1fr; } }

        /* YTD strip */
        .ytd-strip { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1px; background: rgba(255,255,255,.06); border-radius: 16px; overflow: hidden; border: 1px solid rgba(255,255,255,.06); }
        .ytd-cell { background: #080b18; padding: 14px 20px; display: flex; flex-direction: column; gap: 4px; }
        .ytd-cell .ytd-lbl { font-size: 9px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; color: rgba(255,255,255,.28); }
        .ytd-cell .ytd-val { font-size: 17px; font-weight: 800; letter-spacing: -.03em; color: #fff; font-variant-numeric: tabular-nums; }
        .ytd-cell .ytd-sub { font-size: 10px; color: rgba(255,255,255,.25); }
        .ytd-progress { height: 3px; background: rgba(255,255,255,.07); border-radius: 2px; overflow: hidden; margin-top: 6px; }
        .ytd-progress-fill { height: 100%; border-radius: 2px; background: linear-gradient(90deg, #6366f1, #38bdf8); }
        @media (max-width: 767px) { .ytd-strip { grid-template-columns: 1fr 1fr; } }

        /* ── Controls row (top bar right side) ── */
        .ov-controls { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }

        /* ── Table scroll wrapper ── */
        .ov-table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }

        @media (max-width: 1023px) and (min-width: 768px) {
          .hero-row { grid-template-columns: 1fr 1fr; }
          .hero-card { grid-column: 1 / -1; min-height: 120px; }
          .mid-row { grid-template-columns: 1fr; }
          .ov-topbar .date-pill { display: none; }
          .ov-controls { gap: 8px; }
        }

        @media (max-width: 767px) {
          .ov { gap: 10px; }

          /* Top bar: stack title above controls */
          .ov-topbar { flex-direction: column; align-items: stretch; gap: 8px; }
          .ov-topbar .date-pill { display: none; }
          .ov-topbar .upload-btn { display: none; } /* desktop-only task */
          .ov-controls { gap: 6px; width: 100%; }
          .ov-controls > * { flex: 1; min-width: 0; }

          /* KPI cards */
          .hero-row { grid-template-columns: 1fr 1fr; gap: 8px; }
          .hero-card { grid-column: 1 / -1; min-height: 110px; padding: 16px; }
          .hero-card .amt { font-size: 22px; }
          .hero-card .foot .bdg { font-size: 8px; }
          .kpi-card { padding: 14px 16px; min-height: 100px; }
          .kpi-card .v { font-size: 18px; }
          .kpi-card .v.sm { font-size: 15px; }
          .mom-badge { font-size: 9px; }
          .mom-prev { font-size: 8px; }

          /* Trend chart */
          .mid-row { grid-template-columns: 1fr; }

          /* Tables: horizontal scroll, min-width keeps columns readable */
          .table-card { border-radius: 14px; }
          .ov-table-wrap { border-radius: 0; }
          .ov-table { min-width: 560px; }
          .ov-table thead th { padding: 8px 14px 6px; }
          .ov-table tbody td { padding: 10px 14px; }

          /* Branch table: wider for 6 cols */
          .branch-table { min-width: 620px; }

          /* YTD: 2 col already set above */
          .ytd-cell { padding: 12px 14px; }
          .ytd-cell .ytd-val { font-size: 15px; }
        }
      `}</style>

      <SwipeMonthWrapper currentMonth={sel.value} branchId={selectedBranchId}>
      <div className="ov">

        {/* ── Top bar ── */}
        <div className="ov-topbar">
          <div>
            <div className="t">Overview</div>
            <div className="s">
              {selectedBranch ? selectedBranch.name : 'All branches'} · {currCount > 0 ? `${currCount} reports` : 'no reports this month'}
            </div>
          </div>
          <div className="ov-controls">
            <MonthPicker selectedMonth={sel.value} />
            <BranchDropdown branches={branchList} selectedId={selectedBranchId} />
            <div className="date-pill">
              {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}
            </div>
            <a
              href={`/api/admin/export?month=${sel.value}${selectedBranchId ? `&branch=${selectedBranchId}` : ''}`}
              style={{
                background: 'rgba(255,255,255,.06)',
                border: '1px solid rgba(255,255,255,.12)',
                borderRadius: '20px', padding: '8px 16px',
                fontSize: '12px', fontWeight: 600,
                color: 'rgba(255,255,255,.55)',
                textDecoration: 'none', display: 'inline-block',
                whiteSpace: 'nowrap',
              }}
            >
              ↓ Export CSV
            </a>
            <Link href="/admin/upload" className="upload-btn">+ Upload CSV</Link>
          </div>
        </div>

        {/* ── Hero row — selected month KPIs ── */}
        <div className="hero-row">

          {/* 1 · Revenue (hero) */}
          <div className="hero-card">
            <div className="aurora" />
            <div className="lbl">Total Revenue · {new Date(sel.year, sel.month - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</div>
            <div className="amt">
              <span className="sym">฿</span>
              {currRevenue.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="foot">
              <span className="sub">{currCount} reports · sum of net</span>
              <span
                className="bdg"
                style={dRevenue.pct !== null ? { background: dRevenue.bg, color: dRevenue.color, border: 'none' } : undefined}
              >
                {dRevenue.pct === null ? 'No prev data' : dRevenue.label}
              </span>
            </div>
          </div>

          {/* 2 · Total Payout */}
          <div className="kpi-card">
            <div className="glow" style={{ background: '#2563eb' }} />
            <div>
              <div className="k">Total Payout</div>
              <div className="v sm">{formatTHB(currPayout)}</div>
            </div>
            <div>
              <div
                className="mom-badge"
                style={{ background: dPayout.bg, color: dPayout.color }}
              >
                {dPayout.pct !== null && (dPayout.pct > 0 ? '↑' : dPayout.pct < 0 ? '↓' : '→')} {dPayout.label}
              </div>
              <div className="mom-prev">prev: {formatTHB(prevPayout)} ({prevLabel})</div>
            </div>
          </div>

          {/* 3 · Net Profit */}
          <div className="kpi-card">
            <div className="glow" style={{ background: '#10b981' }} />
            <div>
              <div className="k">Net Profit</div>
              <div className="v sm" style={{ color: currProfit >= 0 ? '#34d399' : '#f87171' }}>
                {formatTHB(currProfit)}
              </div>
            </div>
            <div>
              <div
                className="mom-badge"
                style={{ background: dProfit.bg, color: dProfit.color }}
              >
                {dProfit.pct !== null && (dProfit.pct > 0 ? '↑' : dProfit.pct < 0 ? '↓' : '→')} {dProfit.label}
              </div>
              <div className="mom-prev">prev: {formatTHB(prevProfit)} ({prevLabel})</div>
            </div>
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
              <div className="k">Pending This Month</div>
              <div className="v">{pending}</div>
            </div>
            {pending > 0
              ? <span className="tag tag-warn">⚠ Needs review</span>
              : <span className="tag tag-ok">All clear</span>
            }
          </div>
        </div>

        {/* ── YTD summary strip ── */}
        <div className="ytd-strip">
          <div className="ytd-cell">
            <div className="ytd-lbl">YTD Revenue · {sel.year}</div>
            <div className="ytd-val">฿{ytdRevenue.toLocaleString('en', { maximumFractionDigits: 0 })}</div>
            <div className="ytd-sub">
              {ytdMonthsWithData} month{ytdMonthsWithData !== 1 ? 's' : ''} of data · avg ฿{Math.round(ytdAvgRevenue).toLocaleString('en')}/mo
            </div>
            <div className="ytd-progress">
              <div className="ytd-progress-fill" style={{ width: `${yearProgressPct}%` }} />
            </div>
          </div>
          <div className="ytd-cell">
            <div className="ytd-lbl">YTD Payout · {sel.year}</div>
            <div className="ytd-val">฿{ytdPayout.toLocaleString('en', { maximumFractionDigits: 0 })}</div>
            <div className="ytd-sub">
              {ytdRevenue > 0 ? `${((ytdPayout / ytdRevenue) * 100).toFixed(1)}% of revenue` : 'no revenue yet'}
            </div>
            <div className="ytd-progress">
              <div className="ytd-progress-fill" style={{ width: `${yearProgressPct}%`, background: 'linear-gradient(90deg,#2563eb,#60a5fa)' }} />
            </div>
          </div>
          <div className="ytd-cell">
            <div className="ytd-lbl">YTD Net Profit · {sel.year}</div>
            <div className="ytd-val" style={{ color: ytdProfit >= 0 ? '#34d399' : '#f87171' }}>
              ฿{ytdProfit.toLocaleString('en', { maximumFractionDigits: 0 })}
            </div>
            <div className="ytd-sub">
              {ytdRevenue > 0 ? `${((ytdProfit / ytdRevenue) * 100).toFixed(1)}% margin` : '—'}
            </div>
            <div className="ytd-progress">
              <div className="ytd-progress-fill" style={{ width: `${yearProgressPct}%`, background: ytdProfit >= 0 ? 'linear-gradient(90deg,#10b981,#34d399)' : 'linear-gradient(90deg,#dc2626,#f87171)' }} />
            </div>
          </div>
          <div className="ytd-cell">
            <div className="ytd-lbl">Year Progress</div>
            <div className="ytd-val">{yearProgressPct}%</div>
            <div className="ytd-sub">
              {ytdMonthsElapsed} of 12 months · through {new Date(sel.year, sel.month - 1, 1).toLocaleDateString('en-GB', { month: 'short' })}
            </div>
            <div className="ytd-progress">
              <div className="ytd-progress-fill" style={{ width: `${yearProgressPct}%`, background: 'linear-gradient(90deg,#7c3aed,#a78bfa)' }} />
            </div>
          </div>
        </div>

        {/* ── Best / Most-declined branch spotlight ── */}
        {branchTableRows.length > 0 && (
          <div className="spotlight-row">

            {/* Top performer — highest revenue */}
            <div className="spotlight-card" style={{ border: '1px solid rgba(16,185,129,.2)' }}>
              <div className="sp-glow" style={{ background: '#10b981' }} />
              <div className="sp-tag" style={{ background: 'rgba(16,185,129,.12)', color: '#34d399' }}>
                ★ Top Revenue
              </div>
              {bestBranch ? (
                <>
                  <div>
                    <div className="sp-name">{bestBranch.branchName}</div>
                    <div className="sp-partner">{bestBranch.partnerName}</div>
                  </div>
                  <div className="sp-stats">
                    <div className="sp-stat">
                      <div className="sp-stat-lbl">Revenue</div>
                      <div className="sp-stat-val">{formatTHB(bestBranch.revenue)}</div>
                    </div>
                    <div className="sp-stat">
                      <div className="sp-stat-lbl">Payout</div>
                      <div className="sp-stat-val">{bestBranch.payout > 0 ? formatTHB(bestBranch.payout) : '—'}</div>
                    </div>
                    <div className="sp-stat">
                      <div className="sp-stat-lbl">vs {prevLabel}</div>
                      <div className="sp-stat-val" style={{ color: bestBranch.delta.color }}>
                        {bestBranch.delta.pct === null ? 'New'
                          : bestBranch.delta.pct === 0 ? 'Same'
                          : `${bestBranch.delta.pct > 0 ? '+' : ''}${bestBranch.delta.pct.toFixed(1)}%`}
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="sp-empty">No data this month</div>
              )}
            </div>

            {/* Most declined — biggest negative delta; fallback: fastest growing */}
            {declinedBranch ? (
              <div className="spotlight-card" style={{ border: '1px solid rgba(239,68,68,.18)' }}>
                <div className="sp-glow" style={{ background: '#ef4444' }} />
                <div className="sp-tag" style={{ background: 'rgba(239,68,68,.1)', color: '#f87171' }}>
                  ↓ Most Declined
                </div>
                <div>
                  <div className="sp-name">{declinedBranch.branchName}</div>
                  <div className="sp-partner">{declinedBranch.partnerName}</div>
                </div>
                <div className="sp-stats">
                  <div className="sp-stat">
                    <div className="sp-stat-lbl">Revenue</div>
                    <div className="sp-stat-val">{formatTHB(declinedBranch.revenue)}</div>
                  </div>
                  <div className="sp-stat">
                    <div className="sp-stat-lbl">Drop</div>
                    <div className="sp-stat-val" style={{ color: '#f87171' }}>
                      {declinedBranch.delta.pct!.toFixed(1)}%
                    </div>
                  </div>
                  <div className="sp-stat">
                    <div className="sp-stat-lbl">Prev payout</div>
                    <div className="sp-stat-val">{formatTHB(declinedBranch.prevPayout)}</div>
                  </div>
                </div>
              </div>
            ) : fastestGrowing ? (
              <div className="spotlight-card" style={{ border: '1px solid rgba(37,99,235,.2)' }}>
                <div className="sp-glow" style={{ background: '#2563eb' }} />
                <div className="sp-tag" style={{ background: 'rgba(37,99,235,.12)', color: '#93c5fd' }}>
                  ↑ Fastest Growing
                </div>
                <div>
                  <div className="sp-name">{fastestGrowing.branchName}</div>
                  <div className="sp-partner">{fastestGrowing.partnerName}</div>
                </div>
                <div className="sp-stats">
                  <div className="sp-stat">
                    <div className="sp-stat-lbl">Revenue</div>
                    <div className="sp-stat-val">{formatTHB(fastestGrowing.revenue)}</div>
                  </div>
                  <div className="sp-stat">
                    <div className="sp-stat-lbl">Growth</div>
                    <div className="sp-stat-val" style={{ color: '#34d399' }}>
                      +{fastestGrowing.delta.pct!.toFixed(1)}%
                    </div>
                  </div>
                  <div className="sp-stat">
                    <div className="sp-stat-lbl">Payout</div>
                    <div className="sp-stat-val">{fastestGrowing.payout > 0 ? formatTHB(fastestGrowing.payout) : '—'}</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="spotlight-card" style={{ border: '1px solid rgba(255,255,255,.06)' }}>
                <div className="sp-tag" style={{ background: 'rgba(255,255,255,.05)', color: 'rgba(255,255,255,.3)' }}>
                  All Branches
                </div>
                <div className="sp-empty">No significant change vs {prevLabel}</div>
              </div>
            )}

          </div>
        )}

        {/* ── Mid row: chart + status ── */}
        <div className="mid-row">

          {/* Payout trend chart — 6 months ending at selected month */}
          <div className="chart-card">
            <div className="aurora2" />
            <div className="hd">
              <div>
                <div className="ttl">Payout Trend</div>
                <div className="sub">6 months ending {new Date(sel.year, sel.month - 1, 1).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}</div>
              </div>
            </div>
            <div className="big">
              <span className="sym">฿</span>
              {currPayout.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
              {[0.25, 0.5, 0.75].map((p, i) => (
                <line key={i} x1={0} y1={SVG_H * (1 - p)} x2={SVG_W} y2={SVG_H * (1 - p)}
                  stroke="rgba(255,255,255,.04)" strokeWidth={1} />
              ))}
              <line x1={0} y1={SVG_H} x2={SVG_W} y2={SVG_H} stroke="rgba(255,255,255,.07)" strokeWidth={1} />
              {trendValues.some(v => v > 0) && (
                <path d={areaPath} fill="url(#areaGrad)" />
              )}
              {trendValues.some(v => v > 0) && (
                <path d={linePath} fill="none" stroke="url(#lineGrad)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
              )}
              {trendValues.map((v, i) => {
                const x = i === 0 ? 0 : Math.round((i / (trendMonths.length - 1)) * SVG_W)
                const y = Math.round(SVG_H - (v / trendMax) * SVG_H * 0.85 - 4)
                const isLast = i === trendValues.length - 1
                return v > 0 ? (
                  <g key={i}>
                    <circle cx={x} cy={y} r={3.5} fill={isLast ? '#38bdf8' : 'rgba(56,189,248,.6)'} />
                    {isLast && <circle cx={x} cy={y} r={7} fill="rgba(56,189,248,.18)" />}
                  </g>
                ) : null
              })}
            </svg>

            <div className="x-labels">
              {trendMonths.map((m, i) => (
                <span key={i} className={i === trendMonths.length - 1 ? 'active' : ''}>{m.label}</span>
              ))}
            </div>
          </div>

          {/* Status breakdown for selected month */}
          <div className="status-card">
            <div className="ttl">
              Status · {new Date(sel.year, sel.month - 1, 1).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
            </div>
            {totalReports === 0 ? (
              <div className="month-empty">No reports for this month</div>
            ) : (
              [
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
              })
            )}
          </div>
        </div>

        {/* ── Branch Performance Table — selected month ── */}
        <div className="table-card">
          <div className="t-hd">
            <div>
              <div className="t-ttl">Branch Performance</div>
              <div className="t-sub">
                {new Date(sel.year, sel.month - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
                {' · '}sorted by revenue · delta vs {prevLabel}
              </div>
            </div>
            <Link href="/admin/branches" className="t-link">All branches →</Link>
          </div>

          {branchTableRows.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', fontSize: '12px', color: 'rgba(255,255,255,.2)' }}>
              No reports for this month
            </div>
          ) : (
            <div className="ov-table-wrap">
            <table className="ov-table branch-table">
              <thead>
                <tr>
                  <th>Branch</th>
                  <th>Partner</th>
                  <th>Revenue</th>
                  <th className="r">Payout</th>
                  <th className="r">vs {prevLabel}</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {branchTableRows.map((row) => {
                  const ini = initial(row.branchName)
                  const bg  = avatarColors[ini] ?? 'rgba(255,255,255,.08)'
                  const maxRev = branchTableRows[0]?.revenue || 1
                  const barPct = Math.round((row.revenue / maxRev) * 100)
                  return (
                    <tr key={row.id}>
                      <td>
                        <div className="partner-cell">
                          <div className="avatar" style={{ background: bg, color: '#fff' }}>{ini}</div>
                          <span style={{ color: '#fff', fontWeight: 500 }}>{row.branchName}</span>
                        </div>
                      </td>
                      <td>{row.partnerName}</td>
                      <td>
                        <div className="rev-bar-wrap">
                          <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: 'rgba(255,255,255,.6)', whiteSpace: 'nowrap' }}>
                            {formatTHB(row.revenue)}
                          </span>
                          <div className="rev-bar-track">
                            <div className="rev-bar-fill" style={{ width: `${barPct}%` }} />
                          </div>
                        </div>
                      </td>
                      <td className="pay">{row.payout > 0 ? formatTHB(row.payout) : <span style={{ color: 'rgba(255,255,255,.2)' }}>—</span>}</td>
                      <td className="r">
                        {row.prevPayout === 0 && row.payout === 0 ? (
                          <span style={{ fontSize: '10px', color: 'rgba(255,255,255,.2)' }}>—</span>
                        ) : (
                          <span
                            className="delta-pill"
                            style={{ background: row.delta.bg, color: row.delta.color }}
                          >
                            {row.delta.pct !== null && (row.delta.pct > 0 ? '↑' : row.delta.pct < 0 ? '↓' : '→')}
                            {row.delta.pct === null
                              ? 'New'
                              : row.delta.pct === 0
                              ? 'Same'
                              : `${Math.abs(row.delta.pct).toFixed(1)}%`}
                          </span>
                        )}
                      </td>
                      <td><StatusBadge status={row.status as 'draft'} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            </div>
          )}
        </div>

        {/* ── Recent reports table (paginated) ── */}
        <div className="table-card">
          <div className="t-hd">
            <div>
              <div className="t-ttl">Recent Reports</div>
              <div className="t-sub">
                {recentTotal > 0
                  ? `${(currentPage - 1) * PAGE_SIZE + 1}–${Math.min(currentPage * PAGE_SIZE, recentTotal)} of ${recentTotal} reports`
                  : 'No reports yet'}
              </div>
            </div>
            <Link href="/admin/reports" className="t-link">View all →</Link>
          </div>
          <div className="ov-table-wrap">
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
          {/* Pagination controls */}
          {totalPages > 1 && (() => {
            const buildHref = (p: number) => {
              const params = new URLSearchParams()
              if (sel.value)        params.set('month',  sel.value)
              if (selectedBranchId) params.set('branch', selectedBranchId)
              if (p > 1)            params.set('page',   String(p))
              const qs = params.toString()
              return `/admin${qs ? '?' + qs : ''}`
            }
            return (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderTop: '1px solid rgba(255,255,255,.05)' }}>
                <span style={{ fontSize: '12px', color: 'rgba(255,255,255,.3)' }}>
                  Page {currentPage} of {totalPages}
                </span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {currentPage > 1 && (
                    <Link href={buildHref(currentPage - 1)} style={{
                      padding: '5px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 600,
                      background: 'rgba(255,255,255,.06)', color: 'rgba(255,255,255,.6)',
                      textDecoration: 'none', border: '1px solid rgba(255,255,255,.08)',
                    }}>← Prev</Link>
                  )}
                  {currentPage < totalPages && (
                    <Link href={buildHref(currentPage + 1)} style={{
                      padding: '5px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 600,
                      background: 'rgba(59,130,246,.12)', color: '#60a5fa',
                      textDecoration: 'none', border: '1px solid rgba(59,130,246,.2)',
                    }}>Next →</Link>
                  )}
                </div>
              </div>
            )
          })()}
        </div>

      </div>
      </SwipeMonthWrapper>
    </>
  )
}
