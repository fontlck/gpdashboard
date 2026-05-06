'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type OrgInfo = {
  id:     string
  name:   string
  slug:   string
  is_vat: boolean
  role:   string
}

type Props = {
  orgs:           OrgInfo[]
  currentOrgId:   string
  currentOrgName: string
}

export function OrgSwitcher({ orgs, currentOrgId, currentOrgName }: Props) {
  const router   = useRouter()
  const [open,   setOpen]   = useState(false)
  const [saving, setSaving] = useState(false)

  async function switchOrg(orgId: string) {
    if (orgId === currentOrgId) { setOpen(false); return }
    setSaving(true)
    await fetch('/api/auth/orgs', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ org_id: orgId }),
    })
    router.push('/admin')
    router.refresh()
    setSaving(false)
    setOpen(false)
  }

  const currentOrg = orgs.find(o => o.id === currentOrgId)

  return (
    <div style={{ position: 'relative', marginBottom: '20px' }}>
      <button
        onClick={() => setOpen(v => !v)}
        disabled={saving}
        style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '7px 14px', borderRadius: '8px',
          border: '1px solid rgba(255,255,255,0.1)',
          background: 'rgba(255,255,255,0.03)',
          cursor: 'pointer', fontSize: '13px', color: 'rgba(241,245,249,0.7)',
        }}
      >
        <span style={{
          width: '8px', height: '8px', borderRadius: '50%',
          background: currentOrg?.is_vat ? '#4ADE80' : '#FCD34D',
          display: 'inline-block', flexShrink: 0,
        }} />
        {saving ? 'Switching…' : currentOrgName}
        <span style={{ fontSize: '10px', opacity: 0.5 }}>▾</span>
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 99 }}
          />
          {/* Dropdown */}
          <div style={{
            position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 100,
            background: '#0C1018', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '12px', padding: '6px', minWidth: '220px',
            boxShadow: '0 16px 40px rgba(0,0,0,0.5)',
          }}>
            {orgs.map(org => (
              <button
                key={org.id}
                onClick={() => switchOrg(org.id)}
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: '8px',
                  display: 'flex', alignItems: 'center', gap: '10px',
                  background: org.id === currentOrgId ? 'rgba(255,255,255,0.05)' : 'transparent',
                  border: 'none', cursor: 'pointer', textAlign: 'left',
                }}
              >
                <span style={{
                  width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
                  background: org.is_vat ? '#4ADE80' : '#FCD34D',
                }} />
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: '#F1F5F9' }}>
                    {org.name}
                    {org.id === currentOrgId && (
                      <span style={{ fontSize: '10px', color: 'rgba(241,245,249,0.35)', marginLeft: '6px' }}>current</span>
                    )}
                  </div>
                  <div style={{ fontSize: '11px', color: 'rgba(241,245,249,0.35)' }}>
                    {org.is_vat ? 'VAT' : 'Non-VAT'}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
