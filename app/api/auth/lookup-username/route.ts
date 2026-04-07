import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// POST /api/auth/lookup-username
// Body: { username: string }
// Returns: { email: string } or 404
//
// Used by the login page to resolve a username → email before calling
// supabase.auth.signInWithPassword. Never exposes passwords or tokens.

export async function POST(req: Request) {
  try {
    const { username } = await req.json()

    if (!username || typeof username !== 'string') {
      return NextResponse.json({ error: 'username required' }, { status: 400 })
    }

    const admin = createAdminClient()

    // Look up the profile by username to get the auth user id
    const { data: profile, error } = await admin
      .from('profiles')
      .select('id')
      .eq('username', username.trim().toLowerCase())
      .single()

    if (error || !profile) {
      // Return generic error — don't reveal whether username exists
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 404 })
    }

    // Fetch the email from auth.users via admin API
    const { data: { user }, error: authError } = await admin.auth.admin.getUserById(profile.id)

    if (authError || !user?.email) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 404 })
    }

    return NextResponse.json({ email: user.email })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
