'use client'

import React, { useState } from 'react'

type PayoutType = 'revenue_share' | 'fixed_rent'
type VatMode = 'exclusive' | 'inclusive'

type Partner = { id: string; name: string; is_vat_registered: boolean | null }
type BranchRow = {
  id: string
  name: string
  code: string | null
  payout_type: PayoutType
  revenue_share_pct: number
  fixed_rent_amount: number | null
  fixed_rent_vat_mode: VatMode | null
  is_active: boolean
  partner_id: string
  partners: Partner | Partner[] | null
  notification_email: string | null
  line_notify_token: string | null
}

// ── small helpers ────────────────────────────────────────────────────────────

const BTN: React.CSSProperties = {
  padding: '6px 14px', borderRadius: '8px', fontSize: '12px',
  fontWeight: '600', border: 'none', cursor: 'pointer', letterSpacing: '0.04em',
}
const GOLD_BTN: React.CSSProperties = {
  ...BTN,
  background: '#3B82F6',
  color: '#F1F5F9',
}
const GHOST_BTN: React.CSSProperties = {
  ...BTN,
  background: 'rgba(255,255,255,0.06)',
  color: 'rgba(240,236,228,0.7)',
}
const INPUT: React.CSSProperties = {
  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '8px', color: '#F0ECE4', fontSize: '13px',
  padding: '8px 12px', width: '100%', boxSizing: 'border-box',
}
const LABEL: React.CSSProperties = {
  fontSize: '11px', fontWeight: '600', letterSpacing: '0.06em',
  textTransform: 'uppercase', color: 'rgba(240,236,228,0.4)',
  display: 'block', marginBottom: '6px',
}

function partner(b: BranchRow): Partner | null {
  if (!b.partners) return null
  return Array.isArray(b.partners) ? b.partners[0] ?? null : b.partners
}

// ── Edit form (inline row expansion) ────────────────────────────────────────

