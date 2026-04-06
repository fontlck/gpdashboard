'use client'

import { useState, useMemo } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

export type DayData = {
  day:    number   // 1-31
  gross:  number   // sum(amount)
  net:    number   // sum(net)
  orders: number   // count(*)
}

type Mode = 'gross' | 'net' | 'orders'

// ── Helpers ───────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'Jan','Feb','Mar','Apr','May','Jun',
  'Jul','Aug','Sep','Oct','Nov','Dec',
]

function fmtTHB(v: number) {
  return '฿' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtValue(v: number, mode: Mode) {
  if (mode === 'orders') return v.toLocaleString()
  return fmtTHB(v)
}

// ── Component ─────────────────────────────────────────────────────────────────

export function DailyTrendChart({
  data,
  month,
  year,
}: {
  data:  DayData[]
  month: number
  year:  number
}) {
  const [mode, setMode]       = useState<Mode>('gross')
  const [hovered, setHovered] = useState<number | null>(null)

  const monthName = MONTH_NAMES[month - 1]

  // ── Derived series ─────────────────────────────────────────────────────────

  const values = useMemo(() =>
    data.map(d => mode === 'gross' ? d.gross : mode === 'net' ? d.net : d.orders),
  [data, mode])

  const maxVal       = Math.max(...values, 1)
  const activeDays   = values.filter(v => v > 0).length
  const totalVal     = values.reduce((a, b) => a + b, 0)
  const avgVal       = activeDays > 0 ? totalVal / activeDays : 0

  const bestIdx = useMemo(() => {
    let idx = -1, best = -Infinity
    values.forEach((v, i) => { if (v > best) { best = v; idx = i } })
    return best > 0 ? idx : -1
  }, [values])

  const lowestActiveIdx = useMemo(() => {
    let idx = -1, low = Infinity
    values.forEach((v, i) => { if (v > 0 && v < low) { low = v; idx = i } })
    return idx
  }, [values])

  // ── Tabs ───────────────────────────────────────────────────────────────────

  const tabs: { key: Mode; label: string }[] = [
    { key: 'gross',  label: 'Gross Sales' },
    { key: 'net',    label: 'NET' },
    { key: 'orders', label: 'Orders' },
  ]

  // ── Summary stats ──────────────────────────────────────────────────────────

  const stats = [
    {
      label: 'Best Day',
      value: bestIdx >= 0 ? fmtValue(values[bestIdx], mode) : '—',
      sub:   bestIdx >= 0 ? `${monthName} ${data[bestIdx].day}` : 'no activity',
    },
    {
      label: 'Lowest Active Day',
      value: lowestActiveIdx >= 0 ? fmtValue(values[lowestActiveIdx], mode) : '—',
      sub:   lowestActiveIdx >= 0 ? `${monthName} ${data[lowestActiveIdx].day}` : 'no activity',
    },
    {
      label: 'Avg / Active Day',
      value: activeDays > 0 ? fmtValue(avgVal, mode) : '—',
      sub:   'active days only',
    },
    {
      label: 'Active Days',
      value: `${activeDays}`,
      sub:   `of ${data.length} days`,
    },
  ]

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{
      background: '#0D0F1A',
      border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: '16px',
      padding: '24px',
      gridColumn: '1 / -1',
    }}>

      {/* ── Header ── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: '24px',
        flexWrap: 'wrap', gap: '12px',
      }}>
        <h2 style={{
          margin: 0, fontSize: '14px', fontWeight: '600',
          color: 'rgba(240,236,228,0.6)',
          letterSpacing: '0.08em', textTransform: 'uppercase',
        }}>
          Daily Trend — {monthName} {year}
        </h2>

        {/* Tab switcher */}
        <div style={{
          display: 'flex', gap: '3px',
          background: 'rgba(255,255,255,0.04)',
          borderRadius: '10px', padding: '3px',
        }}>
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setMode(t.key)}
              style={{
                padding: '6px 16px', borderRadius: '7px',
                border: 'none', cursor: 'pointer',
                fontSize: '12px', fontWeight: '500',
                background: mode === t.key ? 'rgba(196,163,94,0.15)' : 'transparent',
                color: mode === t.key ? '#C4A35E' : 'rgba(240,236,228,0.4)',
                transition: 'all 0.15s ease',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Chart ── */}
      <div style={{ position: 'relative', userSelect: 'none' }}>

        {/* Horizontal grid lines */}
        <div style={{
          position: 'absolute', inset: '0 0 28px 0',
          pointerEvents: 'none', zIndex: 0,
        }}>
          {[0.25, 0.5, 0.75].map(pct => (
            <div key={pct} style={{
              position: 'absolute',
              top: `${(1 - pct) * 100}%`,
              left: 0, right: 0,
              height: '1px',
              background: 'rgba(255,255,255,0.05)',
            }} />
          ))}
          {/* Baseline */}
          <div style={{
            position: 'absolute', bottom: 0,
            left: 0, right: 0, height: '1px',
            background: 'rgba(255,255,255,0.08)',
          }} />
        </div>

        {/* Bars */}
        <div style={{
          display: 'flex', alignItems: 'flex-end',
          height: '150px', gap: '2px',
          position: 'relative', zIndex: 1,
          paddingBottom: '1px',
        }}>
          {data.map((d, i) => {
            const val      = values[i]
            const isZero   = val === 0
            const heightPct = isZero
              ? 0.5
              : Math.max((val / maxVal) * 100, 2)
            const isHov   = hovered === i
            const isBest  = i === bestIdx

            let barBg: string
            if (isZero)      barBg = 'rgba(255,255,255,0.05)'
            else if (isHov)  barBg = 'rgba(196,163,94,0.85)'
            else if (isBest) barBg = 'rgba(196,163,94,0.65)'
            else             barBg = 'rgba(196,163,94,0.4)'

            return (
              <div
                key={i}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
                style={{
                  flex: 1,
                  height: `${heightPct}%`,
                  background: barBg,
                  borderRadius: '2px 2px 0 0',
                  transition: 'background 0.1s ease',
                  cursor: 'default',
                  minWidth: 0,
                }}
              />
            )
          })}
        </div>

        {/* X-axis labels */}
        <div style={{
          display: 'flex', marginTop: '6px',
          paddingBottom: '4px',
        }}>
          {data.map((d, i) => {
            const show = d.day === 1 || d.day % 5 === 0 || d.day === data.length
            return (
              <div key={i} style={{
                flex: 1, textAlign: 'center',
                fontSize: '10px',
                color: show ? 'rgba(240,236,228,0.25)' : 'transparent',
                minWidth: 0,
              }}>
                {d.day}
              </div>
            )
          })}
        </div>

        {/* Hover tooltip */}
        {hovered !== null && (
          <div style={{
            position: 'absolute',
            // anchor above the chart, horizontally centered over the bar
            top: '-4px',
            left: `${((hovered + 0.5) / data.length) * 100}%`,
            transform: hovered < 3
              ? 'translateX(0%)'
              : hovered > data.length - 4
              ? 'translateX(-100%)'
              : 'translateX(-50%)',
            background: 'rgba(8,10,20,0.96)',
            border: '1px solid rgba(196,163,94,0.25)',
            borderRadius: '8px',
            padding: '7px 12px',
            fontSize: '12px',
            color: '#F0ECE4',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            zIndex: 20,
            boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
          }}>
            <span style={{ color: 'rgba(240,236,228,0.4)', marginRight: '8px' }}>
              {monthName} {data[hovered].day}
            </span>
            <span style={{ fontWeight: '600', color: '#C4A35E' }}>
              {fmtValue(values[hovered], mode)}
            </span>
          </div>
        )}
      </div>

      {/* ── Summary stats ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '1px',
        background: 'rgba(255,255,255,0.05)',
        borderRadius: '10px',
        overflow: 'hidden',
        marginTop: '20px',
      }}>
        {stats.map(s => (
          <div key={s.label} style={{
            background: '#0D0F1A',
            padding: '14px 18px',
          }}>
            <div style={{
              fontSize: '10px', fontWeight: '600',
              letterSpacing: '0.07em', textTransform: 'uppercase',
              color: 'rgba(240,236,228,0.28)',
              marginBottom: '7px',
            }}>
              {s.label}
            </div>
            <div style={{
              fontSize: '15px', fontWeight: '700',
              color: '#F0ECE4',
              marginBottom: '3px',
              letterSpacing: '-0.01em',
            }}>
              {s.value}
            </div>
            <div style={{
              fontSize: '11px',
              color: 'rgba(240,236,228,0.28)',
            }}>
              {s.sub}
            </div>
          </div>
        ))}
      </div>

    </div>
  )
}
