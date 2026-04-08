'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Partner = { id: string; name: string }

type UserData = {
  id:         string
  full_name:  string | null
  username:   string | null
  role:       string
  partner_id: string | null
  is_active:  boolean
}

type Props = {
  user:     UserData
  partners: Partner[]
}

export function UserRowActions({ user, partners }: Props) {
  const router = useRouter()

  // ── Edit modal state ────────────────────────────────────────────────────────
  const [editOpen,  setEditOpen]  = useState(false)
  const [editLoad,  setEditLoad]  = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  const [fullName,  setFullName]  = useState(user.full_name  ?? '')
  const [username,  setUsername]  = useState(user.username   ?? '')
  const [role,      setRole]      = useState<'partner' | 'admin'>(
    user.role === 'admin' ? 'admin' : 'partner'
  )
  const [partnerId, setPartnerId] = useState(user.partner_id ?? '')
  const [isActive,  setIsActive]  = useState(user.is_active)
  const [password,  setPassword]  = useState('')
  const [confirm,   setConfirm]   = useState('')

  // ── Delete state ────────────────────────────────────────────────────────────
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteLoad, setDeleteLoad] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  function openEdit() {
    setFullName(user.full_name ?? '')
    setUsername(user.username  ?? '')
    setRole(user.role === 'admin' ? 'admin' : 'partner')
    setPartnerId(user.partner_id ?? '')
    setIsActive(user.is_active)
    setPassword(''); setConfirm(''); setEditError(null)
    setEditOpen(true)
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    setEditError(null)
    if (password && password !== confirm) { setEditError('Passwords do not match.'); return }
    if (password && password.length < 8)  { setEditError('Password must be at least 8 characters.'); return }
    if (role === 'partner' && !partnerId) { setEditError('Please select a partner.'); return }

    setEditLoad(true)
    const body: Record<string, unknown> = {
      full_name:  fullName,
      username,
      role,
      partner_id: role === 'partner' ? partnerId : null,
      is_active:  isActive,
    }
    if (password) body.password = password

    const res  = await fetch(`/api/admin/users/${user.id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    })
    const json = await res.json()
    setEditLoad(false)

    if (!res.ok) { setEditError(json.error ?? 'Failed to update user.'); return }
    setEditOpen(false)
    router.refresh()
  }

  async function handleDelete() {
    setDeleteLoad(true)
    setDeleteError(null)
    const res  = await fetch(`/api/admin/users/${user.id}`, { method: 'DELETE' })
    const json = await res.json()
    setDeleteLoad(false)
    if (!res.ok) { setDeleteError(json.error ?? 'Failed to delete user.'); return }
    setDeleteOpen(false)
    router.refresh()
  }

  // ── Shared styles ──────────────────────────────────────────────────────────
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px',
    background: '#13151F', border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: '8px', color: '#F0ECE4', fontSize: '13px', outline: 'none',
    boxSizing: 'border-box',
  }
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '11px', fontWeight: '600',
    color: 'rgba(240,236,228,0.45)', letterSpacing: '0.07em',
    textTransform: 'uppercase', marginBottom: '6px',
  }
  const focusBorder = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) =>
    (e.target.style.borderColor = 'rgba(59,130,246,0.5)')
  const blurBorder  = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) =>
    (e.target.style.borderColor = 'rgba(255,255,255,0.10)')

  return (
    <>
      {/* Action buttons */}
      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
        <button
          onClick={openEdit}
          title="Edit user"
          style={{
            padding: '5px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: '600',
            border: '1px solid rgba(99,120,255,0.3)', background: 'rgba(99,120,255,0.08)',
            color: '#818CF8', cursor: 'pointer', letterSpacing: '0.03em',
          }}
        >
          Edit
        </button>
        <button
          onClick={() => { setDeleteError(null); setDeleteOpen(true) }}
          title="Delete user"
          style={{
            padding: '5px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: '600',
            border: '1px solid rgba(239,68,68,0.25)', background: 'rgba(239,68,68,0.07)',
            color: '#F87171', cursor: 'pointer', letterSpacing: '0.03em',
          }}
        >
          Delete
        </button>
      </div>

      {/* ── Edit modal ────────────────────────────────────────────────────── */}
      {editOpen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '20px',
        }}>
          <div style={{
            background: '#0D0F1A', border: '1px solid rgba(255,255,255,0.10)',
            borderRadius: '16px', width: '100%', maxWidth: '520px',
            maxHeight: '90vh', overflowY: 'auto',
          }}>
            {/* Modal header */}
            <div style={{
              padding: '20px 24px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div>
                <div style={{ fontSize: '15px', fontWeight: '700', color: '#F0ECE4' }}>Edit User</div>
                <div style={{ fontSize: '12px', color: 'rgba(240,236,228,0.35)', marginTop: '2px' }}>
                  {user.username ? `@${user.username}` : user.full_name}
                </div>
              </div>
              <button
                onClick={() => setEditOpen(false)}
                style={{ background: 'none', border: 'none', color: 'rgba(240,236,228,0.4)', fontSize: '20px', cursor: 'pointer', lineHeight: 1 }}
              >×</button>
            </div>

            <form onSubmit={handleEdit} style={{ padding: '20px 24px' }}>
              {/* Role */}
              <div style={{ marginBottom: '18px' }}>
                <label style={labelStyle}>Role</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {(['partner', 'admin'] as const).map(r => (
                    <button
                      key={r} type="button"
                      onClick={() => { setRole(r); if (r === 'admin') setPartnerId('') }}
                      style={{
                        padding: '7px 18px', borderRadius: '8px', fontSize: '12px',
                        fontWeight: '700', letterSpacing: '0.05em', cursor: 'pointer',
                        border: role === r
                          ? `1px solid ${r === 'admin' ? 'rgba(59,130,246,0.5)' : 'rgba(99,120,255,0.5)'}`
                          : '1px solid rgba(255,255,255,0.08)',
                        background: role === r
                          ? (r === 'admin' ? 'rgba(59,130,246,0.15)' : 'rgba(99,120,255,0.15)')
                          : 'transparent',
                        color: role === r
                          ? (r === 'admin' ? '#60A5FA' : '#818CF8')
                          : 'rgba(240,236,228,0.35)',
                      }}
                    >
                      {r === 'admin' ? 'Admin' : 'Partner'}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                {/* Full Name */}
                <div>
                  <label style={labelStyle}>Full Name</label>
                  <input type="text" value={fullName} onChange={e => setFullName(e.target.value)}
                    required style={inputStyle} onFocus={focusBorder} onBlur={blurBorder}
                  />
                </div>

                {/* Username */}
                <div>
                  <label style={labelStyle}>Username</label>
                  <input type="text" value={username} onChange={e => setUsername(e.target.value)}
                    required style={inputStyle} onFocus={focusBorder} onBlur={blurBorder}
                  />
                </div>

                {/* Partner — only for partner role */}
                {role === 'partner' && (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={labelStyle}>Partner</label>
                    <select value={partnerId} onChange={e => setPartnerId(e.target.value)}
                      required style={{ ...inputStyle, appearance: 'none' }}
                      onFocus={focusBorder} onBlur={blurBorder}
                    >
                      <option value="">Select partner…</option>
                      {partners.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Status */}
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={labelStyle}>Status</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {[true, false].map(val => (
                      <button
                        key={String(val)} type="button"
                        onClick={() => setIsActive(val)}
                        style={{
                          padding: '7px 18px', borderRadius: '8px', fontSize: '12px',
                          fontWeight: '700', letterSpacing: '0.05em', cursor: 'pointer',
                          border: isActive === val
                            ? `1px solid ${val ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)'}`
                            : '1px solid rgba(255,255,255,0.08)',
                          background: isActive === val
                            ? (val ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.1)')
                            : 'transparent',
                          color: isActive === val
                            ? (val ? '#4ADE80' : '#F87171')
                            : 'rgba(240,236,228,0.35)',
                        }}
                      >
                        {val ? 'Active' : 'Inactive'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* New password (optional) */}
                <div>
                  <label style={labelStyle}>New Password <span style={{ color: 'rgba(240,236,228,0.25)', fontWeight: 400 }}>(optional)</span></label>
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                    placeholder="Leave blank to keep" style={inputStyle} onFocus={focusBorder} onBlur={blurBorder}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Confirm Password</label>
                  <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
                    placeholder="••••••••" style={inputStyle} onFocus={focusBorder} onBlur={blurBorder}
                  />
                </div>
              </div>

              {editError && (
                <div style={{
                  marginTop: '14px', padding: '10px 14px', borderRadius: '8px',
                  background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                  fontSize: '12px', color: '#F87171',
                }}>{editError}</div>
              )}

              <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
                <button type="submit" disabled={editLoad} style={{
                  padding: '10px 24px', borderRadius: '8px',
                  background: editLoad ? 'rgba(59,130,246,0.4)' : '#3B82F6',
                  border: 'none', color: '#F1F5F9', fontSize: '13px', fontWeight: '700',
                  cursor: editLoad ? 'not-allowed' : 'pointer', letterSpacing: '0.04em',
                }}>
                  {editLoad ? 'Saving…' : 'Save Changes'}
                </button>
                <button type="button" onClick={() => setEditOpen(false)} style={{
                  padding: '10px 20px', borderRadius: '8px',
                  border: '1px solid rgba(255,255,255,0.08)',
                  background: 'transparent', color: 'rgba(240,236,228,0.45)',
                  fontSize: '13px', cursor: 'pointer',
                }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete confirm modal ───────────────────────────────────────────── */}
      {deleteOpen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '20px',
        }}>
          <div style={{
            background: '#0D0F1A', border: '1px solid rgba(255,255,255,0.10)',
            borderRadius: '16px', width: '100%', maxWidth: '400px', padding: '28px 28px 24px',
          }}>
            <div style={{
              width: '44px', height: '44px', borderRadius: '12px',
              background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '20px', marginBottom: '16px',
            }}>🗑</div>

            <div style={{ fontSize: '16px', fontWeight: '700', color: '#F0ECE4', marginBottom: '6px' }}>
              Delete user?
            </div>
            <p style={{ fontSize: '13px', color: 'rgba(240,236,228,0.45)', marginBottom: '20px', lineHeight: '1.5' }}>
              This will permanently delete <strong style={{ color: '#F0ECE4' }}>{user.full_name ?? user.username}</strong> and revoke their access. This cannot be undone.
            </p>

            {deleteError && (
              <div style={{
                marginBottom: '14px', padding: '10px 14px', borderRadius: '8px',
                background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                fontSize: '12px', color: '#F87171',
              }}>{deleteError}</div>
            )}

            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={handleDelete} disabled={deleteLoad} style={{
                padding: '10px 20px', borderRadius: '8px',
                background: deleteLoad ? 'rgba(239,68,68,0.4)' : '#EF4444',
                border: 'none', color: '#fff', fontSize: '13px', fontWeight: '700',
                cursor: deleteLoad ? 'not-allowed' : 'pointer',
              }}>
                {deleteLoad ? 'Deleting…' : 'Yes, Delete'}
              </button>
              <button onClick={() => setDeleteOpen(false)} style={{
                padding: '10px 20px', borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.08)',
                background: 'transparent', color: 'rgba(240,236,228,0.45)',
                fontSize: '13px', cursor: 'pointer',
              }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
