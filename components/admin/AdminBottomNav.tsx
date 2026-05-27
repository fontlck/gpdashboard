'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSidebar } from './SidebarContext'

type Tab = {
  href?: string
  label: string
  icon: React.ReactNode
  match?: (p: string) => boolean
  action?: 'menu'
}

function IconHome() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  )
}

function IconReports() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
      <polyline points="10 9 9 9 8 9"/>
    </svg>
  )
}

function IconBranches() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2"/>
      <path d="M8 21h8M12 17v4"/>
    </svg>
  )
}

function IconMenu() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="5" cy="5" r="1.5" fill="currentColor" stroke="none"/>
      <circle cx="12" cy="5" r="1.5" fill="currentColor" stroke="none"/>
      <circle cx="19" cy="5" r="1.5" fill="currentColor" stroke="none"/>
      <circle cx="5" cy="12" r="1.5" fill="currentColor" stroke="none"/>
      <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/>
      <circle cx="19" cy="12" r="1.5" fill="currentColor" stroke="none"/>
      <circle cx="5" cy="19" r="1.5" fill="currentColor" stroke="none"/>
      <circle cx="12" cy="19" r="1.5" fill="currentColor" stroke="none"/>
      <circle cx="19" cy="19" r="1.5" fill="currentColor" stroke="none"/>
    </svg>
  )
}

const TABS: Tab[] = [
  {
    href:  '/admin',
    label: 'Overview',
    icon:  <IconHome />,
    match: p => p === '/admin',
  },
  {
    href:  '/admin/reports',
    label: 'Reports',
    icon:  <IconReports />,
    match: p => p.startsWith('/admin/reports'),
  },
  {
    href:  '/admin/branches',
    label: 'Branches',
    icon:  <IconBranches />,
    match: p => p.startsWith('/admin/branches'),
  },
  {
    label:  'Menu',
    icon:   <IconMenu />,
    action: 'menu',
  },
]

export function AdminBottomNav() {
  const pathname = usePathname()
  const { toggle } = useSidebar()

  return (
    <nav className="bottom-nav">
      {TABS.map(tab => {
        const active = tab.match ? tab.match(pathname) : false

        if (tab.action === 'menu') {
          return (
            <button key="menu" onClick={toggle} className={`bottom-nav-item${active ? ' bottom-nav-item--active' : ''}`}>
              <span className="bottom-nav-icon">{tab.icon}</span>
              <span className="bottom-nav-label">{tab.label}</span>
            </button>
          )
        }

        return (
          <Link key={tab.href} href={tab.href!} className={`bottom-nav-item${active ? ' bottom-nav-item--active' : ''}`}>
            <span className="bottom-nav-icon">{tab.icon}</span>
            <span className="bottom-nav-label">{tab.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
