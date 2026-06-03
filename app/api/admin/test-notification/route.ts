import { NextRequest, NextResponse } from 'next/server'
import { createClient }   from '@/lib/supabase/server'
import { sendTestEmail }  from '@/lib/notify'
import { sendLineNotify } from '@/lib/notify'

// POST /api/admin/test-notification
// Body: { type: 'email' | 'line', to?: string, token?: string }
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json() as { type?: string; to?: string; token?: string }
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://gpdashboard.flashyourmeme.com'

  if (body.type === 'email') {
    if (!body.to?.trim())
      return NextResponse.json({ error: 'Missing email address' }, { status: 400 })

    const result = await sendTestEmail(body.to.trim(), appUrl)
    if (!result.ok)
      return NextResponse.json({ error: result.error }, { status: 500 })

    return NextResponse.json({ success: true, message: `Test email sent to ${body.to}` })
  }

  if (body.type === 'line') {
    if (!body.token?.trim())
      return NextResponse.json({ error: 'Missing Line Notify token' }, { status: 400 })

    const result = await sendLineNotify(
      body.token.trim(),
      '\n[GP Dashboard] Test notification\nรายงาน May 2025 (Test Branch) ได้รับการอนุมัติแล้ว\nยอด: ฿45,000.00',
    )
    if (!result.ok)
      return NextResponse.json({ error: result.error }, { status: 500 })

    return NextResponse.json({ success: true, message: 'Line Notify test sent' })
  }

  return NextResponse.json({ error: 'type must be "email" or "line"' }, { status: 400 })
}
