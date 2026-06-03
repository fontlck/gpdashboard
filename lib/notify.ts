import nodemailer                from 'nodemailer'
import { render }               from '@react-email/render'
import { ReportApprovedEmail }  from '@/components/emails/ReportApprovedEmail'
import { ReportPaidEmail }      from '@/components/emails/ReportPaidEmail'
import type { ReportApprovedEmailProps } from '@/components/emails/ReportApprovedEmail'
import type { ReportPaidEmailProps }     from '@/components/emails/ReportPaidEmail'

const FROM_NAME    = 'Flashyourmeme'
const GMAIL_USER   = process.env.GMAIL_USER   ?? ''
const GMAIL_PASS   = process.env.GMAIL_APP_PASSWORD ?? ''

// ── Gmail SMTP transporter ────────────────────────────────────────────────────

function getTransporter() {
  if (!GMAIL_USER || !GMAIL_PASS) {
    console.warn('[notify] GMAIL_USER or GMAIL_APP_PASSWORD not set — email skipped')
    return null
  }
  return nodemailer.createTransport({
    host:   'smtp.gmail.com',
    port:   587,
    secure: false,
    auth: { user: GMAIL_USER, pass: GMAIL_PASS },
  })
}

// ── Line Notify ───────────────────────────────────────────────────────────────

export async function sendLineNotify(
  token:   string,
  message: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!token?.trim()) return { ok: false, error: 'No Line Notify token' }
  try {
    const res = await fetch('https://notify-api.line.me/api/notify', {
      method:  'POST',
      headers: {
        Authorization:  `Bearer ${token.trim()}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ message }),
    })
    if (!res.ok) {
      const text = await res.text()
      return { ok: false, error: `Line Notify HTTP ${res.status}: ${text}` }
    }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
}

// ── Email helpers ─────────────────────────────────────────────────────────────

export async function sendApprovedEmail(
  to:    string,
  props: ReportApprovedEmailProps,
): Promise<{ ok: boolean; error?: string }> {
  const transporter = getTransporter()
  if (!transporter) return { ok: false, error: 'Gmail not configured' }
  if (!to?.trim())  return { ok: false, error: 'No recipient email' }

  try {
    const html = await render(ReportApprovedEmail(props))
    await transporter.sendMail({
      from:    `"${FROM_NAME}" <${GMAIL_USER}>`,
      to:      to.trim(),
      subject: `รายงาน ${props.period} ได้รับการอนุมัติแล้ว — ${props.amount}`,
      html,
    })
    return { ok: true }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
}

export async function sendPaidEmail(
  to:    string,
  props: ReportPaidEmailProps,
): Promise<{ ok: boolean; error?: string }> {
  const transporter = getTransporter()
  if (!transporter) return { ok: false, error: 'Gmail not configured' }
  if (!to?.trim())  return { ok: false, error: 'No recipient email' }

  try {
    const html = await render(ReportPaidEmail(props))
    await transporter.sendMail({
      from:    `"${FROM_NAME}" <${GMAIL_USER}>`,
      to:      to.trim(),
      subject: `โอนเงิน ${props.period} เรียบร้อยแล้ว — ${props.amount}`,
      html,
    })
    return { ok: true }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
}

// ── Test email ────────────────────────────────────────────────────────────────

export async function sendTestEmail(
  to:      string,
  appUrl:  string,
): Promise<{ ok: boolean; error?: string }> {
  return sendApprovedEmail(to, {
    partnerName:  'Test Partner',
    branchName:   'Test Branch',
    period:       'May 2025',
    amount:       '฿45,000.00',
    approvedDate: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    reportUrl:    `${appUrl}/admin`,
  })
}

// ── Combined notify ───────────────────────────────────────────────────────────

export type NotifyEvent    = 'approved' | 'paid'
export type NotifyChannels = { email?: string | null; lineToken?: string | null }
export type NotifyReportPayload = {
  partnerName: string
  branchName:  string
  period:      string
  amount:      string
  date:        string
  reportUrl:   string
  reference:   string
}

export async function notifyReport(
  event:    NotifyEvent,
  channels: NotifyChannels,
  payload:  NotifyReportPayload,
): Promise<{
  emailResult?: { ok: boolean; error?: string }
  lineResult?:  { ok: boolean; error?: string }
}> {
  const results: {
    emailResult?: { ok: boolean; error?: string }
    lineResult?:  { ok: boolean; error?: string }
  } = {}

  const tasks: Promise<void>[] = []

  if (channels.email) {
    tasks.push((async () => {
      results.emailResult = event === 'approved'
        ? await sendApprovedEmail(channels.email!, {
            partnerName:  payload.partnerName,
            branchName:   payload.branchName,
            period:       payload.period,
            amount:       payload.amount,
            approvedDate: payload.date,
            reportUrl:    payload.reportUrl,
          })
        : await sendPaidEmail(channels.email!, {
            partnerName: payload.partnerName,
            branchName:  payload.branchName,
            period:      payload.period,
            amount:      payload.amount,
            paidDate:    payload.date,
            reportUrl:   payload.reportUrl,
            reference:   payload.reference,
          })
    })())
  }

  if (channels.lineToken) {
    const msg = event === 'approved'
      ? `\n[GP Dashboard] รายงาน ${payload.period} (${payload.branchName}) ได้รับการอนุมัติแล้ว\nยอด: ${payload.amount}\nดูรายงาน: ${payload.reportUrl}`
      : `\n[GP Dashboard] โอนเงิน ${payload.period} (${payload.branchName}) เรียบร้อยแล้ว\nยอด: ${payload.amount}\nReference: ${payload.reference}`

    tasks.push((async () => {
      results.lineResult = await sendLineNotify(channels.lineToken!, msg)
    })())
  }

  await Promise.allSettled(tasks)
  return results
}
