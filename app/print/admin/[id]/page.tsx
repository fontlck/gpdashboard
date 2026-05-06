import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatTHB } from '@/lib/utils/currency'
import { formatReportingPeriod } from '@/lib/utils/date'
import { DownloadPDFButton } from '@/components/shared/DownloadPDFButton'

export const dynamic = 'force-dynamic'

/** Format a date string as dd/mm/yy */
function fmtDate(d: string | null): string {
  if (!d) return '—'
  const s = d.slice(0, 10)
  const [y, m, day] = s.split('-')
  return `${day}/${m}/${y.slice(2)}`
}

/** Extract HH:MM from a datetime string */
function fmtTime(d: string | null): string {
  if (!d || d.length < 16) return '—'
  return d.slice(11, 16)
}

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
      compensation_amount, compensation_note,
      service_fee_amount, service_fee_note, service_fee_wht,
      fee_deduction_amount, fee_deduction_note,
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

  const upliftBase   = Number(r.referred_artist_uplift     ?? 0)
  const upliftVat    = Number(r.referred_artist_uplift_vat ?? 0)
  const upliftTotal  = upliftBase + upliftVat
  type UE = { artist_name: string; uplift_pct: number; uplift_base: number; uplift_vat: number }
  const upliftEntries: UE[] = r.referred_artist_uplift_snapshot ?? []

  const whtPct    = Number(r.withholding_tax_pct    ?? 0)
  const whtAmount = Number(r.withholding_tax_amount ?? 0)

  // ── Extra Adjustments ──
  const extComp   = Number(r.compensation_amount  ?? 0)
  const extSvc    = Number(r.service_fee_amount   ?? 0)
  const extSvcWht = r.service_fee_wht ? extSvc * 0.03 : 0
  const extFee    = Number(r.fee_deduction_amount ?? 0)
  const hasExtras = extComp > 0 || extSvc > 0 || extFee > 0

  // ── Top artists ──
  const { data: artists } = await admin
    .from('artist_summaries')
    .select('artist_name, order_count, gross_sales, total_net')
    .eq('monthly_report_id', id)
    .order('order_count', { ascending: false })
    .limit(10)

  // ── All transaction rows (for page 2) ──
  const { data: txRows } = await admin
    .from('report_rows')
    .select('charge_id, transaction_date, artist_name_raw, amount, net')
    .eq('monthly_report_id', id)
    .order('transaction_date', { ascending: true })

  // ── Daily revenue chart data ──
  const dayMap = new Map<string, number>()
  for (const row of txRows ?? []) {
    const d = (row.transaction_date as string | null)?.slice(0, 10) ?? ''
    if (d) dayMap.set(d, (dayMap.get(d) ?? 0) + Number(row.amount ?? 0))
  }
  const sortedDays = Array.from(dayMap.entries()).sort(([a], [b]) => a.localeCompare(b))

  const SVG_W = 540
  const SVG_H = 52
  const n     = sortedDays.length || 1
  const gap   = 2
  const barW  = Math.max(2, Math.floor((SVG_W - gap * (n - 1)) / n))
  const maxV  = Math.max(...sortedDays.map(([, v]) => v), 1)

  const printDate = new Date().toLocaleDateString('en-GB', {
    day: '2-digit', month: 'long', year: 'numeric',
  })

  // Suggested PDF filename: "BranchName_Month YYYY"
  const pdfFilename = `${branch?.name ?? 'Report'}_${period}`

  type SummaryRow = { label: string; value: string; indent?: boolean; muted?: boolean; section?: string }
  const summaryRows: SummaryRow[] = [
    { label: 'Payout Model',  value: isFixed ? 'Fixed Rent' : `Revenue Share · ${r.revenue_share_pct_snapshot}%` },
    { label: 'Total Orders',  value: Number(r.total_transaction_count).toLocaleString() },
    { label: 'Gross Sales',   value: formatTHB(Number(r.gross_sales)) },
    { label: 'Platform Fee',  value: `– ${formatTHB(Number(r.total_opn_fee))}`, muted: true },
    { label: 'Net Revenue',   value: formatTHB(Number(r.total_net)) },
    ...(Number(r.total_refunds) > 0
      ? [{ label: 'Refunds', value: `– ${formatTHB(Number(r.total_refunds))}`, muted: true }]
      : []),
    ...(!isFixed
      ? [{ label: `Adjusted Net (ex-VAT ${vatPct})`, value: formatTHB(adjNetExVat) }]
      : []),
    { label: 'Partner Share', value: formatTHB(Number(r.partner_share_base)) },
    ...(r.is_vat_registered_snapshot
      ? [{ label: `VAT ${vatPct}`, value: formatTHB(Number(r.vat_amount)), indent: true }]
      : []),
    ...(upliftTotal > 0
      ? [{ label: 'Artist Uplift', value: `+ ${formatTHB(upliftTotal)}`, indent: true }]
      : []),
    ...(whtAmount > 0
      ? [{ label: `WHT ${whtPct}%`, value: `– ${formatTHB(whtAmount)}`, muted: true }]
      : []),
  ]

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-head-element */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      {/* eslint-disable-next-line @next/next/google-font-display */}
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700;9..40,800&family=Noto+Sans:wght@400;600;700&display=block" rel="stylesheet" />
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body {
          background: #fff;
          color: #111;
          font-family: 'DM Sans', 'Noto Sans', 'Helvetica Neue', Arial, sans-serif;
          font-size: 10pt;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        @page { size: A4 portrait; margin: 16mm 20mm 16mm 20mm; }
        @media print { .no-print { display: none !important; } }
        .wrap { max-width: 680px; margin: 0 auto; padding: 32px 0 24px; }

        .hd { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #111; padding-bottom: 14px; margin-bottom: 20px; }
        .hd-logo { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
        .hd-logo img { width: 34px; height: 29px; object-fit: cover; display: block; }
        .hd-logo-name { font-size: 7.5pt; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; line-height: 1.2; }
        .hd-left .eyebrow { font-size: 7pt; font-weight: 600; letter-spacing: .16em; text-transform: uppercase; color: #aaa; margin-bottom: 5px; }
        .hd-left .period  { font-size: 22pt; font-weight: 800; letter-spacing: -.03em; line-height: 1; }
        .hd-right { text-align: right; }
        .hd-right .partner-name { font-size: 13pt; font-weight: 700; letter-spacing: -.01em; }
        .hd-right .detail       { font-size: 8.5pt; color: #666; margin-top: 2px; }
        .hd-right .meta         { font-size: 8pt; color: #aaa; margin-top: 2px; }
        .admin-badge { display: inline-block; background: #111; color: #fff; font-size: 6.5pt; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; padding: 2px 7px; margin-bottom: 4px; }

        .kpi-row { display: flex; gap: 8px; margin-bottom: 20px; }
        .kpi { flex: 1; background: #f6f6f6; border-left: 2.5px solid #111; padding: 9px 10px 8px; }
        .kpi .k { font-size: 6.5pt; font-weight: 600; letter-spacing: .12em; text-transform: uppercase; color: #999; }
        .kpi .v { font-size: 14pt; font-weight: 800; letter-spacing: -.02em; margin-top: 3px; font-variant-numeric: tabular-nums; }

        .sec { font-size: 7pt; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; color: #aaa; margin: 0 0 8px; }

        .chart-wrap { margin-bottom: 20px; }
        .chart-svg  { display: block; width: 100%; overflow: visible; }

        .sum-table { width: 100%; border-collapse: collapse; margin-bottom: 22px; }
        .sum-table td { font-size: 9.5pt; padding: 6px 0; border-bottom: 1px solid #f0f0f0; }
        .sum-table .lbl { color: #555; width: 58%; }
        .sum-table .lbl.indent { padding-left: 14px; color: #888; }
        .sum-table .lbl.muted  { color: #888; }
        .sum-table .val { text-align: right; font-variant-numeric: tabular-nums; font-weight: 500; }
        .sum-table .val.muted { color: #888; }
        .sum-table tfoot td { padding-top: 12px; border-top: 2px solid #111; border-bottom: none; }
        .sum-table tfoot .lbl { font-size: 11pt; font-weight: 700; color: #111; }
        .sum-table tfoot .val { font-size: 14pt; font-weight: 800; }

        /* Extra Adjustments */
        .extra-divider td { border-bottom: none !important; padding-top: 10px !important; padding-bottom: 2px !important; }
        .extra-label { font-size: 7pt; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; color: #aaa; }
        .sum-table .lbl.extra { padding-left: 14px; color: #888; }

        .dt { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 9pt; }
        .dt thead tr { background: #f6f6f6; }
        .dt thead th { padding: 7px 10px; font-size: 7pt; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: #888; border-bottom: 1.5px solid #e0e0e0; text-align: left; }
        .dt thead th.r { text-align: right; }
        .dt tbody td { padding: 6px 10px; border-bottom: 1px solid #f2f2f2; color: #333; }
        .dt tbody td.r    { text-align: right; font-variant-numeric: tabular-nums; }
        .dt tbody td.bold { font-weight: 600; }
        .dt tbody td.dim  { color: #aaa; }
        .dt tbody td.mono { font-family: 'SF Mono', 'Fira Code', monospace; font-size: 7.5pt; }

        /* Page 2 transaction detail */
        .page-break { break-before: page; page-break-before: always; }
        .tx-hd { border-bottom: 1.5px solid #111; padding-bottom: 8px; margin-bottom: 16px; }
        .tx-hd .title { font-size: 16pt; font-weight: 800; letter-spacing: -.02em; }
        .tx-hd .sub   { font-size: 8pt; color: #888; margin-top: 2px; }

        .ft { border-top: 1px solid #e8e8e8; padding-top: 10px; margin-top: 4px; display: flex; justify-content: space-between; font-size: 7.5pt; color: #bbb; }
      `}</style>

      <div className="wrap">

        {/* ── Toolbar (screen only) ── */}
        <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid #eee' }}>
          <a href={`/admin/reports/${id}`} style={{ fontSize: '13px', color: '#888', textDecoration: 'none', fontFamily: 'inherit' }}>
            ← Back to report
          </a>
          <DownloadPDFButton filename={pdfFilename} pdfHref={`/api/print/admin/${id}`} />
        </div>

        {/* ══════════════ PAGE 1 — SUMMARY ══════════════ */}

        {/* ── Header ── */}
        <div className="hd">
          <div className="hd-left">
            <div className="hd-logo">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo-mark.svg" alt="FLASHYOURMEME" />
              <div className="hd-logo-name">FLASHYOURMEME<br />CO., LTD.</div>
            </div>
            <div className="eyebrow">Partner Earnings Report</div>
            <div className="period">{period}</div>
          </div>
          <div className="hd-right">
            <div><span className="admin-badge">Admin Copy</span></div>
            <div className="partner-name">{partner?.name ?? branch?.name}</div>
            {partner?.vat_number && <div className="detail">VAT {partner.vat_number}</div>}
            {branch?.name && <div className="detail">{branch.name}</div>}
            <div className="meta">Printed {printDate}</div>
            <div className="meta" style={{ textTransform: 'capitalize' }}>{r.status}</div>
          </div>
        </div>

        {/* ── KPI Strip ── */}
        <div className="kpi-row">
          <div className="kpi">
            <div className="k">Gross Sales</div>
            <div className="v">{formatTHB(Number(r.gross_sales))}</div>
          </div>
          <div className="kpi">
            <div className="k">Net Revenue</div>
            <div className="v">{formatTHB(Number(r.total_net))}</div>
          </div>
          <div className="kpi">
            <div className="k">Final Payout</div>
            <div className="v">{formatTHB(Number(r.final_payout))}</div>
          </div>
          <div className="kpi">
            <div className="k">Orders</div>
            <div className="v">{Number(r.total_transaction_count).toLocaleString()}</div>
          </div>
        </div>

        {/* ── Daily Revenue Chart ── */}
        {sortedDays.length > 0 && (
          <div className="chart-wrap">
            <div className="sec">Daily Revenue</div>
            <svg
              className="chart-svg"
              viewBox={`0 0 ${SVG_W} ${SVG_H + 14}`}
              xmlns="http://www.w3.org/2000/svg"
            >
              <line x1={0} y1={SVG_H} x2={SVG_W} y2={SVG_H} stroke="#e8e8e8" strokeWidth={1} />
              {sortedDays.map(([date, val], i) => {
                const h   = Math.max(3, (val / maxV) * SVG_H)
                const x   = i * (barW + gap)
                const day = parseInt(date.split('-')[2])
                return (
                  <g key={date}>
                    <rect x={x} y={SVG_H - h} width={barW} height={h} fill="#111" rx={1} />
                    {(day === 1 || day % 5 === 0) && (
                      <text
                        x={x + barW / 2}
                        y={SVG_H + 11}
                        textAnchor="middle"
                        fontSize={6}
                        fill="#bbb"
                        fontFamily="DM Sans, Helvetica Neue, Arial, sans-serif"
                      >
                        {day}
                      </text>
                    )}
                  </g>
                )
              })}
            </svg>
          </div>
        )}

        {/* ── Payout Summary ── */}
        <div className="sec">Payout Summary</div>
        <table className="sum-table">
          <tbody>
            {summaryRows.map((row, i) => (
              <tr key={i}>
                <td className={`lbl${row.indent ? ' indent' : ''}${row.muted ? ' muted' : ''}`}>
                  {row.label}
                </td>
                <td className={`val${row.muted ? ' muted' : ''}`}>{row.value}</td>
              </tr>
            ))}

            {/* Extra Adjustments section */}
            {hasExtras && (
              <>
                <tr className="extra-divider">
                  <td colSpan={2}><span className="extra-label">Extra Adjustments</span></td>
                </tr>
                {extComp > 0 && (
                  <tr>
                    <td className="lbl extra">Compensation{r.compensation_note ? ` — ${r.compensation_note}` : ''}</td>
                    <td className="val">+ {formatTHB(extComp)}</td>
                  </tr>
                )}
                {extSvc > 0 && (
                  <>
                    <tr>
                      <td className="lbl extra">Service Fee{r.service_fee_note ? ` — ${r.service_fee_note}` : ''}</td>
                      <td className="val">+ {formatTHB(extSvc)}</td>
                    </tr>
                    {r.service_fee_wht && (
                      <tr>
                        <td className="lbl extra" style={{ paddingLeft: '28px' }}>WHT 3%</td>
                        <td className="val muted">– {formatTHB(extSvcWht)}</td>
                      </tr>
                    )}
                  </>
                )}
                {extFee > 0 && (
                  <tr>
                    <td className="lbl extra">Fee{r.fee_deduction_note ? ` — ${r.fee_deduction_note}` : ''}</td>
                    <td className="val muted">– {formatTHB(extFee)}</td>
                  </tr>
                )}
              </>
            )}
          </tbody>
          <tfoot>
            <tr>
              <td className="lbl">Final Payout</td>
              <td className="val">{formatTHB(Number(r.final_payout))}</td>
            </tr>
          </tfoot>
        </table>

        {/* ── Artist Uplift Detail ── */}
        {upliftEntries.length > 0 && (
          <>
            <div className="sec">Artist Uplift Detail</div>
            <table className="dt">
              <thead>
                <tr>
                  <th>Artist</th>
                  <th className="r">Rate</th>
                  <th className="r">Uplift (ex-VAT)</th>
                  <th className="r">VAT</th>
                  <th className="r">Total</th>
                </tr>
              </thead>
              <tbody>
                {upliftEntries.map((e, i) => (
                  <tr key={i}>
                    <td>{e.artist_name}</td>
                    <td className="r">{e.uplift_pct}%</td>
                    <td className="r">{formatTHB(e.uplift_base)}</td>
                    <td className="r">{formatTHB(e.uplift_vat)}</td>
                    <td className="r bold">{formatTHB(e.uplift_base + e.uplift_vat)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {/* ── Artist Performance ── */}
        {artists && artists.length > 0 && (
          <>
            <div className="sec">Artist Performance</div>
            <table className="dt">
              <thead>
                <tr>
                  <th style={{ width: '28px' }}>#</th>
                  <th>Artist</th>
                  <th className="r">Orders</th>
                  <th className="r">Gross Sales</th>
                  <th className="r">Net</th>
                </tr>
              </thead>
              <tbody>
                {artists.map((a, i) => (
                  <tr key={i}>
                    <td className="dim">{i + 1}</td>
                    <td>{a.artist_name === '(Unknown)' ? '—' : a.artist_name}</td>
                    <td className="r">{a.order_count}</td>
                    <td className="r">{formatTHB(Number(a.gross_sales))}</td>
                    <td className="r bold">{formatTHB(Number(a.total_net))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {/* ── Footer page 1 ── */}
        <div className="ft">
          <span>FLASHYOURMEME CO., LTD. · {branch?.name ?? ''} · {period}</span>
          <span>Admin Copy · Confidential</span>
        </div>

        {/* ══════════════ PAGE 2 — TRANSACTION DETAIL ══════════════ */}
        {txRows && txRows.length > 0 && (
          <div className="page-break">
            <div className="tx-hd">
              <div className="title">Transaction Detail — {period}</div>
              <div className="sub">{partner?.name ?? ''} · {branch?.name ?? ''} · Admin Copy</div>
            </div>

            <table className="dt">
              <thead>
                <tr>
                  <th style={{ width: '28px' }}>#</th>
                  <th>Charge ID</th>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Artist</th>
                  <th className="r">Amount</th>
                  <th className="r">Net</th>
                </tr>
              </thead>
              <tbody>
                {txRows.map((row, i) => (
                  <tr key={i}>
                    <td className="dim">{i + 1}</td>
                    <td className="mono">{row.charge_id ?? '—'}</td>
                    <td>{fmtDate(row.transaction_date as string | null)}</td>
                    <td>{fmtTime(row.transaction_date as string | null)}</td>
                    <td>{(row.artist_name_raw as string | null) ?? '—'}</td>
                    <td className="r">{formatTHB(Number(row.amount ?? 0))}</td>
                    <td className="r bold">{formatTHB(Number(row.net ?? 0))}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* ── Footer page 2 ── */}
            <div className="ft">
              <span>FLASHYOURMEME CO., LTD. · {branch?.name ?? ''} · {period}</span>
              <span>Admin Copy · Confidential</span>
            </div>
          </div>
        )}

      </div>
    </>
  )
}
