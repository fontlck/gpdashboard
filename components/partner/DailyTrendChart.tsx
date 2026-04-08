'use client'

import { useState, useMemo } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

export type ArtistDayEntry = {
  artist: string   // artist_name_raw (or '(Unknown)')
  gross:  number
  net:    number
  orders: number
}

export type DayData = {
  day:     number
  gross:   number
  net:     number
  orders:  number
  artists: ArtistDayEntry[]
}

type Mode = 'gross' | 'net' | 'orders'

// ── Ocean Depth palette — 8 slots, cycles if more artists ─────────────────────

const OCEAN_PALETTE = [
  { bar: 'rgba(0,212,255,0.78)',   dot: '#00D4FF' },  // cyan
  { bar: 'rgba(0,153,204,0.78)',   dot: '#0099CC' },  // deep sky
  { bar: 'rgba(56,189,248,0.72)',  dot: '#38BDF8' },  // sky blue
  { bar: 'rgba(34,211,238,0.68)',  dot: '#22D3EE' },  // teal
  { bar: 'rgba(14,165,233,0.72)',  dot: '#0EA5E9' },  // blue-sky
  { bar: 'rgba(96,165,250,0.68)',  dot: '#60A5FA' },  // soft blue
  { bar: 'rgba(0,180,216,0.72)',   dot: '#00B4D8' },  // ocean mid
  { bar: 'rgba(72,202,228,0.65)',  dot: '#48CAE4' },  // light teal
]

