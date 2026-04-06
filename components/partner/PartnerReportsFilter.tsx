'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
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

type Props = { reports: FilterableReport[] }

export function PartnerReportsFilter({ reports }: Props) {
  const years = useMemo(() => {
    const set = new Set(reports.map(r => r.reporting_year))
    return Array.from(set).sort((a, b) => b - a)
  }, [reports])

  const [selectedYear,  setSelectedYear]  = useState<string>('all')
  const [selectedMonth, setSelectedMonth] = useState<string>('all')

  const filtered = useMemo(() => {
    return reports.filter(r => {
      if (selectedYear  !== 'all' && r.reporting_year  !== parseInt(selectedYear))  return false
      if (selectedMonth !== 'all' && r.reporting_month !== parseInt(selectedMonth)) return false
      return true
    })
  }, [reports, selectedYear, selectedMonth])

  // ── Styles ──────────────────────────────────────────────────────────────────

  const selectStyle: React.CSSProperties = {
    padding: '8px 14px', borderRadius: '8px',
    border: '1px solid rgba(255,255,255,0.1)',
    background: 'rgba(255,255,255,0.04)', color: '#F0ECE4',
    fontSize: '13px', cursor: 'pointer', outline: 'none',
    appearance: 'none',
  }

  const thStyle: React.CSSProperties = {
    padding: '12px 20px', textAlign: 'left',
    fontSize: '11px', fontWeight: '600', letterSpacing: '0.08em',
    textTransform: 'uppercase', color: 'rgba(240,236,228,0.35)',
    whiteSpace: 'nowrap',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  }

  const tdStyle: React.CSSProperties = {
    padding: '14px 20px', verticalAlign: 'middle',
    borderBottom: '1px solid rgba(255,255,255,0.04)',
  }

  return (
    <div style={{
      background: '#0D0F1A', border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: '16px', overflow: 'hidden',
    }}>
      {/* Table header row */}
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px',
      }}>
        <h2 style={{ margin: 0, fontSize: '15px', fontWeight: '600', color: '#F0ECE4' }}>
          Monthly Reports
        </h2>

        {/* Filters */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {/* Year */}
          <select
            value={selectedYear}
            onChange={e => { setSelectedYear(e.target.value); setSelectedMonth('all') }}
            style={selectStyle}
          >
            <option value="all">All years</option>
            {years.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>

          {/* Month — only enabled when a year is selected */}
          <select
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
            disabled={selectedYear === 'all'}
            style={{ ...selectStyle, opacity: selectedYear === 'all' ? 0.4 : 1 }}
          >
            <option value="all">All months</option>
            {MONTHS.map((m, i) => (
              <option key={i + 1} value={i + 1}>{m}</option>
            ))}
          </select>

          {/* Clear */}
          {(selectedYear !== 'all' || selectedMonth !== 'all') && (
            <button
              onClick={() => { setSelectedYear('all'); setSelectedMonth('all') }}
              style={{
                padding: '8px 12px', borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.08)',
                background: 'transparent', color: 'rgba(240,236,228,0.4)',
                fontSize: '12px', cursor: 'pointer',
              }}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div style={{ padding: '48px 24px', textAlign: 'center' }}>
          <p style={{ fontSize: '14px', color: 'rgba(240,236,228,0.3)', margin: 0 }}>
            No reports match the selected period.
          </p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr>
                <th style={thStyle}>Period</th>
                <th style={thStyle}>Branch</th>
                <th style={thStyle}>Payout Model</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Your Payout</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Updated</th>
                <th style={thStyle}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => {
                // "Updated" = paid_at if paid, else approved_at
                const updatedDate = r.status === 'paid' ? r.paid_at : r.approved_at

                return (
                  <tr key={r.id}>
                    <td style={{ ...tdStyle, color: '#F0ECE4', fontWeight: '500', whiteSpace: 'nowrap' }}>
                      {fmtPeriod(r.reporting_month, r.reporting_year)}
                    </td>
                    <td style={{ ...tdStyle, color: 'rgba(240,236,228,0.7)' }}>
                      {r.branch_name}
                    </td>
                    <td style={{ ...tdStyle, color: 'rgba(240,236,228,0.5)', fontSize: '12px' }}>
                      {payoutModelLabel(r.payout_type_snapshot)}
                    </td>
                    <td style={{
                      ...tdStyle, textAlign: 'right',
                      color: '#C4A35E', fontWeight: '700', whiteSpace: 'nowrap',
                    }}>
                      {fmtTHB(Number(r.final_payout))}
                    </td>
                    <td style={tdStyle}>
                      <StatusBadge status={r.status as 'approved'} />
                    </td>
                    <td style={{ ...tdStyle, color: 'rgba(240,236,228,0.4)', fontSize: '12px', whiteSpace: 'nowrap' }}>
                      {fmtDate(updatedDate)}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      <Link
                        href={`/dashboard/reports/${r.id}`}
                        style={{
                          fontSize: '12px', color: 'rgba(196,163,94,0.8)',
                          textDecoration: 'none', fontWeight: '600',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        View →
                      </Link>
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
