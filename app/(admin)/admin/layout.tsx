import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AdminSidebar } from '@/components/admin/AdminSidebar'
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

  return (
    <div style={{ display: 'flex', minHeight: '100dvh', background: '#080A10' }}>
      <AdminSidebar />
      <main style={{
        flex:     1,
        padding:  '32px 36px',
        overflowY:'auto',
        minWidth: 0,
      }}>
        {children}
      </main>
    </div>
  )
}
