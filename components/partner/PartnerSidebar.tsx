'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const NAV_ITEMS = [
  { href: '/dashboard',         label: 'Overview',  icon: '▦' },
  { href: '/dashboard/reports', label: 'Reports',   icon: '◫' },
  { href: '/dashboard/account', label: 'Account',   icon: '○' },
] as const

export function PartnerSidebar() {
  const pathname = usePathname()
  const router   = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <aside style={{
      width:        '200px',
      minWidth:     '200px',
      height:       '100dvh',
      position:     'sticky',
      top:          0,
      display:      'flex',
      flexDirection:'column',
      background:   '#0D0F1A',
      borderRight:  '1px solid rgba(255,255,255,0.06)',
      zIndex:       40,
    }}>
      {/* Wordmark */}
      <div style={{ padding: '24px 20px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '30px', height: '30px', borderRadius: '8px',
            background: 'linear-gradient(135deg,#C4A35E 0%,#8B6A2E 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '13px', fontWeight: '800', color: '#080A10',
          }}>G</div>
          <div>
            <div style={{ fontSize: '14px', fontWeight: '700', color: '#F0ECE4', letterSpacing: '-0.01em' }}>
              GP Dashboard
            </div>
            <div style={{ fontSize: '10px', color: '#C4A35E', letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.8 }}>
              Partner Portal
            </div>
          </div>
        </div>
      </div>

      <nav style={{ flex: 1, padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {NAV_ITEMS.map(item => {
          const isActive = item.href === '/dashboard'
            ? pathname === '/dashboard'
            : pathname.startsWith(item.href)

          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display:     'flex',
                alignItems:  'center',
                gap:         '10px',
                padding:     '9px 12px',
                borderRadius:'10px',
                fontSize:    '13px',
                fontWeight:  isActive ? '600' : '400',
                color:       isActive ? '#F0ECE4' : 'rgba(240,236,228,0.5)',
                background:  isActive ? 'rgba(255,255,255,0.06)' : 'transparent',
                textDecoration: 'none',
                transition:  'all 0.15s',
                borderLeft:  isActive ? '2px solid rgba(196,163,94,0.6)' : '2px solid transparent',
              }}
            >
              <span style={{ fontSize: '14px', opacity: 0.8 }}>{item.icon}</span>
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div style={{ padding: '12px 10px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <button
          onClick={handleSignOut}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
            padding: '9px 12px', borderRadius: '10px',
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: 'rgba(240,236,228,0.35)', fontSize: '13px',
            transition: 'color 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = '#EF4444')}
          onMouseLeave={e => (e.currentTarget.style.color = 'rgba(240,236,228,0.35)')}
        >
          <span>→</span> Sign out
        </button>
      </div>
    </aside>
  )
}
