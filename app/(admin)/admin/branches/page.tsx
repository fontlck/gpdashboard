import { createAdminClient } from '@/lib/supabase/admin'
import { AdminHeader } from '@/components/admin/AdminHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { BranchesClient } from '@/components/admin/BranchesClient'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Branches' }
export const dynamic = 'force-dynamic'

export default async function AdminBranchesPage() {
  const admin = createAdminClient()

  const { data: rawBranches } = await admin
    .from('branches')
    .select(`
      id, name, code, payout_type, revenue_share_pct,
      fixed_rent_amount, fixed_rent_vat_mode,
      is_active, partner_id,
      partners ( id, name, is_vat_registered )
    `)
    .order('name', { ascending: true })

  const branches = (rawBranches as unknown as Parameters<typeof BranchesClient>[0]['initialBranches']) ?? []

  return (
    <div>
      <AdminHeader
        title="Branches"
        subtitle="All branch locations and their payout settings"
      />

      {branches.length === 0 ? (
        <EmptyState
          icon="⑂"
          title="No branches yet"
          description="Add your first branch to start importing reports."
        />
      ) : (
        <BranchesClient initialBranches={branches} />
      )}
    </div>
  )
}
