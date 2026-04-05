import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { formatFullDate } from '@/lib/utils/date'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Account' }

const FIELD = ({ label, value }: { label: string; value: ReactNode }) => (
  <div style={{
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '13px 0', borderBottom: '1px solid rgba(255,255,255,0.05)',
  }}>
    <span style={{ fontSize: '13px', color: 'rgba(240,236,228,0.45)' }}>{label}</span>
    <span style={{ fontSize: '13px', color: '#F0ECE4', fontWeight: '500' }}>{value ?? '—'}</span>
  </div>
)

export default async function PartnerAccountPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role, partner_id, created_at')
    .eq('id', user.id)
    .single()

  type BranchAccountJoin = { name: string; code: string | null; revenue_share_pct: number; location: string | null; is_active: boolean }
  type PartnerInfo = { name: string; is_vat_registered: boolean; vat_number: string | null; contact_email: string | null; contact_phone: string | null }
  type PartnerAccountRow = PartnerInfo & { branches: BranchAccountJoin | BranchAccountJoin[] | null }

  let partner: PartnerInfo | null = null
  let branches: BranchAccountJoin[] = []

  if (profile?.partner_id) {
    const { data: rawP } = await supabase
      .from('partners')
      .select(`
        name, is_vat_registered, vat_number, contact_email, contact_phone,
        branches ( name, code, revenue_share_pct, location, is_active )
      `)
      .eq('id', profile.partner_id)
      .single()

    const p = rawP as unknown as PartnerAccountRow | null
    if (p) {
      partner   = { name: p.name, is_vat_registered: !!p.is_vat_registered, vat_number: p.vat_number, contact_email: p.contact_email, contact_phone: p.contact_phone }
      const raw = Array.isArray(p.branches) ? p.branches : (p.branches ? [p.branches] : [])
      branches  = raw as BranchAccountJoin[]
    }
  }

  return (
    <div>
      {/* Page heading */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ margin: 0, fontSize: '22px', fontWeight: '700', color: '#F0ECE4', letterSpacing: '-0.02em' }}>
          Account
        </h1>
        <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'rgba(240,236,228,0.4)' }}>
          Your profile and partner details
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>

        {/* Profile */}
        <div style={{
          background: '#0D0F1A', border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '16px', padding: '24px',
        }}>
          <h2 style={{
            fontSize: '14px', fontWeight: '600', color: 'rgba(240,236,228,0.6)',
            letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '16px',
          }}>
            Profile
          </h2>
          <FIELD label="Name"        value={profile?.full_name} />
          <FIELD label="Email"       value={user.email} />
          <FIELD label="Role"        value="Partner" />
          <FIELD label="Member since" value={profile?.created_at ? formatFullDate(profile.created_at) : '—'} />
        </div>

        {/* Partner details */}
        <div style={{
          background: '#0D0F1A', border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '16px', padding: '24px',
        }}>
          <h2 style={{
            fontSize: '14px', fontWeight: '600', color: 'rgba(240,236,228,0.6)',
            letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '16px',
          }}>
            Partner Details
          </h2>
          {partner ? (
            <>
              <FIELD label="Business Name"   value={partner.name} />
              <FIELD label="VAT Registered"  value={partner.is_vat_registered ? 'Yes' : 'No'} />
              {partner.vat_number && <FIELD label="VAT Number" value={partner.vat_number} />}
              <FIELD label="Contact Email"   value={partner.contact_email} />
              <FIELD label="Contact Phone"   value={partner.contact_phone} />
            </>
          ) : (
            <p style={{ fontSize: '13px', color: 'rgba(240,236,228,0.3)', fontStyle: 'italic' }}>
              Not linked to a partner account yet.
            </p>
          )}
        </div>

        {/* Branches */}
        {branches.length > 0 && (
          <div style={{
            background: '#0D0F1A', border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '16px', padding: '24px', gridColumn: '1 / -1',
          }}>
            <h2 style={{
              fontSize: '14px', fontWeight: '600', color: 'rgba(240,236,228,0.6)',
              letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '16px',
            }}>
              Your Branches
            </h2>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  {['Branch Name', 'Code', 'Location', 'Revenue Share', 'Status'].map(h => (
                    <th key={h} style={{
                      padding: '8px 0', textAlign: 'left',
                      fontSize: '11px', fontWeight: '600', letterSpacing: '0.08em',
                      textTransform: 'uppercase', color: 'rgba(240,236,228,0.35)',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {branches.map((b, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '10px 0', color: '#F0ECE4', fontWeight: '500' }}>{b.name}</td>
                    <td style={{ padding: '10px 0', color: 'rgba(240,236,228,0.4)', fontFamily: 'monospace', fontSize: '12px' }}>{b.code ?? '—'}</td>
                    <td style={{ padding: '10px 0', color: 'rgba(240,236,228,0.5)' }}>{b.location ?? '—'}</td>
                    <td style={{ padding: '10px 0', color: '#C4A35E', fontWeight: '600' }}>{b.revenue_share_pct}%</td>
                    <td style={{ padding: '10px 0' }}>
                      <span style={{
                        fontSize: '11px', fontWeight: '600', letterSpacing: '0.06em',
                        padding: '3px 8px', borderRadius: '6px',
                        background: b.is_active ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.04)',
                        color: b.is_active ? '#22C55E' : 'rgba(240,236,228,0.25)',
                      }}>
                        {b.is_active ? 'ACTIVE' : 'INACTIVE'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Info note */}
        <div style={{
          gridColumn: '1 / -1', padding: '14px 20px', borderRadius: '10px',
          background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)',
          fontSize: '12px', color: 'rgba(240,236,228,0.3)',
        }}>
          To update your business name, contact details, or VAT registration, please contact the GP team. Account self-editing is planned for Sprint 3.
        </div>

      </div>
    </div>
  )
}
