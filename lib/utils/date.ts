/**
 * Date utilities — reporting periods, partnership duration, display.
 */

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

/** Format a reporting period as a display string: "March 2026" */
export function formatReportingPeriod(month: number, year: number): string {
  return `${MONTH_NAMES[month - 1]} ${year}`
}

/** Return the full month name for a month number (1-indexed) */
export function monthName(month: number): string {
  return MONTH_NAMES[month - 1] ?? '—'
}

/** Format a DATE string or Date object as "March 1, 2024" */
export function formatFullDate(date: string | Date | null | undefined): string {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('en-US', {
    year:  'numeric',
    month: 'long',
    day:   'numeric',
  })
}

/** Format a TIMESTAMPTZ string as "1 Mar 2026, 14:05" */
export function formatDateTime(ts: string | null | undefined): string {
  if (!ts) return '—'
  return new Date(ts).toLocaleString('en-GB', {
    day:    '2-digit',
    month:  'short',
    year:   'numeric',
    hour:   '2-digit',
    minute: '2-digit',
  })
}

/**
 * Calculate partnership duration between startDate and now.
 * Returns { years, months, days } — all non-negative integers.
 */
export function calculatePartnershipDuration(startDate: string | Date): {
  years:  number
  months: number
  days:   number
} {
  const start = new Date(startDate)
  const now   = new Date()

  let years  = now.getFullYear() - start.getFullYear()
  let months = now.getMonth()    - start.getMonth()
  let days   = now.getDate()     - start.getDate()

  if (days < 0) {
    months -= 1
    const lastDay = new Date(now.getFullYear(), now.getMonth(), 0).getDate()
    days += lastDay
  }
  if (months < 0) {
    years  -= 1
    months += 12
  }

  return { years, months, days }
}

/**
 * Return a human-readable duration string.
 * e.g. "2 years, 3 months, 14 days" or "4 months, 12 days"
 */
export function formatDuration(startDate: string | Date | null | undefined): string {
  if (!startDate) return '—'
  const { years, months, days } = calculatePartnershipDuration(startDate)
  const parts: string[] = []
  if (years  > 0) parts.push(`${years} ${years  === 1 ? 'year'  : 'years'}`)
  if (months > 0) parts.push(`${months} ${months === 1 ? 'month' : 'months'}`)
  parts.push(`${days} ${days === 1 ? 'day' : 'days'}`)
  return parts.join(', ')
}

/**
 * Check whether a TIMESTAMPTZ falls within a given reporting month/year.
 * All comparisons in local UTC+7 (Bangkok) are handled by comparing
 * parsed year/month against the expected values.
 */
export function isWithinReportingPeriod(
  timestampStr: string,
  reportingMonth: number,
  reportingYear:  number,
  timezone = 'Asia/Bangkok'
): boolean {
  const date = new Date(timestampStr)
  const localStr = date.toLocaleDateString('en-CA', { timeZone: timezone }) // YYYY-MM-DD
  const [y, m]   = localStr.split('-').map(Number)
  return y === reportingYear && m === reportingMonth
}

/** Get current reporting period { month, year } */
export function currentReportingPeriod(): { month: number; year: number } {
  const now = new Date()
  return { month: now.getMonth() + 1, year: now.getFullYear() }
}
