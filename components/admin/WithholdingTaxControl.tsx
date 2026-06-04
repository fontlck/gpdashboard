'use client'

import React, { useState } from 'react'

type Props = {
  reportId:        string
  finalPayout:     number        // gross payout (before WHT)
  vatRate:         number        // e.g. 0.07 — from vat_rate_snapshot
  isVatRegistered: boolean       // partner VAT-registered? from is_vat_registered_snapshot
  initialPct:      number | null // existing WHT pct from DB (3, 5, or null)
  initialAmount:   number | null // existing withholding_tax_amount from DB
  locked:          boolean       // approved or paid
}

function fmt(n: number) {
  return '฿' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function WithholdingTaxControl({
  reportId,
  finalPayout,
  vatRate,
  isVatRegistered,
  initialPct,
  initialAmount,
  locked,
}: Props) {
  const [enabled,       setEnabled]       = useState<boolean>(initialPct != null)
  const [pct,           setPct]           = useState<3 | 5>(initialPct === 5 ? 5 : 3)
  const [saving,        setSaving]        = useState(false)
  const [saveMsg,       setSaveMsg]       = useState<{ text: string; ok: boolean } | null>(null)

  // WHT base = the ex-VAT (taxable) portion of the payout.
  //   • VAT-registered: finalPayout includes VAT — strip it (÷ 1.07)
  //   • Non-VAT       : finalPayout is already ex-VAT — use as-is
  const autoBase   = Math.round(
    (isVatRegistered ? finalPayout / (1 + vatRate) : finalPayout) * 100
  ) / 100
  const autoAmount = Math.round(autoBase * (pct / 100) * 100) / 100

  // Manual override
  const hasStoredOverride = initialAmount != null && initialAmount !== autoAmount
  const [overrideMode,  setOverrideMode]  = useState<boolean>(hasStoredOverride)
  const [overrideInput, setOverrideInput] = useState<string>(
    initialAmount != null ? String(initialAmount) : ''
  )
  const [editingOverride, setEditingOverride] = useState(false)

  const overrideParsed = parseFloat(overrideInput.replace(/,/g, '')) || 0
  const whtAmount  = enabled ? (overrideMode ? overrideParsed : autoAmount) : 0
  const netPayout  = finalPayout - whtAmount

  function startOverride() {
    if (!overrideMode) {
      setOverrideInput(autoAmount.toFixed(2))
      setOverrideMode(true)
    }
    setEditingOverride(true)
  }

  function clearOverride() {
    setOverrideMode(false)
    setOverrideInput(autoAmount.toFixed(2))
    setEditingOverride(false)
  }

  async function save() {
    setSaving(true)
    setSaveMsg(null)
    try {
      const body: { pct: number | null; amount?: number } = { pct: enabled ? pct : null }
      if (enabled && overrideMode) body.amount = overrideParsed
      const res  = await fetch(`/api/admin/reports/${reportId}/withholding-tax`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
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
    <div style={{ marginTop: 6, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.08)' }}>

      {/* Header row: label + toggle + pct buttons */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{
          fontSize: '11px', fontWeight: 700, letterSpacing: '0.07em',
          textTransform: 'uppercase', color: 'rgba(240,236,228,0.45)',
        }}>
          Withholding Tax
        </span>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
          <button style={pctBtn(3)} disabled={locked || !enabled} onClick={() => !locked && enabled && setPct(3)}>3%</button>
          <button style={pctBtn(5)} disabled={locked || !enabled} onClick={() => !locked && enabled && setPct(5)}>5%</button>
        </div>
      </div>

      {/* Body */}
      {enabled ? (
        <>
          {/* Deduction row */}
          <div style={{ padding: '8px 0 4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'rgba(240,236,228,0.5)', fontSize: '12px' }}>
                WHT {pct}% of {fmt(autoBase)}{isVatRegistered ? ' (ex-VAT)' : ''}
                {overrideMode && (
                  <span style={{
                    marginLeft: 6, fontSize: '10px', fontWeight: 700, letterSpacing: '0.06em',
                    color: '#F59E0B', background: 'rgba(245,158,11,0.12)',
                    padding: '1px 6px', borderRadius: 4,
                  }}>
                    MANUAL
                  </span>
                )}
              </span>

              {/* Override amount — input or display */}
              {!locked && editingOverride ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ color: '#EF4444', fontWeight: 600, fontSize: '13px' }}>−</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={overrideInput}
                    onChange={e => setOverrideInput(e.target.value)}
                    onBlur={() => setEditingOverride(false)}
                    onKeyDown={e => e.key === 'Enter' && setEditingOverride(false)}
                    autoFocus
                    style={{
                      width: 100, padding: '3px 8px', borderRadius: 6, fontSize: '13px',
                      fontWeight: 600, textAlign: 'right', fontVariantNumeric: 'tabular-nums',
                      background: 'rgba(245,158,11,0.08)', color: '#FCD34D',
                      border: '1px solid rgba(245,158,11,0.35)', outline: 'none',
                    }}
                  />
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: '#EF4444', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                    − {fmt(whtAmount)}
                  </span>
                  {!locked && (
                    <button
                      onClick={startOverride}
                      title="แก้ไขยอดหัก ณ ที่จ่ายเอง"
                      style={{
                        background: 'none', border: 'none', padding: '2px 4px',
                        cursor: 'pointer', color: 'rgba(241,245,249,0.3)',
                        fontSize: '11px', lineHeight: 1,
                      }}
                    >
                      ✎
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Auto-calc hint + reset when override is on */}
            {overrideMode && !locked && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                <button
                  onClick={clearOverride}
                  style={{
                    background: 'none', border: 'none', padding: 0,
                    cursor: 'pointer', fontSize: '11px',
                    color: 'rgba(241,245,249,0.3)',
                    textDecoration: 'underline',
                  }}
                >
                  รีเซ็ตเป็นอัตโนมัติ ({fmt(autoAmount)})
                </button>
              </div>
            )}
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
