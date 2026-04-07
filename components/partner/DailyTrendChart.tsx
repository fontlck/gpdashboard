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
      gold:  true,
    },
    {
      label: 'Lowest Active Day',
      value: lowestActiveIdx >= 0 ? fmtValue(values[lowestActiveIdx], mode) : '—',
      sub:   lowestActiveIdx >= 0 ? `${monthName} ${data[lowestActiveIdx].day}` : 'no activity',
      gold:  false,
    },
    {
      label: 'Avg / Active Day',
      value: activeDays > 0 ? fmtValue(avgVal, mode) : '—',
      sub:   'active days only',
      gold:  false,
    },
    {
      label: 'Active Days',
      value: `${activeDays}`,
      sub:   `of ${data.length} days`,
      gold:  false,
    },
  ]

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{
      background: '#0D0F1A',
      border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: '16px',
      padding: '28px',
      gridColumn: '1 / -1',
    }}>

      {/* ── Header ── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: '24px',
        flexWrap: 'wrap', gap: '12px',
      }}>
        <h2 style={{
          margin: 0, fontSize: '11px', fontWeight: '600',
          color: 'rgba(240,236,228,0.3)',
          letterSpacing: '0.1em', textTransform: 'uppercase',
        }}>
          Daily Trend — {monthName} {year}
        </h2>

        {/* Tab switcher */}
        <div style={{
          display: 'flex', gap: '2px',
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
                background: mode === t.key ? 'rgba(59,130,246,0.12)' : 'transparent',
                color: mode === t.key ? '#60A5FA' : 'rgba(241,245,249,0.38)',
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
          {[0.25, 0.5, 0.75, 1.0].map(pct => (
            <div key={pct} style={{
              position: 'absolute',
              top: `${(1 - pct) * 100}%`,
              left: 0, right: 0,
              height: '1px',
              background: pct === 1.0
                ? 'rgba(255,255,255,0.0)'
                : 'rgba(255,255,255,0.04)',
            }} />
          ))}
          {/* Baseline */}
          <div style={{
            position: 'absolute', bottom: 0,
            left: 0, right: 0, height: '1px',
            background: 'rgba(255,255,255,0.1)',
          }} />
        </div>

        {/* Bars + best-day dot */}
        <div style={{
          display: 'flex', alignItems: 'flex-end',
          height: '180px', gap: '2px',
          position: 'relative', zIndex: 1,
          paddingBottom: '1px',
        }}>
          {data.map((d, i) => {
            const val       = values[i]
            const isZero    = val === 0
            const heightPct = isZero
              ? 0.5
              : Math.max((val / maxVal) * 100, 2)
            const isHov    = hovered === i
            const isBest   = i === bestIdx

            let barBg: string
            if (isZero)       barBg = 'rgba(255,255,255,0.04)'
            else if (isHov)   barBg = 'rgba(59,130,246,0.9)'
            else if (isBest)  barBg = 'rgba(59,130,246,0.75)'
            else              barBg = 'rgba(59,130,246,0.35)'

            return (
              <div
                key={i}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
                style={{
                  flex: 1, minWidth: 0,
                  height: `${heightPct}%`,
                  position: 'relative',
                  cursor: 'default',
                }}
              >
                {/* The bar itself */}
                <div style={{
                  position: 'absolute', inset: 0,
                  background: barBg,
                  borderRadius: '2px 2px 0 0',
                  transition: 'background 0.12s ease',
                }} />
                {/* Best-day crown dot */}
                {isBest && !isZero && (
                  <div style={{
                    position: 'absolute',
                    top: '-7px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: '5px', height: '5px',
                    borderRadius: '50%',
                    background: '#3B82F6',
                    boxShadow: '0 0 6px rgba(59,130,246,0.7)',
                  }} />
                )}
              </div>
            )
          })}
        </div>

        {/* X-axis labels */}
        <div style={{ display: 'flex', marginTop: '7px' }}>
          {data.map((d, i) => {
            const show = d.day === 1 || d.day % 5 === 0 || d.day === data.length
            return (
              <div key={i} style={{
                flex: 1, textAlign: 'center',
                fontSize: '10px',
                color: show ? 'rgba(240,236,228,0.22)' : 'transparent',
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
            top: '-6px',
            left: `${((hovered + 0.5) / data.length) * 100}%`,
            transform: hovered < 3
              ? 'translateX(0%)'
              : hovered > data.length - 4
              ? 'translateX(-100%)'
              : 'translateX(-50%)',
            background: 'rgba(7,9,18,0.97)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '9px',
            padding: '9px 14px',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            zIndex: 20,
            boxShadow: '0 6px 20px rgba(0,0,0,0.5)',
          }}>
            <div style={{ fontSize: '11px', color: 'rgba(240,236,228,0.38)', marginBottom: '4px' }}>
              {monthName} {data[hovered].day}
              {hovered === bestIdx && (
                <span style={{
                  marginLeft: '6px', fontSize: '10px', fontWeight: '600',
                  color: 'rgba(59,130,246,0.9)', letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                }}>
                  Best
                </span>
              )}
            </div>
            <div style={{
              fontSize: '15px', fontWeight: '700', color: '#F1F5F9',
              letterSpacing: '-0.01em', fontVariantNumeric: 'tabular-nums',
            }}>
              {fmtValue(values[hovered], mode)}
            </div>
          </div>
        )}
      </div>

      {/* ── Summary stats ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '1px',
        background: 'rgba(255,255,255,0.05)',
        borderRadius: '12px',
        overflow: 'hidden',
        marginTop: '22px',
      }}>
        {stats.map(s => (
          <div key={s.label} style={{
            background: '#0D0F1A',
            padding: '16px 20px',
          }}>
            <div style={{
              fontSize: '10px', fontWeight: '600',
              letterSpacing: '0.08em', textTransform: 'uppercase',
              color: 'rgba(241,245,249,0.35)',
              marginBottom: '8px',
            }}>
              {s.label}
            </div>
            <div style={{
              fontSize: '16px', fontWeight: '700',
              color: '#F1F5F9',
              marginBottom: '4px',
              letterSpacing: '-0.015em',
              fontVariantNumeric: 'tabular-nums',
            }}>
              {s.value}
            </div>
            <div style={{
              fontSize: '11px',
              color: 'rgba(240,236,228,0.25)',
            }}>
              {s.sub}
            </div>
          </div>
        ))}
      </div>

    </div>
  )
}
