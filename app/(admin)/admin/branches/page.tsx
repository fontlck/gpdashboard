import { createClient } from '@/lib/supabase/server'
import { AdminHeader } from '@/components/admin/AdminHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { formatFullDate } from '@/lib/utils/date'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Branches' }

export default async function AdminBranchesPage() {
  const supabase = await createClient()

  const { data: branches } = await supabase
    .from('branches')
    .select(`
      id, name, code, location, revenue_share_pct,
      is_active, partnership_start_date, partnership_start_date_source,
      created_at,
      partners ( name )
    `)
    .order('name', { ascending: true })

  return (
    <div>
      <AdminHeader
        title="Branches"
        subtitle="All branch locations and their revenue share settings"
        actions={
          <button style={{
            padding: '10px 18px', borderRadius: '10px',
            background: 'linear-gradient(135deg,#C4A35E 0%,#9A7A3A 100%)',
            color: '#080A10', fontSize: '13px', fontWeight: '700',
            border: 'none', cursor: 'pointer', letterSpacing: '0.04em',
          }}>
            + Add Branch
          </button>
        }
      />

      <div style={{
        background: '#0D0F1A', border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '16px', overflow: 'hidden',
      }}>
        {!branches || branches.length === 0 ? (
          <EmptyState
            icon="⑂"
            title="No branches yet"
            description="Add your first branch to start importing reports."
          />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  {['Branch', 'Code', 'Partner', 'Location', 'Rev. Share', 'Partnership Since', 'Status'].map(h => (
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
                {branches.map(b => {
                  const partner = Array.isArray(b.partners) ? b.partners[0] : b.partners
                  return (
                    <tr key={b.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '14px 20px', color: '#F0ECE4', fontWeight: '500' }}>
                        {b.name}
                      </td>
                      <td style={{ padding: '14px 20px', color: 'rgba(240,236,228,0.5)', fontFamily: 'monospace', fontSize: '12px' }}>
                        {b.code ?? '—'}
                      </td>
                      <td style={{ padding: '14px 20px', color: 'rgba(240,236,228,0.7)' }}>
                        {partner?.name ?? '—'}
                      </td>
                      <td style={{ padding: '14px 20px', color: 'rgba(240,236,228,0.5)' }}>
                        {b.location ?? '—'}
                      </td>
                      <td style={{ padding: '14px 20px', color: '#C4A35E', fontWeight: '600' }}>
                        {b.revenue_share_pct}%
                      </td>
                      <td style={{ padding: '14px 20px', color: 'rgba(240,236,228,0.5)', whiteSpace: 'nowrap' }}>
                        {b.partnership_start_date ? (
                          <span>
                            {formatFullDate(b.partnership_start_date)}
                            <span style={{
                              marginLeft: '6px', fontSize: '10px', padding: '2px 6px',
                              borderRadius: '4px', background: 'rgba(255,255,255,0.05)',
                              color: 'rgba(240,236,228,0.35)', letterSpacing: '0.06em',
                            }}>
                              {b.partnership_start_date_source === 'manual' ? 'MANUAL' : 'CSV'}
                            </span>
                          </span>
                        ) : '—'}
                      </td>
                      <td style={{ padding: '14px 20px' }}>
                        <span style={{
                          fontSize: '11px', fontWeight: '600', letterSpacing: '0.06em',
                          padding: '3px 8px', borderRadius: '6px',
                          background: b.is_active ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.05)',
                          color: b.is_active ? '#22C55E' : 'rgba(240,236,228,0.3)',
                        }}>
                          {b.is_active ? 'ACTIVE' : 'INACTIVE'}
                        </span>
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
