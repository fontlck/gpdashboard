import { Resend } from 'resend'
import { render } from '@react-email/render'
import { ReportApprovedEmail } from '@/components/emails/ReportApprovedEmail'
import { ReportPaidEmail }     from '@/components/emails/ReportPaidEmail'
import type { ReportApprovedEmailProps } from '@/components/emails/ReportApprovedEmail'
import type { ReportPaidEmailProps }     from '@/components/emails/ReportPaidEmail'

const FROM = 'Flashyourmeme <no-reply@flashyourmeme.com>'

// ── Resend ─────────────────────────────────────────────────────────────────────

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY
  if (!key) { console.warn('[notify] RESEND_API_KEY not set — email skipped'); return null }
  return new Resend(key)
}

// ── Line Notify ────────────────────────────────────────────────────────────────

export async function sendLineNotify(token: string, message: string): Promise<{ ok: boolean; error?: string }> {
  if (!token?.trim()) return { ok: false, error: 'No Line Notify token' }

  try {
    const res = await fetch('https://notify-api.line.me/api/notify', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token.trim()}`,
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

// ── Email helpers ──────────────────────────────────────────────────────────────

export async function sendApprovedEmail(
  to: string,
  props: ReportApprovedEmailProps,
): Promise<{ ok: boolean; error?: string }> {
  const resend = getResend()
  if (!resend) return { ok: false, error: 'Resend not configured' }
  if (!to?.trim()) return { ok: false, error: 'No recipient email' }

  try {
    const html = await render(ReportApprovedEmail(props))
    const { error } = await resend.emails.send({
      from:    FROM,
      to:      [to.trim()],
      subject: `รายงาน ${props.period} ได้รับการอนุมัติแล้ว — ${props.amount}`,
      html,
    })
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
}

export async function sendPaidEmail(
  to: string,
  props: ReportPaidEmailProps,
): Promise<{ ok: boolean; error?: string }> {
  const resend = getResend()
  if (!resend) return { ok: false, error: 'Resend not configured' }
  if (!to?.trim()) return { ok: false, error: 'No recipient email' }

  try {
    const html = await render(ReportPaidEmail(props))
    const { error } = await resend.emails.send({
      from:    FROM,
      to:      [to.trim()],
      subject: `โอนเงิน ${props.period} เรียบร้อยแล้ว — ${props.amount}`,
      html,
    })
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
}

// ── Combined: send all channels for a report event ────────────────────────────

export type NotifyEvent = 'approved' | 'paid'

export type NotifyChannels = {
  email?: string | null
  lineToken?: string | null
}

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
): Promise<{ emailResult?: { ok: boolean; error?: string }; lineResult?: { ok: boolean; error?: string } }> {
  const results: {
    emailResult?: { ok: boolean; error?: string }
    lineResult?:  { ok: boolean; error?: string }
  } = {}

  const tasks: Promise<void>[] = []

  // Email
  if (channels.email) {
    const task = (async () => {
      if (event === 'approved') {
        results.emailResult = await sendApprovedEmail(channels.email!, {
          partnerName:  payload.partnerName,
          branchName:   payload.branchName,
          period:       payload.period,
          amount:       payload.amount,
          approvedDate: payload.date,
          reportUrl:    payload.reportUrl,
        })
      } else {
        results.emailResult = await sendPaidEmail(channels.email!, {
          partnerName: payload.partnerName,
          branchName:  payload.branchName,
          period:      payload.period,
          amount:      payload.amount,
          paidDate:    payload.date,
          reportUrl:   payload.reportUrl,
          reference:   payload.reference,
        })
      }
    })()
    tasks.push(task)
  }

  // Line Notify
  if (channels.lineToken) {
    const lineMsg = event === 'approved'
      ? `\n[GP Dashboard] รายงาน ${payload.period} (${payload.branchName}) ได้รับการอนุมัติแล้ว\nยอด: ${payload.amount}\nดูรายงาน: ${payload.reportUrl}`
      : `\n[GP Dashboard] โอนเงิน ${payload.period} (${payload.branchName}) เรียบร้อยแล้ว\nยอด: ${payload.amount}\nReference: ${payload.reference}`

    const task = (async () => {
      results.lineResult = await sendLineNotify(channels.lineToken!, lineMsg)
    })()
    tasks.push(task)
  }

  await Promise.allSettled(tasks)
  return results
}