// ── Helpers ───────────────────────────────────────────────────────────────────

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function fmtTHB(v: number) {
  return '฿' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtValue(v: number, mode: Mode) {
  return mode === 'orders' ? v.toLocaleString() : fmtTHB(v)
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

  // ── All unique artist names, stable order (by total desc) ─────────────────

  const artists = useMemo(() => {
    const totals = new Map<string, number>()
    for (const d of data) {
      for (const a of d.artists) {
        totals.set(a.artist, (totals.get(a.artist) ?? 0) + a.gross)
      }
    }
    return [...totals.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name], i) => ({ name, palette: OCEAN_PALETTE[i % OCEAN_PALETTE.length] }))
  }, [data])

  const artistIndex = useMemo(() => {
    const m = new Map<string, number>()
    artists.forEach((a, i) => m.set(a.name, i))
    return m
  }, [artists])

  // ── Derived values per day ─────────────────────────────────────────────────

  const values = useMemo(() =>
    data.map(d => mode === 'gross' ? d.gross : mode === 'net' ? d.net : d.orders),
  [data, mode])

  const maxVal  = Math.max(...values, 1)
  const bestIdx = useMemo(() => {
    let idx = 0
    values.forEach((v, i) => { if (v > values[idx]) idx = i })
    return values[idx] > 0 ? idx : -1
  }, [values])

  const lowestIdx = useMemo(() => {
    let idx = -1
    values.forEach((v, i) => { if (v > 0 && (idx === -1 || v < values[idx])) idx = i })
    return idx
  }, [values])

  const activeDays = values.filter(v => v > 0).length
  const totalVal   = values.reduce((a, b) => a + b, 0)
  const avgVal     = activeDays > 0 ? totalVal / activeDays : 0

  const tabs: { key: Mode; label: string }[] = [
    { key: 'gross',  label: 'Gross Sales' },
    { key: 'net',    label: 'NET'         },
    { key: 'orders', label: 'Orders'      },
  ]

  const stats = [
    { label: 'Best Day',          value: bestIdx   >= 0 ? fmtValue(values[bestIdx],   mode) : '—', sub: bestIdx   >= 0 ? `${monthName} ${data[bestIdx].day}`   : 'no activity' },
    { label: 'Lowest Active Day', value: lowestIdx >= 0 ? fmtValue(values[lowestIdx], mode) : '—', sub: lowestIdx >= 0 ? `${monthName} ${data[lowestIdx].day}` : 'no activity' },
    { label: 'Avg / Active Day',  value: activeDays > 0 ? fmtValue(avgVal, mode) : '—',             sub: 'active days only'                                                    },
    { label: 'Active Days',       value: `${activeDays}`,                                           sub: `of ${data.length} days`                                              },
  ]

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{
      background: '#0D0F1A',
      border: '1px solid rgba(0,212,255,0.1)',
      borderRadius: '16px',
      padding: '28px',
    }}>

      {/* ── Header ── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'flex-start', marginBottom: '20px',
        flexWrap: 'wrap', gap: '12px',
      }}>
        <div>
          <h2 style={{
            margin: '0 0 12px', fontSize: '11px', fontWeight: '600',
            color: 'rgba(200,240,255,0.35)',
            letterSpacing: '0.1em', textTransform: 'uppercase',
          }}>
            Daily Trend — {monthName} {year}
          </h2>

          {/* Artist legend */}
          {artists.length > 0 && (
            <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
              {artists.map(a => (
                <div key={a.name} style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  fontSize: '11px', color: 'rgba(200,240,255,0.5)',
                }}>
                  <div style={{
                    width: '8px', height: '8px', borderRadius: '2px',
                    background: a.palette.dot, flexShrink: 0,
                    boxShadow: `0 0 4px ${a.palette.dot}66`,
                  }} />
                  {a.name === '(Unknown)' ? 'Unknown' : a.name}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tab switcher */}
        <div style={{
          display: 'flex', gap: '2px',
          background: 'rgba(0,212,255,0.05)',
          borderRadius: '10px', padding: '3px',
          alignSelf: 'flex-start',
        }}>
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setMode(t.key)}
              style={{
                padding: '6px 16px', borderRadius: '7px',
                border: 'none', cursor: 'pointer',
                fontSize: '12px', fontWeight: '500',
                background: mode === t.key ? 'rgba(0,212,255,0.12)' : 'transparent',
                color:      mode === t.key ? '#00D4FF'               : 'rgba(200,240,255,0.35)',
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

        {/* Grid lines */}
        <div style={{ position: 'absolute', inset: '0 0 28px 0', pointerEvents: 'none', zIndex: 0 }}>
          {[0.25, 0.5, 0.75].map(pct => (
            <div key={pct} style={{
              position: 'absolute', top: `${(1 - pct) * 100}%`,
              left: 0, right: 0, height: '1px',
              background: 'rgba(0,212,255,0.05)',
            }} />
          ))}
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, height: '1px',
            background: 'rgba(0,212,255,0.18)',
          }} />
        </div>

        {/* Bars */}
        <div style={{
          display: 'flex', alignItems: 'flex-end',
          height: '280px', gap: '2px',
          position: 'relative', zIndex: 1, paddingBottom: '1px',
        }}>
          {data.map((d, i) => {
            const val       = values[i]
            const isZero    = val === 0
            const heightPct = isZero ? 0 : Math.max((val / maxVal) * 100, 2)
            const isHov     = hovered === i
            const isBest    = i === bestIdx

            // Artist segments (bottom-up = column-reverse)
            const sum = d.artists.reduce((s, a) => {
              const v = mode === 'gross' ? a.gross : mode === 'net' ? a.net : a.orders
              return s + v
            }, 0)

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
                  display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
                }}
              >
                {isZero ? (
                  <div style={{
                    width: '100%', height: '3px', borderRadius: '2px',
                    background: 'rgba(0,212,255,0.06)',
                  }} />
                ) : (
                  <div style={{
                    position: 'absolute', inset: 0,
                    display: 'flex', flexDirection: 'column-reverse',
                    borderRadius: '2px 2px 0 0',
                    overflow: 'hidden',
                    opacity: isHov ? 1 : 0.88,
                    transition: 'opacity 0.12s ease',
                    boxShadow: isHov ? `0 0 10px rgba(0,212,255,0.3)` : 'none',
                  }}>
                    {/* Segments per artist */}
                    {sum > 0 && d.artists.map(a => {
                      const v = mode === 'gross' ? a.gross : mode === 'net' ? a.net : a.orders
                      if (v <= 0) return null
                      const idx = artistIndex.get(a.artist) ?? 0
                      const pal = OCEAN_PALETTE[idx % OCEAN_PALETTE.length]
                      return (
                        <div
                          key={a.artist}
                          style={{
                            width: '100%',
                            height: `${(v / sum) * 100}%`,
                            background: pal.bar,
                          }}
                        />
                      )
                    })}
                    {/* Fallback if no artist data */}
                    {sum === 0 && (
                      <div style={{ width: '100%', height: '100%', background: 'rgba(0,212,255,0.4)' }} />
                    )}
                  </div>
                )}

                {/* Best-day dot */}
                {isBest && !isZero && (
                  <div style={{
                    position: 'absolute', top: '-8px', left: '50%',
                    transform: 'translateX(-50%)',
                    width: '5px', height: '5px', borderRadius: '50%',
                    background: '#00D4FF',
                    boxShadow: '0 0 8px rgba(0,212,255,0.9)',
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
                flex: 1, textAlign: 'center', fontSize: '10px', minWidth: 0,
                color: show ? 'rgba(200,240,255,0.22)' : 'transparent',
              }}>
                {d.day}
              </div>
            )
          })}
        </div>

        {/* Hover tooltip */}
        {hovered !== null && (() => {
          const d   = data[hovered]
          const val = values[hovered]
          const isLeft  = hovered < 3
          const isRight = hovered > data.length - 4
          return (
            <div style={{
              position: 'absolute', top: '-8px',
              left: `${((hovered + 0.5) / data.length) * 100}%`,
              transform: isLeft ? 'translateX(0%)' : isRight ? 'translateX(-100%)' : 'translateX(-50%)',
              background: 'rgba(5,8,20,0.97)',
              border: '1px solid rgba(0,212,255,0.18)',
              borderRadius: '10px', padding: '10px 14px',
              pointerEvents: 'none', whiteSpace: 'nowrap',
              zIndex: 20, boxShadow: '0 6px 24px rgba(0,0,0,0.6)',
              minWidth: '150px',
            }}>
              <div style={{
                fontSize: '11px', color: 'rgba(200,240,255,0.4)',
                marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px',
              }}>
                {monthName} {d.day}
                {hovered === bestIdx && (
                  <span style={{
                    fontSize: '9px', fontWeight: '700',
                    color: '#00D4FF', letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    background: 'rgba(0,212,255,0.1)',
                    padding: '1px 6px', borderRadius: '4px',
                  }}>
                    Best
                  </span>
                )}
              </div>
              <div style={{
                fontSize: '15px', fontWeight: '700', color: '#E0F8FF',
                letterSpacing: '-0.01em', fontVariantNumeric: 'tabular-nums',
                marginBottom: val > 0 && d.artists.length > 0 ? '8px' : 0,
                paddingBottom: val > 0 && d.artists.length > 0 ? '8px' : 0,
                borderBottom: val > 0 && d.artists.length > 0 ? '1px solid rgba(0,212,255,0.1)' : 'none',
              }}>
                {fmtValue(val, mode)}
              </div>
              {val > 0 && d.artists.map(a => {
                const v = mode === 'gross' ? a.gross : mode === 'net' ? a.net : a.orders
                if (v <= 0) return null
                const idx = artistIndex.get(a.artist) ?? 0
                const pal = OCEAN_PALETTE[idx % OCEAN_PALETTE.length]
                return (
                  <div key={a.artist} style={{
                    display: 'flex', justifyContent: 'space-between',
                    alignItems: 'center', gap: '20px', marginBottom: '4px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'rgba(200,240,255,0.5)' }}>
                      <div style={{ width: '7px', height: '7px', borderRadius: '2px', background: pal.dot, flexShrink: 0 }} />
                      {a.artist === '(Unknown)' ? 'Unknown' : a.artist}
                    </div>
                    <div style={{ fontSize: '12px', fontWeight: '600', color: '#E0F8FF', fontVariantNumeric: 'tabular-nums' }}>
                      {fmtValue(v, mode)}
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })()}
      </div>

      {/* ── Summary stats ── */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '1px', background: 'rgba(0,212,255,0.07)',
        borderRadius: '12px', overflow: 'hidden', marginTop: '22px',
      }}>
        {stats.map(s => (
          <div key={s.label} style={{ background: '#0D0F1A', padding: '16px 20px' }}>
            <div style={{
              fontSize: '10px', fontWeight: '600',
              letterSpacing: '0.08em', textTransform: 'uppercase',
              color: 'rgba(200,240,255,0.35)', marginBottom: '8px',
            }}>
              {s.label}
            </div>
            <div style={{
              fontSize: '16px', fontWeight: '700', color: '#E0F8FF',
              marginBottom: '4px', letterSpacing: '-0.015em',
              fontVariantNumeric: 'tabular-nums',
            }}>
              {s.value}
            </div>
            <div style={{ fontSize: '11px', color: 'rgba(200,240,255,0.25)' }}>
              {s.sub}
            </div>
          </div>
        ))}
      </div>

    </div>
  )
}
