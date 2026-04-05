'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState<string | null>(null)
  const [loading,  setLoading]  = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const supabase = createClient()
    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (authError || !data.user) {
      setError(authError?.message ?? 'Invalid email or password.')
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

  return (
    <div style={{ width: '100%', maxWidth: '400px', padding: '0 24px' }}>
      {/* Logo / wordmark */}
      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '10px',
          marginBottom: '8px',
        }}>
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
        <h1 style={{ fontSize: '22px', fontWeight: '600', color: '#F0ECE4', marginBottom: '6px' }}>
          Sign in
        </h1>
        <p style={{ fontSize: '13px', color: 'rgba(240,236,228,0.4)', marginBottom: '28px' }}>
          Access your partner dashboard
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Email */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '500',
              color: 'rgba(240,236,228,0.55)', letterSpacing: '0.06em',
              textTransform: 'uppercase', marginBottom: '8px' }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
              style={{
                width: '100%', padding: '11px 14px',
                background: '#13151F',
                border: '1px solid rgba(255,255,255,0.10)',
                borderRadius: '10px',
                color: '#F0ECE4', fontSize: '14px',
                outline: 'none', transition: 'border-color 0.15s',
              }}
              onFocus={e  => (e.target.style.borderColor = 'rgba(196,163,94,0.5)')}
              onBlur={e   => (e.target.style.borderColor = 'rgba(255,255,255,0.10)')}
            />
          </div>

          {/* Password */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '500',
              color: 'rgba(240,236,228,0.55)', letterSpacing: '0.06em',
              textTransform: 'uppercase', marginBottom: '8px' }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              style={{
                width: '100%', padding: '11px 14px',
                background: '#13151F',
                border: '1px solid rgba(255,255,255,0.10)',
                borderRadius: '10px',
                color: '#F0ECE4', fontSize: '14px',
                outline: 'none', transition: 'border-color 0.15s',
              }}
              onFocus={e  => (e.target.style.borderColor = 'rgba(196,163,94,0.5)')}
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
              background: loading
                ? 'rgba(196,163,94,0.4)'
                : 'linear-gradient(135deg,#C4A35E 0%,#9A7A3A 100%)',
              border: 'none', borderRadius: '10px',
              color: '#080A10', fontSize: '14px', fontWeight: '700',
              cursor: loading ? 'not-allowed' : 'pointer',
              letterSpacing: '0.04em',
              transition: 'opacity 0.15s',
            }}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>

      <p style={{ textAlign: 'center', marginTop: '24px', fontSize: '12px',
        color: 'rgba(240,236,228,0.2)' }}>
        Contact your administrator to reset your password.
      </p>
    </div>
  )
}
