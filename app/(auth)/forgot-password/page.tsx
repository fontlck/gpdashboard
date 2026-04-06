'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function ForgotPasswordPage() {
  const [email,     setEmail]     = useState('')
  const [loading,   setLoading]   = useState(false)
  const [sent,      setSent]      = useState(false)
  const [error,     setError]     = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const supabase = createClient()
    const { error: authError } = await supabase.auth.resetPasswordForEmail(
      email.trim(),
      { redirectTo: `${window.location.origin}/reset-password` },
    )

    setLoading(false)

    if (authError) {
      setError(authError.message ?? 'Something went wrong. Please try again.')
      return
    }

    setSent(true)
  }

  // ── Shared styles ─────────────────────────────────────────────────────────────

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '11px 14px',
    background: '#13151F',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: '10px',
    color: '#F0ECE4', fontSize: '14px',
    outline: 'none', transition: 'border-color 0.15s',
  }

  return (
    <div style={{ width: '100%', maxWidth: '400px', padding: '0 24px' }}>
      {/* Logo */}
      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <span style={{
            width: '36px', height: '36px', borderRadius: '10px',
            background: 'linear-gradient(135deg,#C4A35E 0%,#8B6A2E 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '16px', fontWeight: '700', color: '#080A10',
          }}>G</span>
          <span style={{ fontSize: '20px', fontWeight: '700', color: '#F0ECE4', letterSpacing: '-0.02em' }}>
            GP Dashboard
          </span>
        </div>
        <p style={{ fontSize: '13px', color: 'rgba(240,236,228,0.4)', letterSpacing: '0.04em' }}>
          Partner Revenue Portal
        </p>
      </div>

      {/* Card */}
      <div style={{
        background: '#0D0F1A',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: '20px',
        padding: '36px 32px',
        boxShadow: '0 8px 48px rgba(0,0,0,0.5)',
      }}>
        {sent ? (
          /* ── Success state ──────────────────────────────────────────────────── */
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: '48px', height: '48px', borderRadius: '50%',
              background: 'rgba(196,163,94,0.1)', border: '1px solid rgba(196,163,94,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 18px',
              fontSize: '22px',
            }}>
              ✦
            </div>
            <h1 style={{ fontSize: '20px', fontWeight: '600', color: '#F0ECE4', marginBottom: '10px' }}>
              Check your email
            </h1>
            <p style={{ fontSize: '13px', color: 'rgba(240,236,228,0.45)', lineHeight: 1.7, marginBottom: '24px' }}>
              If <span style={{ color: 'rgba(240,236,228,0.75)' }}>{email}</span> is registered,
              you'll receive a link to reset your password shortly.
            </p>
            <p style={{ fontSize: '12px', color: 'rgba(240,236,228,0.28)', lineHeight: 1.6 }}>
              Didn't get an email? Check your spam folder or contact your administrator.
            </p>
          </div>
        ) : (
          /* ── Form state ─────────────────────────────────────────────────────── */
          <>
            <h1 style={{ fontSize: '22px', fontWeight: '600', color: '#F0ECE4', marginBottom: '6px' }}>
              Reset password
            </h1>
            <p style={{ fontSize: '13px', color: 'rgba(240,236,228,0.4)', marginBottom: '28px' }}>
              Enter your email and we'll send you a reset link.
            </p>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{
                  display: 'block', fontSize: '12px', fontWeight: '500',
                  color: 'rgba(240,236,228,0.55)', letterSpacing: '0.06em',
                  textTransform: 'uppercase', marginBottom: '8px',
                }}>
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  placeholder="you@example.com"
                  style={inputStyle}
                  onFocus={e  => (e.target.style.borderColor = 'rgba(196,163,94,0.5)')}
                  onBlur={e   => (e.target.style.borderColor = 'rgba(255,255,255,0.10)')}
                />
              </div>

              {error && (
                <p style={{
                  fontSize: '13px', color: '#EF4444',
                  background: 'rgba(239,68,68,0.08)',
                  border: '1px solid rgba(239,68,68,0.2)',
                  borderRadius: '8px', padding: '10px 14px',
                }}>
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                style={{
                  marginTop: '4px', padding: '12px',
                  background: loading
                    ? 'rgba(196,163,94,0.4)'
                    : 'linear-gradient(135deg,#C4A35E 0%,#9A7A3A 100%)',
                  border: 'none', borderRadius: '10px',
                  color: '#080A10', fontSize: '14px', fontWeight: '700',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  letterSpacing: '0.04em',
                }}
              >
                {loading ? 'Sending…' : 'Send reset link'}
              </button>
            </form>
          </>
        )}
      </div>

      {/* Back to login */}
      <p style={{ textAlign: 'center', marginTop: '24px', fontSize: '12px' }}>
        <a
          href="/login"
          style={{ color: 'rgba(240,236,228,0.35)', textDecoration: 'none' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'rgba(240,236,228,0.65)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'rgba(240,236,228,0.35)')}
        >
          ← Back to sign in
        </a>
      </p>
    </div>
  )
}
