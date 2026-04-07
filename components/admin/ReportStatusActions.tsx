'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

// ── Types ─────────────────────────────────────────────────────────────────────

type ReportStatus = 'draft' | 'approved' | 'paid'

type Toast = { message: string; ok: boolean }

type Props = {
  reportId: string
  status:   ReportStatus
  // Timestamps for display
  approvedAt?: string | null
  paidAt?:     string | null
}

// ── Confirmation modal ────────────────────────────────────────────────────────

function ConfirmModal({ message, onConfirm, onCancel, loading }: {
  message:   string
  onConfirm: () => void
  onCancel:  () => void
  loading:   boolean
}) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: '#0C1018', border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '16px', padding: '28px 32px', maxWidth: '400px', width: '100%',
        boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
      }}>
        <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#F1F5F9', margin: '0 0 12px' }}>
          Revert to Draft?
        </h3>
        <p style={{ fontSize: '13px', color: 'rgba(241,245,249,0.55)', margin: '0 0 24px', lineHeight: 1.6 }}>
          {message}
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
            {loading ? 'Reverting…' : 'Yes, revert to draft'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ReportStatusActions({ reportId, status, approvedAt, paidAt }: Props) {
  const router = useRouter()
  const [loading,     setLoading]     = useState<'approve' | 'mark_paid' | 'revert_to_draft' | null>(null)
  const [toast,       setToast]       = useState<Toast | null>(null)
  const [error,       setError]       = useState<string | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)

  async function transition(action: 'approve' | 'mark_paid' | 'revert_to_draft') {
    setLoading(action)
    setError(null)

    try {
      const res  = await fetch(`/api/admin/reports/${reportId}/status`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ action }),
      })
      const json = await res.json()

      if (!res.ok) {
        setError(json.error ?? 'Action failed. Please try again.')
        setLoading(null)
        return
      }

      const msg = action === 'approve'
        ? 'Report approved — order rows and refunds are now locked.'
        : action === 'mark_paid'
          ? 'Report marked as paid.'
          : 'Report reverted to draft — financial fields are editable again.'

      setToast({ message: msg, ok: true })
      setTimeout(() => setToast(null), 6000)
      router.refresh()  // re-fetch server component so status badge + locks update
    } catch {
      setError('Network error — please try again.')
    } finally {
      setLoading(null)
    }
  }

  // ── Styles ──────────────────────────────────────────────────────────────────

  const sectionLabel: React.CSSProperties = {
    fontSize: '14px', fontWeight: '600', color: 'rgba(240,236,228,0.6)',
    letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '16px',
  }

  const metaLine: React.CSSProperties = {
    fontSize: '12px', color: 'rgba(240,236,228,0.4)', marginTop: '6px',
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <>
    {showConfirm && (
      <ConfirmModal
        message="This will unlock all financial fields and allow re-importing or editing. The approval timestamp will be cleared."
        loading={loading === 'revert_to_draft'}
        onCancel={() => setShowConfirm(false)}
        onConfirm={async () => { await transition('revert_to_draft'); setShowConfirm(false) }}
      />
    )}
    <div style={{
      background: '#0D0F1A', border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: '16px', padding: '24px',
    }}>
      <h2 style={sectionLabel}>Status &amp; Approval</h2>

      {/* Toast */}
      {toast && (
        <div style={{
          marginBottom: '16px', padding: '10px 14px', borderRadius: '8px',
          background: toast.ok ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
          border: `1px solid ${toast.ok ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`,
          fontSize: '12px', color: toast.ok ? '#4ADE80' : '#F87171',
        }}>
          {toast.message}
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{
          marginBottom: '16px', padding: '10px 14px', borderRadius: '8px',
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
          fontSize: '12px', color: '#F87171',
        }}>
          {error}
        </div>
      )}

      {/* draft → approve */}
      {status === 'draft' && (
        <div>
          <p style={{ fontSize: '13px', color: 'rgba(240,236,228,0.5)', marginBottom: '14px' }}>
            Approving this report locks all order row edits and refund changes.
            This action cannot be undone.
          </p>
          <button
            onClick={() => transition('approve')}
            disabled={loading === 'approve'}
            style={{
              padding: '10px 20px', borderRadius: '8px',
              border: '1px solid rgba(34,197,94,0.35)',
              background: 'rgba(34,197,94,0.1)', color: '#4ADE80',
              fontSize: '13px', fontWeight: '700', cursor: 'pointer',
              opacity: loading === 'approve' ? 0.6 : 1,
            }}
          >
            {loading === 'approve' ? 'Approving…' : '✓ Approve Report'}
          </button>
        </div>
      )}

      {/* approved → mark paid  /  approved → revert to draft */}
      {status === 'approved' && (
        <div>
          {approvedAt && (
            <p style={metaLine}>Approved {fmtDate(approvedAt)}</p>
          )}
          <div style={{ height: '14px' }} />
          <p style={{ fontSize: '13px', color: 'rgba(240,236,228,0.5)', marginBottom: '14px' }}>
            Mark this report as paid once the partner payout has been processed.
          </p>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button
              onClick={() => transition('mark_paid')}
              disabled={!!loading}
              style={{
                padding: '10px 20px', borderRadius: '8px',
                border: '1px solid rgba(34,197,94,0.4)',
                background: 'rgba(34,197,94,0.1)', color: '#4ADE80',
                fontSize: '13px', fontWeight: '700', cursor: loading ? 'default' : 'pointer',
                opacity: loading ? 0.6 : 1,
              }}
            >
              {loading === 'mark_paid' ? 'Saving…' : '฿ Mark as Paid'}
            </button>
            <button
              onClick={() => setShowConfirm(true)}
              disabled={!!loading}
              style={{
                padding: '10px 20px', borderRadius: '8px',
                border: '1px solid rgba(239,68,68,0.25)',
                background: 'transparent', color: 'rgba(248,113,113,0.7)',
                fontSize: '13px', cursor: loading ? 'default' : 'pointer',
                opacity: loading ? 0.6 : 1,
              }}
            >
              ↩ Revert to Draft
            </button>
          </div>
        </div>
      )}

      {/* paid — terminal state */}
      {status === 'paid' && (
        <div>
          {approvedAt && (
            <p style={metaLine}>Approved {fmtDate(approvedAt)}</p>
          )}
          {paidAt && (
            <p style={metaLine}>Paid {fmtDate(paidAt)}</p>
          )}
          <div style={{
            marginTop: '14px', padding: '10px 14px', borderRadius: '8px',
            background: 'rgba(34,197,94,0.04)', border: '1px solid rgba(34,197,94,0.12)',
            fontSize: '12px', color: 'rgba(74,222,128,0.7)',
          }}>
            This report is fully paid. No further actions available.
          </div>
        </div>
      )}
    </div>
    </>
  )
}
