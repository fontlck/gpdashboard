import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const BUCKET = 'report-documents'

// ── GET /api/reports/[id]/document-url?type=slip|wht ─────────────────────────
// Returns a short-lived signed URL for downloading a report document.
// Accessible by admin (any) or partner (own approved/paid reports).

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const type = new URL(req.url).searchParams.get('type')
  if (!['slip', 'wht'].includes(type ?? '')) {
    return NextResponse.json({ error: 'Invalid type. Use slip or wht' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role, partner_id').eq('id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // ── Ownership + status check for partners ─────────────────────────────────
  if (profile.role === 'partner') {
    const { data: report } = await supabase
      .from('monthly_reports')
      .select('status, branches(partner_id)')
      .eq('id', id)
      .single()

    if (!report || !['approved', 'paid'].includes(report.status)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    const branch = report.branches as { partner_id: string } | { partner_id: string }[] | null
    const partnerId = Array.isArray(branch) ? branch[0]?.partner_id : branch?.partner_id
    if (partnerId !== profile.partner_id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
  } else if (profile.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // ── Fetch the stored path ──────────────────────────────────────────────────
  const col = type === 'slip' ? 'payment_slip_path' : 'wht_cert_path'
  const { data: row } = await supabase
    .from('monthly_reports')
    .select(`${col}, payment_slip_name, wht_cert_name`)
    .eq('id', id)
    .single()

  const path = (row as Record<string, unknown> | null)?.[col] as string | null
  if (!path) return NextResponse.json({ error: 'No document uploaded' }, { status: 404 })

  // ── Generate signed URL (valid 60 minutes) ────────────────────────────────
  const { data: signed, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 3600)

  if (error || !signed?.signedUrl) {
    return NextResponse.json({ error: 'Could not generate download URL' }, { status: 500 })
  }

  const fileName = type === 'slip'
    ? ((row as Record<string, unknown>)?.payment_slip_name as string ?? 'payment-slip')
    : ((row as Record<string, unknown>)?.wht_cert_name     as string ?? 'wht-certificate')

  return NextResponse.json({ url: signed.signedUrl, name: fileName })
}
