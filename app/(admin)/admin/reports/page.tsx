import { createAdminClient } from '@/lib/supabase/admin'
import { AdminHeader } from '@/components/admin/AdminHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { ReportsClient } from '@/components/admin/ReportsClient'
import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Reports' }
export const dynamic = 'force-dynamic'

// ── Supabase join types ───────────────────────────────────────────────────────

type PartnerJoin = { name: string; is_vat_registered: boolean | null }
type BranchJoin  = {
  id: string
  name: string
  code: string | null
  partners: PartnerJoin | PartnerJoin[] | null
}
type RawReport = {
  id: string
  branch_id: string
  reporting_month: number
  reporting_year: number
  status: string
  gross_sales: string | number
  total_net: string | number
  total_refunds: string | number
  final_payout: string | number
  vat_amount: string | number
  payout_type_snapshot: 'revenue_share' | 'fixed_rent'
  revenue_share_pct_snapshot: string | number
  fixed_rent_snapshot: string | number | null
  has_negative_adjusted_net: boolean | null
  created_at: string
  updated_at: string
  branches: BranchJoin | BranchJoin[] | null
}

export default async function AdminReportsPage() {
  const admin = createAdminClient()

  const { data: rawReports } = await admin
    .from('monthly_reports')
    .select(`
      id, branch_id, reporting_month, reporting_year, status,
      gross_sales, total_net, total_refunds, final_payout, vat_amount,
      payout_type_snapshot, revenue_share_pct_snapshot,
      fixed_rent_snapshot,
      has_negative_adjusted_net,
      created_at, updated_at,
      branches (
        id, name, code,
        partners ( name, is_vat_registered )
      )
    `)
    .order('reporting_year',  { ascending: false })
    .order('reporting_month', { ascending: false })
    .order('created_at',      { ascending: true  })

  const raw = (rawReports as unknown as RawReport[] | null) ?? []

  // Flatten joins into a stable, serialisable shape for the client component
  const reports = raw.map(r => {
    const branch  = Array.isArray(r.branches) ? r.branches[0] : r.branches
    const partner = branch && (Array.isArray(branch.partners) ? branch.partners[0] : branch.partners)
    return {
      id:                          r.id,
      branch_id:                   r.branch_id,
      reporting_month:             r.reporting_month,
      reporting_year:              r.reporting_year,
      status:                      r.status,
      gross_sales:                 Number(r.gross_sales),
      total_net:                   Number(r.total_net),
      total_refunds:               Number(r.total_refunds),
      final_payout:                Number(r.final_payout),
      vat_amount:                  Number(r.vat_amount),
      payout_type_snapshot:        r.payout_type_snapshot ?? 'revenue_share',
      revenue_share_pct_snapshot:  Number(r.revenue_share_pct_snapshot ?? 50),
      fixed_rent_snapshot:         r.fixed_rent_snapshot != null ? Number(r.fixed_rent_snapshot) : null,
      has_negative_adjusted_net:   r.has_negative_adjusted_net ?? false,
      created_at:                  r.created_at,
      updated_at:                  r.updated_at,
      branch_name:                 branch?.name   ?? '—',
      branch_code:                 branch?.code   ?? null,
      partner_name:                partner?.name  ?? '—',
      is_vat_registered:           partner?.is_vat_registered ?? false,
    }
  })

  return (
    <div>
      <AdminHeader
        title="Monthly Reports"
        subtitle={`${reports.length} report${reports.length !== 1 ? 's' : ''} across all branches and periods`}
        actions={
          <Link href="/admin/upload" style={{
            padding: '10px 18px', borderRadius: '10px',
            background: 'linear-gradient(135deg,#C4A35E 0%,#9A7A3A 100%)',
            color: '#080A10', fontSize: '13px', fontWeight: '700',
            textDecoration: 'none', letterSpacing: '0.04em',
          }}>
            ↑ Upload CSV
          </Link>
        }
      />

      {reports.length === 0 ? (
        <EmptyState
          icon="◫"
          title="No reports yet"
          description="Upload a CSV file to generate monthly reports for each branch."
        />
      ) : (
        <ReportsClient reports={reports} />
      )}
    </div>
  )
}
