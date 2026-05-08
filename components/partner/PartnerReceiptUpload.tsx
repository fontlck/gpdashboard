'use client'

import { useState, useRef, useEffect } from 'react'

function fmtDate(iso: string | null) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('th-TH', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

function isImage(name: string | null) {
  return /\.(jpe?g|png)$/i.test(name ?? '')
}

// ── Props ─────────────────────────────────────────────────────────────────────

type Props = {
  reportId:    string
  period:      string   // e.g. "April 2026" — shown in card subtitle
  initName:    string | null
  initAt:      string | null
  initSignedUrl: string | null
}

// ── Component ─────────────────────────────────────────────────────────────────

export function PartnerReceiptUpload({
  reportId, period, initName, initAt, initSignedUrl,
}: Props) {
  const inputRef                  = useRef<HTMLInputElement>(null)
  const [name,        setName]    = useState<string | null>(initName)
  const [uploadedAt,  setAt]      = useState<string | null>(initAt)
  const [signedUrl,   setSigned]  = useState<string | null>(initSignedUrl)
  const [previewUrl,  setPreview] = useState<string | null>(null)
  const [loadingPrev, setLoadPrev]= useState(false)
  const [uploading,   setUploading] = useState(false)
  const [removing,    setRemoving]  = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [error,       setError]   = useState<string | null>(null)

  const hasFile = !!name
  const img     = isImage(name)

  // Fetch signed URL when name is set (and no local preview)
  useEffect(() => {
    if (!name || previewUrl) return
    if (signedUrl) return // already have one from server
    setLoadPrev(true)
    fetch(`/api/reports/${reportId}/document-url?type=receipt`)
      .then(r => r.json())
      .then(d => setSigned(d.url ?? null))
      .catch(() => {})
      .finally(() => setLoadPrev(false))
  }, [name, reportId, signedUrl, previewUrl])

  async function handleUpload(file: File) {
    setUploading(true)
    setError(null)
    setPreview(null)

    // Local preview for images
    if (/image\//i.test(file.type)) {
      const reader = new FileReader()
      reader.onload = e => setPreview(e.target?.result as string)
      reader.readAsDataURL(file)
    }

    const fd = new FormData()
    fd.append('file', file)
    try {
      const res  = await fetch(`/api/partner/reports/${reportId}/receipt`, { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Upload failed')
      setName(json.name)
      setAt(json.uploadedAt)
      setSigned(json.signedUrl)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
      setPreview(null)
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function handleRemove() {
    if (!confirm('ลบ Receipt / Tax Invoice นี้?')) return
    setRemoving(true)
    setError(null)
    try {
      const res = await fetch(`/api/partner/reports/${reportId}/receipt`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Remove failed')
      setName(null); setAt(null); setSigned(null); setPreview(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Remove failed')
    } finally {
      setRemoving(false)
    }
  }

  async function handleDownload() {
    setDownloading(true)
    try {
      const res  = await fetch(`/api/reports/${reportId}/document-url?type=receipt`)
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

  const displayUrl = previewUrl ?? signedUrl

  // ── Status badge ──────────────────────────────────────────────────────────
  const StatusBadge = () => hasFile ? (
    <span style={{
      fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: '20px',
      background: 'rgba(34,197,94,0.1)', color: '#22C55E',
      border: '1px solid rgba(34,197,94,0.2)',
    }}>
      ✓ ได้รับแล้ว
    </span>
  ) : (
    <span style={{
      fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: '20px',
      background: 'rgba(245,158,11,0.1)', color: '#F59E0B',
      border: '1px solid rgba(245,158,11,0.2)',
    }}>
      รอเอกสาร
    </span>
  )

  return (
    <div style={{
      background: '#0D0F1A',
      border: hasFile
        ? '1px solid rgba(255,255,255,0.06)'
        : '1px solid rgba(59,130,246,0.18)',
      borderRadius: '16px', padding: '24px 28px',
    }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '18px' }}>
        <div>
          <h2 style={{
            margin: '0 0 4px', fontSize: '11px', fontWeight: 600,
            letterSpacing: '0.1em', textTransform: 'uppercase',
            color: 'rgba(240,236,228,0.3)',
          }}>
            Receipt / Tax Invoice
          </h2>
          <p style={{ margin: 0, fontSize: '12px', color: 'rgba(240,236,228,0.2)' }}>
            ส่งใบเสร็จรับเงิน / ใบกำกับภาษีสำหรับ {period} · PDF · JPEG · PNG · max 10 MB
          </p>
        </div>
        <StatusBadge />
      </div>

      {hasFile ? (
        /* ── File card (Option B style) ───────────────────────────────────── */
        <div style={{
          border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px',
          overflow: 'hidden',
        }}>
          {/* Image preview or PDF area */}
          {img ? (
            <div style={{ width: '100%', height: '160px', background: 'rgba(255,255,255,0.02)', position: 'relative' }}>
              {loadingPrev ? (
                <div style={{
                  width: '100%', height: '100%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '11px', color: 'rgba(240,236,228,0.2)',
                }}>
                  Loading…
                </div>
              ) : displayUrl ? (
                <img
                  src={displayUrl}
                  alt="receipt"
                  style={{ width: '100%', height: '160px', objectFit: 'cover', display: 'block' }}
                />
              ) : (
                <div style={{
                  width: '100%', height: '100%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '11px', color: 'rgba(240,236,228,0.2)',
                }}>
                  No preview
                </div>
              )}
            </div>
          ) : (
            /* PDF area */
            <div style={{
              height: '100px', background: 'rgba(239,68,68,0.04)',
              borderBottom: '1px solid rgba(255,255,255,0.05)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px',
            }}>
              <div style={{
                width: '40px', height: '40px', borderRadius: '8px',
                background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '11px', fontWeight: 700, color: '#F87171',
              }}>
                PDF
              </div>
              {displayUrl && (
                <a
                  href={displayUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: '12px', color: 'rgba(59,130,246,0.7)', textDecoration: 'none' }}
                >
                  Open PDF ↗
                </a>
              )}
            </div>
          )}

          {/* Footer: filename + date + actions */}
          <div style={{
            padding: '10px 14px', background: 'rgba(255,255,255,0.02)',
            display: 'flex', alignItems: 'center', gap: '10px',
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
                  อัพโหลด {fmtDate(uploadedAt)}
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
              disabled={uploading || removing}
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
              disabled={removing || uploading}
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
        /* ── Empty state: upload zone ─────────────────────────────────────── */
        <div
          onClick={() => !uploading && inputRef.current?.click()}
          style={{
            border: '1px dashed rgba(59,130,246,0.2)', borderRadius: '10px',
            minHeight: '120px',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: '6px',
            cursor: uploading ? 'default' : 'pointer',
            transition: 'border-color 0.15s',
          }}
          onMouseEnter={e => !uploading && (e.currentTarget.style.borderColor = 'rgba(59,130,246,0.45)')}
          onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(59,130,246,0.2)')}
        >
          {uploading ? (
            <span style={{ fontSize: '12px', color: 'rgba(59,130,246,0.6)' }}>กำลังอัพโหลด…</span>
          ) : (
            <>
              <div style={{ fontSize: '22px', color: 'rgba(59,130,246,0.25)' }}>↑</div>
              <div style={{ fontSize: '12px', color: 'rgba(240,236,228,0.35)', fontWeight: 500 }}>
                Upload Receipt / Tax Invoice
              </div>
              <div style={{ fontSize: '11px', color: 'rgba(240,236,228,0.18)' }}>PDF · JPEG · PNG</div>
            </>
          )}
        </div>
      )}

      {error && (
        <div style={{ fontSize: '11px', color: '#F87171', marginTop: '8px' }}>{error}</div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f) }}
      />
    </div>
  )
}
