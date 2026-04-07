'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Partner = { id: string; name: string }

type Props = { partners: Partner[] }

export function CreatePartnerForm({ partners }: Props) {
  const router = useRouter()
  const [open,      setOpen]      = useState(false)
  const [loading,   setLoading]   = useState(false)
  const [success,   setSuccess]   = useState<string | null>(null)
  const [error,     setError]     = useState<string | null>(null)

  const [username,   setUsername]   = useState('')
  const [fullName,   setFullName]   = useState('')
  const [partnerId,  setPartnerId]  = useState('')
  const [password,   setPassword]   = useState('')
  const [confirm,    setConfirm]    = useState('')

  function reset() {
    setUsername(''); setFullName(''); setPartnerId('');
    setPassword(''); setConfirm('');
    setError(null); setSuccess(null);
  }

  function handleClose() {
    setOpen(false)
    reset()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (!partnerId) {
      setError('Please select a partner.')
      return
    }

    setLoading(true)
    const res  = await fetch('/api/admin/users', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ username, full_name: fullName, partner_id: partnerId, password }),
    })
    const json = await res.json()
    setLoading(false)

    if (!res.ok) {
      setError(json.error ?? 'Failed to create user.')
      return
    }

    setSuccess(`Partner created! Username: ${json.username}`)
    reset()
    router.refresh()
  }

  // ── Shared input style ────────────────────────────────────────────────────────
  const input: React.CSSProperties = {
    width: '100%', padding: '10px 12px',
    background: '#13151F', border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: '8px', color: '#F0ECE4', fontSize: '13px', outline: 'none',
  }
  const label: React.CSSProperties = {
    display: 'block', fontSize: '11px', fontWeight: '600',
    color: 'rgba(240,236,228,0.45)', letterSpacing: '0.07em',
    textTransform: 'uppercase', marginBottom: '6px',
  }

  return (
    <div style={{
      background: '#0D0F1A', border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: '16px', overflow: 'hidden',
    }}>
      {/* Header row — always visible */}
      <div style={{
        padding: '16px 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: open ? '1px solid rgba(255,255,255,0.06)' : 'none',
      }}>
        <div>
          <span style={{ fontSize: '13px', fontWeight: '600', color: 'rgba(240,236,228,0.6)',
            letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Create Partner Account
          </span>
          <p style={{ fontSize: '12px', color: 'rgba(240,236,228,0.3)', marginTop: '2px' }}>
            Set a username &amp; password to hand off to the partner directly
          </p>
        </div>
        <button
          onClick={() => { setOpen(o => !o); setError(null); setSuccess(null) }}
          style={{
            padding: '8px 16px', borderRadius: '8px',
            border: '1px solid rgba(59,130,246,0.35)',
            background: open ? 'rgba(255,255,255,0.04)' : 'rgba(59,130,246,0.1)',
            color: open ? 'rgba(241,245,249,0.5)' : '#60A5FA',
            fontSize: '12px', fontWeight: '700', cursor: 'pointer',
            letterSpacing: '0.04em',
          }}
        >
          {open ? '✕ Cancel' : '+ New Partner'}
        </button>
      </div>

      {/* Success banner (shown even when form is closed) */}
      {success && !open && (
        <div style={{
          padding: '12px 20px',
          background: 'rgba(34,197,94,0.07)', borderTop: '1px solid rgba(34,197,94,0.15)',
          fontSize: '13px', color: '#4ADE80',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span>✓ {success}</span>
          <button
            onClick={() => setSuccess(null)}
            style={{ background: 'none', border: 'none', color: 'rgba(74,222,128,0.5)', cursor: 'pointer', fontSize: '16px' }}
          >×</button>
        </div>
      )}

      {/* Form — only when open */}
      {open && (
        <form onSubmit={handleSubmit} style={{ padding: '24px 20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            {/* Username */}
            <div>
              <label style={label}>Username</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
                placeholder="e.g. bkk_riverside"
                style={input}
                onFocus={e  => (e.target.style.borderColor = 'rgba(59,130,246,0.5)')}
                onBlur={e   => (e.target.style.borderColor = 'rgba(255,255,255,0.10)')}
              />
              <p style={{ fontSize: '11px', color: 'rgba(240,236,228,0.25)', marginTop: '4px' }}>
                Lowercase, no spaces (underscores ok)
              </p>
            </div>

            {/* Full name */}
            <div>
              <label style={label}>Full Name</label>
              <input
                type="text"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                required
                placeholder="e.g. Riverside Branch"
                style={input}
                onFocus={e  => (e.target.style.borderColor = 'rgba(59,130,246,0.5)')}
                onBlur={e   => (e.target.style.borderColor = 'rgba(255,255,255,0.10)')}
              />
            </div>

            {/* Partner */}
            <div>
              <label style={label}>Partner</label>
              <select
                value={partnerId}
                onChange={e => setPartnerId(e.target.value)}
                required
                style={{ ...input, appearance: 'none' }}
                onFocus={e  => (e.target.style.borderColor = 'rgba(59,130,246,0.5)')}
                onBlur={e   => (e.target.style.borderColor = 'rgba(255,255,255,0.10)')}
              >
                <option value="">Select partner…</option>
                {partners.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            {/* Spacer */}
            <div />

            {/* Password */}
            <div>
              <label style={label}>Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={8}
                placeholder="Min. 8 characters"
                style={input}
                onFocus={e  => (e.target.style.borderColor = 'rgba(59,130,246,0.5)')}
                onBlur={e   => (e.target.style.borderColor = 'rgba(255,255,255,0.10)')}
              />
            </div>

            {/* Confirm password */}
            <div>
              <label style={label}>Confirm Password</label>
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                required
                placeholder="••••••••"
                style={input}
                onFocus={e  => (e.target.style.borderColor = 'rgba(59,130,246,0.5)')}
                onBlur={e   => (e.target.style.borderColor = 'rgba(255,255,255,0.10)')}
              />
            </div>
          </div>

          {/* Error / success */}
          {error && (
            <div style={{
              marginTop: '16px', padding: '10px 14px', borderRadius: '8px',
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
              fontSize: '12px', color: '#F87171',
            }}>{error}</div>
          )}

          {success && (
            <div style={{
              marginTop: '16px', padding: '10px 14px', borderRadius: '8px',
              background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)',
              fontSize: '12px', color: '#4ADE80',
            }}>{success}</div>
          )}

          {/* Actions */}
          <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '10px 24px', borderRadius: '8px',
                background: loading ? 'rgba(59,130,246,0.4)' : '#3B82F6',
                border: 'none', color: '#F1F5F9', fontSize: '13px', fontWeight: '700',
                cursor: loading ? 'not-allowed' : 'pointer', letterSpacing: '0.04em',
              }}
            >
              {loading ? 'Creating…' : 'Create Partner'}
            </button>
            <button
              type="button"
              onClick={handleClose}
              style={{
                padding: '10px 20px', borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.08)',
                background: 'transparent', color: 'rgba(240,236,228,0.45)',
                fontSize: '13px', cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
