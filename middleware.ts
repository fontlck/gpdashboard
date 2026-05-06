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
  // Fetch all active orgs for this user
  const orgCookie = request.cookies.get(ORG_COOKIE)?.value

  if (!isOrgSelect && (isAdminRoute || isPartnerRoute)) {
    const { data: memberships } = await supabase
      .from('org_memberships')
      .select('organization_id')
      .eq('user_id', user.id)
      .eq('is_active', true)

    const orgs = memberships ?? []
    const validOrgIds = orgs.map(m => m.organization_id)

    // Check if current cookie points to an org the user actually belongs to
    const cookieIsValid = orgCookie && validOrgIds.includes(orgCookie)

    if (!cookieIsValid) {
      if (orgs.length === 0) {
        // No org — redirect to org-select to show error
        const url = request.nextUrl.clone()
        url.pathname = '/org-select'
        const res = NextResponse.redirect(url)
        res.cookies.delete(ORG_COOKIE)
        return res
      }

      if (orgs.length === 1) {
        // Auto-select the only org — redirect so the page sees the new cookie
        const url = request.nextUrl.clone()
        const res = NextResponse.redirect(url)
        res.cookies.set(ORG_COOKIE, orgs[0].organization_id, {
          path: '/', httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 30,
        })
        return res
      } else {
        // Multiple orgs — let user pick
        const url = request.nextUrl.clone()
        url.pathname = '/org-select'
        const res = NextResponse.redirect(url)
        res.cookies.delete(ORG_COOKIE)
        return res
      }
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
