'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { StatusBadge } from '@/components/shared/StatusBadge'

// ── Types ─────────────────────────────────────────────────────────────────────

export type BranchOption = { id: string; name: string }

export type RefundRow = {
  id: string
  amount: number
  reason: string
  reference_number: string | null
  created_at: string
  branch_id: string
  reporting_month: number
  reporting_year: number
  monthly_report_id: string | null
  // joined
  branch_name: string
  report_status: string | null
  report_id: string | null
}

type Mode = 'list' | 'create' | 'edit'

type FormState = {
  branch_id: string
  reporting_month: string
  reporting_year: string
  amount: string
  reason: string
  reference_number: string
}

type Toast = { message: string; ok: boolean }

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtTHB(n: number) {
  return `฿${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })
}

function fmtPeriod(month: number, year: number) {
  const m = new Date(year, month - 1, 1).toLocaleString('en-US', { month: 'long' })
  return `${m} ${year}`
}

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

const currentYear  = new Date().getFullYear()
const YEARS        = Array.from({ length: 5 }, (_, i) => currentYear - i)

// ── Shared styles ─────────────────────────────────────────────────────────────

const fieldLabel: React.CSSProperties = {
  display: 'block', fontSize: '11px', fontWeight: '600',
  letterSpacing: '0.07em', textTransform: 'uppercase',
  color: 'rgba(240,236,228,0.45)', marginBottom: '6px',
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: '8px',
  border: '1px solid rgba(255,255,255,0.1)',
  background: 'rgba(255,255,255,0.04)', color: '#F0ECE4',
  fontSize: '13px', outline: 'none', boxSizing: 'border-box',
}

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  appearance: 'none', cursor: 'pointer',
}

// ── RefundForm (inner) ────────────────────────────────────────────────────────

type RefundFormProps = {
  branches:       BranchOption[]
  editRefund?:    RefundRow          // present in edit mode
  onClose:        () => void
  onSaved:        (msg: string) => void
}

function RefundForm({ branches, editRefund, onClose, onSaved }: RefundFormProps) {
  const isEdit = !!editRefund

  const [form, setForm] = useState<FormState>({
    branch_id:        editRefund?.branch_id      ?? '',
    reporting_month:  editRefund ? String(editRefund.reporting_month) : '',
    reporting_year:   editRefund ? String(editRefund.reporting_year)  : String(currentYear),
    amount:           editRefund ? String(editRefund.amount)          : '',
    reason:           editRefund?.reason          ?? '',
    reference_number: editRefund?.reference_number ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState<string | null>(null)

  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm(f => ({ ...f, [k]: e.target.value }))
    setError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    // Client-side validation
    const amount = parseFloat(form.amount)
    if (!form.branch_id)              return setError('Please select a branch.')
    if (!form.reporting_month)        return setError('Please select a reporting month.')
    if (!form.reporting_year)         return setError('Please enter a reporting year.')
    if (isNaN(amount) || amount <= 0) return setError('Amount must be a positive number.')
    if (!form.reason.trim())          return setError('Reason is required.')

    setSaving(true)

    try {
      let res: Response
      if (isEdit) {
        // PATCH — only send changed editable fields
        res = await fetch(`/api/admin/refunds/${editRefund!.id}`, {
          method:  'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            amount:           amount,
            reason:           form.reason.trim(),
            reference_number: form.reference_number.trim() || null,
          }),
        })
      } else {
        // POST — create new
        res = await fetch('/api/admin/refunds', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            branch_id:        form.branch_id,
            reporting_month:  parseInt(form.reporting_month),
            reporting_year:   parseInt(form.reporting_year),
            amount,
            reason:           form.reason.trim(),
            reference_number: form.reference_number.trim() || null,
          }),
        })
      }

      const json = await res.json()

      if (!res.ok) {
        // 409 = duplicate — surface the useful message
        setError(json.error ?? 'Save failed. Please try again.')
        setSaving(false)
        return
      }

      const pct = json.report_recalculated
        ? ' Report recalculated.'
        : ' (No linked report found — recalculation skipped.)'

      onSaved(isEdit ? `Refund updated.${pct}` : `Refund recorded.${pct}`)
    } catch {
      setError('Network error — please try again.')
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>

        {/* Branch */}
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={fieldLabel}>Branch</label>
          {isEdit ? (
            // Read-only in edit mode — branch/period cannot be changed
            <div style={{
              ...inputStyle, color: 'rgba(240,236,228,0.5)',
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}>
              {editRefund!.branch_name}
            </div>
          ) : (
            <select value={form.branch_id} onChange={set('branch_id')} style={selectStyle} required>
              <option value="">— Select branch —</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          )}
        </div>

        {/* Month */}
        <div>
          <label style={fieldLabel}>Reporting Month</label>
          {isEdit ? (
            <div style={{
              ...inputStyle, color: 'rgba(240,236,228,0.5)',
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}>
              {MONTHS[(editRefund!.reporting_month ?? 1) - 1]}
            </div>
          ) : (
            <select value={form.reporting_month} onChange={set('reporting_month')} style={selectStyle} required>
              <option value="">— Month —</option>
              {MONTHS.map((m, i) => (
                <option key={i + 1} value={i + 1}>{m}</option>
              ))}
            </select>
          )}
        </div>

        {/* Year */}
        <div>
          <label style={fieldLabel}>Reporting Year</label>
          {isEdit ? (
            <div style={{
              ...inputStyle, color: 'rgba(240,236,228,0.5)',
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}>
              {editRefund!.reporting_year}
            </div>
          ) : (
            <select value={form.reporting_year} onChange={set('reporting_year')} style={selectStyle} required>
              {YEARS.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          )}
        </div>

        {/* Amount */}
        <div>
          <label style={fieldLabel}>Amount (฿)</label>
          <input
            type="number"
            min="0.01"
            step="0.01"
            placeholder="0.00"
            value={form.amount}
            onChange={set('amount')}
            style={inputStyle}
            required
          />
        </div>

        {/* Reference number */}
        <div>
          <label style={fieldLabel}>Reference Number <span style={{ opacity: 0.45, fontWeight: 400 }}>(optional)</span></label>
          <input
            type="text"
            placeholder="e.g. INV-2024-01"
            value={form.reference_number}
            onChange={set('reference_number')}
            style={inputStyle}
          />
        </div>

        {/* Reason — full width */}
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={fieldLabel}>Reason</label>
          <textarea
            rows={3}
            placeholder="Describe the refund reason…"
            value={form.reason}
            onChange={set('reason')}
            style={{
              ...inputStyle, resize: 'vertical', fontFamily: 'inherit',
              lineHeight: '1.5',
            }}
            required
          />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          marginTop: '12px', padding: '10px 14px', borderRadius: '8px',
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
          fontSize: '12px', color: '#F87171',
        }}>
          {error}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
        <button
          type="button"
          onClick={onClose}
          disabled={saving}
          style={{
            padding: '9px 18px', borderRadius: '8px',
            border: '1px solid rgba(255,255,255,0.1)',
            background: 'transparent', color: 'rgba(240,236,228,0.6)',
            fontSize: '13px', cursor: 'pointer',
          }}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          style={{
            padding: '9px 18px', borderRadius: '8px',
            border: '1px solid rgba(239,68,68,0.35)',
            background: 'rgba(239,68,68,0.12)', color: '#EF4444',
            fontSize: '13px', fontWeight: '700', cursor: 'pointer',
            opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Record Refund'}
        </button>
      </div>
    </form>
  )
}

// ── RefundPageClient (exported) ───────────────────────────────────────────────

type Props = {
  branches: BranchOption[]
  refunds:  RefundRow[]
}

export function RefundPageClient({ branches, refunds: initialRefunds }: Props) {
  const router = useRouter()

  const [mode,       setMode]       = useState<Mode>('list')
  const [editTarget, setEditTarget] = useState<RefundRow | null>(null)
  const [toast,      setToast]      = useState<Toast | null>(null)

  // Use prop directly — router.refresh() will re-render this component
  // with updated server data, so no need to mirror it in state.
  const refunds = initialRefunds

  const showToast = useCallback((message: string, ok = true) => {
    setToast({ message, ok })
    setTimeout(() => setToast(null), 5000)
  }, [])

  function openCreate() { setEditTarget(null); setMode('create') }
  function openEdit(r: RefundRow) { setEditTarget(r); setMode('edit') }
  function closeForm() { setMode('list'); setEditTarget(null) }

  function handleSaved(msg: string) {
    closeForm()
    showToast(msg)
    router.refresh()   // re-fetch server component (list + report detail if open)
  }

  // ── Styles ──────────────────────────────────────────────────────────────────

  const thStyle: React.CSSProperties = {
    padding: '12px 20px', textAlign: 'left',
    fontSize: '11px', fontWeight: '600', letterSpacing: '0.08em',
    textTransform: 'uppercase', color: 'rgba(240,236,228,0.35)',
    whiteSpace: 'nowrap',
  }
  const tdStyle: React.CSSProperties = {
    padding: '14px 20px', verticalAlign: 'middle',
  }

  return (
    <div>
      {/* ── Header row (title + button) ──────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#F0ECE4', margin: 0 }}>Refunds</h1>
          <p style={{ fontSize: '13px', color: 'rgba(240,236,228,0.45)', marginTop: '4px' }}>
            Business refunds deducted from monthly partner payouts
          </p>
        </div>
        {mode === 'list' && (
          <button
            onClick={openCreate}
            style={{
              padding: '10px 18px', borderRadius: '10px',
              background: 'rgba(239,68,68,0.12)',
              color: '#EF4444', fontSize: '13px', fontWeight: '700',
              border: '1px solid rgba(239,68,68,0.25)', cursor: 'pointer',
              letterSpacing: '0.04em',
            }}
          >
            + Record Refund
          </button>
        )}
      </div>

      {/* ── Toast ────────────────────────────────────────────────────────────── */}
      {toast && (
        <div style={{
          marginBottom: '16px', padding: '12px 16px', borderRadius: '10px',
          background: toast.ok ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
          border: `1px solid ${toast.ok ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`,
          fontSize: '13px', color: toast.ok ? '#4ADE80' : '#F87171',
        }}>
          {toast.message}
        </div>
      )}

      {/* ── Form panel (create or edit) ───────────────────────────────────────── */}
      {(mode === 'create' || mode === 'edit') && (
        <div style={{
          background: '#0D0F1A', border: '1px solid rgba(239,68,68,0.15)',
          borderRadius: '16px', padding: '24px', marginBottom: '24px',
        }}>
          <h2 style={{
            fontSize: '14px', fontWeight: '600', color: 'rgba(240,236,228,0.6)',
            letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '20px',
          }}>
            {mode === 'edit'
              ? `Edit Refund — ${editTarget ? fmtPeriod(editTarget.reporting_month, editTarget.reporting_year) : ''} · ${editTarget?.branch_name ?? ''}`
              : 'Record New Refund'}
          </h2>
          <RefundForm
            branches={branches}
            editRefund={editTarget ?? undefined}
            onClose={closeForm}
            onSaved={handleSaved}
          />
        </div>
      )}

      {/* ── Refund list table ─────────────────────────────────────────────────── */}
      <div style={{
        background: '#0D0F1A', border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '16px', overflow: 'hidden',
      }}>
        {refunds.length === 0 ? (
          <div style={{ padding: '60px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: '32px', marginBottom: '12px', opacity: 0.4 }}>↩</div>
            <p style={{ fontSize: '14px', fontWeight: '600', color: 'rgba(240,236,228,0.4)', margin: 0 }}>
              No refunds recorded
            </p>
            <p style={{ fontSize: '12px', color: 'rgba(240,236,228,0.25)', marginTop: '6px' }}>
              Refunds reduce the adjusted NET before calculating partner payout.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <th style={thStyle}>Period</th>
                  <th style={thStyle}>Branch</th>
                  <th style={thStyle}>Amount</th>
                  <th style={thStyle}>Reason</th>
                  <th style={thStyle}>Reference</th>
                  <th style={thStyle}>Report Status</th>
                  <th style={thStyle}>Recorded</th>
                  <th style={thStyle}></th>
                </tr>
              </thead>
              <tbody>
                {refunds.map(r => (
                  <tr
                    key={r.id}
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                  >
                    <td style={{ ...tdStyle, color: '#F0ECE4', whiteSpace: 'nowrap' }}>
                      {fmtPeriod(r.reporting_month, r.reporting_year)}
                    </td>
                    <td style={{ ...tdStyle, color: 'rgba(240,236,228,0.7)' }}>
                      {r.branch_name}
                    </td>
                    <td style={{ ...tdStyle, color: '#EF4444', fontWeight: '600', whiteSpace: 'nowrap' }}>
                      − {fmtTHB(r.amount)}
                    </td>
                    <td style={{ ...tdStyle, color: 'rgba(240,236,228,0.6)', maxWidth: '220px' }}>
                      <span style={{
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}>
                        {r.reason}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, color: 'rgba(240,236,228,0.4)', fontFamily: 'monospace', fontSize: '12px' }}>
                      {r.reference_number ?? '—'}
                    </td>
                    <td style={tdStyle}>
                      {r.report_status ? (
                        <StatusBadge status={r.report_status as 'draft'} />
                      ) : (
                        <span style={{ fontSize: '12px', color: 'rgba(240,236,228,0.25)' }}>No report</span>
                      )}
                    </td>
                    <td style={{ ...tdStyle, color: 'rgba(240,236,228,0.4)', whiteSpace: 'nowrap', fontSize: '12px' }}>
                      {fmtDate(r.created_at)}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      <button
                        onClick={() => openEdit(r)}
                        style={{
                          padding: '5px 12px', borderRadius: '6px',
                          border: '1px solid rgba(255,255,255,0.1)',
                          background: 'transparent',
                          color: 'rgba(240,236,228,0.5)',
                          fontSize: '12px', cursor: 'pointer',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Info note ─────────────────────────────────────────────────────────── */}
      <div style={{
        marginTop: '16px', padding: '14px 20px', borderRadius: '10px',
        background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.1)',
        fontSize: '12px', color: 'rgba(239,100,100,0.7)',
      }}>
        MVP: one refund per branch per reporting month. The refund amount is subtracted from NET before applying the
        revenue share percentage. If the refund exceeds NET, the partner payout is set to ฿0.00.
      </div>
    </div>
  )
}
