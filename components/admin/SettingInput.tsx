'use client'

import { useState } from 'react'

type Props = {
  settingKey: string
  initialValue: string
  label:        string
  description?: string
  placeholder?: string
}

export function SettingInput({ settingKey, initialValue, label, description, placeholder }: Props) {
  const [value,   setValue]   = useState(initialValue)
  const [saving,  setSaving]  = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [err,     setErr]     = useState<string | null>(null)

  async function save() {
    setErr(null); setSaving(true)
    try {
      const res  = await fetch('/api/admin/settings', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ key: settingKey, value: value.trim() || null }),
      })
      const data = await res.json()
      if (!res.ok) { setErr(data.error ?? 'Save failed'); setSaving(false); return }
      setSavedAt(Date.now())
      setTimeout(() => setSavedAt(null), 2500)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Network error')
    } finally {
      setSaving(false)
    }
  }

  const dirty = value.trim() !== (initialValue ?? '').trim()

  return (
    <div style={{
      padding: '16px 0', borderBottom: '1px solid rgba(255,255,255,0.04)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: '20px', marginBottom: '10px' }}>
        <div>
          <p style={{ margin: 0, fontSize: '13px', fontWeight: '500', color: '#F0ECE4' }}>{label}</p>
          {description && (
            <p style={{ margin: '3px 0 0', fontSize: '11px', color: 'rgba(240,236,228,0.35)' }}>{description}</p>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          type="text"
          value={value}
          onChange={e => setValue(e.target.value)}
          placeholder={placeholder ?? ''}
          style={{
            flex: 1, minWidth: '280px',
            padding: '9px 12px', borderRadius: '8px',
            border: '1px solid rgba(255,255,255,0.1)',
            background: 'rgba(255,255,255,0.04)', color: '#F0ECE4',
            fontSize: '13px', outline: 'none',
          }}
        />
        <button
          onClick={save}
          disabled={saving || !dirty}
          style={{
            padding: '8px 18px', borderRadius: '8px', fontSize: '12px', fontWeight: 700,
            border: 'none', color: '#F1F5F9',
            background: dirty && !saving ? '#3B82F6' : 'rgba(59,130,246,0.3)',
            cursor: dirty && !saving ? 'pointer' : 'default',
            opacity: saving ? 0.5 : 1,
          }}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        {savedAt && (
          <span style={{ fontSize: '12px', color: '#22C55E' }}>✓ Saved</span>
        )}
        {err && (
          <span style={{ fontSize: '12px', color: '#F87171' }}>{err}</span>
        )}
      </div>
    </div>
  )
}
