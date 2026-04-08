'use client'

import { useState } from 'react'

type DocItem = {
  label:      string
  type:       'slip' | 'wht'
  name:       string | null
  uploadedAt: string | null
}

function fmtDate(iso: string | null) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function DocRow({ reportId, item }: { reportId: string; item: DocItem }) {
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const download = async () => {
    setLoading(true); setError(null)
    try {
      const res  = await fetch(`/api/reports/${reportId}/document-url?type=${item.type}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to get download link')
      const a = document.createElement('a')
      a.href     = json.url
      a.download = json.name
      a.click()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Download failed')
    } finally {
      setLoading(false)
    }
  }

  const hasFile = !!item.name

  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '16px 0', borderBottom: '1px solid rgba(255,255,255,0.05)',
      gap: '12px', flexWrap: 'wrap',
    }}>
      <div>
        <div style={{ fontSize: '12px', fontWeight: '600', color: 'rgba(240,236,228,0.4)', marginBottom: '4px' }}>
          {item.label}
        </div>
        {hasFile ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '13px', color: '#F0ECE4', fontWeight: '500' }}>
              📎 {item.name}
            </span>
            {item.uploadedAt && (
              <span style={{ fontSize: '11px', color: 'rgba(240,236,228,0.3)' }}>
                {fmtDate(item.uploadedAt)}
              </span>
            )}
          </div>
        ) : (
          <span style={{ fontSize: '13px', color: 'rgba(240,236,228,0.2)', fontStyle: 'italic' }}>
            Not yet uploaded
          </span>
        )}
        {error && (
          <div style={{ fontSize: '12px', color: '#EF4444', marginTop: '5px' }}>{error}</div>
        )}
      </div>

      {hasFile && (
        <button
          onClick={download}
          disabled={loading}
          style={{
            padding: '8px 18px', borderRadius: '8px',
            border: '1px solid rgba(0,212,255,0.2)',
            background: 'rgba(0,212,255,0.07)', cursor: 'pointer',
            fontSize: '12px', color: '#00D4FF', fontWeight: '500',
            flexShrink: 0,
          }}
        >
          {loading ? 'Getting link…' : '↓ Download'}
        </button>
      )}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function ReportDocumentView({
  reportId,
  slipName, slipUploadedAt,
  whtName,  whtUploadedAt,
}: {
  reportId:      string
  slipName:      string | null
  slipUploadedAt: string | null
  whtName:       string | null
  whtUploadedAt: string | null
}) {
  const hasAny = slipName || whtName

  return (
    <div style={{
      background: '#0D0F1A', border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: '16px', padding: '24px 28px',
    }}>
      <h2 style={{
        margin: '0 0 4px', fontSize: '11px', fontWeight: '600',
        letterSpacing: '0.1em', textTransform: 'uppercase',
        color: 'rgba(240,236,228,0.3)',
      }}>
        Documents
      </h2>
      {!hasAny && (
        <p style={{ margin: '12px 0 0', fontSize: '13px', color: 'rgba(240,236,228,0.25)' }}>
          No documents attached to this report yet.
        </p>
      )}

      <DocRow reportId={reportId} item={{
        label: 'Payment Slip', type: 'slip',
        name: slipName, uploadedAt: slipUploadedAt,
      }} />
      <DocRow reportId={reportId} item={{
        label: 'Withholding Tax Certificate (ใบหัก ณ ที่จ่าย)', type: 'wht',
        name: whtName, uploadedAt: whtUploadedAt,
      }} />
    </div>
  )
}
