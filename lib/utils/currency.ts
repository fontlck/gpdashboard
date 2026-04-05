/**
 * Currency utilities — all monetary values in THB.
 * Round-half-up to 2 decimal places (matches Phase 0 spec).
 */

const THB_FORMATTER = new Intl.NumberFormat('th-TH', {
  style:                 'currency',
  currency:              'THB',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const NUMBER_FORMATTER = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** Format a number as Thai Baht: ฿1,234.56 */
export function formatTHB(value: number): string {
  return THB_FORMATTER.format(value)
}

/** Format a number with 2 decimal places, no currency symbol: 1,234.56 */
export function formatNumber(value: number): string {
  return NUMBER_FORMATTER.format(value)
}

/**
 * Round-half-up to N decimal places.
 * Standard rounding (Math.round) in JS is already round-half-up for positive numbers.
 * This function makes it explicit and handles negatives correctly.
 */
export function roundHalfUp(value: number, decimals = 2): number {
  const factor = Math.pow(10, decimals)
  return Math.round((value + Number.EPSILON) * factor) / factor
}

/** Parse a raw CSV string value to a float, returning 0 if unparseable */
export function parseMoneyValue(raw: string | undefined | null): number {
  if (!raw || raw.trim() === '') return 0
  const cleaned = raw.replace(/,/g, '').trim()
  const parsed  = parseFloat(cleaned)
  return isNaN(parsed) ? 0 : parsed
}

/** Returns true if the value is a valid finite non-negative number */
export function isValidAmount(value: unknown): value is number {
  return typeof value === 'number' && isFinite(value) && value >= 0
}
