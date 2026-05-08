'use client'

import { useState, useEffect } from 'react'

function fmtDate(iso: string | null) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function isImage(name: string | null) {
  return /\.(jpe?g|png)$/i.test(name ?? '')
}

// ── Single read-only document card ────────────────────────────────────────────

function DocCard({
  reportId, docType, label, name, uploadedAt,
}: {
  reportId:   string
  docType:    'slip' | 'wht'
  label:      string
  name:       string | null
  uploadedAt: string | null
}) {
  const [signedUrl,    setSignedUrl]    = useState<string | null>(null)
  const [loadingPrev,  setLoadingPrev]  = useState(false)
  const [downloading,  setDownloading]  = useState(false)
  const [error,        setError]        = useState<string | null>(null)

  const hasFile = !!name
  const img     = isImage(name)

  // Fetch signed URL when file exists
  useEffect(() => {
    if (!name) { setSignedUrl(null); return }
    setLoadingPrev(true)
    fetch(`/api/reports/${reportId}/document-url?type=${docType}`)
      .then(r => r.json())
      .then(d => setSignedUrl(d.url ?? null))
      .catch(() => setSignedUrl(null))
      .finally(() => setLoadingPrev(false))
  }, [name, reportId, docType])

  async function handleDownload() {
    setDownloading(true); setError(null)
    try {
      const res  = await fetch(`/api/reports/${reportId}/document-url?type=${docType}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed')
      const a = document.createElement('a')
      a.href = json.url; a.download = json.name; a.click()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Download failed')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Label */}
      <div style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(240,236,228,0.4)', marginBottom: '8px' }}>
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
              width: '100%', height: '130px',
              background: 'rgba(255,255,255,0.03)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderBottom: '1px solid rgba(255,255,255,0.05)',
            }}>
              {loadingPrev ? (
                <span style={{ fontSize: '11px', color: 'rgba(240,236,228,0.2)' }}>Loading…</span>
              ) : signedUrl ? (
                <img
                  src={signedUrl}
                  alt={label}
                  style={{ width: '100%', height: '130px', objectFit: 'cover', display: 'block' }}
                />
              ) : (
                <span style={{ fontSize: '11px', color: 'rgba(240,236,228,0.2)' }}>No preview</span>
              )}
            </div>
          )}

          {/* PDF area */}
          {!img && (
            <div style={{
              height: '80px', background: 'rgba(239,68,68,0.05)',
              borderBottom: '1px solid rgba(255,255,255,0.05)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
            }}>
              <div style={{
                width: '36px', height: '36px', borderRadius: '8px',
                background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '11px', fontWeight: 700, color: '#F87171',
              }}>
                PDF
              </div>
              {signedUrl && (
                <a
                  href={signedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: '12px', color: 'rgba(59,130,246,0.7)', textDecoration: 'none' }}
                >
                  Open PDF ↗
                </a>
              )}
            </div>
          )}

          {/* Footer: filename + date + download */}
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
                padding: '5px 14px', borderRadius: '7px', fontSize: '11px', fontWeight: 500,
                border: '1px solid rgba(0,212,255,0.2)', background: 'rgba(0,212,255,0.07)',
                color: '#00D4FF', cursor: 'pointer', flexShrink: 0,
              }}
            >
              {downloading ? '…' : '↓ Download'}
            </button>
          </div>

          {error && (
            <div style={{ fontSize: '11px', color: '#F87171', padding: '0 12px 8px' }}>{error}</div>
          )}
        </div>
      ) : (
        /* Empty state — read-only, no upload */
        <div style={{
          border: '1px solid rgba(255,255,255,0.05)', borderRadius: '10px',
          flex: 1, minHeight: '130px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(255,255,255,0.01)',
        }}>
          <span style={{ fontSize: '12px', color: 'rgba(240,236,228,0.18)', fontStyle: 'italic' }}>
            Not yet uploaded
          </span>
        </div>
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
  reportId:       string
  slipName:       string | null
  slipUploadedAt: string | null
  whtName:        string | null
  whtUploadedAt:  string | null
}) {
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
        Payment Slip and Withholding Tax Certificate from GP Dashboard
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <DocCard
          reportId={reportId} docType="slip" label="Payment Slip"
          name={slipName} uploadedAt={slipUploadedAt}
        />
        <DocCard
          reportId={reportId} docType="wht" label="Withholding Tax Certificate (ใบหัก ณ ที่จ่าย)"
          name={whtName} uploadedAt={whtUploadedAt}
        />
      </div>
    </div>
  )
}
