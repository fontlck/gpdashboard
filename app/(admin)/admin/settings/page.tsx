import type { ReactNode } from 'react'
import { createClient } from '@/lib/supabase/server'
import { AdminHeader } from '@/components/admin/AdminHeader'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Settings' }

const ROW = ({ label, value, description }: { label: string; value: ReactNode; description?: string }) => (
  <div style={{
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '16px 0', borderBottom: '1px solid rgba(255,255,255,0.04)',
    gap: '24px',
  }}>
    <div>
      <p style={{ margin: 0, fontSize: '13px', fontWeight: '500', color: '#F0ECE4' }}>{label}</p>
      {description && (
        <p style={{ margin: '3px 0 0', fontSize: '11px', color: 'rgba(240,236,228,0.35)' }}>{description}</p>
      )}
    </div>
    <span style={{ fontSize: '14px', fontWeight: '600', color: '#F1F5F9', whiteSpace: 'nowrap' }}>
      {value}
    </span>
  </div>
)

export default async function AdminSettingsPage() {
  const supabase = await createClient()

  const { data: settings } = await supabase
    .from('settings')
    .select('key, value')

  const settingsMap = Object.fromEntries((settings ?? []).map(s => [s.key, s.value]))

  const vatRate     = settingsMap['vat_rate']     ?? '0.07'
  const currency    = settingsMap['system_currency'] ?? 'THB'
  const csvMaxRows  = settingsMap['csv_max_rows']  ?? '50000'

  const vatPct = (parseFloat(vatRate) * 100).toFixed(0) + '%'

  return (
    <div>
      <AdminHeader
        title="Settings"
        subtitle="Global system configuration — edit via Supabase dashboard in Sprint 2"
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

        {/* Financial settings */}
        <div style={{
          background: '#0D0F1A', border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '16px', padding: '24px',
        }}>
          <h2 style={{
            fontSize: '14px', fontWeight: '600', color: 'rgba(240,236,228,0.6)',
            letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '4px',
          }}>
            Financial
          </h2>
          <ROW
            label="VAT Rate"
            value={vatPct}
            description="Applied to partner payout when partner is VAT-registered. Snapshotted into each report at calculation time."
          />
          <ROW
            label="System Currency"
            value={currency}
            description="All non-THB transactions in uploaded CSVs are skipped automatically."
          />
        </div>

        {/* Import settings */}
        <div style={{
          background: '#0D0F1A', border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '16px', padding: '24px',
        }}>
          <h2 style={{
            fontSize: '14px', fontWeight: '600', color: 'rgba(240,236,228,0.6)',
            letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '4px',
          }}>
            CSV Import
          </h2>
          <ROW
            label="Max Rows per Upload"
            value={parseInt(csvMaxRows).toLocaleString()}
            description="Files exceeding this row count are rejected during validation."
          />
        </div>

        {/* Info */}
        <div style={{
          padding: '16px 20px', borderRadius: '12px',
          background: 'rgba(99,120,255,0.05)', border: '1px solid rgba(99,120,255,0.12)',
          display: 'flex', gap: '12px', alignItems: 'flex-start',
        }}>
          <span style={{ fontSize: '16px', flexShrink: 0 }}>ℹ</span>
          <div>
            <p style={{ margin: 0, fontSize: '13px', fontWeight: '500', color: 'rgba(150,160,255,0.9)' }}>
              Settings are stored in the <code style={{ fontSize: '12px', background: 'rgba(255,255,255,0.06)', padding: '1px 5px', borderRadius: '4px' }}>settings</code> table
            </p>
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'rgba(150,160,255,0.55)' }}>
              To change VAT rate or CSV limits, update the row directly in Supabase. An admin UI for editing settings is planned for Sprint 3.
            </p>
          </div>
        </div>

      </div>
    </div>
  )
}
