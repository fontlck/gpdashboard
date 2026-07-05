import { createAdminClient } from '@/lib/supabase/admin'
import { requireOrgId } from '@/lib/org'
import { AdminHeader } from '@/components/admin/AdminHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { BranchesClient } from '@/components/admin/BranchesClient'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Branches' }
export const dynamic = 'force-dynamic'

export default async function AdminBranchesPage() {
  const admin = createAdminClient()
  const orgId = await requireOrgId()

  const { data: rawBranches } = await admin
    .from('branches')
    .select(`
      id, name, code, payout_type, revenue_share_pct,
      fixed_rent_amount, fixed_rent_vat_mode,
      is_active, partner_id,
      notification_email, line_notify_token,
      partners (
        id, name, is_vat_registered, vat_number,
        contact_email, contact_phone,
        bank_name, bank_account_name, bank_account_number,
        doc_pp20_name, doc_id_card_name, doc_bookbank_name
      )
    `)
    .eq('organization_id', orgId)
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
