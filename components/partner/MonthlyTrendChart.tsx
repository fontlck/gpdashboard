'use client'

import { useState, useMemo } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

export type MonthPoint = {
  label:           string  // "March 2026"
  shortLabel:      string  // "Mar"
  paidPayout:      number
  approvedPayout:  number
  totalPayout:     number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtTHB(n: number) {
  return `฿${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// ── Component ─────────────────────────────────────────────────────────────────

const CHART_H   = 140  // px — bar area height
const LABEL_H   = 28   // px — label row below bars
const GOLD      = '#C4A35E'
const GOLD_DIM  = 'rgba(196,163,94,0.38)'
const GOLD_HOV  = 'rgba(196,163,94,0.58)'
const GOLD_BEST = 'rgba(196,163,94,0.82)'
const AMBER     = 'rgba(245,158,11,0.22)'
const AMBER_BDR = 'rgba(245,158,11,0.35)'

export function MonthlyTrendChart({ data }: { data: MonthPoint[] }) {
  const [hovered, setHovered] = useState<number | null>(null)

  const maxVal = useMemo(() => Math.max(...data.map(d => d.totalPayout), 1), [data])

  const bestIdx = useMemo(() => {
    let best = 0
    data.forEach((d, i) => {
      if (d.paidPayout > data[best].paidPayout) best = i
    })
    return best
  }, [data])

  return (
    <div style={{
      background:   '#0D0F1A',
      border:       '1px solid rgba(255,255,255,0.06)',
      borderRadius: '16px',
      padding:      '24px',
      position:     'relative',
      overflow:     'hidden',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <span style={{
          fontSize: '11px', fontWeight: '600', letterSpacing: '0.1em',
          textTransform: 'uppercase', color: 'rgba(240,236,228,0.3)',
        }}>
          Revenue Trend
        </span>
        <div style={{ display: 'flex', gap: '14px' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'rgba(240,236,228,0.35)' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: GOLD, display: 'inline-block' }} />
            Paid
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'rgba(240,236,228,0.35)' }}>
            <span style={{
              width: '8px', height: '8px', borderRadius: '2px',
              background: AMBER, border: `1px solid ${AMBER_BDR}`, display: 'inline-block',
            }} />
            Approved
          </span>
        </div>
      </div>

      {/* Chart canvas */}
      <div style={{
        position: 'relative',
        height:   `${CHART_H + LABEL_H}px`,
      }}>
        {/* Horizontal grid lines */}
        {[0.25, 0.5, 0.75, 1].map(pct => (
          <div key={pct} style={{
            position:   'absolute',
            top:        `${(1 - pct) * CHART_H}px`,
            left:       0, right: 0, height: '1px',
            background: pct === 1
              ? 'rgba(255,255,255,0.06)'
              : 'rgba(255,255,255,0.03)',
          }} />
        ))}

        {/* Bars row */}
        <div style={{
          position: 'absolute',
          top: 0, bottom: `${LABEL_H}px`, left: 0, right: 0,
          display: 'flex', alignItems: 'flex-end', gap: '5px',
        }}>
          {data.map((d, i) => {
            const totalH    = maxVal > 0 ? (d.totalPayout   / maxVal) * CHART_H : 0
            const paidH     = maxVal > 0 ? (d.paidPayout    / maxVal) * CHART_H : 0
            const approvedH = Math.max(0, totalH - paidH)
            const isBest    = i === bestIdx && d.paidPayout > 0
            const isHov     = i === hovered

            return (
              <div
                key={d.label}
                style={{ flex: 1, position: 'relative', height: '100%', cursor: 'default' }}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
              >
                {/* Stacked bar — positioned from bottom */}
                {totalH > 0 && (
                  <div style={{
                    position:      'absolute',
                    bottom:        0,
                    left:          '1px', right: '1px',
                    height:        `${totalH}px`,
                    display:       'flex',
                    flexDirection: 'column',
                  }}>
                    {/* Approved — top portion */}
                    {approvedH > 0 && (
                      <div style={{
                        height:       `${approvedH}px`,
                        flexShrink:   0,
                        background:   isHov ? 'rgba(245,158,11,0.3)' : AMBER,
                        border:       `1px solid ${AMBER_BDR}`,
                        borderBottom: 'none',
                        borderRadius: '3px 3px 0 0',
                        transition:   'background 0.15s',
                      }} />
                    )}

                    {/* Paid — bottom portion */}
                    {paidH > 0 && (
                      <div style={{
                        height:       `${paidH}px`,
                        flexShrink:   0,
                        background:   isBest
                          ? GOLD_BEST
                          : isHov ? GOLD_HOV : GOLD_DIM,
                        borderRadius: approvedH > 0
                          ? '0'
                          : '3px 3px 0 0',
                        transition:   'background 0.15s',
                      }} />
                    )}
                  </div>
                )}

                {/* Best-day gold dot */}
                {isBest && (
                  <div style={{
                    position:     'absolute',
                    bottom:       `${totalH + 6}px`,
                    left:         '50%',
                    transform:    'translateX(-50%)',
                    width:        '5px', height: '5px',
                    borderRadius: '50%',
                    background:   GOLD,
                    boxShadow:    `0 0 6px rgba(196,163,94,0.7)`,
                    zIndex:       2,
                    pointerEvents: 'none',
                  }} />
                )}

                {/* Month label */}
                <div style={{
                  position:   'absolute',
                  bottom:     `-${LABEL_H - 4}px`,
                  left:       '50%',
                  transform:  'translateX(-50%)',
                  fontSize:   '10px',
                  color:      isBest ? 'rgba(196,163,94,0.8)' : 'rgba(240,236,228,0.22)',
                  whiteSpace: 'nowrap',
                  fontWeight: isBest ? '600' : '400',
                  userSelect: 'none',
                }}>
                  {d.shortLabel}
                </div>

                {/* Hover tooltip */}
                {isHov && (
                  <div style={{
                    position:      'absolute',
                    bottom:        `${totalH + 14}px`,
                    left:          '50%',
                    transform:     'translateX(-50%)',
                    background:    '#1A1C2E',
                    border:        '1px solid rgba(196,163,94,0.18)',
                    borderRadius:  '8px',
                    padding:       '8px 12px',
                    zIndex:        20,
                    whiteSpace:    'nowrap',
                    pointerEvents: 'none',
                    boxShadow:     '0 4px 24px rgba(0,0,0,0.5)',
                    minWidth:      '120px',
                  }}>
                    <div style={{ fontSize: '11px', color: 'rgba(240,236,228,0.45)', marginBottom: '5px' }}>
                      {d.label}{isBest && (
                        <span style={{
                          marginLeft: '6px', fontSize: '9px', fontWeight: '700',
                          color: GOLD, letterSpacing: '0.08em', textTransform: 'uppercase',
                        }}>Best</span>
                      )}
                    </div>
                    {d.paidPayout > 0 && (
                      <div style={{ fontSize: '14px', fontWeight: '700', color: GOLD, fontVariantNumeric: 'tabular-nums' }}>
                        {fmtTHB(d.paidPayout)}
                      </div>
                    )}
                    {d.approvedPayout > 0 && (
                      <div style={{ fontSize: '11px', color: '#F59E0B', marginTop: '3px', fontVariantNumeric: 'tabular-nums' }}>
                        + {fmtTHB(d.approvedPayout)} pending
                      </div>
                    )}
                    {d.paidPayout === 0 && d.approvedPayout === 0 && (
                      <div style={{ fontSize: '13px', color: 'rgba(240,236,228,0.3)' }}>฿0.00</div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Summary stats */}
      {data.length > 0 && (
        <div style={{
          display:      'flex',
          gap:          '28px',
          marginTop:    '16px',
          paddingTop:   '14px',
          borderTop:    '1px solid rgba(255,255,255,0.04)',
          flexWrap:     'wrap',
        }}>
          <div>
            <div style={{ fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(240,236,228,0.3)', marginBottom: '4px' }}>
              Best Month
            </div>
            <div style={{ fontSize: '13px', fontWeight: '600', color: GOLD }}>
              {data[bestIdx].label}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(240,236,228,0.3)', marginBottom: '4px' }}>
              Peak Payout
            </div>
            <div style={{ fontSize: '13px', fontWeight: '600', color: GOLD, fontVariantNumeric: 'tabular-nums' }}>
              {fmtTHB(data[bestIdx].paidPayout)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(240,236,228,0.3)', marginBottom: '4px' }}>
              Months Tracked
            </div>
            <div style={{ fontSize: '13px', fontWeight: '600', color: 'rgba(240,236,228,0.6)' }}>
              {data.length}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
