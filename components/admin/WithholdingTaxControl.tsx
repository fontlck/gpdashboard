'use client'

import React, { useState } from 'react'

type Props = {
  reportId:         string
  finalPayout:      number   // gross payout (before WHT)
  partnerShareBase: number   // ex-VAT partner share
  upliftBase:       number   // ex-VAT referred artist uplift
  initialPct:       number | null   // existing WHT pct from DB (3, 5, or null)
  locked:           boolean  // approved or paid
}

function fmt(n: number) {
  return '฿' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function WithholdingTaxControl({
  reportId,
  finalPayout,
  partnerShareBase,
  upliftBase,
  initialPct,
  locked,
}: Props) {
  const [enabled,  setEnabled]  = useState<boolean>(initialPct != null)
  const [pct,      setPct]      = useState<3 | 5>(initialPct === 5 ? 5 : 3)
  const [saving,   setSaving]   = useState(false)
  const [saveMsg,  setSaveMsg]  = useState<{ text: string; ok: boolean } | null>(null)

  // WHT base = ex-VAT partner share + ex-VAT uplift
  const whtBase   = partnerShareBase + upliftBase
  const whtAmount = enabled ? Math.round(whtBase * (pct / 100) * 100) / 100 : 0
  const netPayout = finalPayout - whtAmount

  async function save() {
    setSaving(true)
    setSaveMsg(null)
    try {
      const res  = await fetch(`/api/admin/reports/${reportId}/withholding-tax`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ pct: enabled ? pct : null }),
      })
      const data = await res.json()
      if (!res.ok) {
        setSaveMsg({ text: data.error ?? 'Save failed', ok: false })
      } else {
        setSaveMsg({
          text: enabled
            ? `✓ WHT ${pct}% saved — ${fmt(data.withholding_tax_amount)} deducted`
            : '✓ WHT cleared',
          ok: true,
        })
      }
    } catch {
      setSaveMsg({ text: 'Network error — please try again.', ok: false })
    } finally {
      setSaving(false)
      setTimeout(() => setSaveMsg(null), 5000)
    }
  }

  const pctBtn = (v: 3 | 5): React.CSSProperties => ({
    padding: '4px 14px', borderRadius: 6, fontSize: '12px', fontWeight: 700,
    cursor: locked || !enabled ? 'default' : 'pointer',
    border: '1px solid transparent',
    transition: 'all 0.12s',
    ...(enabled && pct === v
      ? { background: 'rgba(59,130,246,0.15)', color: '#93C5FD', borderColor: 'rgba(59,130,246,0.35)' }
      : { background: 'rgba(255,255,255,0.04)', color: 'rgba(241,245,249,0.35)', borderColor: 'rgba(255,255,255,0.08)' }
    ),
  })

  return (
    <div style={{
      marginTop: 6,
      paddingTop: 16,
      borderTop: '1px solid rgba(255,255,255,0.08)',
    }}>
      {/* Header row: label + toggle + pct buttons */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{
          fontSize: '11px', fontWeight: 700, letterSpacing: '0.07em',
          textTransform: 'uppercase', color: 'rgba(240,236,228,0.45)',
        }}>
          Withholding Tax
        </span>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Toggle */}
          <button
            onClick={() => !locked && setEnabled(e => !e)}
            disabled={locked}
            title={locked ? 'Report is locked' : (enabled ? 'Disable WHT' : 'Enable WHT')}
            style={{
              width: 36, height: 20, borderRadius: 10, border: 'none', padding: 0,
              background: enabled ? '#3B82F6' : 'rgba(255,255,255,0.12)',
              cursor: locked ? 'default' : 'pointer',
              position: 'relative', display: 'inline-block',
              transition: 'background 0.15s', flexShrink: 0,
            }}
          >
            <span style={{
              display: 'block', width: 14, height: 14, borderRadius: '50%', background: '#fff',
              position: 'absolute', top: 3,
              left: enabled ? 19 : 3,
              transition: 'left 0.15s',
            }} />
          </button>

          {/* 3% / 5% selector */}
          <button style={pctBtn(3)} disabled={locked || !enabled} onClick={() => !locked && enabled && setPct(3)}>3%</button>
          <button style={pctBtn(5)} disabled={locked || !enabled} onClick={() => !locked && enabled && setPct(5)}>5%</button>
        </div>
      </div>

      {/* Body */}
      {enabled ? (
        <>
          {/* Deduction row */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '8px 0 4px', fontSize: '13px',
          }}>
            <span style={{ color: 'rgba(240,236,228,0.5)', fontSize: '12px' }}>
              WHT {pct}% of {fmt(whtBase)} (ex-VAT base)
            </span>
            <span style={{ color: '#EF4444', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
              − {fmt(whtAmount)}
            </span>
          </div>

          {/* Net payout */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '10px 0 0', borderTop: '1px solid rgba(255,255,255,0.06)', marginTop: 8,
          }}>
            <span style={{ fontSize: '13px', color: 'rgba(240,236,228,0.6)' }}>Net to Partner</span>
            <span style={{ fontSize: '16px', fontWeight: 700, color: '#F1F5F9', fontVariantNumeric: 'tabular-nums' }}>
              {fmt(netPayout)}
            </span>
          </div>
        </>
      ) : (
        <p style={{ fontSize: '12px', color: 'rgba(241,245,249,0.25)', paddingBottom: 4 }}>
          No WHT applied — partner receives full payout.
        </p>
      )}

      {/* Save row */}
      {!locked && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10, marginTop: 14 }}>
          {saveMsg && (
            <span style={{ fontSize: '12px', color: saveMsg.ok ? '#4ADE80' : '#F87171' }}>
              {saveMsg.text}
            </span>
          )}
          <button
            onClick={save}
            disabled={saving}
            style={{
              padding: '7px 18px', borderRadius: 8, fontSize: '12px', fontWeight: 700,
              border: 'none', cursor: saving ? 'default' : 'pointer',
              background: saving ? 'rgba(59,130,246,0.3)' : 'rgba(59,130,246,0.85)',
              color: '#fff', opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      )}
    </div>
  )
}
