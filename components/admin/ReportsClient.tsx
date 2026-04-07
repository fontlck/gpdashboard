'use client'

import React, { useState, useMemo } from 'react'
import Link from 'next/link'
import { StatusBadge } from '@/components/shared/StatusBadge'

// ── Types ────────────────────────────────────────────────────────────────────

type PayoutType = 'revenue_share' | 'fixed_rent'

type ReportRow = {
  id: string
  reporting_month: number
  reporting_year: number
  status: string
  gross_sales: number
  total_net: number
  total_refunds: number
  final_payout: number
  vat_amount: number
  payout_type_snapshot: PayoutType
  revenue_share_pct_snapshot: number
  fixed_rent_snapshot: number | null
  has_negative_adjusted_net: boolean
  created_at: string
  updated_at: string
  branch_id: string
  branch_name: string
  branch_code: string | null
  partner_name: string
  is_vat_registered: boolean
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'Jan','Feb','Mar','Apr','May','Jun',
  'Jul','Aug','Sep','Oct','Nov','Dec',
]

function fmtTHB(n: number): string {
  return '฿' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtPeriod(month: number, year: number): string {
  return `${MONTH_NAMES[month - 1] ?? '?'} ${year}`
}

function fmtDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })
}

const STATUS_ORDER: Record<string, number> = {
  draft: 0, pending_review: 1, approved: 2, paid: 3,
}

// ── Styles ───────────────────────────────────────────────────────────────────

const SELECT: React.CSSProperties = {
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '8px',
  color: '#F0ECE4',
  fontSize: '12px',
  padding: '7px 10px',
  cursor: 'pointer',
  minWidth: '120px',
}

const TH: React.CSSProperties = {
  padding: '12px 16px',
  textAlign: 'left',
  fontSize: '11px',
  fontWeight: '600',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'rgba(240,236,228,0.35)',
  whiteSpace: 'nowrap',
}

const TD: React.CSSProperties = {
  padding: '13px 16px',
  verticalAlign: 'middle',
}

// ── Filter bar ───────────────────────────────────────────────────────────────

function FilterBar({
  years, branches, statuses,
  year, setYear,
  month, setMonth,
  branchId, setBranchId,
  status, setStatus,
  count, total,
}: {
  years: number[]
  branches: { id: string; name: string }[]
  statuses: string[]
  year: string; setYear: (v: string) => void
  month: string; setMonth: (v: string) => void
  branchId: string; setBranchId: (v: string) => void
  status: string; setStatus: (v: string) => void
  count: number; total: number
}) {
  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center',
      marginBottom: '16px',
    }}>
      {/* Year */}
      <select style={SELECT} value={year} onChange={e => setYear(e.target.value)}>
        <option value="">All years</option>
        {years.map(y => <option key={y} value={y}>{y}</option>)}
      </select>

      {/* Month */}
      <select style={SELECT} value={month} onChange={e => setMonth(e.target.value)}>
        <option value="">All months</option>
        {MONTH_NAMES.map((m, i) => (
          <option key={i + 1} value={i + 1}>{m}</option>
        ))}
      </select>

      {/* Branch */}
      <select style={{ ...SELECT, minWidth: '160px' }} value={branchId} onChange={e => setBranchId(e.target.value)}>
        <option value="">All branches</option>
        {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
      </select>

      {/* Status */}
      <select style={SELECT} value={status} onChange={e => setStatus(e.target.value)}>
        <option value="">All statuses</option>
        {statuses.map(s => (
          <option key={s} value={s}>
            {s === 'pending_review' ? 'Pending Review' : s.charAt(0).toUpperCase() + s.slice(1)}
          </option>
        ))}
      </select>

      {/* Count */}
      <span style={{ marginLeft: 'auto', fontSize: '12px', color: 'rgba(240,236,228,0.35)', whiteSpace: 'nowrap' }}>
        {count === total ? `${total} report${total !== 1 ? 's' : ''}` : `${count} of ${total}`}
      </span>
    </div>
  )
}

// ── Payout model pill ─────────────────────────────────────────────────────────

