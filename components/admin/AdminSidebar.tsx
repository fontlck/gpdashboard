'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

// ── Design tokens ─────────────────────────────────────────────────────────────
const T = {
  bg:       '#06080F',
  border:   'rgba(255,255,255,0.07)',
  accent:   '#3B82F6',
  accentBg: 'rgba(59,130,246,0.08)',
  text:     '#F1F5F9',
  muted:    'rgba(241,245,249,0.45)',
  hover:    'rgba(255,255,255,0.04)',
}

type NavItem = { href: string; label: string; dividerBefore?: boolean }
const NAV: NavItem[] = [
  { href: '/admin',          label: 'Overview'   },
  { href: '/admin/reports',  label: 'Reports'    },
  { href: '/admin/upload',   label: 'Upload CSV' },
  { href: '/admin/refunds',  label: 'Refunds'    },
  { href: '/admin/branches', label: 'Branches',  dividerBefore: true },
  { href: '/admin/partners', label: 'Partners'   },
  { href: '/admin/artists',  label: 'Artists'    },
  { href: '/admin/users',    label: 'Users'      },
  { href: '/admin/audit',    label: 'Audit Log', dividerBefore: true },
  { href: '/admin/settings', label: 'Settings'   },
]

export function AdminSidebar() {
  const pathname    = usePathname()
  const router      = useRouter()
  const [open, setOpen] = useState(false)

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  function close() { setOpen(false) }

  return (
    <>
      {/* ── Mobile top bar ───────────────────────────────────────── */}
      <div className="mobile-topbar">
        <button
          onClick={() => setOpen(o => !o)}
          aria-label="Open menu"
          style={{
            display: 'flex', flexDirection: 'column', gap: '5px',
            background: 'none', border: 'none', cursor: 'pointer',
            padding: '6px', borderRadius: '8px',
            color: T.text, flexShrink: 0,
          }}
        >
          <span style={{ display: 'block', width: '20px', height: '2px', background: 'currentColor', borderRadius: '1px' }} />
          <span style={{ display: 'block', width: '14px', height: '2px', background: 'currentColor', borderRadius: '1px' }} />
          <span style={{ display: 'block', width: '18px', height: '2px', background: 'currentColor', borderRadius: '1px' }} />
        </button>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo-fym.svg"
          alt="FlashYourMeme"
          style={{ height: '22px', width: 'auto', filter: 'brightness(0) invert(1)' }}
        />
        <span style={{ fontSize: '12px', fontWeight: 700, color: T.text, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          Admin
        </span>
      </div>

      {/* ── Mobile overlay ───────────────────────────────────────── */}
      {open && (
        <div className="sidebar-overlay" onClick={close} />
      )}

      {/* ── Sidebar ──────────────────────────────────────────────── */}
      <aside
        className={`sidebar-aside${open ? ' sidebar--open' : ''}`}
        style={{
          background:  T.bg,
          borderRight: `1px solid ${T.border}`,
        }}
      >
        {/* Logo */}
        <div style={{ padding: '16px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-fym.svg"
            alt="FlashYourMeme"
            style={{ height: '28px', width: 'auto', filter: 'brightness(0) invert(1)', flexShrink: 0 }}
          />
          <div>
            <div style={{ fontSize: '11px', fontWeight: '700', color: T.text, letterSpacing: '0.05em', textTransform: 'uppercase', lineHeight: 1.2 }}>
              FlashYourMeme
            </div>
            <div style={{ fontSize: '10px', color: T.accent, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.7, marginTop: '2px' }}>
              Admin
            </div>
          </div>

          {/* Close button — mobile only */}
          <button
            onClick={close}
            aria-label="Close menu"
            style={{
              marginLeft: 'auto', background: 'none', border: 'none',
              cursor: 'pointer', color: T.muted, fontSize: '18px',
              padding: '4px', lineHeight: 1,
              display: 'none', // shown via CSS on mobile
            }}
            className="sidebar-close-btn"
          >
            ✕
          </button>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '8px', display: 'flex', flexDirection: 'column', gap: '1px', overflowY: 'auto' }}>
          {NAV.map(item => {
            const active = item.href === '/admin'
              ? pathname === '/admin'
              : pathname.startsWith(item.href)

            return (
              <div key={item.href}>
                {item.dividerBefore && (
                  <div style={{ height: '1px', background: T.border, margin: '6px 0' }} />
                )}
                <Link
                  href={item.href}
                  onClick={close}
                  style={{
                    display: 'flex', alignItems: 'center',
                    height: '36px', padding: '0 12px',
                    borderRadius: '8px', fontSize: '13px',
                    fontWeight: active ? '600' : '400',
                    color: active ? T.text : T.muted,
                    background: active ? T.accentBg : 'transparent',
                    textDecoration: 'none', transition: 'background 0.12s, color 0.12s',
                    borderLeft: active ? `2px solid ${T.accent}` : '2px solid transparent',
                    marginLeft: '-2px',
                  }}
                  onMouseEnter={e => { if (!active) { e.currentTarget.style.background = T.hover; e.currentTarget.style.color = T.text } }}
                  onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = T.muted } }}
                >
                  {item.label}
                </Link>
              </div>
            )
          })}
        </nav>

        {/* Sign out */}
        <div style={{ padding: '8px', borderTop: `1px solid ${T.border}` }}>
          <button onClick={handleSignOut} style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: '8px',
            height: '36px', padding: '0 12px', borderRadius: '8px',
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: 'rgba(241,245,249,0.3)', fontSize: '13px', textAlign: 'left',
            transition: 'color 0.12s, background 0.12s',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = '#F87171'; e.currentTarget.style.background = 'rgba(239,68,68,0.06)' }}
          onMouseLeave={e => { e.currentTarget.style.color = 'rgba(241,245,249,0.3)'; e.currentTarget.style.background = 'transparent' }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Sign out
          </button>
        </div>
      </aside>
    </>
  )
}
