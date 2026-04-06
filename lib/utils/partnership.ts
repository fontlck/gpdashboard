// ── Partnership duration utilities ─────────────────────────────────────────────

export type Duration = {
  years:     number
  months:    number
  days:      number
  totalDays: number
}

/**
 * Calculate years/months/days between startDate and today (calendar diff).
 */
export function calcDuration(startDate: Date, today: Date = new Date()): Duration {
  let years  = today.getFullYear() - startDate.getFullYear()
  let months = today.getMonth()    - startDate.getMonth()
  let days   = today.getDate()     - startDate.getDate()

  if (days < 0) {
    months--
    const daysInPrevMonth = new Date(today.getFullYear(), today.getMonth(), 0).getDate()
    days += daysInPrevMonth
  }
  if (months < 0) {
    years--
    months += 12
  }

  const totalDays = Math.max(0, Math.floor(
    (today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
  ))

  return { years, months, days, totalDays }
}

/**
 * Format a Date as "March 1, 2024".
 */
export function formatStartDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  })
}

/**
 * Parse a DB date string "YYYY-MM-DD" as a local (non-UTC) Date.
 */
export function parseDateString(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/**
 * Convert a UTC ISO timestamp to a Bangkok (UTC+7) local Date.
 * Used when deriving partnership start from transaction_date.
 */
export function utcToBangkokDate(utcTimestamp: string): Date {
  const BKK_OFFSET_MS = 7 * 60 * 60 * 1000
  const utcMs  = new Date(utcTimestamp).getTime()
  const bkkMs  = utcMs + BKK_OFFSET_MS
  const bkkUTC = new Date(bkkMs)
  // Return a local-midnight Date for the Bangkok calendar date
  return new Date(bkkUTC.getUTCFullYear(), bkkUTC.getUTCMonth(), bkkUTC.getUTCDate())
}