function PayoutModelCell({ r }: { r: ReportRow }) {
  if (r.payout_type_snapshot === 'fixed_rent') {
    return (
      <div>
        <span style={{ fontSize: '12px', color: 'rgba(240,236,228,0.6)' }}>Fixed rent</span>
        {r.fixed_rent_snapshot != null && (
          <div style={{ fontSize: '11px', color: 'rgba(240,236,228,0.35)', marginTop: '2px' }}>
            {fmtTHB(r.fixed_rent_snapshot)}/mo
          </div>
        )}
      </div>
    )
  }
  return (
    <div>
      <span style={{ fontSize: '12px', color: 'rgba(240,236,228,0.6)' }}>Rev share</span>
      <div style={{ fontSize: '11px', color: 'rgba(240,236,228,0.35)', marginTop: '2px' }}>
        {r.revenue_share_pct_snapshot}%
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function ReportsClient({ reports }: { reports: ReportRow[] }) {
  const [year,     setYear]     = useState('')
  const [month,    setMonth]    = useState('')
  const [branchId, setBranchId] = useState('')
  const [status,   setStatus]   = useState('')

  // Derive filter options from data
  const years = useMemo(() =>
    [...new Set(reports.map(r => r.reporting_year))].sort((a, b) => b - a),
    [reports]
  )
  const branches = useMemo(() => {
    const seen = new Map<string, string>()
    reports.forEach(r => { if (!seen.has(r.branch_id)) seen.set(r.branch_id, r.branch_name) })
    return [...seen.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
  }, [reports])
  const statuses = useMemo(() =>
    [...new Set(reports.map(r => r.status))].sort((a, b) => (STATUS_ORDER[a] ?? 9) - (STATUS_ORDER[b] ?? 9)),
    [reports]
  )

  // Apply filters
  const filtered = useMemo(() => reports.filter(r => {
    if (year     && r.reporting_year  !== parseInt(year))  return false
    if (month    && r.reporting_month !== parseInt(month)) return false
    if (branchId && r.branch_id       !== branchId)        return false
    if (status   && r.status          !== status)          return false
    return true
  }), [reports, year, month, branchId, status])

  return (
    <div>
      <FilterBar
        years={years} branches={branches} statuses={statuses}
        year={year} setYear={setYear}
        month={month} setMonth={setMonth}
        branchId={branchId} setBranchId={setBranchId}
        status={status} setStatus={setStatus}
        count={filtered.length} total={reports.length}
      />

      <div style={{
        background: '#0D0F1A',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '16px',
        overflow: 'hidden',
      }}>
        {filtered.length === 0 ? (
          <div style={{
            padding: '60px 20px', textAlign: 'center',
            color: 'rgba(240,236,228,0.3)', fontSize: '14px',
          }}>
            No reports match the current filters.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  {['Period', 'Branch', 'Partner', 'Payout model', 'Gross Sales', 'Final Payout', 'Status', 'Updated', ''].map(h => (
                    <th key={h} style={TH}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr
                    key={r.id}
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                  >
                    {/* Period */}
                    <td style={{ ...TD, color: '#F0ECE4', fontWeight: '500', whiteSpace: 'nowrap' }}>
                      {fmtPeriod(r.reporting_month, r.reporting_year)}
                    </td>

                    {/* Branch */}
                    <td style={TD}>
                      <span style={{ color: 'rgba(240,236,228,0.8)' }}>{r.branch_name}</span>
                      {r.branch_code && (
                        <span style={{
                          marginLeft: '6px', fontSize: '10px', fontFamily: 'monospace',
                          color: 'rgba(240,236,228,0.3)',
                        }}>{r.branch_code}</span>
                      )}
                    </td>

                    {/* Partner */}
                    <td style={{ ...TD, color: 'rgba(240,236,228,0.5)' }}>
                      {r.partner_name}
                      {r.is_vat_registered && (
                        <span style={{
                          marginLeft: '6px', fontSize: '10px', fontWeight: '700',
                          letterSpacing: '0.06em', padding: '1px 5px', borderRadius: '4px',
                          background: 'rgba(59,130,246,0.1)', color: '#60A5FA',
                          border: '1px solid rgba(59,130,246,0.2)',
                        }}>VAT</span>
                      )}
                    </td>

                    {/* Payout model */}
                    <td style={TD}>
                      <PayoutModelCell r={r} />
                    </td>

                    {/* Gross Sales */}
                    <td style={{ ...TD, color: 'rgba(240,236,228,0.6)', whiteSpace: 'nowrap' }}>
                      {fmtTHB(r.gross_sales)}
                    </td>

                    {/* Final Payout */}
                    <td style={{ ...TD, whiteSpace: 'nowrap' }}>
                      <span style={{ color: '#F1F5F9', fontWeight: '700' }}>
                        {fmtTHB(r.final_payout)}
                      </span>
                      {r.vat_amount > 0 && (
                        <div style={{ fontSize: '10px', color: 'rgba(240,236,228,0.3)', marginTop: '2px' }}>
                          incl. {fmtTHB(r.vat_amount)} VAT
                        </div>
                      )}
                      {r.has_negative_adjusted_net && (
                        <div style={{ fontSize: '10px', color: '#EF4444', marginTop: '2px' }}>
                          ⚠ neg. net
                        </div>
                      )}
                    </td>

                    {/* Status */}
                    <td style={TD}>
                      <StatusBadge status={r.status as 'draft'} />
                    </td>

                    {/* Updated */}
                    <td style={{ ...TD, color: 'rgba(240,236,228,0.35)', fontSize: '11px', whiteSpace: 'nowrap' }}>
                      {fmtDate(r.updated_at)}
                    </td>

                    {/* Action */}
                    <td style={{ ...TD, textAlign: 'right' }}>
                      <Link
                        href={`/admin/reports/${r.id}`}
                        style={{
                          fontSize: '12px',
                          color: 'rgba(59,130,246,0.8)',
                          textDecoration: 'none',
                          fontWeight: '500',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        View →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
