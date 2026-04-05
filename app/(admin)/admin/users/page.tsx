import { createClient } from '@/lib/supabase/server'
import { AdminHeader } from '@/components/admin/AdminHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { formatFullDate } from '@/lib/utils/date'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Users' }

const ROLE_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  admin:   { bg: 'rgba(196,163,94,0.1)',  color: '#C4A35E',  label: 'ADMIN'   },
  partner: { bg: 'rgba(99,120,255,0.1)',  color: '#6378FF',  label: 'PARTNER' },
}

export default async function AdminUsersPage() {
  const supabase = await createClient()

  const { data: profiles } = await supabase
    .from('profiles')
    .select(`
      id, full_name, role, created_at,
      partners ( name )
    `)
    .order('created_at', { ascending: false })

  return (
    <div>
      <AdminHeader
        title="Users"
        subtitle="All registered accounts and their access roles"
      />

      <div style={{
        background: '#0D0F1A', border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '16px', overflow: 'hidden',
      }}>
        {!profiles || profiles.length === 0 ? (
          <EmptyState
            icon="◉"
            title="No users yet"
            description="Users are created automatically when someone signs up."
          />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  {['Name', 'Role', 'Partner Account', 'Joined'].map(h => (
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

      {/* Info note */}
      <div style={{
        marginTop: '16px', padding: '14px 20px', borderRadius: '10px',
        background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)',
        fontSize: '12px', color: 'rgba(240,236,228,0.35)',
      }}>
        Partner users sign up with a shared invite link. After signup, link their profile to a partner account via the Supabase dashboard until the invite flow is built in Sprint 3.
      </div>
    </div>
  )
}
