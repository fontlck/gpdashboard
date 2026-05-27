import { createClient } from '@/lib/supabase/server'
import { getCurrentOrgId } from '@/lib/org'
import { AdminBottomNav } from './AdminBottomNav'

export async function AdminBottomNavServer() {
  try {
    const supabase = await createClient()
    const orgId    = await getCurrentOrgId()

    let pendingCount = 0
    if (orgId) {
      const { count } = await supabase
        .from('monthly_reports')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .eq('status', 'pending_review')

      pendingCount = count ?? 0
    }

    return <AdminBottomNav pendingCount={pendingCount} />
  } catch {
    return <AdminBottomNav />
  }
}
