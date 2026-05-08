'use client'

import React, { useState, useRef } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

export type AccountInitialData = {
  contact_email:       string | null
  contact_phone:       string | null
  bank_name:           string | null
  bank_account_name:   string | null
  bank_account_number: string | null
  docs: {
    pp20:     { name: string | null; signedUrl: string | null }
    id_card:  { name: string | null; signedUrl: string | null }
    bookbank: { name: string | null; signedUrl: string | null }
  }
}

type DocType = 'pp20' | 'id_card' | 'bookbank'

// ── Design tokens ─────────────────────────────────────────────────────────────

const CARD: React.CSSProperties = {
  background: '#0D0F1A', border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: '16px', padding: '24px',
}
const SECTION_TITLE: React.CSSProperties = {
  fontSize: '11px', fontWeight: 600, color: 'rgba(240,236,228,0.4)',
  letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '16px',
}
const INPUT_STYLE: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: '8px',
  border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)',
  color: '#F0ECE4', fontSize: '13px', outline: 'none',
  transition: 'border-color 0.15s',
}
const LABEL_STYLE: React.CSSProperties = {
  display: 'block', fontSize: '11px', color: 'rgba(240,236,228,0.45)',
  marginBottom: '5px',
}

// ── Field group ───────────────────────────────────────────────────────────────

function Field({ label, value, onChange, placeholder, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void
  placeholder?: string; type?: string
}) {
  const [focused, setFocused] = useState(false)
  return (
    <div>
      <label style={LABEL_STYLE}>{label}</label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          ...INPUT_STYLE,
          borderColor: focused ? 'rgba(59,130,246,0.5)' : 'rgba(255,255,255,0.1)',
        }}
      />
    </div>
  )
}

// ── Document upload zone ──────────────────────────────────────────────────────

