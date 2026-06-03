import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient }      from '@/lib/supabase/server'
import { notifyReport }      from '@/lib/notify'
import { formatTHB }         from '@/lib/utils/currency'

// POST /api/admin/reports/[id]/send-notification
// Manually sends email/line notification for approved or paid report.

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: reportId } = await params

  // Auth: admin only
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()

  // Fetch report
  const { data: report, error: repErr } = await admin
    .from('monthly_reports')
    .select('id, status, final_payout, reporting_month, reporting_year, branch_id')
    .eq('id', reportId)
    .single()

  if (repErr || !report)
    return NextResponse.json({ error: 'Report not found' }, { status: 404 })

  if (report.status !== 'approved' && report.status !== 'paid')
    return NextResponse.json({ error: 'Can only notify for approved or paid reports' }, { status: 409 })

  // Fetch branch + partner
  const { data: branch } = await admin
    .from('branches')
    .select('name, notification_email, line_notify_token, partners(name)')
    .eq('id', report.branch_id)
    .single()

  if (!branch)
    return NextResponse.json({ error: 'Branch not found' }, { status: 404 })

  if (!branch.notification_email && !branch.line_notify_token)
    return NextResponse.json({ error: 'No notification channels configured for this branch' }, { status: 400 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const partnerRaw  = branch.partners as any
  const partnerName = (Array.isArray(partnerRaw) ? partnerRaw[0]?.name : partnerRaw?.name) ?? branch.name
  const amount      = formatTHB(Number(report.final_payout ?? 0))
  const monthName   = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][report.reporting_month - 1] ?? ''
  const period      = `${monthName} ${report.reporting_year}`
  const appUrl      = process.env.NEXT_PUBLIC_APP_URL ?? 'https://gpdashboard.flashyourmeme.com'
  const reportUrl   = `${appUrl}/admin/reports/${reportId}`
  const reference   = `#RPT-${report.reporting_year}-${String(report.reporting_month).padStart(2,'0')}-${reportId.slice(0,6).toUpperCase()}`
  const date        = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })

  const event = report.status === 'approved' ? 'approved' : 'paid'

  try {
    const results = await notifyReport(
      event,
      { email: branch.notification_email, lineToken: branch.line_notify_token },
      { partnerName, branchName: branch.name, period, amount, date, reportUrl, reference },
    )

    const emailOk = results.emailResult?.ok ?? null
    const lineOk  = results.lineResult?.ok  ?? null

    if ((results.emailResult && !emailOk) || (results.lineResult && !lineOk)) {
      return NextResponse.json({
        success: false,
        emailError: results.emailResult?.error,
        lineError:  results.lineResult?.error,
      }, { status: 500 })
    }

    return NextResponse.json({ success: true, emailOk, lineOk })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
