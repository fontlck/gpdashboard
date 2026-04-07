import { createAdminClient } from '@/lib/supabase/admin'
import { AdminHeader } from '@/components/admin/AdminHeader'
import { formatFullDate } from '@/lib/utils/date'
import { CreatePartnerForm } from '@/components/admin/CreatePartnerForm'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Users' }
export const dynamic = 'force-dynamic'

const ROLE_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  admin:   { bg: 'rgba(59,130,246,0.1)', color: '#60A5FA', label: 'ADMIN'   },
  partner: { bg: 'rgba(99,120,255,0.1)', color: '#6378FF', label: 'PARTNER' },
}

export default async function AdminUsersPage() {
  const admin = createAdminClient()

  const [profilesRes, partnersRes] = await Promise.all([
    admin
      .from('profiles')
      .select('id, full_name, role, username, is_active, created_at, partners ( name )')
      .order('created_at', { ascending: false }),
    admin
      .from('partners')
      .select('id, name')
      .eq('is_active', true)
      .order('name'),
  ])

  const profiles = profilesRes.data ?? []
  const partners = partnersRes.data ?? []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <AdminHeader
        title="Users"
        subtitle="Partner accounts and their access credentials"
      />

      {/* Create Partner form */}
      <CreatePartnerForm partners={partners} />

      {/* Users table */}
      <div style={{
        background: '#0D0F1A', border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '16px', overflow: 'hidden',
      }}>
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: '13px', fontWeight: '600', color: 'rgba(240,236,228,0.6)',
            letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            All Users
          </span>
          <span style={{ fontSize: '12px', color: 'rgba(240,236,228,0.3)' }}>
            {profiles.length} account{profiles.length !== 1 ? 's' : ''}
          </span>
        </div>

        {profiles.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'rgba(240,236,228,0.3)', fontSize: '13px' }}>
            No users yet.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  {['Name', 'Username', 'Role', 'Partner', 'Status', 'Joined'].map(h => (
                    <th key={h} style={{
                      padding: '12px 20px', textAlign: 'left',
                      fontSize: '11px', fontWeight: '600', letterSpacing: '0.08em',
                      textTransform: 'uppercase', color: 'rgba(240,236,228,0.35)',
                      whiteSpace: 'nowrap',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {profiles.map(u => {
                  const partner = Array.isArray(u.partners) ? u.partners[0] : u.partners
                  const rs = ROLE_STYLE[u.role] ?? ROLE_STYLE.partner

                  return (
                    <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '14px 20px', color: '#F0ECE4', fontWeight: '500' }}>
                        {u.full_name ?? <span style={{ color: 'rgba(240,236,228,0.3)', fontStyle: 'italic' }}>No name</span>}
                      </td>
                      <td style={{ padding: '14px 20px' }}>
                        {u.username ? (
                          <span style={{
                            fontFamily: 'monospace', fontSize: '12px',
                            color: 'rgba(241,245,249,0.7)',
                            background: 'rgba(255,255,255,0.06)',
                            padding: '2px 8px', borderRadius: '5px',
                          }}>
                            {u.username}
                          </span>
                        ) : (
                          <span style={{ color: 'rgba(240,236,228,0.2)', fontStyle: 'italic' }}>email only</span>
                        )}
                      </td>
                      <td style={{ padding: '14px 20px' }}>
                        <span style={{
                          fontSize: '11px', fontWeight: '700', letterSpacing: '0.08em',
                          padding: '3px 8px', borderRadius: '6px',
                          background: rs.bg, color: rs.color,
                        }}>
                          {rs.label}
                        </span>
                      </td>
                      <td style={{ padding: '14px 20px', color: 'rgba(240,236,228,0.5)' }}>
                        {partner?.name ?? '—'}
                      </td>
                      <td style={{ padding: '14px 20px' }}>
                        <span style={{
                          fontSize: '11px', fontWeight: '600', letterSpacing: '0.06em',
                          color: u.is_active ? 'rgba(74,222,128,0.8)' : 'rgba(240,236,228,0.3)',
                        }}>
                          {u.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td style={{ padding: '14px 20px', color: 'rgba(240,236,228,0.4)', whiteSpace: 'nowrap' }}>
                        {u.created_at ? formatFullDate(u.created_at) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
