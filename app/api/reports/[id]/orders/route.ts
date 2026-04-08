import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// ── GET /api/reports/[id]/orders ───────────────────────────────────────────────
// Returns paginated report_rows for a report.
// Accessible by: admin (any report), partner (own reports only).
// Returns `link` extracted from raw_data["link (metadata)"].

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  // ── Auth ──────────────────────────────────────────────────────────────────
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, partner_id')
    .eq('id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // ── Ownership check for partners ──────────────────────────────────────────
  if (profile.role === 'partner') {
    const { data: report } = await supabase
      .from('monthly_reports')
      .select('branches(partner_id)')
      .eq('id', id)
      .single()

    const branch = report?.branches as { partner_id: string } | { partner_id: string }[] | null
    const partnerId = Array.isArray(branch) ? branch[0]?.partner_id : branch?.partner_id
    if (partnerId !== profile.partner_id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // Partners can only see approved/paid reports
    const { data: statusCheck } = await supabase
      .from('monthly_reports')
      .select('status')
      .eq('id', id)
      .single()
    if (!statusCheck || !['approved', 'paid'].includes(statusCheck.status)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
  } else if (profile.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // ── Pagination params ─────────────────────────────────────────────────────
  const url    = new URL(req.url)
  const page   = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10))
  const limit  = Math.min(100, Math.max(10, parseInt(url.searchParams.get('limit') ?? '50', 10)))
  const offset = (page - 1) * limit

  // ── Fetch rows ────────────────────────────────────────────────────────────
  const { data: rows, error, count } = await supabase
    .from('report_rows')
    .select(
      'id, row_number, charge_id, transaction_date, amount, net, opn_fee, payment_source, branch_name_raw, artist_name_raw, raw_data',
      { count: 'exact' }
    )
    .eq('monthly_report_id', id)
    .order('transaction_date', { ascending: true })
    .range(offset, offset + limit - 1)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // ── Extract link (metadata) from raw_data ─────────────────────────────────
  type RawData = Record<string, unknown>
  const orders = (rows ?? []).map(r => {
    const raw = (r.raw_data as RawData) ?? {}
    const link = (raw['link (metadata)'] as string | undefined)?.trim() || null
    return {
      id:              r.id,
      row_number:      r.row_number,
      charge_id:       r.charge_id,
      transaction_date: r.transaction_date,
      amount:          Number(r.amount),
      net:             Number(r.net),
      opn_fee:         Number(r.opn_fee),
      payment_source:  r.payment_source ?? null,
      branch_name:     r.branch_name_raw ?? null,
      artist_name:     r.artist_name_raw ?? null,
      link,
    }
  })

  return NextResponse.json({
    orders,
    pagination: {
      page,
      limit,
      total:       count ?? 0,
      total_pages: Math.ceil((count ?? 0) / limit),
    },
  })
}
