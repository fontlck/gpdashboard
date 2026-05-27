import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { AdminSidebar } from '@/components/admin/AdminSidebar'
import { AdminBottomNav } from '@/components/admin/AdminBottomNav'
import { SidebarProvider } from '@/components/admin/SidebarContext'
import { OrgSwitcher } from '@/components/admin/OrgSwitcher'
import { getCurrentOrgId, getUserOrgs } from '@/lib/org'
import type { ReactNode } from 'react'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: { default: 'Admin', template: '%s | Admin — GP Dashboard' } }

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') redirect('/dashboard')

  // Load org info for the switcher
  const [currentOrgId, orgs] = await Promise.all([
    getCurrentOrgId(),
    getUserOrgs(),
  ])

  // Resolve current org name
  const currentOrg = orgs.find(o => o.id === currentOrgId)

  return (
    <SidebarProvider>
      <div className="app-shell" style={{ background: '#06080F' }}>
        <AdminSidebar />
        <main className="admin-main">
          {orgs.length > 1 && (
            <OrgSwitcher
              orgs={orgs}
              currentOrgId={currentOrgId ?? ''}
              currentOrgName={currentOrg?.name ?? 'Unknown'}
            />
          )}
          {children}
        </main>
      </div>
      <AdminBottomNav />
    </SidebarProvider>
  )
}
