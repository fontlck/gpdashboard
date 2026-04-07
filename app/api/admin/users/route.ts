import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

// POST /api/admin/users
// Creates a new partner auth user + profile row.
// Body: { username, full_name, partner_id, password, email? }
//
// If email is omitted, a placeholder is generated:
//   {username}@internal.gpdashboard.com
// The partner logs in with username + password only — email is never shown.

export async function POST(req: Request) {
  try {
    // Verify the caller is an admin
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Parse body
    const body = await req.json()
    const { username, full_name, partner_id, password, email: rawEmail } = body

    if (!username || !full_name || !partner_id || !password) {
      return NextResponse.json({ error: 'username, full_name, partner_id, and password are required' }, { status: 400 })
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }

    const cleanUsername = (username as string).trim().toLowerCase().replace(/\s+/g, '_')
    const email = rawEmail?.trim() || `${cleanUsername}@internal.gpdashboard.com`

    const admin = createAdminClient()

    // Check username is not already taken
    const { data: existing } = await admin
      .from('profiles')
      .select('id')
      .eq('username', cleanUsername)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: 'Username already taken' }, { status: 409 })
    }

    // Create auth user (email_confirm: true skips the confirmation email)
    const { data: { user: newUser }, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (createError || !newUser) {
      // If email collision (duplicate placeholder), surface a friendly message
      if (createError?.message?.includes('already registered')) {
        return NextResponse.json({ error: 'A user with this email already exists' }, { status: 409 })
      }
      return NextResponse.json({ error: createError?.message ?? 'Failed to create user' }, { status: 500 })
    }

    // Insert profile row
    const { error: profileError } = await admin
      .from('profiles')
      .insert({
        id:         newUser.id,
        full_name:  (full_name as string).trim(),
        role:       'partner',
        partner_id,
        username:   cleanUsername,
        is_active:  true,
      })

    if (profileError) {
      // Roll back the auth user to avoid orphans
      await admin.auth.admin.deleteUser(newUser.id)
      return NextResponse.json({ error: 'Failed to create profile: ' + profileError.message }, { status: 500 })
    }

    // Audit log
    await admin.from('audit_logs').insert({
      actor_id:    user.id,
      action:      'user_created',
      entity_type: 'profiles',
      entity_id:   newUser.id,
      after_state: { username: cleanUsername, full_name, partner_id, role: 'partner' },
    })

    return NextResponse.json({ id: newUser.id, username: cleanUsername }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
