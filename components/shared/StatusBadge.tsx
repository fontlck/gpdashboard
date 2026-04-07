import type { CSSProperties } from 'react'
import type { ReportStatus, UploadStatus } from '@/lib/types/database.types'

// ── Labels ────────────────────────────────────────────────────────────────────

const REPORT_LABEL: Record<ReportStatus, string> = {
  draft:          'Draft',
  pending_review: 'Pending',
  approved:       'Approved',
  paid:           'Paid',
}

// ── Styles ────────────────────────────────────────────────────────────────────
// Color logic:
//   draft          → neutral gray    (inactive / not reviewed)
//   pending_review → amber           (needs attention)
//   approved       → blue #3B82F6   (confirmed, in processing)
//   paid           → green #4ADE80  (settled — complete, positive outcome)

const REPORT_STYLE: Record<ReportStatus, CSSProperties> = {
  draft:          { background: 'rgba(255,255,255,0.06)',  color: 'rgba(241,245,249,0.45)' },
  pending_review: { background: 'rgba(245,158,11,0.12)',  color: '#F59E0B'                 },
  approved:       { background: 'rgba(59,130,246,0.12)',  color: '#60A5FA'                 },
  paid:           { background: 'rgba(34,197,94,0.12)',   color: '#4ADE80'                 },
}

// ── Component ─────────────────────────────────────────────────────────────────

interface StatusBadgeProps {
  status: ReportStatus | UploadStatus | string
  size?:  'sm' | 'md'
}

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const label = REPORT_LABEL[status as ReportStatus] ?? status.replace(/_/g, ' ')
  const style = REPORT_STYLE[status as ReportStatus] ?? {
    background: 'rgba(255,255,255,0.06)',
    color:      'rgba(241,245,249,0.45)',
  }

  return (
    <span style={{
      ...style,
      display:       'inline-flex',
      alignItems:    'center',
      padding:       size === 'sm' ? '2px 7px' : '3px 9px',
      borderRadius:  '999px',
      fontSize:      '11px',
      fontWeight:    '600',
      letterSpacing: '0.05em',
      whiteSpace:    'nowrap',
      textTransform: 'uppercase',
    }}>
      {label}
    </span>
  )
}
