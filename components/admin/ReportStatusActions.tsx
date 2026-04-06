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
  const [loading, setLoading] = useState<'approve' | 'mark_paid' | null>(null)
  const [toast,   setToast]   = useState<Toast | null>(null)
  const [error,   setError]   = useState<string | null>(null)

  async function transition(action: 'approve' | 'mark_paid') {
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
        : 'Report marked as paid.'

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

      {/* approved → mark paid */}
      {status === 'approved' && (
        <div>
          {approvedAt && (
            <p style={metaLine}>Approved {fmtDate(approvedAt)}</p>
          )}
          <div style={{ height: '14px' }} />
          <p style={{ fontSize: '13px', color: 'rgba(240,236,228,0.5)', marginBottom: '14px' }}>
            Mark this report as paid once the partner payout has been processed.
          </p>
          <button
            onClick={() => transition('mark_paid')}
            disabled={loading === 'mark_paid'}
            style={{
              padding: '10px 20px', borderRadius: '8px',
              border: '1px solid rgba(196,163,94,0.4)',
              background: 'rgba(196,163,94,0.1)', color: '#C4A35E',
              fontSize: '13px', fontWeight: '700', cursor: 'pointer',
              opacity: loading === 'mark_paid' ? 0.6 : 1,
            }}
          >
            {loading === 'mark_paid' ? 'Saving…' : '฿ Mark as Paid'}
          </button>
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
            background: 'rgba(196,163,94,0.06)', border: '1px solid rgba(196,163,94,0.15)',
            fontSize: '12px', color: 'rgba(196,163,94,0.7)',
          }}>
            This report is fully paid. No further actions available.
          </div>
        </div>
      )}
    </div>
  )
}
