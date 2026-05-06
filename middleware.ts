import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { ORG_COOKIE } from '@/lib/org'

type CookieToSet = { name: string; value: string; options?: Record<string, unknown> }

/**
 * Route guard:
 *  - Unauthenticated            → /login
 *  - Authenticated, no org set  → /org-select  (pick which dashboard to use)
 *  - Admin  visiting /dashboard/** → /admin
 *  - Partner visiting /admin/**    → /dashboard
 *  - Logged-in visiting /login     → respective dashboard
 */
export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: ()                => request.cookies.getAll(),
        setAll: (cookiesToSet: CookieToSet[]) => {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options as Parameters<typeof supabaseResponse.cookies.set>[2])
          )
        },
      },
    }
  )

  // Refresh session — MUST be called before any redirect logic
  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  const isLoginPage    = pathname === '/login'
  const isOrgSelect    = pathname === '/org-select'
  const isAdminRoute   = pathname.startsWith('/admin')
  const isPartnerRoute = pathname.startsWith('/dashboard')
  const isAuthCallback = pathname.startsWith('/auth')
  const isRoot         = pathname === '/'

  const isPublicAuthPage = pathname === '/forgot-password' || pathname === '/reset-password'
  const isPublicApi      = pathname.startsWith('/api/auth/')

  if (isAuthCallback || isPublicAuthPage || isPublicApi) return supabaseResponse

  // ── Not authenticated ────────────────────────────────────────────────────────
  if (!user) {
    if (isLoginPage) return supabaseResponse
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // ── Authenticated: fetch role ────────────────────────────────────────────────
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = profile?.role ?? 'partner'

  // Redirect away from login / root
  if (isLoginPage || isRoot) {
    const url = request.nextUrl.clone()
    url.pathname = role === 'admin' ? '/admin' : '/dashboard'
    return NextResponse.redirect(url)
  }

  // ── Org selection ────────────────────────────────────────────────────────────
  // If user is on a protected page but has no org cookie, check how many orgs
  // they belong to. If >1, send them to org-select. If exactly 1, auto-set it.
  const orgCookie = request.cookies.get(ORG_COOKIE)?.value

  if (!orgCookie && !isOrgSelect && (isAdminRoute || isPartnerRoute)) {
    // Fetch orgs for this user
    const { data: memberships } = await supabase
      .from('org_memberships')
      .select('organization_id')
      .eq('user_id', user.id)
      .eq('is_active', true)

    const orgs = memberships ?? []

    if (orgs.length === 0) {
      // No org assigned — show error at org-select
      const url = request.nextUrl.clone()
      url.pathname = '/org-select'
      return NextResponse.redirect(url)
    }

    if (orgs.length === 1) {
      // Auto-select the only org — set cookie and continue
      supabaseResponse.cookies.set(ORG_COOKIE, orgs[0].organization_id, {
        path: '/', httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 30, // 30 days
      })
    } else {
      // Multiple orgs — let user pick
      const url = request.nextUrl.clone()
      url.pathname = '/org-select'
      return NextResponse.redirect(url)
    }
  }

  // Guard: partner cannot access admin routes
  if (isAdminRoute && role !== 'admin') {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  // Guard: admin is redirected away from partner routes
  if (isPartnerRoute && role !== 'partner') {
    const url = request.nextUrl.clone()
    url.pathname = '/admin'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