function DocUpload({
  label, docType, initial, onUploaded, onDeleted,
}: {
  label: string
  docType: DocType
  initial: { name: string | null; signedUrl: string | null }
  onUploaded: (name: string, signedUrl: string | null) => void
  onDeleted: () => void
}) {
  const [name,       setName]       = useState<string | null>(initial.name)
  const [signedUrl,  setSignedUrl]  = useState<string | null>(initial.signedUrl)
  const [uploading,  setUploading]  = useState(false)
  const [deleting,   setDeleting]   = useState(false)
  const [error,      setError]      = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const isImage = name ? /\.(jpe?g|png)$/i.test(name) : false

  async function handleFile(file: File) {
    setUploading(true)
    setError(null)
    setPreviewUrl(null)

    // Show local preview for images immediately
    if (/image\//i.test(file.type)) {
      const reader = new FileReader()
      reader.onload = e => setPreviewUrl(e.target?.result as string)
      reader.readAsDataURL(file)
    }

    try {
      const fd = new FormData()
      fd.append('type', docType)
      fd.append('file', file)
      const res = await fetch('/api/partner/documents', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Upload failed')
        setPreviewUrl(null)
      } else {
        setName(data.name)
        setSignedUrl(data.signedUrl)
        onUploaded(data.name, data.signedUrl)
      }
    } catch {
      setError('Network error')
      setPreviewUrl(null)
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    setError(null)
    try {
      const res = await fetch(`/api/partner/documents?type=${docType}`, { method: 'DELETE' })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError(d.error ?? 'Delete failed')
      } else {
        setName(null)
        setSignedUrl(null)
        setPreviewUrl(null)
        onDeleted()
      }
    } catch {
      setError('Network error')
    } finally {
      setDeleting(false)
    }
  }

  const displayUrl = previewUrl ?? signedUrl

  return (
    <div>
      <div style={{ fontSize: '11px', color: 'rgba(240,236,228,0.45)', marginBottom: '6px' }}>
        {label}
      </div>

      {name ? (
        <div style={{
          border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px',
          overflow: 'hidden', background: 'rgba(255,255,255,0.02)',
        }}>
          {/* Image preview */}
          {isImage && displayUrl && (
            <div style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <img
                src={displayUrl}
                alt={label}
                style={{ width: '100%', maxHeight: '140px', objectFit: 'cover', display: 'block' }}
              />
            </div>
          )}

          {/* File row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px' }}>
            <div style={{
              width: '32px', height: '32px', borderRadius: '7px', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '10px', fontWeight: 700,
              background: isImage ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
              color: isImage ? '#34D399' : '#F87171',
            }}>
              {isImage ? 'IMG' : 'PDF'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#F0ECE4', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {name}
              </div>
              {signedUrl && !isImage && (
                <a
                  href={signedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: '11px', color: 'rgba(59,130,246,0.7)', textDecoration: 'none' }}
                >
                  Open PDF ↗
                </a>
              )}
            </div>
            <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
              <button
                onClick={() => inputRef.current?.click()}
                disabled={uploading || deleting}
                title="Replace file"
                style={{
                  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '6px', padding: '4px 10px', fontSize: '11px',
                  color: 'rgba(240,236,228,0.5)', cursor: 'pointer',
                }}
              >
                แทนที่
              </button>
              <button
                onClick={handleDelete}
                disabled={uploading || deleting}
                title="Delete"
                style={{
                  background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.15)',
                  borderRadius: '6px', padding: '4px 8px', fontSize: '11px',
                  color: '#F87171', cursor: 'pointer',
                }}
              >
                {deleting ? '…' : '✕'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div
          onClick={() => !uploading && inputRef.current?.click()}
          style={{
            border: '1px dashed rgba(255,255,255,0.12)', borderRadius: '10px',
            padding: '20px', textAlign: 'center', cursor: uploading ? 'default' : 'pointer',
            background: 'rgba(255,255,255,0.01)', transition: 'border-color 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(59,130,246,0.35)')}
          onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)')}
        >
          {uploading ? (
            <div style={{ fontSize: '12px', color: 'rgba(59,130,246,0.7)' }}>กำลังอัพโหลด…</div>
          ) : (
            <>
              <div style={{ fontSize: '18px', color: 'rgba(240,236,228,0.2)', marginBottom: '6px' }}>↑</div>
              <div style={{ fontSize: '12px', color: 'rgba(240,236,228,0.4)', fontWeight: 500 }}>อัพโหลดไฟล์</div>
              <div style={{ fontSize: '11px', color: 'rgba(240,236,228,0.2)', marginTop: '3px' }}>PDF · JPEG · PNG · สูงสุด 10 MB</div>
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
        accept=".pdf,.jpg,.jpeg,.png"
        style={{ display: 'none' }}
        onChange={e => {
          const f = e.target.files?.[0]
          if (f) handleFile(f)
          e.target.value = ''
        }}
      />
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export function AccountClient({ initial }: { initial: AccountInitialData }) {
  const [contactEmail, setContactEmail] = useState(initial.contact_email ?? '')
  const [contactPhone, setContactPhone] = useState(initial.contact_phone ?? '')
  const [bankName,     setBankName]     = useState(initial.bank_name ?? '')
  const [bankAccName,  setBankAccName]  = useState(initial.bank_account_name ?? '')
  const [bankAccNum,   setBankAccNum]   = useState(initial.bank_account_number ?? '')

  const [saving,   setSaving]   = useState(false)
  const [saveMsg,  setSaveMsg]  = useState<{ text: string; ok: boolean } | null>(null)

  async function save() {
    setSaving(true)
    setSaveMsg(null)
    try {
      const res = await fetch('/api/partner/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contact_email:       contactEmail || null,
          contact_phone:       contactPhone || null,
          bank_name:           bankName     || null,
          bank_account_name:   bankAccName  || null,
          bank_account_number: bankAccNum   || null,
        }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setSaveMsg({ text: d.error ?? 'บันทึกไม่สำเร็จ', ok: false })
      } else {
        setSaveMsg({ text: '✓ บันทึกสำเร็จ', ok: true })
      }
    } catch {
      setSaveMsg({ text: 'Network error', ok: false })
    } finally {
      setSaving(false)
      setTimeout(() => setSaveMsg(null), 4000)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* ── Contact information ────────────────────────────────────────────── */}
      <div style={CARD}>
        <div style={SECTION_TITLE}>Contact information</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
          <Field
            label="Contact email"
            value={contactEmail}
            onChange={setContactEmail}
            placeholder="email@example.com"
            type="email"
          />
          <Field
            label="Contact phone"
            value={contactPhone}
            onChange={setContactPhone}
            placeholder="+66 8x xxx xxxx"
          />
        </div>

        {/* Bank account */}
        <div style={{
          borderTop: '1px solid rgba(255,255,255,0.05)',
          paddingTop: '20px',
        }}>
          <div style={SECTION_TITLE}>Bank account</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
            <Field
              label="Bank"
              value={bankName}
              onChange={setBankName}
              placeholder="Kasikorn / SCB / BBL…"
            />
            <Field
              label="Account name"
              value={bankAccName}
              onChange={setBankAccName}
              placeholder="ชื่อบัญชี"
            />
            <Field
              label="Account number"
              value={bankAccNum}
              onChange={setBankAccNum}
              placeholder="xxx-x-xxxxx-x"
            />
          </div>
        </div>

        {/* Save button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '12px', marginTop: '20px' }}>
          {saveMsg && (
            <span style={{ fontSize: '12px', color: saveMsg.ok ? '#4ADE80' : '#F87171' }}>
              {saveMsg.text}
            </span>
          )}
          <button
            onClick={save}
            disabled={saving}
            style={{
              padding: '8px 22px', borderRadius: '8px', fontSize: '13px', fontWeight: 600,
              border: 'none', cursor: saving ? 'default' : 'pointer',
              background: saving ? 'rgba(59,130,246,0.3)' : 'rgba(59,130,246,0.85)',
              color: '#fff', opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? 'กำลังบันทึก…' : 'Save'}
          </button>
        </div>
      </div>

      {/* ── Documents ─────────────────────────────────────────────────────── */}
      <div style={CARD}>
        <div style={SECTION_TITLE}>Documents</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
          <DocUpload
            label="ภ.พ.20"
            docType="pp20"
            initial={initial.docs.pp20}
            onUploaded={() => {}}
            onDeleted={() => {}}
          />
          <DocUpload
            label="บัตรประชาชน / หนังสือรับรองบริษัท"
            docType="id_card"
            initial={initial.docs.id_card}
            onUploaded={() => {}}
            onDeleted={() => {}}
          />
          <DocUpload
            label="Bookbank"
            docType="bookbank"
            initial={initial.docs.bookbank}
            onUploaded={() => {}}
            onDeleted={() => {}}
          />
        </div>
      </div>

    </div>
  )
}
