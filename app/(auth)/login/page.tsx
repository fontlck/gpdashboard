'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const [identifier, setIdentifier] = useState('')  // email OR username
  const [password,   setPassword]   = useState('')
  const [error,      setError]      = useState<string | null>(null)
  const [loading,    setLoading]    = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const supabase = createClient()
    const raw = identifier.trim()

    // Resolve username → email if no @ in input
    let email = raw
    if (!raw.includes('@')) {
      const res  = await fetch('/api/auth/lookup-username', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ username: raw }),
      })
      if (!res.ok) {
        setError('Invalid username or password.')
        setLoading(false)
        return
      }
      const json = await res.json()
      email = json.email
    }

    // Sign in with resolved email + password
    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError || !data.user) {
      setError('Invalid username or password.')
      setLoading(false)
      return
    }

    // Fetch role to decide redirect
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .single()

    router.push(profile?.role === 'admin' ? '/admin' : '/dashboard')
    router.refresh()
  }

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
      {/* Logo / wordmark */}
      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo-fym.svg"
          alt="FlashYourMeme"
          style={{ display: 'block', margin: '0 auto 14px', height: '72px', width: 'auto', filter: 'brightness(0) invert(1)' }}
        />
        <p style={{ fontSize: '13px', color: 'rgba(241,245,249,0.35)', letterSpacing: '0.04em', margin: 0 }}>
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
        <h1 style={{ fontSize: '22px', fontWeight: '600', color: '#F0ECE4', marginBottom: '6px' }}>
          Sign in
        </h1>
        <p style={{ fontSize: '13px', color: 'rgba(240,236,228,0.4)', marginBottom: '28px' }}>
          Access your partner dashboard
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Username or Email */}
          <div>
            <label style={{
              display: 'block', fontSize: '12px', fontWeight: '500',
              color: 'rgba(240,236,228,0.55)', letterSpacing: '0.06em',
              textTransform: 'uppercase', marginBottom: '8px',
            }}>
              Username or Email
            </label>
            <input
              type="text"
              value={identifier}
              onChange={e => setIdentifier(e.target.value)}
              required
              autoComplete="username"
              placeholder="username or you@example.com"
              style={inputStyle}
              onFocus={e  => (e.target.style.borderColor = 'rgba(59,130,246,0.5)')}
              onBlur={e   => (e.target.style.borderColor = 'rgba(255,255,255,0.10)')}
            />
          </div>

          {/* Password */}
          <div>
            <label style={{
              display: 'block', fontSize: '12px', fontWeight: '500',
              color: 'rgba(240,236,228,0.55)', letterSpacing: '0.06em',
              textTransform: 'uppercase', marginBottom: '8px',
            }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="••••••••"
              style={inputStyle}
              onFocus={e  => (e.target.style.borderColor = 'rgba(59,130,246,0.5)')}
              onBlur={e   => (e.target.style.borderColor = 'rgba(255,255,255,0.10)')}
            />
          </div>

          {/* Error */}
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

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: '4px',
              padding: '12px',
              background: loading ? 'rgba(59,130,246,0.4)' : '#3B82F6',
              border: 'none', borderRadius: '10px',
              color: '#F1F5F9', fontSize: '14px', fontWeight: '700',
              cursor: loading ? 'not-allowed' : 'pointer',
              letterSpacing: '0.04em',
              transition: 'opacity 0.15s',
            }}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>

          {/* Forgot password */}
          <div style={{ textAlign: 'center', marginTop: '4px' }}>
            <a
              href="/forgot-password"
              style={{
                fontSize: '12px',
                color: 'rgba(59,130,246,0.7)',
                textDecoration: 'none',
                letterSpacing: '0.02em',
              }}
              onMouseEnter={e => (e.currentTarget.style.color = '#3B82F6')}
              onMouseLeave={e => (e.currentTarget.style.color = 'rgba(59,130,246,0.7)')}
            >
              Forgot password?
            </a>
          </div>
        </form>
      </div>
    </div>
  )
}
