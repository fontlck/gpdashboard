import type { CSSProperties } from 'react'
import type { ReportStatus, UploadStatus } from '@/lib/types/database.types'

const REPORT_LABEL: Record<ReportStatus, string> = {
  draft:          'Draft',
  pending_review: 'Pending Review',
  approved:       'Approved',
  paid:           'Paid',
}

const REPORT_STYLE: Record<ReportStatus, CSSProperties> = {
  draft:          { background: 'rgba(255,255,255,0.06)', color: 'rgba(240,236,228,0.45)' },
  pending_review: { background: 'rgba(245,158,11,0.12)',  color: '#F59E0B' },
  approved:       { background: 'rgba(34,197,94,0.12)',   color: '#22C55E' },
  paid:           { background: 'rgba(196,163,94,0.15)',  color: '#C4A35E' },
}

interface StatusBadgeProps {
  status: ReportStatus | UploadStatus | string
  size?:  'sm' | 'md'
}

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const label = REPORT_LABEL[status as ReportStatus] ?? status.replace(/_/g, ' ')
  const style = REPORT_STYLE[status as ReportStatus] ?? {
    background: 'rgba(255,255,255,0.06)',
    color: 'rgba(240,236,228,0.45)',
  }

  return (
    <span style={{
      ...style,
      display:       'inline-flex',
      alignItems:    'center',
      padding:       size === 'sm' ? '2px 8px' : '4px 10px',
      borderRadius:  '999px',
      fontSize:      size === 'sm' ? '11px' : '12px',
      fontWeight:    '600',
      letterSpacing: '0.04em',
      whiteSpace:    'nowrap',
      textTransform: 'capitalize',
    }}>
      {label}
    </span>
  )
}
