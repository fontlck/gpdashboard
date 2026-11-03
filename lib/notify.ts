import nodemailer                from 'nodemailer'
import { render }               from '@react-email/render'
import { ReportApprovedEmail }  from '@/components/emails/ReportApprovedEmail'
import { ReportPaidEmail }      from '@/components/emails/ReportPaidEmail'
import type { ReportApprovedEmailProps } from '@/components/emails/ReportApprovedEmail'
import type { ReportPaidEmailProps }     from '@/components/emails/ReportPaidEmail'

const FROM_NAME = 'Flashyourmeme'

// Generic SMTP settings — supports Zoho, Gmail, or any other SMTP provider.
// Falls back to legacy GMAIL_* env vars if the generic MAIL_* ones aren't set.
const MAIL_HOST = process.env.MAIL_HOST ?? 'smtp.gmail.com'
const MAIL_PORT = Number(process.env.MAIL_PORT ?? 587)
const MAIL_USER = process.env.MAIL_USER     ?? process.env.GMAIL_USER         ?? ''
const MAIL_PASS = process.env.MAIL_PASSWORD ?? process.env.GMAIL_APP_PASSWORD ?? ''

// ── SMTP transporter ─────────────────────────────────────────────────────────

function getTransporter() {
  if (!MAIL_USER || !MAIL_PASS) {
    console.warn('[notify] MAIL_USER or MAIL_PASSWORD not set — email skipped')
    return null
  }
  return nodemailer.createTransport({
    host:   MAIL_HOST,
    port:   MAIL_PORT,
    secure: MAIL_PORT === 465,   // true for 465 (SSL), false for 587 (STARTTLS)
    auth:   { user: MAIL_USER, pass: MAIL_PASS },
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

/** Split a comma-separated email string into a clean array of valid-looking emails. */
function parseRecipients(input: string): string[] {
  return input
    .split(/[,;\n]+/)
    .map(s => s.trim())
    .filter(s => s.length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s))
}

export async function sendApprovedEmail(
  to:    string,
  props: ReportApprovedEmailProps,
): Promise<{ ok: boolean; error?: string; recipientCount?: number }> {
  const transporter = getTransporter()
  if (!transporter) return { ok: false, error: 'Gmail not configured' }
  const recipients = parseRecipients(to ?? '')
  if (recipients.length === 0) return { ok: false, error: 'No valid recipient email' }

  try {
    const html = await render(ReportApprovedEmail(props))
    await transporter.sendMail({
      from:    `"${FROM_NAME}" <${MAIL_USER}>`,
      to:      recipients,
      subject: `Sale Report ${props.period} ได้รับการอนุมัติแล้ว`,
      html,
    })
    return { ok: true, recipientCount: recipients.length }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
}

export async function sendPaidEmail(
  to:    string,
  props: ReportPaidEmailProps,
): Promise<{ ok: boolean; error?: string; recipientCount?: number }> {
  const transporter = getTransporter()
  if (!transporter) return { ok: false, error: 'Gmail not configured' }
  const recipients = parseRecipients(to ?? '')
  if (recipients.length === 0) return { ok: false, error: 'No valid recipient email' }

  try {
    const html = await render(ReportPaidEmail(props))
    await transporter.sendMail({
      from:    `"${FROM_NAME}" <${MAIL_USER}>`,
      to:      recipients,
      subject: `Sale Report ${props.period} โอนเงินเรียบร้อยแล้ว`,
      html,
    })
    return { ok: true, recipientCount: recipients.length }
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
  emailResult?: { ok: boolean; error?: string; recipientCount?: number }
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
