'use client'

import { useState, useRef, useEffect } from 'react'

type DocType = 'slip' | 'wht'

type Props = {
  reportId:       string
  slipName:       string | null
  slipUploadedAt: string | null
  whtName:        string | null
  whtUploadedAt:  string | null
}

function fmtDate(iso: string | null) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function isImage(name: string | null) {
  return /\.(jpe?g|png)$/i.test(name ?? '')
}

// ── Single document card (Option C style) ─────────────────────────────────────

function DocCard({
  reportId, docType, label, name, uploadedAt, onUpdated,
}: {
  reportId: string; docType: DocType; label: string
  name: string | null; uploadedAt: string | null
  onUpdated: (name: string | null, uploadedAt: string | null) => void
}) {
  const inputRef             = useRef<HTMLInputElement>(null)
  const [uploading,  setUploading]  = useState(false)
  const [removing,   setRemoving]   = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [error,      setError]      = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)

  // Fetch signed URL for preview/download when name is set
  useEffect(() => {
    if (!name) { setPreviewUrl(null); return }
    setLoadingPreview(true)
    fetch(`/api/reports/${reportId}/document-url?type=${docType}`)
      .then(r => r.json())
      .then(d => setPreviewUrl(d.url ?? null))
      .catch(() => setPreviewUrl(null))
      .finally(() => setLoadingPreview(false))
  }, [name, reportId, docType])

  async function handleUpload(file: File) {
    setUploading(true); setError(null)
    // Local preview for images
    if (/image\//i.test(file.type)) {
      const reader = new FileReader()
      reader.onload = e => setPreviewUrl(e.target?.result as string)
      reader.readAsDataURL(file)
    }
    const fd = new FormData()
    fd.append('file', file)
    fd.append('type', docType)
    try {
      const res  = await fetch(`/api/admin/reports/${reportId}/documents`, { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Upload failed')
      onUpdated(json.name, new Date().toISOString())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
      setPreviewUrl(null)
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function handleRemove() {
    if (!confirm(`Remove ${label}?`)) return
    setRemoving(true); setError(null)
    try {
      const res = await fetch(`/api/admin/reports/${reportId}/documents?type=${docType}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Remove failed')
      onUpdated(null, null)
      setPreviewUrl(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Remove failed')
    } finally {
      setRemoving(false)
    }
  }

  async function handleDownload() {
    setDownloading(true)
    try {
      const res  = await fetch(`/api/reports/${reportId}/document-url?type=${docType}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      const a = document.createElement('a')
      a.href = json.url; a.download = json.name; a.click()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Download failed')
    } finally {
      setDownloading(false)
    }
  }

  const hasFile = !!name
  const img     = isImage(name)

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Label */}
      <div style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(240,236,228,0.55)', marginBottom: '8px' }}>
        {label}
      </div>

      {hasFile ? (
        <div style={{
          border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px',
          overflow: 'hidden', flex: 1,
        }}>
          {/* Image preview */}
          {img && (
            <div style={{
              width: '100%', height: '130px', background: 'rgba(255,255,255,0.03)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderBottom: '1px solid rgba(255,255,255,0.05)',
            }}>
              {loadingPreview ? (
                <span style={{ fontSize: '11px', color: 'rgba(240,236,228,0.2)' }}>Loading…</span>
              ) : previewUrl ? (
                <img
                  src={previewUrl}
                  alt="slip"
                  style={{ width: '100%', height: '130px', objectFit: 'cover', display: 'block' }}
                />
              ) : (
                <span style={{ fontSize: '11px', color: 'rgba(240,236,228,0.2)' }}>No preview</span>
              )}
            </div>
          )}

          {/* PDF icon row */}
          {!img && (
            <div style={{
              height: '80px', background: 'rgba(239,68,68,0.05)',
              borderBottom: '1px solid rgba(255,255,255,0.05)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            }}>
              <div style={{
                width: '36px', height: '36px', borderRadius: '8px',
                background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '11px', fontWeight: 700, color: '#F87171',
              }}>PDF</div>
              {previewUrl && (
                <a
                  href={previewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: '12px', color: 'rgba(59,130,246,0.7)', textDecoration: 'none' }}
                >
                  Open PDF ↗
                </a>
              )}
            </div>
          )}

          {/* Footer: filename + actions */}
          <div style={{
            padding: '9px 12px', background: 'rgba(255,255,255,0.02)',
            display: 'flex', alignItems: 'center', gap: '8px',
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: '12px', fontWeight: 600, color: '#F0ECE4',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {name}
              </div>
              {uploadedAt && (
                <div style={{ fontSize: '10px', color: 'rgba(240,236,228,0.3)', marginTop: '1px' }}>
                  {fmtDate(uploadedAt)}
                </div>
              )}
            </div>
            <button
              onClick={handleDownload}
              disabled={downloading}
              title="Download"
              style={{
                padding: '5px 10px', borderRadius: '7px', fontSize: '11px',
                border: '1px solid rgba(20,184,166,0.3)', background: 'rgba(20,184,166,0.07)',
                color: '#2DD4BF', cursor: 'pointer', flexShrink: 0,
              }}
            >
              {downloading ? '…' : '↓'}
            </button>
            <button
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              title="Replace"
              style={{
                padding: '5px 10px', borderRadius: '7px', fontSize: '11px',
                border: '1px solid rgba(255,255,255,0.09)', background: 'rgba(255,255,255,0.04)',
                color: 'rgba(240,236,228,0.5)', cursor: 'pointer', flexShrink: 0,
              }}
            >
              {uploading ? '…' : '↺'}
            </button>
            <button
              onClick={handleRemove}
              disabled={removing}
              title="Remove"
              style={{
                padding: '5px 8px', borderRadius: '7px', fontSize: '11px',
                border: '1px solid rgba(239,68,68,0.18)', background: 'rgba(239,68,68,0.06)',
                color: '#F87171', cursor: 'pointer', flexShrink: 0,
              }}
            >
              {removing ? '…' : '✕'}
            </button>
          </div>
        </div>
      ) : (
        /* Empty state — upload zone */
        <div
          onClick={() => !uploading && inputRef.current?.click()}
          style={{
            border: '1px dashed rgba(255,255,255,0.09)', borderRadius: '10px',
            flex: 1, minHeight: '160px',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: '6px',
            cursor: uploading ? 'default' : 'pointer',
            transition: 'border-color 0.15s',
          }}
          onMouseEnter={e => !uploading && (e.currentTarget.style.borderColor = 'rgba(0,212,255,0.3)')}
          onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)')}
        >
          {uploading ? (
            <span style={{ fontSize: '12px', color: 'rgba(0,212,255,0.6)' }}>Uploading…</span>
          ) : (
            <>
              <div style={{ fontSize: '20px', color: 'rgba(240,236,228,0.12)' }}>↑</div>
              <div style={{ fontSize: '12px', color: 'rgba(240,236,228,0.3)', fontWeight: 500 }}>Upload file</div>
              <div style={{ fontSize: '11px', color: 'rgba(240,236,228,0.18)' }}>PNG · JPG · PDF</div>
            </>
          )}
        </div>
      )}

      {error && (
        <div style={{ fontSize: '11px', color: '#F87171', marginTop: '5px' }}>{error}</div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept=".png,.jpg,.jpeg,.pdf"
        style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f) }}
      />
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export function ReportDocumentUpload({
  reportId, slipName: initSlipName, slipUploadedAt: initSlipAt,
  whtName: initWhtName, whtUploadedAt: initWhtAt,
}: Props) {
  const [slipName, setSlipName] = useState(initSlipName)
  const [slipAt,   setSlipAt]   = useState(initSlipAt)
  const [whtName,  setWhtName]  = useState(initWhtName)
  const [whtAt,    setWhtAt]    = useState(initWhtAt)

  return (
    <div style={{
      background: '#0D0F1A', border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: '16px', padding: '24px 28px',
    }}>
      <h2 style={{
        margin: '0 0 4px', fontSize: '11px', fontWeight: 600,
        letterSpacing: '0.1em', textTransform: 'uppercase',
        color: 'rgba(240,236,228,0.3)',
      }}>
        Documents
      </h2>
      <p style={{ margin: '0 0 18px', fontSize: '12px', color: 'rgba(240,236,228,0.2)' }}>
        PNG, JPG or PDF · max 10 MB
      </p>

      {/* Side-by-side grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <DocCard
          reportId={reportId} docType="slip" label="Payment Slip"
          name={slipName} uploadedAt={slipAt}
          onUpdated={(n, a) => { setSlipName(n); setSlipAt(a) }}
        />
        <DocCard
          reportId={reportId} docType="wht" label="Withholding Tax Certificate (ใบหัก ณ ที่จ่าย)"
          name={whtName} uploadedAt={whtAt}
          onUpdated={(n, a) => { setWhtName(n); setWhtAt(a) }}
        />
      </div>
    </div>
  )
}
