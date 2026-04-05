import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Server-side Supabase client.
 * Use in Server Components, Route Handlers, and Server Actions.
 * Reads the session from the request cookies (anon key — respects RLS).
 *
 * Note: Database generic is omitted intentionally — Supabase's conditional
 * Pick types over a Database type with Json fields exhaust TypeScript's
 * instantiation depth limit in Next.js 15 / TS 5.x, collapsing all query
 * results to `never`. Explicit row types + `as unknown as T` casts are used
 * at call sites instead.
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: ()              => cookieStore.getAll(),
        setAll: (cookiesToSet)  => {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // setAll is called from Server Components where cookies
            // are read-only — safe to ignore if session refresh is
            // handled in middleware.
          }
        },
      },
    }
  )
}
