'use client'

import React, { useState, useMemo } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

export type ArtistSummaryRow = {
  id: string
  artist_name: string
  artist_image_url: string | null
  order_count: number
  gross_sales: number | string
  total_net: number | string
}

export type UpliftSnapshotEntry = {
  artist_name: string
  uplift_pct: number
  uplift_base: number
  uplift_vat: number
  uplift_total: number
}

type ArtistState = {
  enabled: boolean
  pct: string
}

type Props = {
  reportId:           string
  artists:            ArtistSummaryRow[]
  vatRate:            number       // e.g. 0.07
  isVatRegistered:    boolean
  partnerShareBase:   number       // ex-VAT partner share (before uplift)
  baseVatAmount:      number       // VAT on the partner share (before uplift)
  existingSnapshot:   UpliftSnapshotEntry[]
  locked:             boolean      // approved or paid — disables editing
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return '฿' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const TH: React.CSSProperties = {
  padding: '8px 0',
  textAlign: 'left',
  fontSize: '11px',
  fontWeight: '600',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'rgba(240,236,228,0.35)',
  whiteSpace: 'nowrap',
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ArtistUpliftTable({
  reportId,
  artists,
  vatRate,
  isVatRegistered,
  partnerShareBase,
  baseVatAmount,
  existingSnapshot,
  locked,
}: Props) {
  // ── Per-artist state initialised from existing snapshot ───────────────────

  const init = (): Record<string, ArtistState> => {
    const map: Record<string, ArtistState> = {}
    for (const a of artists) {
      if (a.artist_name === '(Unknown)') continue
      const snap = existingSnapshot.find(e => e.artist_name === a.artist_name)
      map[a.artist_name] = {
        enabled: snap != null && snap.uplift_pct > 0,
        pct:     snap ? String(snap.uplift_pct) : '0',
      }
    }
    return map
  }

  const [state,   setState]   = useState<Record<string, ArtistState>>(init)
  const [saving,  setSaving]  = useState(false)
  const [saveMsg, setSaveMsg] = useState<{ text: string; ok: boolean } | null>(null)

  // ── Live calculation ──────────────────────────────────────────────────────

  const rows = useMemo(() => artists.map(a => {
    if (a.artist_name === '(Unknown)') {
      return { ...a, enabled: false, pct: 0, upliftBase: 0, upliftVat: 0, upliftTotal: 0 }
    }
    const s          = state[a.artist_name]
    const pct        = Math.max(0, parseFloat(s?.pct ?? '0') || 0)
    const netExVat   = Number(a.total_net) / (1 + vatRate)
    const upliftBase = s?.enabled && pct > 0 ? netExVat * (pct / 100) : 0
    const upliftVat  = isVatRegistered ? upliftBase * vatRate : 0
    return { ...a, enabled: s?.enabled ?? false, pct, upliftBase, upliftVat, upliftTotal: upliftBase + upliftVat }
  }), [artists, state, vatRate, isVatRegistered])

  const totalUpliftBase = rows.reduce((s, r) => s + r.upliftBase, 0)
  const totalUpliftVat  = rows.reduce((s, r) => s + r.upliftVat,  0)
  const totalUplift     = totalUpliftBase + totalUpliftVat
  const finalPayout     = partnerShareBase + baseVatAmount + totalUplift

  // ── Save ──────────────────────────────────────────────────────────────────

  async function save() {
    setSaving(true)
    setSaveMsg(null)
    try {
      const entries = rows
        .filter(r => r.artist_name !== '(Unknown)' && r.enabled && r.pct > 0)
        .map(r => ({ artist_name: r.artist_name, uplift_pct: r.pct }))

      const res  = await fetch(`/api/admin/reports/${reportId}/uplift`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ entries }),
      })
      const data = await res.json()
      if (!res.ok) {
        setSaveMsg({ text: data.error ?? 'Save failed', ok: false })
      } else {
        setSaveMsg({ text: `✓ Saved — final payout updated to ${fmt(data.final_payout)}`, ok: true })
      }
    } catch {
      setSaveMsg({ text: 'Network error — please try again.', ok: false })
    } finally {
      setSaving(false)
      setTimeout(() => setSaveMsg(null), 6000)
    }
  }

  // ── Toggle helper ─────────────────────────────────────────────────────────

  function toggle(name: string) {
    setState(prev => ({
      ...prev,
      [name]: { ...prev[name], enabled: !prev[name]?.enabled },
    }))
  }

  function setPct(name: string, val: string) {
    setState(prev => ({ ...prev, [name]: { ...prev[name], pct: val } }))
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <th style={{ ...TH, width: 44 }}></th>
            <th style={TH}>Artist</th>
            <th style={TH}>Orders</th>
            <th style={TH}>Gross Sales</th>
            <th style={TH}>NET</th>
            <th style={{ ...TH, textAlign: 'center', width: 64 }}>Uplift</th>
            <th style={{ ...TH, width: 100 }}>%</th>
            <th style={{ ...TH, textAlign: 'right' }}>Uplift Amount</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(a => {
            const isUnknown = a.artist_name === '(Unknown)'
            const s = state[a.artist_name]

            return (
              <tr key={a.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                {/* Avatar */}
                <td style={{ padding: '10px 0' }}>
                  {a.artist_image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={a.artist_image_url}
                      alt=""
                      style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', border: '1px solid rgba(255,255,255,0.1)', display: 'block' }}
                    />
                  ) : (
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', color: 'rgba(240,236,228,0.2)' }}>?</div>
                  )}
                </td>

                {/* Name */}
                <td style={{ padding: '10px 0', color: isUnknown ? 'rgba(240,236,228,0.3)' : '#F0ECE4' }}>
                  {isUnknown ? '—' : a.artist_name}
                </td>

                {/* Orders */}
                <td style={{ padding: '10px 0', color: 'rgba(240,236,228,0.7)' }}>{a.order_count}</td>

                {/* Gross */}
                <td style={{ padding: '10px 0', color: 'rgba(240,236,228,0.7)', fontVariantNumeric: 'tabular-nums' }}>
                  {fmt(Number(a.gross_sales))}
                </td>

                {/* NET */}
                <td style={{ padding: '10px 0', color: 'rgba(240,236,228,0.7)', fontVariantNumeric: 'tabular-nums' }}>
                  {fmt(Number(a.total_net))}
                </td>

                {/* Toggle */}
                <td style={{ padding: '10px 0', textAlign: 'center' }}>
                  {!isUnknown && (
                    <button
                      onClick={() => !locked && toggle(a.artist_name)}
                      disabled={locked}
                      title={locked ? 'Report is locked' : (s?.enabled ? 'Disable uplift' : 'Enable uplift')}
                      style={{
                        width: 36, height: 20, borderRadius: 10, border: 'none', padding: 0,
                        background: s?.enabled ? '#3B82F6' : 'rgba(255,255,255,0.12)',
                        cursor: locked ? 'default' : 'pointer',
                        position: 'relative', flexShrink: 0, display: 'inline-block',
                        transition: 'background 0.15s',
                      }}
                      aria-label={`Toggle uplift for ${a.artist_name}`}
                    >
                      <span style={{
                        display: 'block', width: 14, height: 14, borderRadius: '50%',
                        background: '#fff',
                        position: 'absolute', top: 3,
                        left: s?.enabled ? 19 : 3,
                        transition: 'left 0.15s',
                      }} />
                    </button>
                  )}
                </td>

                {/* % input */}
                <td style={{ padding: '10px 0' }}>
                  {!isUnknown && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={0.5}
                        disabled={locked || !s?.enabled}
                        value={s?.pct ?? '0'}
                        onChange={e => setPct(a.artist_name, e.target.value)}
                        style={{
                          width: 60,
                          background: s?.enabled && !locked ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.03)',
                          border: `1px solid ${s?.enabled && !locked ? 'rgba(59,130,246,0.4)' : 'rgba(255,255,255,0.08)'}`,
                          borderRadius: 6,
                          color: s?.enabled && !locked ? '#F0ECE4' : 'rgba(240,236,228,0.3)',
                          fontSize: '12px', padding: '4px 8px', textAlign: 'right',
                          outline: 'none',
                        }}
                      />
                      <span style={{ fontSize: '11px', color: 'rgba(240,236,228,0.3)' }}>%</span>
                    </div>
                  )}
                </td>

                {/* Uplift amount */}
                <td style={{
                  padding: '10px 0', textAlign: 'right',
                  fontVariantNumeric: 'tabular-nums',
                  color: a.upliftTotal > 0 ? '#60A5FA' : 'rgba(241,245,249,0.2)',
                  fontWeight: a.upliftTotal > 0 ? '600' : '400',
                }}>
                  {a.upliftTotal > 0 ? `+${fmt(a.upliftTotal)}` : '—'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {/* ── Summary + Save ─────────────────────────────────────────────────── */}
      <div style={{
        marginTop: 16, paddingTop: 16,
        borderTop: '1px solid rgba(255,255,255,0.08)',
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'flex-end', gap: 16, flexWrap: 'wrap',
      }}>
        {/* Uplift breakdown */}
        <div style={{ fontSize: '12px', color: 'rgba(241,245,249,0.45)', lineHeight: 2 }}>
          {totalUpliftBase > 0 ? (
            <>
              <span>Uplift base: <strong style={{ color: '#60A5FA' }}>{fmt(totalUpliftBase)}</strong></span>
              {isVatRegistered && totalUpliftVat > 0 && (
                <span style={{ marginLeft: 16 }}>
                  + VAT: <strong style={{ color: '#60A5FA' }}>{fmt(totalUpliftVat)}</strong>
                </span>
              )}
              <span style={{ marginLeft: 16 }}>
                → Total uplift: <strong style={{ color: '#60A5FA' }}>{fmt(totalUplift)}</strong>
              </span>
            </>
          ) : (
            <span>No uplift configured.</span>
          )}
        </div>

        {/* Projected payout + save */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
          <div style={{ fontSize: '13px', color: 'rgba(241,245,249,0.55)' }}>
            Projected final payout:{' '}
            <strong style={{ fontSize: '15px', color: '#F1F5F9', fontVariantNumeric: 'tabular-nums' }}>
              {fmt(finalPayout)}
            </strong>
          </div>

          {!locked && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {saveMsg && (
                <span style={{
                  fontSize: '12px',
                  color: saveMsg.ok ? '#4ADE80' : '#F87171',
                }}>
                  {saveMsg.text}
                </span>
              )}
              <button
                onClick={save}
                disabled={saving}
                style={{
                  padding: '7px 18px', borderRadius: 8,
                  fontSize: '12px', fontWeight: '700',
                  border: 'none',
                  cursor: saving ? 'default' : 'pointer',
                  background: saving ? 'rgba(59,130,246,0.3)' : 'rgba(59,130,246,0.85)',
                  color: '#fff',
                  opacity: saving ? 0.6 : 1,
                }}
              >
                {saving ? 'Saving…' : 'Save uplift'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
