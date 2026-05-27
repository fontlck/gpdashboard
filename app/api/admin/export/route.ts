import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/api/require-admin'
import { createAdminClient } from '@/lib/supabase/admin'

function parseMonth(raw: string | null): { year: number; month: number } {
  const now = new Date()
  if (!raw || !/^\d{4}-\d{2}$/.test(raw)) {
    return { year: now.getFullYear(), month: now.getMonth() + 1 }
  }
  const [y, m] = raw.split('-').map(Number)
  if (!y || !m || m < 1 || m > 12) {
    return { year: now.getFullYear(), month: now.getMonth() + 1 }
  }
  return { year: y, month: m }
}

function prevMonth(year: number, month: number) {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 }
}

function esc(v: string | number | null | undefined): string {
  const s = String(v ?? '')
  return s.includes(',') || s.includes('"') || s.includes('\n')
    ? `"${s.replace(/"/g, '""')}"`
    : s
}

function row(...cells: (string | number | null | undefined)[]): string {
  return cells.map(esc).join(',')
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin()
  if (auth.error) {
    return new Response(auth.error, { status: auth.status })
  }
  const { orgId } = auth
  const admin = createAdminClient()

  const params   = req.nextUrl.searchParams
  const sel      = parseMonth(params.get('month'))
  const branchId = params.get('branch') ?? null
  const prev     = prevMonth(sel.year, sel.month)

  const monthLabel = new Date(sel.year, sel.month - 1, 1)
    .toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
  const prevLabel = new Date(prev.year, prev.month - 1, 1)
    .toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })

  // ── Fetch data ──
  const buildQ = (year: number, month: number) => {
    let q = admin.from('monthly_reports')
      .select('branch_id, status, final_payout, total_net, branches(name, partners(name))')
      .eq('organization_id', orgId)
      .eq('reporting_year', year)
      .eq('reporting_month', month)
    if (branchId) q = q.eq('branch_id', branchId)
    return q
  }

  const [currRes, prevRes] = await Promise.all([
    buildQ(sel.year, sel.month),
    buildQ(prev.year, prev.month),
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const currRows = (currRes.data ?? []) as any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prevRows = (prevRes.data ?? []) as any[]

  // Build prev-month payout lookup
  const prevPayoutMap: Record<string, number> = {}
  for (const r of prevRows) {
    prevPayoutMap[r.branch_id] = Number(r.final_payout ?? 0)
  }

  // Aggregate KPIs
  const totalRevenue = currRows.reduce((s: number, r: any) => s + Number(r.total_net ?? 0), 0)
  const totalPayout  = currRows
    .filter((r: any) => ['approved', 'paid'].includes(r.status))
    .reduce((s: number, r: any) => s + Number(r.final_payout ?? 0), 0)
  const netProfit = totalRevenue - totalPayout

  // Build branch rows
  type ExportRow = {
    branchName: string
    partnerName: string
    revenue: number
    payout: number
    prevPayout: number
    deltaPct: string
    status: string
  }

  const branchRows: ExportRow[] = currRows.map((r: any) => {
    const branch   = Array.isArray(r.branches)  ? r.branches[0]  : r.branches
    const partner  = Array.isArray(branch?.partners) ? branch.partners[0] : branch?.partners
    const payout   = ['approved', 'paid'].includes(r.status) ? Number(r.final_payout ?? 0) : 0
    const prev     = prevPayoutMap[r.branch_id] ?? 0
    let deltaPct   = 'N/A'
    if (prev > 0) {
      const pct = ((payout - prev) / prev) * 100
      deltaPct = `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`
    } else if (payout > 0) {
      deltaPct = 'New'
    }
    return {
      branchName:  branch?.name  ?? '—',
      partnerName: partner?.name ?? '—',
      revenue:     Number(r.total_net ?? 0),
      payout,
      prevPayout:  prev,
      deltaPct,
      status:      r.status,
    }
  }).sort((a: ExportRow, b: ExportRow) => b.revenue - a.revenue)

  // ── Build CSV ──
  const lines: string[] = []

  // Metadata header
  lines.push(row('GP Dashboard — Monthly Export'))
  lines.push(row('Period', monthLabel))
  lines.push(row('Generated', new Date().toLocaleString('en-GB')))
  lines.push(row('Scope', branchId ? 'Single branch' : 'All branches'))
  lines.push('')

  // KPI summary
  lines.push(row('KPI Summary'))
  lines.push(row('Metric', 'Value'))
  lines.push(row('Total Revenue', totalRevenue.toFixed(2)))
  lines.push(row('Total Payout', totalPayout.toFixed(2)))
  lines.push(row('Net Profit', netProfit.toFixed(2)))
  lines.push(row('Margin %', totalRevenue > 0 ? `${((netProfit / totalRevenue) * 100).toFixed(1)}%` : '—'))
  lines.push(row('Report Count', currRows.length))
  lines.push('')

  // Branch breakdown
  lines.push(row('Branch Breakdown'))
  lines.push(row('Branch', 'Partner', 'Revenue (THB)', `Payout (THB)`, `Payout prev (${prevLabel})`, 'MoM Delta', 'Status'))
  for (const r of branchRows) {
    lines.push(row(
      r.branchName,
      r.partnerName,
      r.revenue.toFixed(2),
      r.payout.toFixed(2),
      r.prevPayout.toFixed(2),
      r.deltaPct,
      r.status,
    ))
  }

  const csv      = lines.join('\r\n')
  const filename = `gp-overview-${sel.year}-${String(sel.month).padStart(2, '0')}.csv`

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
