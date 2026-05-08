import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatFullDate } from '@/lib/utils/date'
import { AccountClient, type AccountInitialData } from '@/components/partner/AccountClient'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Account' }

const BUCKET = 'partner-documents'

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

  type BranchJoin = {
    name: string; code: string | null; revenue_share_pct: number
    location: string | null; is_active: boolean
    partnership_start_date: string | null
  }
  type PartnerRow = {
    name: string; is_vat_registered: boolean; vat_number: string | null
    contact_email: string | null; contact_phone: string | null
    bank_name: string | null; bank_account_name: string | null; bank_account_number: string | null
    doc_pp20_name: string | null; doc_pp20_path: string | null
    doc_id_card_name: string | null; doc_id_card_path: string | null
    doc_bookbank_name: string | null; doc_bookbank_path: string | null
    branches: BranchJoin | BranchJoin[] | null
  }

  let partnerName     = profile?.full_name ?? 'Partner'
  let isVatRegistered = false
  let branches:  BranchJoin[] = []
  let partnerSince: string | null = null
  let accountInitial: AccountInitialData = {
    contact_email: null, contact_phone: null,
    bank_name: null, bank_account_name: null, bank_account_number: null,
    docs: {
      pp20:     { name: null, signedUrl: null },
      id_card:  { name: null, signedUrl: null },
      bookbank: { name: null, signedUrl: null },
    },
  }

  if (profile?.partner_id) {
    const { data: rawP } = await supabase
      .from('partners')
      .select(`
        name, is_vat_registered, vat_number,
        contact_email, contact_phone,
        bank_name, bank_account_name, bank_account_number,
        doc_pp20_name, doc_pp20_path,
        doc_id_card_name, doc_id_card_path,
        doc_bookbank_name, doc_bookbank_path,
        branches ( name, code, revenue_share_pct, location, is_active, partnership_start_date )
      `)
      .eq('id', profile.partner_id)
      .single()

    const p = rawP as unknown as PartnerRow | null
    if (p) {
      partnerName     = p.name
      isVatRegistered = !!p.is_vat_registered
      const raw       = Array.isArray(p.branches) ? p.branches : (p.branches ? [p.branches] : [])
      branches        = raw

      // Partner since = earliest partnership_start_date across active branches
      const activeBranches = branches.filter(b => b.is_active)
      const withDate = activeBranches
        .filter(b => b.partnership_start_date)
        .sort((a, b) => (a.partnership_start_date! < b.partnership_start_date! ? -1 : 1))
      partnerSince = withDate[0]?.partnership_start_date ?? null

      // Generate signed URLs for existing docs
      const admin = createAdminClient()
      async function signedUrl(path: string | null): Promise<string | null> {
        if (!path) return null
        const { data } = await admin.storage.from(BUCKET).createSignedUrl(path, 3600)
        return data?.signedUrl ?? null
      }

      const [pp20Url, idCardUrl, bookbankUrl] = await Promise.all([
        signedUrl(p.doc_pp20_path),
        signedUrl(p.doc_id_card_path),
        signedUrl(p.doc_bookbank_path),
      ])

      accountInitial = {
        contact_email:       p.contact_email,
        contact_phone:       p.contact_phone,
        bank_name:           p.bank_name,
        bank_account_name:   p.bank_account_name,
        bank_account_number: p.bank_account_number,
        docs: {
          pp20:     { name: p.doc_pp20_name,     signedUrl: pp20Url },
          id_card:  { name: p.doc_id_card_name,  signedUrl: idCardUrl },
          bookbank: { name: p.doc_bookbank_name,  signedUrl: bookbankUrl },
        },
      }
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

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* ── Top row: Profile + Partner Details ────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>

          {/* Profile */}
          <div style={{
            background: '#0D0F1A', border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '16px', padding: '24px',
          }}>
            <h2 style={{
              fontSize: '11px', fontWeight: 600, color: 'rgba(240,236,228,0.4)',
              letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '16px',
            }}>
              Profile
            </h2>
            <FIELD label="Name"          value={profile?.full_name} />
            <FIELD label="Role"          value="Partner" />
            <FIELD label="Partner since" value={partnerSince ? formatFullDate(partnerSince) : '—'} />
          </div>

          {/* Partner Details */}
          <div style={{
            background: '#0D0F1A', border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '16px', padding: '24px',
          }}>
            <h2 style={{
              fontSize: '11px', fontWeight: 600, color: 'rgba(240,236,228,0.4)',
              letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '16px',
            }}>
              Partner Details
            </h2>
            <FIELD label="Business name"  value={partnerName} />
            <FIELD label="VAT registered" value={isVatRegistered ? 'Yes' : 'No'} />
          </div>
        </div>

        {/* ── Branches ──────────────────────────────────────────────────── */}
        {branches.length > 0 && (
          <div style={{
            background: '#0D0F1A', border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '16px', padding: '24px',
          }}>
            <h2 style={{
              fontSize: '11px', fontWeight: 600, color: 'rgba(240,236,228,0.4)',
              letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '16px',
            }}>
              Your Branches
            </h2>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  {['Branch name', 'Code', 'Location', 'Revenue share', 'Status'].map(h => (
                    <th key={h} style={{
                      padding: '8px 0', textAlign: 'left',
                      fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em',
                      textTransform: 'uppercase', color: 'rgba(240,236,228,0.35)',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {branches.map((b, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '10px 0', color: '#F0ECE4', fontWeight: 500 }}>{b.name}</td>
                    <td style={{ padding: '10px 0', color: 'rgba(240,236,228,0.4)', fontFamily: 'monospace', fontSize: '12px' }}>{b.code ?? '—'}</td>
                    <td style={{ padding: '10px 0', color: 'rgba(240,236,228,0.5)' }}>{b.location ?? '—'}</td>
                    <td style={{ padding: '10px 0', color: '#F1F5F9', fontWeight: 600 }}>{b.revenue_share_pct}%</td>
                    <td style={{ padding: '10px 0' }}>
                      <span style={{
                        fontSize: '11px', fontWeight: 600, letterSpacing: '0.06em',
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

        {/* ── Contact / Bank / Documents (client) ───────────────────────── */}
        <AccountClient initial={accountInitial} />

      </div>
    </div>
  )
}
