import { AdminHeader } from '@/components/admin/AdminHeader'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Upload CSV' }

export default function AdminUploadPage() {
  return (
    <div>
      <AdminHeader
        title="Upload CSV"
        subtitle="Import an OPN/Omise transaction export to generate monthly reports"
      />

      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '20px',
      }}>
        {/* Drop zone */}
        <div style={{
          gridColumn: '1 / -1',
          background: '#0D0F1A',
          border: '2px dashed rgba(196,163,94,0.25)',
          borderRadius: '16px',
          padding: '64px 40px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px',
          textAlign: 'center',
        }}>
          <div style={{
            width: '56px', height: '56px', borderRadius: '14px',
            background: 'rgba(196,163,94,0.08)',
            border: '1px solid rgba(196,163,94,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '22px',
          }}>
            ↑
          </div>
          <div>
            <p style={{ margin: 0, fontSize: '15px', fontWeight: '600', color: '#F0ECE4' }}>
              Drop your OPN CSV here
            </p>
            <p style={{ margin: '6px 0 0', fontSize: '13px', color: 'rgba(240,236,228,0.4)' }}>
              or click to browse — .csv files only, max 50,000 rows
            </p>
          </div>
          <div style={{
            padding: '10px 24px', borderRadius: '10px',
            background: 'linear-gradient(135deg,#C4A35E 0%,#9A7A3A 100%)',
            color: '#080A10', fontSize: '13px', fontWeight: '700',
            cursor: 'pointer', letterSpacing: '0.04em',
          }}>
            Browse File
          </div>
        </div>

        {/* Upload steps */}
        <div style={{
          background: '#0D0F1A', border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '16px', padding: '24px',
        }}>
          <h2 style={{
            fontSize: '14px', fontWeight: '600', color: 'rgba(240,236,228,0.6)',
            letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '20px',
          }}>
            Import Phases
          </h2>
          {[
            { num: '01', label: 'Validate', desc: 'Check headers, row count, currency, and date range' },
            { num: '02', label: 'Map Branches', desc: 'Match CSV branch names to your registered branches' },
            { num: '03', label: 'Preview', desc: 'Review aggregated totals before committing' },
            { num: '04', label: 'Import', desc: 'Write report rows and calculate monthly summaries' },
          ].map(step => (
            <div key={step.num} style={{
              display: 'flex', gap: '16px', alignItems: 'flex-start',
              padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.04)',
            }}>
              <span style={{
                flexShrink: 0,
                fontSize: '11px', fontWeight: '700', color: 'rgba(196,163,94,0.6)',
                letterSpacing: '0.1em', paddingTop: '2px',
              }}>{step.num}</span>
              <div>
                <p style={{ margin: 0, fontSize: '13px', fontWeight: '600', color: '#F0ECE4' }}>
                  {step.label}
                </p>
                <p style={{ margin: '3px 0 0', fontSize: '12px', color: 'rgba(240,236,228,0.4)' }}>
                  {step.desc}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Requirements */}
        <div style={{
          background: '#0D0F1A', border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '16px', padding: '24px',
        }}>
          <h2 style={{
            fontSize: '14px', fontWeight: '600', color: 'rgba(240,236,228,0.6)',
            letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '20px',
          }}>
            CSV Requirements
          </h2>
          {[
            'Exported from OPN (Omise) dashboard',
            'Must include: charge_id, amount, fee, net, currency, branchName (metadata)',
            'All THB transactions — non-THB rows skipped automatically',
            'One reporting month per upload recommended',
            'Maximum 50,000 rows per file',
            'Duplicate charge_ids within the same report are skipped',
          ].map((req, i) => (
            <div key={i} style={{
              display: 'flex', gap: '10px', alignItems: 'flex-start',
              padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.03)',
            }}>
              <span style={{ color: 'rgba(196,163,94,0.5)', fontSize: '12px', paddingTop: '2px' }}>✓</span>
              <span style={{ fontSize: '12px', color: 'rgba(240,236,228,0.5)', lineHeight: 1.5 }}>{req}</span>
            </div>
          ))}
        </div>

        {/* Coming soon notice */}
        <div style={{
          gridColumn: '1 / -1',
          padding: '14px 20px', borderRadius: '10px',
          background: 'rgba(99,120,255,0.06)', border: '1px solid rgba(99,120,255,0.15)',
          fontSize: '12px', color: 'rgba(150,160,255,0.8)',
        }}>
          🛠 CSV import logic is implemented in Sprint 2 — this page is a scaffold placeholder.
        </div>
      </div>
    </div>
  )
}
