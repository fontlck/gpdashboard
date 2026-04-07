'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password,  setPassword]  = useState('')
  const [confirm,   setConfirm]   = useState('')
  const [loading,   setLoading]   = useState(false)
  const [done,      setDone]       = useState(false)
  const [error,     setError]     = useState<string | null>(null)
  const [ready,     setReady]     = useState(false)

  // Supabase handles the token exchange via PKCE automatically on mount.
  // We just need to wait for the session to be established.
  useEffect(() => {
    const supabase = createClient()

    // Listen for PASSWORD_RECOVERY event which fires after Supabase
    // exchanges the token from the URL hash/query params.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setReady(true)
      }
    })

    // Also check if we already have an active session (page reload case)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    const supabase = createClient()
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (updateError) {
      setError(updateError.message ?? 'Failed to update password. Please try again.')
      return
    }

    setDone(true)
    // Redirect to login after a short delay
    setTimeout(() => router.push('/login'), 2500)
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
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo-fym.svg"
          alt="FlashYourMeme"
          style={{ height: '36px', width: 'auto', filter: 'brightness(0) invert(1)', marginBottom: '10px' }}
        />
        <div style={{ fontSize: '15px', fontWeight: '700', color: '#F1F5F9', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '4px' }}>
          FLASHYOURMEME
        </div>
        <p style={{ fontSize: '13px', color: 'rgba(241,245,249,0.4)', letterSpacing: '0.04em' }}>
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
        {done ? (
          /* ── Success ────────────────────────────────────────────────────────── */
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: '48px', height: '48px', borderRadius: '50%',
              background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 18px', fontSize: '22px', color: '#4ADE80',
            }}>
              ✓
            </div>
            <h1 style={{ fontSize: '20px', fontWeight: '600', color: '#F0ECE4', marginBottom: '10px' }}>
              Password updated
            </h1>
            <p style={{ fontSize: '13px', color: 'rgba(240,236,228,0.45)', lineHeight: 1.7 }}>
              Your password has been changed. Redirecting to sign in…
            </p>
          </div>
        ) : !ready ? (
          /* ── Waiting for token exchange ─────────────────────────────────────── */
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            <p style={{ fontSize: '13px', color: 'rgba(240,236,228,0.4)' }}>
              Verifying reset link…
            </p>
          </div>
        ) : (
          /* ── Form ────────────────────────────────────────────────────────────── */
          <>
            <h1 style={{ fontSize: '22px', fontWeight: '600', color: '#F0ECE4', marginBottom: '6px' }}>
              New password
            </h1>
            <p style={{ fontSize: '13px', color: 'rgba(240,236,228,0.4)', marginBottom: '28px' }}>
              Choose a strong password for your account.
            </p>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* New password */}
              <div>
                <label style={{
                  display: 'block', fontSize: '12px', fontWeight: '500',
                  color: 'rgba(240,236,228,0.55)', letterSpacing: '0.06em',
                  textTransform: 'uppercase', marginBottom: '8px',
                }}>
                  New password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={8}
                  placeholder="Min. 8 characters"
                  style={inputStyle}
                  onFocus={e  => (e.target.style.borderColor = 'rgba(59,130,246,0.5)')}
                  onBlur={e   => (e.target.style.borderColor = 'rgba(255,255,255,0.10)')}
                />
              </div>

              {/* Confirm */}
              <div>
                <label style={{
                  display: 'block', fontSize: '12px', fontWeight: '500',
                  color: 'rgba(240,236,228,0.55)', letterSpacing: '0.06em',
                  textTransform: 'uppercase', marginBottom: '8px',
                }}>
                  Confirm password
                </label>
                <input
                  type="password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  required
                  placeholder="••••••••"
                  style={inputStyle}
                  onFocus={e  => (e.target.style.borderColor = 'rgba(59,130,246,0.5)')}
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
                  background: loading ? 'rgba(59,130,246,0.4)' : '#3B82F6',
                  border: 'none', borderRadius: '10px',
                  color: '#F1F5F9', fontSize: '14px', fontWeight: '700',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  letterSpacing: '0.04em',
                }}
              >
                {loading ? 'Updating…' : 'Update password'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
