'use client'

import { useState, useCallback } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

type ConfiguredArtist = {
  id: string
  artist_name: string
  branch_id: string
  is_referral_eligible: boolean
  referral_partner_id: string | null
  referral_uplift_pct: number | null
  branches: { id: string; name: string } | null
}

type UnconfiguredArtist = {
  artist_name: string
  branch_id: string
  branch_name: string
}

type Partner = { id: string; name: string }

type Props = {
  initialConfigured:   ConfiguredArtist[]
  initialUnconfigured: UnconfiguredArtist[]
  partners:            Partner[]
}

// ── Design tokens ─────────────────────────────────────────────────────────────

const BG    = '#0C1018'
const CARD  = { background: BG, border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', overflow: 'hidden' as const }
const TH: React.CSSProperties = {
  padding: '0 20px 10px', textAlign: 'left', fontSize: '10px', fontWeight: '600',
  letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(241,245,249,0.28)',
  whiteSpace: 'nowrap', borderBottom: '1px solid rgba(255,255,255,0.06)',
}
const TD: React.CSSProperties = {
  padding: '10px 20px', verticalAlign: 'middle',
  borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '13px',
}
const SELECT: React.CSSProperties = {
  padding: '5px 10px', borderRadius: '7px', border: '1px solid rgba(255,255,255,0.09)',
  background: 'rgba(255,255,255,0.04)', color: 'rgba(240,236,228,0.7)', fontSize: '12px',
  cursor: 'pointer', outline: 'none', appearance: 'none', minWidth: '140px',
}
const INPUT: React.CSSProperties = {
  width: '72px', padding: '5px 8px', borderRadius: '7px',
  border: '1px solid rgba(255,255,255,0.09)', background: 'rgba(255,255,255,0.04)',
  color: 'rgba(240,236,228,0.8)', fontSize: '12px', outline: 'none',
  textAlign: 'right', fontVariantNumeric: 'tabular-nums',
}

// ── Toggle switch ─────────────────────────────────────────────────────────────

function Toggle({ checked, onChange, disabled }: {
  checked: boolean; onChange: (v: boolean) => void; disabled?: boolean
}) {
  return (
    <div
      role="switch"
      aria-checked={checked}
      onClick={() => !disabled && onChange(!checked)}
      style={{
        width: '36px', height: '20px', borderRadius: '999px',
        background: checked ? 'rgba(59,130,246,0.75)' : 'rgba(255,255,255,0.12)',
        border: `1px solid ${checked ? 'rgba(59,130,246,0.9)' : 'rgba(255,255,255,0.16)'}`,
        cursor: disabled ? 'default' : 'pointer',
        position: 'relative', flexShrink: 0, transition: 'background 0.15s, border-color 0.15s',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <div style={{
        position: 'absolute', top: '2px',
        left: checked ? '17px' : '2px',
        width: '14px', height: '14px', borderRadius: '50%',
        background: checked ? '#fff' : 'rgba(255,255,255,0.4)',
        transition: 'left 0.15s',
      }} />
    </div>
  )
}

// ── Status pill ───────────────────────────────────────────────────────────────

function StatusPill({ saving, error }: { saving: boolean; error: string | null }) {
  if (saving) return (
    <span style={{ fontSize: '11px', color: 'rgba(59,130,246,0.7)' }}>Saving…</span>
  )
  if (error) return (
    <span style={{ fontSize: '11px', color: '#EF4444' }}>{error}</span>
  )
  return null
}

// ── Main component ─────────────────────────────────────────────────────────────

export function ArtistsClient({ initialConfigured, initialUnconfigured, partners }: Props) {
  const [configured,   setConfigured]   = useState<ConfiguredArtist[]>(initialConfigured)
  const [unconfigured, setUnconfigured] = useState<UnconfiguredArtist[]>(initialUnconfigured)

  // Per-row saving state: id → { saving, error }
  const [rowState, setRowState] = useState<Record<string, { saving: boolean; error: string | null }>>({})

  // ── PATCH existing artist ─────────────────────────────────────────────────
  const patchArtist = useCallback(async (
    id: string,
    patch: { is_referral_eligible?: boolean; referral_partner_id?: string | null; referral_uplift_pct?: number | null }
  ) => {
    setRowState(s => ({ ...s, [id]: { saving: true, error: null } }))
    // Optimistic update
    setConfigured(prev => prev.map(a => a.id === id ? { ...a, ...patch } : a))

    const res = await fetch(`/api/admin/artists/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setRowState(s => ({ ...s, [id]: { saving: false, error: data.error ?? 'Failed to save' } }))
      // Revert optimistic
      setConfigured(prev => prev.map(a => a.id === id ? { ...a, ...Object.fromEntries(
        Object.keys(patch).map(k => [k, a[k as keyof ConfiguredArtist]])
      ) } : a))
    } else {
      setRowState(s => ({ ...s, [id]: { saving: false, error: null } }))
    }
  }, [])

  // ── Configure an unconfigured artist ─────────────────────────────────────
  const configureArtist = useCallback(async (artist: UnconfiguredArtist) => {
    const key = `${artist.branch_id}::${artist.artist_name}`
    setRowState(s => ({ ...s, [key]: { saving: true, error: null } }))

    const res = await fetch('/api/admin/artists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        artist_name: artist.artist_name,
        branch_id:   artist.branch_id,
        is_referral_eligible: false,
      }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setRowState(s => ({ ...s, [key]: { saving: false, error: data.error ?? 'Failed' } }))
      return
    }
    const data = await res.json()
    // Move from unconfigured → configured
    setUnconfigured(prev => prev.filter(a => !(a.branch_id === artist.branch_id && a.artist_name === artist.artist_name)))
    setConfigured(prev => [...prev, {
      ...data.artist,
      branches: { id: artist.branch_id, name: artist.branch_name },
    }].sort((a, b) => a.artist_name.localeCompare(b.artist_name)))
    setRowState(s => ({ ...s, [key]: { saving: false, error: null } }))
  }, [])

  const totalEligible = configured.filter(a => a.is_referral_eligible).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>

      {/* ── Summary strip ──────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '24px', padding: '14px 20px', ...CARD, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(241,245,249,0.3)', marginBottom: '3px' }}>
            Configured
          </div>
          <div style={{ fontSize: '20px', fontWeight: '700', color: '#F1F5F9', letterSpacing: '-0.02em' }}>
            {configured.length}
          </div>
        </div>
        <div>
          <div style={{ fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(241,245,249,0.3)', marginBottom: '3px' }}>
            Uplift Active
          </div>
          <div style={{ fontSize: '20px', fontWeight: '700', color: totalEligible > 0 ? '#60A5FA' : 'rgba(241,245,249,0.35)', letterSpacing: '-0.02em' }}>
            {totalEligible}
          </div>
        </div>
        <div>
          <div style={{ fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(241,245,249,0.3)', marginBottom: '3px' }}>
            Unconfigured
          </div>
          <div style={{ fontSize: '20px', fontWeight: '700', color: unconfigured.length > 0 ? '#F59E0B' : 'rgba(241,245,249,0.35)', letterSpacing: '-0.02em' }}>
            {unconfigured.length}
          </div>
        </div>
      </div>

      {/* ── Configured artists table ───────────────────────────────────────── */}
      {configured.length > 0 && (
        <div style={CARD}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '11px', fontWeight: '600', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(241,245,249,0.35)' }}>
              Configured Artists
            </span>
            <span style={{ fontSize: '11px', color: 'rgba(241,245,249,0.22)', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '999px', padding: '2px 8px' }}>
              {configured.length}
            </span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ ...TH, paddingTop: '14px' }}>Artist</th>
                  <th style={{ ...TH, paddingTop: '14px' }}>Branch</th>
                  <th style={{ ...TH, paddingTop: '14px', textAlign: 'center' }}>Uplift Active</th>
                  <th style={{ ...TH, paddingTop: '14px' }}>Referring Partner</th>
                  <th style={{ ...TH, paddingTop: '14px', textAlign: 'right' }}>Uplift %</th>
                  <th style={{ ...TH, paddingTop: '14px' }}>&nbsp;</th>
                </tr>
              </thead>
              <tbody>
                {configured.map(artist => {
                  const state = rowState[artist.id]
                  return (
                    <tr key={artist.id}>
                      {/* Artist name */}
                      <td style={TD}>
                        <div style={{ fontSize: '13px', fontWeight: '600', color: '#F1F5F9' }}>
                          {artist.artist_name}
                        </div>
                      </td>

                      {/* Branch */}
                      <td style={TD}>
                        <span style={{ fontSize: '12px', color: 'rgba(241,245,249,0.45)' }}>
                          {artist.branches?.name ?? '—'}
                        </span>
                      </td>

                      {/* Toggle */}
                      <td style={{ ...TD, textAlign: 'center' }}>
                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                          <Toggle
                            checked={artist.is_referral_eligible}
                            disabled={state?.saving}
                            onChange={v => patchArtist(artist.id, { is_referral_eligible: v })}
                          />
                        </div>
                      </td>

                      {/* Partner dropdown */}
                      <td style={TD}>
                        <select
                          value={artist.referral_partner_id ?? ''}
                          disabled={!artist.is_referral_eligible || state?.saving}
                          style={{ ...SELECT, opacity: artist.is_referral_eligible ? 1 : 0.35 }}
                          onChange={e => patchArtist(artist.id, {
                            referral_partner_id: e.target.value || null
                          })}
                        >
                          <option value="">— No partner —</option>
                          {partners.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                      </td>

                      {/* Uplift % input */}
                      <td style={{ ...TD, textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            step={0.1}
                            disabled={!artist.is_referral_eligible || state?.saving}
                            style={{ ...INPUT, opacity: artist.is_referral_eligible ? 1 : 0.35 }}
                            defaultValue={artist.referral_uplift_pct ?? ''}
                            placeholder="0"
                            onBlur={e => {
                              const val = e.target.value === '' ? null : parseFloat(e.target.value)
                              if (!artist.is_referral_eligible) return
                              if (val === artist.referral_uplift_pct) return
                              patchArtist(artist.id, { referral_uplift_pct: val })
                            }}
                          />
                          <span style={{ fontSize: '12px', color: 'rgba(241,245,249,0.3)', flexShrink: 0 }}>%</span>
                        </div>
                      </td>

                      {/* Status */}
                      <td style={{ ...TD, minWidth: '80px' }}>
                        <StatusPill saving={!!state?.saving} error={state?.error ?? null} />
                        {artist.is_referral_eligible && !state?.saving && !state?.error && (
                          <span style={{
                            fontSize: '10px', fontWeight: '600', letterSpacing: '0.08em',
                            textTransform: 'uppercase', color: 'rgba(59,130,246,0.7)',
                            background: 'rgba(59,130,246,0.1)', borderRadius: '4px', padding: '2px 6px',
                          }}>
                            Active
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Unconfigured artists ──────────────────────────────────────────────── */}
      {unconfigured.length > 0 && (
        <div style={CARD}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '11px', fontWeight: '600', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(241,245,249,0.35)' }}>
              Seen But Not Configured
            </span>
            <span style={{
              fontSize: '11px', color: 'rgba(245,158,11,0.7)', background: 'rgba(245,158,11,0.08)',
              border: '1px solid rgba(245,158,11,0.18)', borderRadius: '999px', padding: '2px 8px',
            }}>
              {unconfigured.length}
            </span>
          </div>
          <div style={{ padding: '10px 0' }}>
            <p style={{ fontSize: '12px', color: 'rgba(241,245,249,0.3)', margin: '0 20px 10px', lineHeight: 1.5 }}>
              These artists appear in imported reports but have no uplift configuration. Click configure to set one up.
            </p>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ ...TH, paddingTop: '10px' }}>Artist</th>
                    <th style={{ ...TH, paddingTop: '10px' }}>Branch</th>
                    <th style={{ ...TH, paddingTop: '10px' }}>&nbsp;</th>
                  </tr>
                </thead>
                <tbody>
                  {unconfigured.map(artist => {
                    const key = `${artist.branch_id}::${artist.artist_name}`
                    const state = rowState[key]
                    return (
                      <tr key={key}>
                        <td style={TD}>
                          <div style={{ fontSize: '13px', color: 'rgba(241,245,249,0.6)' }}>
                            {artist.artist_name}
                          </div>
                        </td>
                        <td style={TD}>
                          <span style={{ fontSize: '12px', color: 'rgba(241,245,249,0.35)' }}>
                            {artist.branch_name}
                          </span>
                        </td>
                        <td style={{ ...TD, textAlign: 'right' }}>
                          {state?.saving ? (
                            <span style={{ fontSize: '12px', color: 'rgba(59,130,246,0.7)' }}>Creating…</span>
                          ) : state?.error ? (
                            <span style={{ fontSize: '12px', color: '#EF4444' }}>{state.error}</span>
                          ) : (
                            <button
                              onClick={() => configureArtist(artist)}
                              style={{
                                padding: '6px 14px', borderRadius: '7px', fontSize: '12px',
                                border: '1px solid rgba(59,130,246,0.3)', background: 'rgba(59,130,246,0.08)',
                                color: 'rgba(59,130,246,0.85)', cursor: 'pointer', fontWeight: '500',
                              }}
                            >
                              Configure
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Empty state ─────────────────────────────────────────────────────── */}
      {configured.length === 0 && unconfigured.length === 0 && (
        <div style={{ ...CARD, padding: '64px 32px', textAlign: 'center' }}>
          <div style={{ fontSize: '24px', marginBottom: '12px', opacity: 0.2 }}>◎</div>
          <p style={{ fontSize: '14px', fontWeight: '600', color: 'rgba(241,245,249,0.28)', margin: 0 }}>
            No artists yet
          </p>
          <p style={{ fontSize: '12px', color: 'rgba(241,245,249,0.18)', margin: '6px 0 0' }}>
            Artists appear automatically once you import a CSV report with artist metadata.
          </p>
        </div>
      )}
    </div>
  )
}
