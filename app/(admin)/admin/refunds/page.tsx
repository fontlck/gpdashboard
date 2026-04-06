import { createAdminClient } from '@/lib/supabase/admin'
import { RefundPageClient } from '@/components/admin/RefundPageClient'
import type { BranchOption, RefundRow } from '@/components/admin/RefundPageClient'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Refunds' }
export const dynamic = 'force-dynamic'

// ── Join shapes from Supabase ─────────────────────────────────────────────────

type BranchJoin = { name: string } | null
type ReportJoin = {
  id: string
  status: string
} | null

type RawRefundRow = {
  id: string
  amount: number | string
  reason: string
  reference_number: string | null
  created_at: string
  branch_id: string
  reporting_month: number
  reporting_year: number
  monthly_report_id: string | null
  branches: BranchJoin | BranchJoin[]
  monthly_reports: ReportJoin | ReportJoin[]
}

export default async function AdminRefundsPage() {
  const admin = createAdminClient()

  const [branchesRes, refundsRes] = await Promise.all([
    admin
      .from('branches')
      .select('id, name')
      .order('name'),

    admin
      .from('refunds')
      .select(`
        id, amount, reason, reference_number, created_at,
        branch_id, reporting_month, reporting_year, monthly_report_id,
        branches ( name ),
        monthly_reports ( id, status )
      `)
      .order('created_at', { ascending: false }),
  ])

  // ── Branches for form selector ────────────────────────────────────────────
  const branches: BranchOption[] = (branchesRes.data ?? []).map(b => ({
    id:   b.id,
    name: b.name,
  }))

  // ── Flatten refund rows for client component ──────────────────────────────
  const raw = (refundsRes.data as unknown as RawRefundRow[] | null) ?? []

  const refunds: RefundRow[] = raw.map(r => {
    const branch = Array.isArray(r.branches) ? r.branches[0] : r.branches
    const report = Array.isArray(r.monthly_reports) ? r.monthly_reports[0] : r.monthly_reports

    return {
      id:                r.id,
      amount:            Number(r.amount),
      reason:            r.reason,
      reference_number:  r.reference_number,
      created_at:        r.created_at,
      branch_id:         r.branch_id,
      reporting_month:   r.reporting_month,
      reporting_year:    r.reporting_year,
      monthly_report_id: r.monthly_report_id,
      // joined
      branch_name:   branch?.name ?? '—',
      report_status: report?.status ?? null,
      report_id:     report?.id ?? null,
    }
  })

  return (
    <div>
      <RefundPageClient branches={branches} refunds={refunds} />
    </div>
  )
}
