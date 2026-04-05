import { createClient } from '@/lib/supabase/server'
import { AdminHeader } from '@/components/admin/AdminHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Partners' }

export default async function AdminPartnersPage() {
  const supabase = await createClient()

  const { data: partners } = await supabase
    .from('partners')
    .select(`
      id, name, is_vat_registered, vat_number, contact_email, contact_phone,
      created_at,
      branches ( id, name, is_active )
    `)
    .order('name', { ascending: true })

  return (
    <div>
      <AdminHeader
        title="Partners"
        subtitle="Business entities that receive revenue share payouts"
        actions={
          <button style={{
            padding: '10px 18px', borderRadius: '10px',
            background: 'linear-gradient(135deg,#C4A35E 0%,#9A7A3A 100%)',
            color: '#080A10', fontSize: '13px', fontWeight: '700',
            border: 'none', cursor: 'pointer', letterSpacing: '0.04em',
          }}>
            + Add Partner
          </button>
        }
      />

      {!partners || partners.length === 0 ? (
        <EmptyState
          icon="◈"
          title="No partners yet"
          description="Partners receive revenue share payouts for their branches."
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {partners.map(p => {
            const branches = Array.isArray(p.branches) ? p.branches : (p.branches ? [p.branches] : [])
            const activeBranches = branches.filter((b: { is_active: boolean }) => b.is_active)

            return (
              <div key={p.id} style={{
                background: '#0D0F1A', border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '16px', padding: '24px',
                display: 'grid', gridTemplateColumns: '1fr auto',
                gap: '16px', alignItems: 'start',
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                    <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: '#F0ECE4' }}>
                      {p.name}
                    </h3>
                    {p.is_vat_registered && (
                      <span style={{
                        fontSize: '10px', fontWeight: '700', letterSpacing: '0.08em',
                        padding: '3px 8px', borderRadius: '6px',
                        background: 'rgba(196,163,94,0.1)', color: '#C4A35E',
                        border: '1px solid rgba(196,163,94,0.2)',
                      }}>
                        VAT REG
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                    {p.contact_email && (
                      <span style={{ fontSize: '12px', color: 'rgba(240,236,228,0.4)' }}>
                        ✉ {p.contact_email}
                      </span>
                    )}
                    {p.contact_phone && (
                      <span style={{ fontSize: '12px', color: 'rgba(240,236,228,0.4)' }}>
                        ✆ {p.contact_phone}
                      </span>
                    )}
                    {p.vat_number && (
                      <span style={{ fontSize: '12px', color: 'rgba(240,236,228,0.4)' }}>
                        VAT: {p.vat_number}
                      </span>
                    )}
                  </div>

                  {/* Branches */}
                  {branches.length > 0 && (
                    <div style={{ marginTop: '12px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {branches.map((b: { id: string; name: string; is_active: boolean }) => (
                        <span key={b.id} style={{
                          fontSize: '11px', padding: '3px 10px', borderRadius: '6px',
                          background: b.is_active ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.02)',
                          color: b.is_active ? 'rgba(240,236,228,0.6)' : 'rgba(240,236,228,0.25)',
                          border: '1px solid rgba(255,255,255,0.06)',
                        }}>
                          {b.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ textAlign: 'right' }}>
                  <p style={{ margin: 0, fontSize: '24px', fontWeight: '700', color: '#C4A35E' }}>
                    {activeBranches.length}
                  </p>
                  <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'rgba(240,236,228,0.3)',
                    textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    Active {activeBranches.length === 1 ? 'Branch' : 'Branches'}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
