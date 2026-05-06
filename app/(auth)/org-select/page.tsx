'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

type OrgInfo = {
  id:     string
  name:   string
  slug:   string
  is_vat: boolean
  role:   string
}

export default function OrgSelectPage() {
  const router  = useRouter()
  const [orgs,    setOrgs]    = useState<OrgInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)
  const [saving,  setSaving]  = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/auth/orgs')
      .then(r => r.json())
      .then(d => { setOrgs(d.orgs ?? []); setLoading(false) })
      .catch(() => { setError('Failed to load organizations'); setLoading(false) })
  }, [])

  async function selectOrg(orgId: string, role: string) {
    setSaving(orgId)
    const res = await fetch('/api/auth/orgs', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ org_id: orgId }),
    })
    if (res.ok) {
      router.push(role === 'admin' ? '/admin' : '/dashboard')
    } else {
      setError('Failed to select organization')
      setSaving(null)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#080A12',
    }}>
      <div style={{ maxWidth: '420px', width: '100%', padding: '0 24px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: '700', color: '#F1F5F9', marginBottom: '8px', textAlign: 'center' }}>
          Select Dashboard
        </h1>
        <p style={{ fontSize: '13px', color: 'rgba(241,245,249,0.45)', textAlign: 'center', marginBottom: '32px' }}>
          Choose which dashboard to open
        </p>

        {loading && (
          <p style={{ textAlign: 'center', color: 'rgba(241,245,249,0.4)', fontSize: '13px' }}>Loading…</p>
        )}

        {error && (
          <div style={{
            padding: '10px 14px', borderRadius: '8px', marginBottom: '16px',
            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
            fontSize: '13px', color: '#F87171', textAlign: 'center',
          }}>
            {error}
          </div>
        )}

        {!loading && orgs.length === 0 && !error && (
          <div style={{
            padding: '16px', borderRadius: '12px', textAlign: 'center',
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
            fontSize: '13px', color: 'rgba(241,245,249,0.4)',
          }}>
            No dashboards assigned to your account.<br />Please contact your administrator.
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {orgs.map(org => (
            <button
              key={org.id}
              onClick={() => selectOrg(org.id, org.role)}
              disabled={saving === org.id}
              style={{
                padding: '18px 20px', borderRadius: '14px', textAlign: 'left', cursor: 'pointer',
                background: '#0C1018', border: '1px solid rgba(255,255,255,0.08)',
                opacity: saving && saving !== org.id ? 0.5 : 1,
                transition: 'border-color 0.15s',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '15px', fontWeight: '700', color: '#F1F5F9' }}>
                  {saving === org.id ? 'Opening…' : org.name}
                </span>
                <span style={{
                  fontSize: '11px', padding: '3px 8px', borderRadius: '6px',
                  background: org.is_vat ? 'rgba(34,197,94,0.1)' : 'rgba(251,191,36,0.1)',
                  color: org.is_vat ? '#4ADE80' : '#FCD34D',
                  border: `1px solid ${org.is_vat ? 'rgba(34,197,94,0.25)' : 'rgba(251,191,36,0.25)'}`,
                }}>
                  {org.is_vat ? 'VAT' : 'Non-VAT'}
                </span>
              </div>
              <div style={{ fontSize: '12px', color: 'rgba(241,245,249,0.4)', marginTop: '4px' }}>
                {org.role === 'admin' ? 'Admin' : 'Partner'} · {org.slug}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
