import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

// ─── PATCH /api/admin/users/[id] ──────────────────────────────────────────────
// Body: { full_name?, username?, partner_id?, role?, is_active?, password? }
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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

    const { id: targetId } = await params
    const body = await req.json()
    const { full_name, username, partner_id, role, is_active, password } = body

    const admin = createAdminClient()

    // ── Build profile update ──────────────────────────────────────────────────
    const profileUpdate: Record<string, unknown> = {}
    if (full_name  !== undefined) profileUpdate.full_name  = (full_name as string).trim()
    if (partner_id !== undefined) profileUpdate.partner_id = partner_id || null
    if (role       !== undefined) profileUpdate.role       = role
    if (is_active  !== undefined) profileUpdate.is_active  = is_active

    if (username !== undefined) {
      const clean = (username as string).trim().toLowerCase().replace(/\s+/g, '_')
      const { data: taken } = await admin
        .from('profiles')
        .select('id')
        .eq('username', clean)
        .neq('id', targetId)
        .maybeSingle()
      if (taken) return NextResponse.json({ error: 'Username already taken' }, { status: 409 })
      profileUpdate.username = clean
    }

    if (Object.keys(profileUpdate).length > 0) {
      const { error: profileErr } = await admin
        .from('profiles')
        .update(profileUpdate)
        .eq('id', targetId)
      if (profileErr) return NextResponse.json({ error: profileErr.message }, { status: 500 })
    }

    // ── Update auth user (password / role) ───────────────────────────────────
    const authUpdate: Record<string, unknown> = {}
    if (password) {
      if ((password as string).length < 8) {
        return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
      }
      authUpdate.password = password
    }
    if (role !== undefined) {
      authUpdate.user_metadata = { role }
    }

    if (Object.keys(authUpdate).length > 0) {
      const { error: authErr } = await admin.auth.admin.updateUserById(targetId, authUpdate)
      if (authErr) return NextResponse.json({ error: authErr.message }, { status: 500 })
    }

    // ── Audit log ─────────────────────────────────────────────────────────────
    await admin.from('audit_logs').insert({
      actor_id:    user.id,
      action:      'user_updated',
      entity_type: 'profiles',
      entity_id:   targetId,
      after_state: profileUpdate,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('PATCH /api/admin/users/[id]:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// ─── DELETE /api/admin/users/[id] ─────────────────────────────────────────────
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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

    const { id: targetId } = await params

    // Prevent self-deletion
    if (targetId === user.id) {
      return NextResponse.json({ error: 'You cannot delete your own account' }, { status: 400 })
    }

    const admin = createAdminClient()

    // Deleting the auth user cascades to profiles via ON DELETE CASCADE
    const { error } = await admin.auth.admin.deleteUser(targetId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Audit log
    await admin.from('audit_logs').insert({
      actor_id:    user.id,
      action:      'user_deleted',
      entity_type: 'profiles',
      entity_id:   targetId,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('DELETE /api/admin/users/[id]:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
