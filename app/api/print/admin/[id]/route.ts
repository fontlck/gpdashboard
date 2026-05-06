import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { formatReportingPeriod } from '@/lib/utils/date'
import { getBrowser } from '@/lib/pdf/browser'

// Allow up to 60 s (Vercel Pro / Hobby both support this now)
export const maxDuration = 60

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  // ── 1. Auth check — requester must be an authenticated admin ──────────────
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return new NextResponse('Forbidden', { status: 403 })

  // ── 2. Fetch report data just for the filename ────────────────────────────
  const admin = createAdminClient()
  const { data: report } = await admin
    .from('monthly_reports')
    .select('reporting_month, reporting_year, branches(name)')
    .eq('id', id)
    .single()
  if (!report) return new NextResponse('Not Found', { status: 404 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const branchRaw  = (report as any).branches
  const branchName = (Array.isArray(branchRaw) ? branchRaw[0] : branchRaw)?.name ?? 'Report'
  const period     = formatReportingPeriod(report.reporting_month, report.reporting_year)
  const filename   = `${branchName}_${period}.pdf`

  // ── 3. Build URL of the print page ───────────────────────────────────────
  const origin =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ??
    `${request.nextUrl.protocol}//${request.nextUrl.host}`
  const printUrl = `${origin}/print/admin/${id}`

  // ── 4. Launch Puppeteer, pass auth cookies, render → PDF ─────────────────
  let browser = null
  try {
    browser = await getBrowser()
    const page = await browser.newPage()

    // Forward all cookies so the middleware lets the request through
    const targetHost = new URL(printUrl).hostname
    for (const cookie of request.cookies.getAll()) {
      await page.setCookie({
        name:   cookie.name,
        value:  cookie.value,
        domain: targetHost,
        path:   '/',
        secure: printUrl.startsWith('https'),
      })
    }

    await page.goto(printUrl, { waitUntil: 'networkidle0', timeout: 30_000 })

    const pdf = await page.pdf({
      format:          'A4',
      printBackground: true,
      margin: { top: '16mm', right: '20mm', bottom: '16mm', left: '20mm' },
    })

    return new NextResponse(pdf, {
      headers: {
        'Content-Type':        'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control':       'no-store',
      },
    })
  } catch (err) {
    console.error('[PDF admin] generation failed:', err)
    return new NextResponse('PDF generation failed', { status: 500 })
  } finally {
    await browser?.close()
  }
}
