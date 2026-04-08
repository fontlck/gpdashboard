'use client'

import { useState, useRef } from 'react'

type DocType = 'slip' | 'wht'

type Props = {
  reportId:    string
  // current state from server
  slipName:    string | null
  slipUploadedAt: string | null
  whtName:     string | null
  whtUploadedAt:  string | null
}

function fmtDate(iso: string | null) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function DocRow({
  reportId, docType, label, name, uploadedAt,
  onUpdated,
}: {
  reportId: string; docType: DocType; label: string
  name: string | null; uploadedAt: string | null
  onUpdated: (name: string | null, uploadedAt: string | null) => void
}) {
  const inputRef  = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [removing,  setRemoving]  = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)

  const handleUpload = async (file: File) => {
    setUploading(true); setError(null)
    const fd = new FormData()
    fd.append('file', file)
    fd.append('type', docType)
    try {
      const res = await fetch(`/api/admin/reports/${reportId}/documents`, { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Upload failed')
      onUpdated(json.name, new Date().toISOString())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const handleRemove = async () => {
    if (!confirm(`Remove ${label}?`)) return
    setRemoving(true); setError(null)
    try {
      const res = await fetch(`/api/admin/reports/${reportId}/documents?type=${docType}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Remove failed')
      onUpdated(null, null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Remove failed')
    } finally {
      setRemoving(false)
    }
  }

  const handleDownload = async () => {
    setDownloading(true)
    try {
      const res  = await fetch(`/api/reports/${reportId}/document-url?type=${docType}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      const a = document.createElement('a')
      a.href     = json.url
      a.download = json.name
      a.click()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Download failed')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div style={{
      padding: '18px 0',
      borderBottom: '1px solid rgba(255,255,255,0.05)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: '12px', fontWeight: '600', color: 'rgba(240,236,228,0.55)', marginBottom: '4px' }}>
            {label}
          </div>
          {name ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{
                fontSize: '13px', color: '#F0ECE4', fontWeight: '500',
              }}>
                📎 {name}
              </span>
              {uploadedAt && (
                <span style={{ fontSize: '11px', color: 'rgba(240,236,228,0.3)' }}>
                  Uploaded {fmtDate(uploadedAt)}
                </span>
              )}
            </div>
          ) : (
            <span style={{ fontSize: '13px', color: 'rgba(240,236,228,0.25)' }}>No file uploaded</span>
          )}
          {error && (
            <div style={{ fontSize: '12px', color: '#EF4444', marginTop: '5px' }}>{error}</div>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '6px', flexShrink: 0, alignItems: 'center' }}>
          {name && (
            <>
              <button
                onClick={handleDownload}
                disabled={downloading}
                style={{
                  padding: '7px 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)',
                  background: 'rgba(255,255,255,0.04)', cursor: 'pointer',
                  fontSize: '12px', color: 'rgba(240,236,228,0.65)',
                }}
              >
                {downloading ? '…' : '↓ Download'}
              </button>
              <button
                onClick={handleRemove}
                disabled={removing}
                style={{
                  padding: '7px 14px', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.2)',
                  background: 'rgba(239,68,68,0.06)', cursor: 'pointer',
                  fontSize: '12px', color: 'rgba(239,68,68,0.7)',
                }}
              >
                {removing ? '…' : 'Remove'}
              </button>
            </>
          )}
          <button
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            style={{
              padding: '7px 14px', borderRadius: '8px', border: '1px solid rgba(0,212,255,0.25)',
              background: 'rgba(0,212,255,0.07)', cursor: 'pointer',
              fontSize: '12px', color: '#00D4FF', fontWeight: '500',
            }}
          >
            {uploading ? 'Uploading…' : name ? 'Replace' : '↑ Upload'}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept=".png,.jpg,.jpeg,.pdf"
            style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f) }}
          />
        </div>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function ReportDocumentUpload({
  reportId, slipName: initSlipName, slipUploadedAt: initSlipAt,
  whtName: initWhtName, whtUploadedAt: initWhtAt,
}: Props) {
  const [slipName, setSlipName]   = useState(initSlipName)
  const [slipAt,   setSlipAt]     = useState(initSlipAt)
  const [whtName,  setWhtName]    = useState(initWhtName)
  const [whtAt,    setWhtAt]      = useState(initWhtAt)

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
      <p style={{ margin: '0 0 4px', fontSize: '12px', color: 'rgba(240,236,228,0.25)' }}>
        PNG, JPG or PDF · max 10 MB
      </p>

      <DocRow
        reportId={reportId} docType="slip" label="Payment Slip"
        name={slipName} uploadedAt={slipAt}
        onUpdated={(n, a) => { setSlipName(n); setSlipAt(a) }}
      />
      <DocRow
        reportId={reportId} docType="wht" label="Withholding Tax Certificate (ใบหัก ณ ที่จ่าย)"
        name={whtName} uploadedAt={whtAt}
        onUpdated={(n, a) => { setWhtName(n); setWhtAt(a) }}
      />
    </div>
  )
}
