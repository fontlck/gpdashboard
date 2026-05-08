'use client'

import React, { useState, useMemo, useRef, useCallback } from 'react'
import { ArtistAvatar } from '@/components/shared/ArtistAvatar'

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

// ── Merge dialog ──────────────────────────────────────────────────────────────

function MergeDialog({
  sourceName, targetName, onConfirm, onCancel, merging,
}: {
  sourceName: string; targetName: string
  onConfirm: () => void; onCancel: () => void; merging: boolean
}) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: '#111827', border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '14px', padding: '28px 32px', maxWidth: '420px', width: '90%',
        boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '10px',
            background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '20px', flexShrink: 0,
          }}>⚠</div>
          <div>
            <div style={{ fontSize: '15px', fontWeight: '700', color: '#F1F5F9' }}>Duplicate artist name</div>
            <div style={{ fontSize: '12px', color: 'rgba(241,245,249,0.4)', marginTop: '2px' }}>
              An artist with this name already exists in this report
            </div>
          </div>
        </div>

        <p style={{ fontSize: '13px', color: 'rgba(241,245,249,0.65)', lineHeight: 1.6, margin: '0 0 16px' }}>
          <strong style={{ color: '#F1F5F9' }}>&ldquo;{targetName}&rdquo;</strong> already exists.
          Do you want to merge <strong style={{ color: '#F1F5F9' }}>&ldquo;{sourceName}&rdquo;</strong> into it?
        </p>

        <div style={{
          background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)',
          borderRadius: '8px', padding: '10px 14px', marginBottom: '22px',
          fontSize: '12px', color: 'rgba(241,245,249,0.5)', lineHeight: 1.6,
        }}>
          Orders from <strong style={{ color: 'rgba(241,245,249,0.75)' }}>{sourceName}</strong> will be combined with <strong style={{ color: 'rgba(241,245,249,0.75)' }}>{targetName}</strong> in this report.
        </div>

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button onClick={onCancel} disabled={merging} style={{
            padding: '8px 18px', borderRadius: '8px', fontSize: '13px',
            border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)',
            color: 'rgba(241,245,249,0.6)', cursor: merging ? 'default' : 'pointer',
          }}>Cancel</button>
          <button onClick={onConfirm} disabled={merging} style={{
            padding: '8px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: '600',
            border: 'none', background: merging ? 'rgba(245,158,11,0.3)' : 'rgba(245,158,11,0.85)',
            color: '#fff', cursor: merging ? 'default' : 'pointer', opacity: merging ? 0.7 : 1,
          }}>
            {merging ? 'Merging…' : 'Merge artists'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Inline name editor ────────────────────────────────────────────────────────

function ArtistNameEditor({
  name, allNames, onRename, onMergeRequest, disabled,
}: {
  name: string
  allNames: string[]
  onRename: (oldName: string, newName: string) => void
  onMergeRequest: (sourceName: string, targetName: string) => void
  disabled: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [value,   setValue]   = useState(name)
  const inputRef              = useRef<HTMLInputElement>(null)

  function startEdit() {
    if (disabled) return
    setValue(name)
    setEditing(true)
    setTimeout(() => inputRef.current?.select(), 0)
  }

  function commit() {
    const trimmed = value.trim()
    if (!trimmed || trimmed === name) { setValue(name); setEditing(false); return }

    const conflict = allNames.find(
      n => n !== name && n.toLowerCase() === trimmed.toLowerCase()
    )
    if (conflict) {
      setEditing(false)
      onMergeRequest(name, conflict)
    } else {
      setEditing(false)
      onRename(name, trimmed)
    }
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={value}
        autoFocus
        onChange={e => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); commit() }
          if (e.key === 'Escape') { setValue(name); setEditing(false) }
        }}
        style={{
          fontSize: '13px', fontWeight: '500',
          background: 'rgba(59,130,246,0.08)', color: '#F0ECE4',
          border: '1px solid rgba(59,130,246,0.4)', borderRadius: '6px',
          padding: '4px 8px', outline: 'none', width: '160px',
        }}
      />
    )
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <span style={{ color: '#F0ECE4' }}>{name}</span>
      {!disabled && (
        <button
          onClick={startEdit}
          title="Rename artist in this report"
          style={{
            background: 'none', border: 'none', padding: '2px 4px',
            cursor: 'pointer', color: 'rgba(240,236,228,0.2)',
            fontSize: '12px', lineHeight: 1, borderRadius: '4px',
            transition: 'color 0.12s',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = 'rgba(240,236,228,0.6)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'rgba(240,236,228,0.2)')}
        >
          ✎
        </button>
      )}
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ArtistUpliftTable({
  reportId,
  artists: initialArtists,
  vatRate,
  isVatRegistered,
  partnerShareBase,
  baseVatAmount,
  existingSnapshot,
  locked,
}: Props) {
  // Local artist rows (mutable for rename/merge)
  const [artists, setArtists] = useState<ArtistSummaryRow[]>(initialArtists)

  // ── Per-artist uplift state initialised from existing snapshot ────────────

  const init = (): Record<string, ArtistState> => {
    const map: Record<string, ArtistState> = {}
    for (const a of initialArtists) {
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

  // Merge dialog
  const [mergeDialog, setMergeDialog] = useState<{ source: string; target: string } | null>(null)
  const [merging,     setMerging]     = useState(false)
  const [renameErr,   setRenameErr]   = useState<string | null>(null)

  // ── Rename handler ────────────────────────────────────────────────────────

  const renameArtist = useCallback(async (oldName: string, newName: string) => {
    setRenameErr(null)
    try {
      const res = await fetch(`/api/admin/reports/${reportId}/rename-artist`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ old_name: oldName, new_name: newName }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setRenameErr(data.error ?? 'Rename failed')
        return
      }
      // Update local artist rows
      setArtists(prev => prev.map(a =>
        a.artist_name === oldName ? { ...a, artist_name: newName } : a
      ))
      // Migrate uplift state key
      setState(prev => {
        const next = { ...prev }
        if (next[oldName] !== undefined) {
          next[newName] = next[oldName]
          delete next[oldName]
        }
        return next
      })
    } catch {
      setRenameErr('Network error')
    }
  }, [reportId])

  // ── Merge handler (combine two rows client-side after rename) ─────────────

  const confirmMerge = useCallback(async () => {
    if (!mergeDialog) return
    const { source, target } = mergeDialog
    setMerging(true)
    setRenameErr(null)
    try {
      const res = await fetch(`/api/admin/reports/${reportId}/rename-artist`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ old_name: source, new_name: target }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setRenameErr(data.error ?? 'Merge failed')
        setMerging(false)
        setMergeDialog(null)
        return
      }
      // Merge source row into target row client-side
      setArtists(prev => {
        const sourceRow = prev.find(a => a.artist_name === source)
        const targetRow = prev.find(a => a.artist_name === target)
        if (!sourceRow || !targetRow) return prev
        const merged: ArtistSummaryRow = {
          ...targetRow,
          order_count: targetRow.order_count + sourceRow.order_count,
          gross_sales: Number(targetRow.gross_sales) + Number(sourceRow.gross_sales),
          total_net:   Number(targetRow.total_net)   + Number(sourceRow.total_net),
        }
        return prev
          .filter(a => a.artist_name !== source)
          .map(a => a.artist_name === target ? merged : a)
      })
      // Drop source uplift state (keep target's)
      setState(prev => {
        const next = { ...prev }
        delete next[source]
        return next
      })
    } catch {
      setRenameErr('Network error')
    } finally {
      setMerging(false)
      setMergeDialog(null)
    }
  }, [mergeDialog, reportId])

  // ── Live uplift calculation ───────────────────────────────────────────────

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

  // Known artist names for duplicate detection (excluding Unknown)
  const knownNames = artists
    .filter(a => a.artist_name !== '(Unknown)')
    .map(a => a.artist_name)

  // ── Save uplift ───────────────────────────────────────────────────────────

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

  function toggle(name: string) {
    setState(prev => ({ ...prev, [name]: { ...prev[name], enabled: !prev[name]?.enabled } }))
  }
  function setPct(name: string, val: string) {
    setState(prev => ({ ...prev, [name]: { ...prev[name], pct: val } }))
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {mergeDialog && (
        <MergeDialog
          sourceName={mergeDialog.source}
          targetName={mergeDialog.target}
          onConfirm={confirmMerge}
          onCancel={() => setMergeDialog(null)}
          merging={merging}
        />
      )}

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
                    <ArtistAvatar name={a.artist_name} imageUrl={a.artist_image_url} />
                  </td>

                  {/* Name (editable) */}
                  <td style={{ padding: '10px 0', color: isUnknown ? 'rgba(240,236,228,0.3)' : '#F0ECE4' }}>
                    {isUnknown ? '—' : (
                      <ArtistNameEditor
                        name={a.artist_name}
                        allNames={knownNames}
                        onRename={renameArtist}
                        onMergeRequest={(src, tgt) => setMergeDialog({ source: src, target: tgt })}
                        disabled={locked}
                      />
                    )}
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

        {/* Rename error */}
        {renameErr && (
          <p style={{ fontSize: '12px', color: '#F87171', margin: '8px 0 0' }}>{renameErr}</p>
        )}

        {/* ── Summary + Save ─────────────────────────────────────────────────── */}
        <div style={{
          marginTop: 16, paddingTop: 16,
          borderTop: '1px solid rgba(255,255,255,0.08)',
          display: 'flex', justifyContent: 'space-between',
          alignItems: 'flex-end', gap: 16, flexWrap: 'wrap',
        }}>
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
                  <span style={{ fontSize: '12px', color: saveMsg.ok ? '#4ADE80' : '#F87171' }}>
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
    </>
  )
}
