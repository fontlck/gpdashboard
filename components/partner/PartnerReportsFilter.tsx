'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { StatusBadge } from '@/components/shared/StatusBadge'

// ── Types ─────────────────────────────────────────────────────────────────────

export type FilterableReport = {
  id: string
  reporting_month: number
  reporting_year: number
  status: string
  final_payout: number | string | null
  payout_type_snapshot: string
  approved_at: string | null
  paid_at: string | null
  branch_name: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtTHB(n: number) {
  return `฿${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtPeriod(month: number, year: number) {
  const m = new Date(year, month - 1, 1).toLocaleString('en-US', { month: 'long' })
  return `${m} ${year}`
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function payoutModelLabel(type: string) {
  return type === 'fixed_rent' ? 'Fixed rent' : 'Revenue share'
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

// ── Component ─────────────────────────────────────────────────────────────────

type Props = {
  reports:    FilterableReport[]
  totalCount?: number
}

export function PartnerReportsFilter({ reports, totalCount }: Props) {
  const router = useRouter()

  const years = useMemo(() => {
    const set = new Set(reports.map(r => r.reporting_year))
    return Array.from(set).sort((a, b) => b - a)
  }, [reports])

  const [selectedYear,  setSelectedYear]  = useState<string>('all')
  const [selectedMonth, setSelectedMonth] = useState<string>('all')
  const [hoveredId,     setHoveredId]     = useState<string | null>(null)

  const filtered = useMemo(() => {
    return reports.filter(r => {
      if (selectedYear  !== 'all' && r.reporting_year  !== parseInt(selectedYear))  return false
      if (selectedMonth !== 'all' && r.reporting_month !== parseInt(selectedMonth)) return false
      return true
    })
  }, [reports, selectedYear, selectedMonth])

  const hasFilter = selectedYear !== 'all' || selectedMonth !== 'all'

  // ── Styles ───────────────────────────────────────────────────────────────────

  const selectStyle: React.CSSProperties = {
    padding:     '7px 12px',
    borderRadius: '8px',
    border:       '1px solid rgba(255,255,255,0.08)',
    background:   'rgba(255,255,255,0.04)',
    color:        'rgba(240,236,228,0.65)',
    fontSize:     '12px',
    cursor:       'pointer',
    outline:      'none',
    appearance:   'none',
    letterSpacing: '0.01em',
  }

  const TH_BASE: React.CSSProperties = {
    padding:       '0 28px 14px',
    textAlign:     'left',
    fontSize:      '10px',
    fontWeight:    '600',
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color:         'rgba(240,236,228,0.28)',
    whiteSpace:    'nowrap',
    borderBottom:  '1px solid rgba(255,255,255,0.06)',
  }

  return (
    <div style={{
      background:   '#0D0F1A',
      border:       '1px solid rgba(255,255,255,0.06)',
      borderRadius: '20px',
      boxShadow:    '0 1px 0 rgba(255,255,255,0.05) inset, 0 12px 40px rgba(0,0,0,0.4)',
      overflow:     'hidden',
    }}>

      {/* ── Header row ──────────────────────────────────────────────────────── */}
      <div style={{
        padding:        '20px 28px',
        borderBottom:   '1px solid rgba(255,255,255,0.055)',
        display:        'flex',
        justifyContent: 'space-between',
        alignItems:     'center',
        gap:            '12px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{
            fontSize:      '11px',
            fontWeight:    '600',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color:         'rgba(240,236,228,0.35)',
          }}>
            Monthly Reports
          </span>
          <span style={{
            fontSize:     '11px',
            color:        'rgba(240,236,228,0.22)',
            background:   'rgba(255,255,255,0.05)',
            border:       '1px solid rgba(255,255,255,0.07)',
            borderRadius: '999px',
            padding:      '2px 8px',
          }}>
            {totalCount ?? reports.length}
          </span>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <select
            value={selectedYear}
            onChange={e => { setSelectedYear(e.target.value); setSelectedMonth('all') }}
            style={selectStyle}
          >
            <option value="all">All years</option>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>

          <select
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
            disabled={selectedYear === 'all'}
            style={{ ...selectStyle, opacity: selectedYear === 'all' ? 0.4 : 1 }}
          >
            <option value="all">All months</option>
            {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
          </select>

          {hasFilter && (
            <button
              onClick={() => { setSelectedYear('all'); setSelectedMonth('all') }}
              style={{
                padding:      '7px 12px',
                borderRadius: '8px',
                border:       '1px solid rgba(255,255,255,0.07)',
                background:   'transparent',
                color:        'rgba(240,236,228,0.35)',
                fontSize:     '12px',
                cursor:       'pointer',
              }}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* ── Table ───────────────────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div style={{ padding: '52px 28px', textAlign: 'center' }}>
          <p style={{ fontSize: '13px', color: 'rgba(240,236,228,0.28)', margin: 0 }}>
            No reports match the selected period.
          </p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ ...TH_BASE, paddingTop: '18px' }}>Period</th>
                <th style={{ ...TH_BASE, paddingTop: '18px' }}>Model</th>
                <th style={{ ...TH_BASE, paddingTop: '18px', textAlign: 'right' }}>Payout</th>
                <th style={{ ...TH_BASE, paddingTop: '18px' }}>Status</th>
                <th style={{ ...TH_BASE, paddingTop: '18px', textAlign: 'right' }}>Date</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => {
                const isHov      = hoveredId === r.id
                const updatedDate = r.status === 'paid' ? r.paid_at : r.approved_at

                return (
                  <tr
                    key={r.id}
                    onClick={() => router.push(`/dashboard/reports/${r.id}`)}
                    onMouseEnter={() => setHoveredId(r.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    style={{
                      background:  isHov ? 'rgba(255,255,255,0.025)' : 'transparent',
                      cursor:      'pointer',
                      transition:  'background 0.12s',
                    }}
                  >
                    {/* Period + branch */}
                    <td style={{ padding: '18px 28px', verticalAlign: 'middle', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <div style={{
                        fontSize:   '14px',
                        fontWeight: '600',
                        color:      '#F0ECE4',
                        whiteSpace: 'nowrap',
                        letterSpacing: '-0.01em',
                      }}>
                        {fmtPeriod(r.reporting_month, r.reporting_year)}
                      </div>
                      <div style={{
                        fontSize:   '11px',
                        color:      'rgba(240,236,228,0.3)',
                        marginTop:  '3px',
                        whiteSpace: 'nowrap',
                      }}>
                        {r.branch_name}
                      </div>
                    </td>

                    {/* Payout model */}
                    <td style={{ padding: '18px 28px', verticalAlign: 'middle', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <span style={{
                        fontSize:     '12px',
                        color:        'rgba(240,236,228,0.35)',
                        background:   'rgba(255,255,255,0.04)',
                        border:       '1px solid rgba(255,255,255,0.07)',
                        borderRadius: '6px',
                        padding:      '3px 8px',
                        whiteSpace:   'nowrap',
                      }}>
                        {payoutModelLabel(r.payout_type_snapshot)}
                      </span>
                    </td>

                    {/* Payout amount */}
                    <td style={{ padding: '18px 28px', verticalAlign: 'middle', textAlign: 'right', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <div style={{
                        fontSize:           '16px',
                        fontWeight:         '700',
                        color:              '#C4A35E',
                        whiteSpace:         'nowrap',
                        fontVariantNumeric: 'tabular-nums',
                        letterSpacing:      '-0.01em',
                      }}>
                        {fmtTHB(Number(r.final_payout))}
                      </div>
                    </td>

                    {/* Status badge */}
                    <td style={{ padding: '18px 28px', verticalAlign: 'middle', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <StatusBadge status={r.status as 'approved'} />
                    </td>

                    {/* Date */}
                    <td style={{ padding: '18px 28px', verticalAlign: 'middle', textAlign: 'right', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <div style={{ fontSize: '12px', color: 'rgba(240,236,228,0.3)', whiteSpace: 'nowrap' }}>
                        {fmtDate(updatedDate)}
                      </div>
                      {isHov && (
                        <div style={{ fontSize: '11px', color: 'rgba(196,163,94,0.6)', marginTop: '3px' }}>
                          View report →
                        </div>
                      )}
                    </td>
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
