'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { formatTHB } from '@/lib/utils/currency'

interface ExtraLineItemsProps {
  reportId:            string
  locked:              boolean
  /** Final payout BEFORE any extra adjustments — computed server-side */
  basePayout:          number
  /** Current stored final_payout (with extras already applied) */
  currentFinalPayout:  number
  initialComp:         number | null
  initialCompNote:     string | null
  initialSvc:          number | null
  initialSvcNote:      string | null
  initialSvcWht:       boolean
  initialFee:          number | null
  initialFeeNote:      string | null
}

function calcAdj(comp: number, svc: number, wht: boolean, fee: number) {
  const whtAmt = wht ? svc * 0.03 : 0
  return comp + svc - whtAmt - fee
}

export function ExtraLineItems({
  reportId,
  locked,
  basePayout,
  currentFinalPayout,
  initialComp,
  initialCompNote,
  initialSvc,
  initialSvcNote,
  initialSvcWht,
  initialFee,
  initialFeeNote,
}: ExtraLineItemsProps) {
  const router           = useRouter()
  const [pending, start] = useTransition()

  // ── Edit form state ─────────────────────────────────────────────────────────
  const [editing,    setEditing]    = useState(false)
  const [compAmt,    setCompAmt]    = useState(initialComp  != null ? String(initialComp)  : '')
  const [compNote,   setCompNote]   = useState(initialCompNote  ?? '')
  const [svcAmt,     setSvcAmt]     = useState(initialSvc   != null ? String(initialSvc)   : '')
  const [svcNote,    setSvcNote]    = useState(initialSvcNote   ?? '')
  const [svcWht,     setSvcWht]     = useState(initialSvcWht)
  const [feeAmt,     setFeeAmt]     = useState(initialFee   != null ? String(initialFee)   : '')
  const [feeNote,    setFeeNote]    = useState(initialFeeNote   ?? '')
  const [saveError,  setSaveError]  = useState<string | null>(null)

  // ── Live-preview final payout ────────────────────────────────────────────────
  const liveComp = parseFloat(compAmt) || 0
  const liveSvc  = parseFloat(svcAmt)  || 0
  const liveFee  = parseFloat(feeAmt)  || 0
  const liveAdj  = calcAdj(liveComp, liveSvc, svcWht, liveFee)
  const liveWht  = svcWht ? liveSvc * 0.03 : 0
  const liveFinalPayout = basePayout + liveAdj

  // ── Display values (stored) ─────────────────────────────────────────────────
  const dispComp = initialComp != null ? initialComp : 0
  const dispSvc  = initialSvc  != null ? initialSvc  : 0
  const dispFee  = initialFee  != null ? initialFee  : 0
  const dispWht  = initialSvcWht ? dispSvc * 0.03 : 0
  const hasExtras = dispComp !== 0 || dispSvc !== 0 || dispFee !== 0

  // ── Save ────────────────────────────────────────────────────────────────────
  async function handleSave() {
    setSaveError(null)
    const body = {
      compensation_amount:  compAmt !== '' ? parseFloat(compAmt) : null,
      compensation_note:    compNote.trim() || null,
      service_fee_amount:   svcAmt  !== '' ? parseFloat(svcAmt)  : null,
      service_fee_note:     svcNote.trim()  || null,
      service_fee_wht:      svcWht,
      fee_deduction_amount: feeAmt  !== '' ? parseFloat(feeAmt)  : null,
      fee_deduction_note:   feeNote.trim()  || null,
    }
    const res = await fetch(`/api/admin/reports/${reportId}/extras`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      setSaveError(j.error ?? 'Save failed')
      return
    }
    setEditing(false)
    start(() => router.refresh())
  }

  function handleCancel() {
    setCompAmt(initialComp  != null ? String(initialComp)  : '')
    setCompNote(initialCompNote  ?? '')
    setSvcAmt(initialSvc   != null ? String(initialSvc)   : '')
    setSvcNote(initialSvcNote   ?? '')
    setSvcWht(initialSvcWht)
    setFeeAmt(initialFee   != null ? String(initialFee)   : '')
    setFeeNote(initialFeeNote   ?? '')
    setSaveError(null)
    setEditing(false)
  }

  // ── Shared row styles ────────────────────────────────────────────────────────
  const ROW_STYLE: React.CSSProperties = {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '14px 0', borderBottom: '1px solid rgba(255,255,255,0.05)',
  }
  const LABEL_STYLE: React.CSSProperties = {
    fontSize: '13px', color: 'rgba(240,236,228,0.5)',
  }
  const VALUE_STYLE: React.CSSProperties = {
    fontSize: '14px', fontWeight: '500', color: '#F1F5F9',
  }
  const ACCENT_STYLE: React.CSSProperties = {
    fontSize: '14px', fontWeight: '700', color: '#F1F5F9',
  }
  const inputStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px',
    padding: '8px 12px',
    fontSize: '13px',
    color: '#F1F5F9',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  }

  // ── View mode ────────────────────────────────────────────────────────────────
  if (!editing) {
    return (
      <>
        {/* Section header with optional Edit button */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '14px 0 4px',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          marginTop: '8px',
        }}>
          <span style={{ fontSize: '11px', fontWeight: '600', letterSpacing: '0.08em',
            textTransform: 'uppercase', color: 'rgba(240,236,228,0.3)' }}>
            Extra Adjustments
          </span>
          {!locked && (
            <button
              onClick={() => setEditing(true)}
              style={{
                background: 'none', border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '6px', padding: '4px 10px',
                fontSize: '11px', color: 'rgba(240,236,228,0.5)',
                cursor: 'pointer', fontWeight: '500',
              }}
            >
              {hasExtras ? 'Edit' : '+ Add'}
            </button>
          )}
        </div>

        {/* Display existing extras */}
        {hasExtras ? (
          <>
            {dispComp > 0 && (
              <div style={ROW_STYLE}>
                <span style={LABEL_STYLE}>
                  ค่าชดเชยรายได้{initialCompNote ? ` — ${initialCompNote}` : ''}
                </span>
                <span style={{ ...VALUE_STYLE, color: '#86EFAC' }}>+ {formatTHB(dispComp)}</span>
              </div>
            )}
            {dispSvc > 0 && (
              <>
                <div style={ROW_STYLE}>
                  <span style={LABEL_STYLE}>
                    ค่าบริการ{initialSvcNote ? ` — ${initialSvcNote}` : ''}
                  </span>
                  <span style={{ ...VALUE_STYLE, color: '#86EFAC' }}>+ {formatTHB(dispSvc)}</span>
                </div>
                {dispWht > 0 && (
                  <div style={ROW_STYLE}>
                    <span style={{ ...LABEL_STYLE, paddingLeft: '16px' }}>WHT 3% (หัก ณ ที่จ่าย)</span>
                    <span style={{ ...VALUE_STYLE, color: '#FCA5A5' }}>− {formatTHB(dispWht)}</span>
                  </div>
                )}
              </>
            )}
            {dispFee > 0 && (
              <div style={ROW_STYLE}>
                <span style={LABEL_STYLE}>
                  ค่าธรรมเนียม{initialFeeNote ? ` — ${initialFeeNote}` : ''}
                </span>
                <span style={{ ...VALUE_STYLE, color: '#FCA5A5' }}>− {formatTHB(dispFee)}</span>
              </div>
            )}
          </>
        ) : (
          <div style={{ padding: '10px 0 6px' }}>
            <span style={{ fontSize: '12px', color: 'rgba(240,236,228,0.22)' }}>
              ไม่มีรายการเพิ่มเติม
            </span>
          </div>
        )}

        {/* Final Payout — computed from basePayout + displayed extras so it is
            always consistent with the line items shown, even if the stored
            final_payout column is momentarily stale. */}
        <div style={{ ...ROW_STYLE, borderBottom: 'none', paddingTop: '16px' }}>
          <span style={{ fontSize: '13px', color: 'rgba(240,236,228,0.5)' }}>Final Payout</span>
          <span style={ACCENT_STYLE}>
            {formatTHB(basePayout + calcAdj(dispComp, dispSvc, initialSvcWht, dispFee))}
          </span>
        </div>
      </>
    )
  }

  // ── Edit mode ────────────────────────────────────────────────────────────────
  return (
    <>
      <div style={{
        borderTop: '1px solid rgba(255,255,255,0.08)',
        marginTop: '8px',
        paddingTop: '16px',
      }}>
        <p style={{ fontSize: '11px', fontWeight: '600', letterSpacing: '0.08em',
          textTransform: 'uppercase', color: 'rgba(240,236,228,0.3)',
          marginBottom: '16px',
        }}>
          Extra Adjustments
        </p>

        {/* ── ค่าชดเชยรายได้ ─────────────────────────────────────────────── */}
        <div style={{ marginBottom: '20px' }}>
          <p style={{ fontSize: '12px', color: 'rgba(240,236,228,0.6)', marginBottom: '8px', fontWeight: '500' }}>
            ค่าชดเชยรายได้ <span style={{ color: '#86EFAC', fontSize: '11px' }}>(บวกเพิ่ม)</span>
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '8px' }}>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="จำนวนเงิน"
              value={compAmt}
              onChange={e => setCompAmt(e.target.value)}
              style={inputStyle}
            />
            <input
              type="text"
              placeholder="หมายเหตุ (ถ้ามี)"
              value={compNote}
              onChange={e => setCompNote(e.target.value)}
              style={inputStyle}
            />
          </div>
        </div>

        {/* ── ค่าบริการ ──────────────────────────────────────────────────── */}
        <div style={{ marginBottom: '20px' }}>
          <p style={{ fontSize: '12px', color: 'rgba(240,236,228,0.6)', marginBottom: '8px', fontWeight: '500' }}>
            ค่าบริการ <span style={{ color: '#86EFAC', fontSize: '11px' }}>(บวกเพิ่ม)</span>
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '8px', marginBottom: '8px' }}>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="จำนวนเงิน"
              value={svcAmt}
              onChange={e => setSvcAmt(e.target.value)}
              style={inputStyle}
            />
            <input
              type="text"
              placeholder="หมายเหตุ (ถ้ามี)"
              value={svcNote}
              onChange={e => setSvcNote(e.target.value)}
              style={inputStyle}
            />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={svcWht}
              onChange={e => setSvcWht(e.target.checked)}
              style={{ width: '14px', height: '14px', accentColor: '#6366F1', cursor: 'pointer' }}
            />
            <span style={{ fontSize: '12px', color: 'rgba(240,236,228,0.5)' }}>
              หัก WHT 3%
              {liveSvc > 0 && svcWht && (
                <span style={{ color: '#FCA5A5', marginLeft: '8px' }}>
                  (−{formatTHB(liveWht)})
                </span>
              )}
            </span>
          </label>
        </div>

        {/* ── ค่าธรรมเนียม ───────────────────────────────────────────────── */}
        <div style={{ marginBottom: '20px' }}>
          <p style={{ fontSize: '12px', color: 'rgba(240,236,228,0.6)', marginBottom: '8px', fontWeight: '500' }}>
            ค่าธรรมเนียม <span style={{ color: '#FCA5A5', fontSize: '11px' }}>(หักออก)</span>
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '8px' }}>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="จำนวนเงิน"
              value={feeAmt}
              onChange={e => setFeeAmt(e.target.value)}
              style={inputStyle}
            />
            <input
              type="text"
              placeholder="หมายเหตุ (ถ้ามี)"
              value={feeNote}
              onChange={e => setFeeNote(e.target.value)}
              style={inputStyle}
            />
          </div>
        </div>

        {/* Live preview */}
        <div style={{
          padding: '12px 16px', borderRadius: '10px',
          background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)',
          marginBottom: '14px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: 'rgba(240,236,228,0.5)' }}>Final Payout (preview)</span>
            <span style={{ fontSize: '15px', fontWeight: '700', color: '#A5B4FC' }}>
              {formatTHB(liveFinalPayout)}
            </span>
          </div>
          {(liveComp > 0 || liveSvc > 0 || liveFee > 0) && (
            <div style={{ marginTop: '6px', fontSize: '11px', color: 'rgba(240,236,228,0.3)' }}>
              Base {formatTHB(basePayout)}
              {liveComp > 0 && <> + comp {formatTHB(liveComp)}</>}
              {liveSvc > 0 && <> + svc {formatTHB(liveSvc)}</>}
              {liveWht > 0 && <> − WHT {formatTHB(liveWht)}</>}
              {liveFee > 0 && <> − fee {formatTHB(liveFee)}</>}
            </div>
          )}
        </div>

        {saveError && (
          <p style={{ fontSize: '12px', color: '#EF4444', marginBottom: '10px' }}>{saveError}</p>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={handleSave}
            disabled={pending}
            style={{
              flex: 1,
              padding: '9px 0', borderRadius: '8px',
              background: pending ? 'rgba(99,102,241,0.3)' : '#6366F1',
              border: 'none', fontSize: '13px', fontWeight: '600',
              color: '#fff', cursor: pending ? 'default' : 'pointer',
            }}
          >
            {pending ? 'Saving…' : 'Save'}
          </button>
          <button
            onClick={handleCancel}
            disabled={pending}
            style={{
              padding: '9px 20px', borderRadius: '8px',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.1)',
              fontSize: '13px', color: 'rgba(240,236,228,0.6)',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </>
  )
}
