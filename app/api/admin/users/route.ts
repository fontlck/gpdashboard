import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

// POST /api/admin/users
// Creates a new partner auth user + profile row.
// Body: { username, full_name, partner_id, password, email? }
//
// The DB trigger handle_new_user() auto-creates the profile row from
// raw_user_meta_data on auth.users insert. We then UPDATE to add username.

export async function POST(req: Request) {
  try {
    // Verify the caller is an admin
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: callerProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (callerProfile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Parse body
    const body = await req.json()
    const { username, full_name, partner_id, password, email: rawEmail, role: rawRole } = body

    const role = rawRole === 'admin' ? 'admin' : 'partner'

    if (!username || !full_name || !password) {
      return NextResponse.json(
        { error: 'username, full_name, and password are required' },
        { status: 400 }
      )
    }

    // Partner is required for partner-role users
    if (role === 'partner' && !partner_id) {
      return NextResponse.json(
        { error: 'Please select a partner.' },
        { status: 400 }
      )
    }
    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }

    const cleanUsername = (username as string).trim().toLowerCase().replace(/\s+/g, '_')
    const email = rawEmail?.trim() || `${cleanUsername}@internal.gpdashboard.com`

    const admin = createAdminClient()

    // Check username not already taken
    const { data: existing } = await admin
      .from('profiles')
      .select('id')
      .eq('username', cleanUsername)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: 'Username already taken' }, { status: 409 })
    }

    // Create auth user — pass metadata so the handle_new_user() trigger can
    // populate the profile row correctly (it reads raw_user_meta_data).
    const { data: { user: newUser }, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: (full_name as string).trim(),
        role,
        partner_id: partner_id || null,
      },
    })

    if (createError || !newUser) {
      if (createError?.message?.includes('already registered')) {
        return NextResponse.json({ error: 'A user with this email already exists' }, { status: 409 })
      }
      return NextResponse.json(
        { error: createError?.message ?? 'Failed to create user' },
        { status: 500 }
      )
    }

    // The trigger already created the profile — just UPDATE to set username.
    const { error: updateError } = await admin
      .from('profiles')
      .update({ username: cleanUsername })
      .eq('id', newUser.id)

    if (updateError) {
      // Roll back the auth user to avoid orphans
      await admin.auth.admin.deleteUser(newUser.id)
      return NextResponse.json(
        { error: 'Failed to set username: ' + updateError.message },
        { status: 500 }
      )
    }

    // Audit log
    await admin.from('audit_logs').insert({
      actor_id:    user.id,
      action:      'user_created',
      entity_type: 'profiles',
      entity_id:   newUser.id,
      after_state: { username: cleanUsername, full_name, partner_id: partner_id || null, role },
    })

    return NextResponse.json({ id: newUser.id, username: cleanUsername }, { status: 201 })
  } catch (err) {
    console.error('POST /api/admin/users error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
