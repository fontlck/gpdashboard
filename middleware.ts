import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

type CookieToSet = { name: string; value: string; options?: Record<string, unknown> }

/**
 * Route guard:
 *  - Unauthenticated → /login
 *  - Admin  visiting /dashboard/** → /admin
 *  - Partner visiting /admin/**   → /dashboard
 *  - Logged-in visiting /login    → respective dashboard
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
  const isLoginPage   = pathname === '/login'
  const isAdminRoute  = pathname.startsWith('/admin')
  const isPartnerRoute = pathname.startsWith('/dashboard')
  const isAuthCallback = pathname.startsWith('/auth')
  const isRoot        = pathname === '/'

  // Always allow auth callback
  if (isAuthCallback) return supabaseResponse

  // ── Not authenticated ────────────────────────────────────────
  if (!user) {
    if (isLoginPage) return supabaseResponse
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // ── Authenticated: fetch role ────────────────────────────────
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = profile?.role ?? 'partner'

  // Redirect away from login
  if (isLoginPage || isRoot) {
    const url = request.nextUrl.clone()
    url.pathname = role === 'admin' ? '/admin' : '/dashboard'
    return NextResponse.redirect(url)
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
    /*
     * Run on all paths EXCEPT:
     * - _next/static (static files)
     * - _next/image  (image optimisation)
     * - favicon.ico
     * - public assets
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
