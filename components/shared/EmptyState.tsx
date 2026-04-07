import type { ReactNode } from 'react'

interface EmptyStateProps {
  icon?:        ReactNode
  title:        string
  description?: string
  action?:      ReactNode
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '56px 24px', textAlign: 'center', gap: '10px',
    }}>
      {icon && (
        <div style={{ fontSize: '28px', opacity: 0.2, marginBottom: '4px' }}>
          {icon}
        </div>
      )}
      <p style={{ fontSize: '14px', fontWeight: '600', color: 'rgba(241,245,249,0.6)', margin: 0 }}>
        {title}
      </p>
      {description && (
        <p style={{
          fontSize: '13px', color: 'rgba(241,245,249,0.3)',
          maxWidth: '300px', lineHeight: 1.6, margin: 0,
        }}>
          {description}
        </p>
      )}
      {action && <div style={{ marginTop: '12px' }}>{action}</div>}
    </div>
  )
}
