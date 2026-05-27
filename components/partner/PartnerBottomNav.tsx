'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function IconHome() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  )
}

function IconAccount() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  )
}

function IconSignOut() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
      <polyline points="16 17 21 12 16 7"/>
      <line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  )
}

export function PartnerBottomNav() {
  const pathname = usePathname()
  const router   = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const tabs = [
    {
      href:   '/dashboard',
      label:  'Overview',
      icon:   <IconHome />,
      active: pathname === '/dashboard',
    },
    {
      href:   '/dashboard/account',
      label:  'Account',
      icon:   <IconAccount />,
      active: pathname.startsWith('/dashboard/account'),
    },
  ]

  return (
    <nav className="bottom-nav">
      {tabs.map(tab => (
        <Link
          key={tab.href}
          href={tab.href}
          className={`bottom-nav-item${tab.active ? ' bottom-nav-item--active' : ''}`}
        >
          <span className="bottom-nav-icon">{tab.icon}</span>
          <span className="bottom-nav-label">{tab.label}</span>
        </Link>
      ))}

      <button onClick={handleSignOut} className="bottom-nav-item bottom-nav-item--danger">
        <span className="bottom-nav-icon"><IconSignOut /></span>
        <span className="bottom-nav-label">Sign out</span>
      </button>
    </nav>
  )
}