function EditForm({
  branch,
  onSaved,
  onCancel,
}: {
  branch: BranchRow
  onSaved: (updated: BranchRow) => void
  onCancel: () => void
}) {
  const p = partner(branch)

  const [payoutType, setPayoutType]       = useState<PayoutType>(branch.payout_type)
  const [revShare, setRevShare]           = useState(String(branch.revenue_share_pct ?? 50))
  const [rentAmount, setRentAmount]       = useState(String(branch.fixed_rent_amount ?? ''))
  const [vatMode, setVatMode]             = useState<VatMode>(branch.fixed_rent_vat_mode ?? 'exclusive')
  const [partnerVat, setPartnerVat]       = useState<boolean>(p?.is_vat_registered ?? false)
  const [notifEmail, setNotifEmail]       = useState(branch.notification_email ?? '')
  const [lineToken, setLineToken]         = useState(branch.line_notify_token ?? '')
  const [saving, setSaving]               = useState(false)
  const [err, setErr]                     = useState('')
  const [saved, setSaved]                 = useState(false)
  const [testEmailState, setTestEmailState] = useState<'idle'|'sending'|'ok'|'err'>('idle')
  const [testLineState,  setTestLineState]  = useState<'idle'|'sending'|'ok'|'err'>('idle')
  const [testEmailTo,    setTestEmailTo]    = useState('')
  const [showTestEmailInput, setShowTestEmailInput] = useState(false)

  async function save() {
    setErr(''); setSaved(false)

    // Client-side validation before hitting the API
    if (payoutType === 'revenue_share') {
      const pct = parseFloat(revShare)
      if (isNaN(pct) || pct < 0 || pct > 100) { setErr('Revenue share must be 0–100'); return }
    } else {
      const rent = parseFloat(rentAmount)
      if (isNaN(rent) || rent < 0) { setErr('Rent amount must be a number ≥ 0'); return }
    }

    setSaving(true)
    try {
      const body: Record<string, unknown> = {
        payout_type: payoutType,
        partner_is_vat_registered: partnerVat,
        notification_email: notifEmail.trim() || null,
        line_notify_token:  lineToken.trim()  || null,
      }
      if (payoutType === 'revenue_share') {
        body.revenue_share_pct = parseFloat(revShare)
      } else {
        body.fixed_rent_amount   = parseFloat(rentAmount)
        body.fixed_rent_vat_mode = vatMode
      }

      const res  = await fetch(`/api/admin/branches/${branch.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) { setErr(data.error ?? 'Save failed'); setSaving(false); return }
      // Merge updated partner VAT into the returned branch object
      const updated = data.branch as BranchRow
      if (updated.partners) {
        const up = Array.isArray(updated.partners) ? updated.partners[0] : updated.partners
        if (up) up.is_vat_registered = partnerVat
      }
      setSaved(true)
      setTimeout(() => onSaved(updated), 800) // brief success flash before closing
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Network error')
      setSaving(false)
    }
  }

  async function sendTestEmail() {
    if (!testEmailTo.trim()) return
    setTestEmailState('sending')
    try {
      const res = await fetch('/api/admin/test-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'email', to: testEmailTo.trim() }),
      })
      setTestEmailState(res.ok ? 'ok' : 'err')
      setTimeout(() => { setTestEmailState('idle'); setShowTestEmailInput(false) }, 3000)
    } catch { setTestEmailState('err'); setTimeout(() => setTestEmailState('idle'), 3000) }
  }

  async function sendTestLine() {
    if (!lineToken.trim()) return
    setTestLineState('sending')
    try {
      const res = await fetch('/api/admin/test-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'line', token: lineToken.trim() }),
      })
      setTestLineState(res.ok ? 'ok' : 'err')
      setTimeout(() => setTestLineState('idle'), 3000)
    } catch { setTestLineState('err'); setTimeout(() => setTestLineState('idle'), 3000) }
  }

  const toggleStyle = (active: boolean): React.CSSProperties => ({
    ...BTN,
    background: active ? 'rgba(59,130,246,0.12)' : 'rgba(255,255,255,0.04)',
    color: active ? '#60A5FA' : 'rgba(241,245,249,0.5)',
    border: `1px solid ${active ? 'rgba(59,130,246,0.3)' : 'rgba(255,255,255,0.08)'}`,
  })

  return (
    <tr>
      <td colSpan={7} style={{ padding: 0 }}>
        <div style={{
          background: 'rgba(255,255,255,0.02)',
          borderTop: '1px solid rgba(255,255,255,0.07)',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          padding: '20px 24px',
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px', marginBottom: '16px' }}>

            {/* Payout model */}
            <div>
              <span style={LABEL}>Payout model</span>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button style={toggleStyle(payoutType === 'revenue_share')} onClick={() => setPayoutType('revenue_share')}>
                  Revenue share %
                </button>
                <button style={toggleStyle(payoutType === 'fixed_rent')} onClick={() => setPayoutType('fixed_rent')}>
                  Fixed rent
                </button>
              </div>
            </div>

            {/* Revenue share % */}
            {payoutType === 'revenue_share' && (
              <div>
                <label style={LABEL}>Revenue share %</label>
                <input
                  type="number" min={0} max={100} step={0.5}
                  style={INPUT} value={revShare}
                  onChange={e => setRevShare(e.target.value)}
                />
              </div>
            )}

            {/* Fixed rent amount */}
            {payoutType === 'fixed_rent' && (
              <div>
                <label style={LABEL}>Monthly rent (THB)</label>
                <input
                  type="number" min={0} step={1}
                  style={INPUT} value={rentAmount}
                  onChange={e => setRentAmount(e.target.value)}
                />
              </div>
            )}

            {/* VAT mode */}
            {payoutType === 'fixed_rent' && (
              <div>
                <span style={LABEL}>Rent is VAT…</span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button style={toggleStyle(vatMode === 'exclusive')} onClick={() => setVatMode('exclusive')}>
                    Exclusive (+ VAT)
                  </button>
                  <button style={toggleStyle(vatMode === 'inclusive')} onClick={() => setVatMode('inclusive')}>
                    Inclusive (incl. VAT)
                  </button>
                </div>
              </div>
            )}

            {/* Partner VAT registration */}
            <div>
              <span style={LABEL}>Partner VAT</span>
              <label style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                cursor: 'pointer', fontSize: '13px', color: '#F0ECE4',
                marginTop: '4px',
              }}>
                <input
                  type="checkbox"
                  checked={partnerVat}
                  onChange={e => setPartnerVat(e.target.checked)}
                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                />
                VAT-registered
              </label>
            </div>
          </div>

          {/* ── Notifications section ── */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', marginTop: '8px', paddingTop: '16px' }}>
            <span style={{ ...LABEL, color: 'rgba(240,236,228,0.25)', marginBottom: '12px' }}>Notifications</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '16px' }}>

              {/* Email */}
              <div>
                <label style={LABEL}>Notification Email</label>
                <input
                  type="email"
                  placeholder="partner@email.com"
                  style={INPUT}
                  value={notifEmail}
                  onChange={e => setNotifEmail(e.target.value)}
                />
                <div style={{ marginTop: '8px', display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                  {!showTestEmailInput ? (
                    <button
                      style={{ ...GHOST_BTN, fontSize: '11px', padding: '4px 10px', opacity: notifEmail.trim() ? 1 : 0.4 }}
                      disabled={!notifEmail.trim()}
                      onClick={() => setShowTestEmailInput(true)}
                    >
                      Send test email
                    </button>
                  ) : (
                    <>
                      <input
                        type="email"
                        placeholder="your@email.com"
                        style={{ ...INPUT, width: 'auto', flex: 1, fontSize: '12px', padding: '5px 10px' }}
                        value={testEmailTo}
                        onChange={e => setTestEmailTo(e.target.value)}
                        autoFocus
                      />
                      <button
                        style={{ ...GHOST_BTN, fontSize: '11px', padding: '4px 10px', opacity: testEmailState === 'sending' ? 0.5 : 1 }}
                        onClick={sendTestEmail}
                        disabled={testEmailState === 'sending' || !testEmailTo.trim()}
                      >
                        {testEmailState === 'sending' ? 'Sending…' : testEmailState === 'ok' ? 'Sent!' : testEmailState === 'err' ? 'Failed' : 'Send'}
                      </button>
                      <button style={{ ...GHOST_BTN, fontSize: '11px', padding: '4px 8px' }} onClick={() => setShowTestEmailInput(false)}>✕</button>
                    </>
                  )}
                  {testEmailState === 'ok'  && !showTestEmailInput && <span style={{ fontSize: '11px', color: '#22C55E' }}>Sent!</span>}
                  {testEmailState === 'err' && !showTestEmailInput && <span style={{ fontSize: '11px', color: '#F87171' }}>Failed</span>}
                </div>
              </div>

              {/* Line Notify */}
              <div>
                <label style={LABEL}>Line Notify Token</label>
                <input
                  type="text"
                  placeholder="Paste token here"
                  style={INPUT}
                  value={lineToken}
                  onChange={e => setLineToken(e.target.value)}
                />
                <div style={{ marginTop: '8px' }}>
                  <button
                    style={{ ...GHOST_BTN, fontSize: '11px', padding: '4px 10px', opacity: lineToken.trim() ? 1 : 0.4 }}
                    disabled={!lineToken.trim() || testLineState === 'sending'}
                    onClick={sendTestLine}
                  >
                    {testLineState === 'sending' ? 'Sending…' : testLineState === 'ok' ? 'Sent!' : testLineState === 'err' ? 'Failed' : 'Send test Line'}
                  </button>
                </div>
              </div>

            </div>
          </div>

          {err && (
            <p style={{ color: '#F87171', fontSize: '12px', margin: '12px 0 0' }}>{err}</p>
          )}
          {saved && (
            <p style={{ color: '#22C55E', fontSize: '12px', margin: '12px 0 0' }}>Saved</p>
          )}

          <div style={{ display: 'flex', gap: '8px' }}>
            <button style={{ ...GOLD_BTN, opacity: saving || saved ? 0.6 : 1 }} onClick={save} disabled={saving || saved}>
              {saving ? 'Saving…' : saved ? 'Saved!' : 'Save changes'}
            </button>
            <button style={GHOST_BTN} onClick={onCancel} disabled={saving}>
              Cancel
            </button>
          </div>
        </div>
      </td>
    </tr>
  )
}

// ── Delete confirm modal ─────────────────────────────────────────────────────

function DeleteModal({ branchName, onConfirm, onCancel, loading }: {
  branchName: string
  onConfirm:  () => void
  onCancel:   () => void
  loading:    boolean
}) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: '#0C1018', border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '16px', padding: '28px 32px', maxWidth: '420px', width: '100%',
        boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
      }}>
        <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#F1F5F9', margin: '0 0 12px' }}>
          Delete branch?
        </h3>
        <p style={{ fontSize: '13px', color: 'rgba(241,245,249,0.55)', margin: '0 0 6px', lineHeight: 1.6 }}>
          You are about to delete <strong style={{ color: '#F1F5F9' }}>{branchName}</strong>.
        </p>
        <p style={{ fontSize: '12px', color: 'rgba(241,245,249,0.35)', margin: '0 0 24px', lineHeight: 1.6 }}>
          If this branch has existing reports it will be <em>deactivated</em> instead of permanently deleted.
        </p>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            disabled={loading}
            style={{
              padding: '8px 18px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer',
              border: '1px solid rgba(255,255,255,0.1)', background: 'transparent',
              color: 'rgba(241,245,249,0.6)',
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            style={{
              padding: '8px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: '700',
              cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.6 : 1,
              border: '1px solid rgba(239,68,68,0.4)', background: 'rgba(239,68,68,0.1)',
              color: '#F87171',
            }}
          >
            {loading ? 'Deleting…' : 'Yes, delete'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────

export function BranchesClient({ initialBranches }: { initialBranches: BranchRow[] }) {
  const [branches,    setBranches]    = useState<BranchRow[]>(initialBranches)
  const [editingId,   setEditingId]   = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null)
  const [deleting,    setDeleting]    = useState(false)
  const [deleteMsg,   setDeleteMsg]   = useState<{ text: string; ok: boolean } | null>(null)

  function handleSaved(updated: BranchRow) {
    setBranches(prev => prev.map(b => b.id === updated.id ? updated : b))
    setEditingId(null)
  }

  async function handleDelete(id: string) {
    setDeleting(true)
    try {
      const res  = await fetch(`/api/admin/branches/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) {
        setDeleteMsg({ text: data.error ?? 'Delete failed', ok: false })
      } else if (data.deleted) {
        // Hard deleted — remove from list
        setBranches(prev => prev.filter(b => b.id !== id))
        setDeleteMsg({ text: data.message, ok: true })
      } else {
        // Soft deactivated — update status in list
        setBranches(prev => prev.map(b => b.id === id ? { ...b, is_active: false } : b))
        setDeleteMsg({ text: data.message, ok: true })
      }
    } catch {
      setDeleteMsg({ text: 'Network error — please try again.', ok: false })
    } finally {
      setDeleting(false)
      setConfirmDelete(null)
      setTimeout(() => setDeleteMsg(null), 6000)
    }
  }

  const TH: React.CSSProperties = {
    padding: '12px 20px', textAlign: 'left',
    fontSize: '11px', fontWeight: '600', letterSpacing: '0.08em',
    textTransform: 'uppercase', color: 'rgba(240,236,228,0.35)',
    whiteSpace: 'nowrap',
  }

  return (
    <>
    {confirmDelete && (
      <DeleteModal
        branchName={confirmDelete.name}
        loading={deleting}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => handleDelete(confirmDelete.id)}
      />
    )}
    <div style={{
      background: '#0D0F1A', border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: '16px', overflow: 'hidden',
    }}>
      {deleteMsg && (
        <div style={{
          margin: '16px 20px 0', padding: '10px 14px', borderRadius: '8px',
          background: deleteMsg.ok ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
          border: `1px solid ${deleteMsg.ok ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`,
          fontSize: '12px', color: deleteMsg.ok ? '#4ADE80' : '#F87171',
        }}>
          {deleteMsg.text}
        </div>
      )}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              {['Branch', 'Code', 'Partner', 'Payout model', 'Amount', 'Status', ''].map(h => (
                <th key={h} style={TH}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {branches.map(b => {
              const p      = partner(b)
              const isEdit = editingId === b.id

              return (
                <React.Fragment key={b.id}>
                  <tr
                    style={{
                      borderBottom: isEdit ? 'none' : '1px solid rgba(255,255,255,0.04)',
                      background: isEdit ? 'rgba(59,130,246,0.03)' : 'transparent',
                    }}
                  >
                    {/* Branch name */}
                    <td style={{ padding: '14px 20px', color: '#F0ECE4', fontWeight: '500' }}>
                      {b.name}
                    </td>

                    {/* Code */}
                    <td style={{ padding: '14px 20px', color: 'rgba(240,236,228,0.5)', fontFamily: 'monospace', fontSize: '12px' }}>
                      {b.code ?? '—'}
                    </td>

                    {/* Partner + VAT badge */}
                    <td style={{ padding: '14px 20px' }}>
                      <span style={{ color: 'rgba(240,236,228,0.7)' }}>{p?.name ?? '—'}</span>
                      {p?.is_vat_registered && (
                        <span style={{
                          marginLeft: '8px', fontSize: '10px', fontWeight: '700',
                          letterSpacing: '0.06em', padding: '2px 6px', borderRadius: '4px',
                          background: 'rgba(59,130,246,0.1)', color: '#60A5FA',
                          border: '1px solid rgba(59,130,246,0.2)',
                        }}>VAT</span>
                      )}
                    </td>

                    {/* Payout model */}
                    <td style={{ padding: '14px 20px', color: 'rgba(240,236,228,0.6)' }}>
                      {b.payout_type === 'fixed_rent' ? (
                        <span>
                          Fixed rent
                          {b.fixed_rent_vat_mode && (
                            <span style={{ marginLeft: '6px', fontSize: '10px', opacity: 0.5 }}>
                              ({b.fixed_rent_vat_mode})
                            </span>
                          )}
                        </span>
                      ) : 'Revenue share'}
                    </td>

                    {/* Amount */}
                    <td style={{ padding: '14px 20px', color: '#F1F5F9', fontWeight: '600' }}>
                      {b.payout_type === 'fixed_rent'
                        ? `฿${(b.fixed_rent_amount ?? 0).toLocaleString()}/mo`
                        : `${b.revenue_share_pct}%`
                      }
                    </td>

                    {/* Status */}
                    <td style={{ padding: '14px 20px' }}>
                      <span style={{
                        fontSize: '11px', fontWeight: '600', letterSpacing: '0.06em',
                        padding: '3px 8px', borderRadius: '6px',
                        background: b.is_active ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.05)',
                        color: b.is_active ? '#22C55E' : 'rgba(240,236,228,0.3)',
                      }}>
                        {b.is_active ? 'ACTIVE' : 'INACTIVE'}
                      </span>
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button
                          style={{
                            ...GHOST_BTN,
                            ...(isEdit ? { background: 'rgba(59,130,246,0.1)', color: '#60A5FA' } : {}),
                          }}
                          onClick={() => setEditingId(isEdit ? null : b.id)}
                        >
                          {isEdit ? 'Close' : 'Edit'}
                        </button>
                        <button
                          style={{
                            ...GHOST_BTN,
                            color: 'rgba(248,113,113,0.7)',
                            border: '1px solid rgba(239,68,68,0.2)',
                          }}
                          onClick={() => setConfirmDelete({ id: b.id, name: b.name })}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>

                  {isEdit && (
                    <EditForm
                      branch={b}
                      onSaved={handleSaved}
                      onCancel={() => setEditingId(null)}
                    />
                  )}
                </React.Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
    </>
  )
}
