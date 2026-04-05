interface EmptyStateProps {
  icon?:        React.ReactNode
  title:        string
  description?: string
  action?:      React.ReactNode
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div style={{
      display:        'flex',
      flexDirection:  'column',
      alignItems:     'center',
      justifyContent: 'center',
      padding:        '60px 24px',
      textAlign:      'center',
      gap:            '12px',
    }}>
      {icon && (
        <div style={{ fontSize: '32px', opacity: 0.3, marginBottom: '4px' }}>
          {icon}
        </div>
      )}
      <h3 style={{ fontSize: '16px', fontWeight: '600', color: 'rgba(240,236,228,0.7)' }}>
        {title}
      </h3>
      {description && (
        <p style={{ fontSize: '13px', color: 'rgba(240,236,228,0.35)', maxWidth: '320px', lineHeight: 1.6 }}>
          {description}
        </p>
      )}
      {action && <div style={{ marginTop: '8px' }}>{action}</div>}
    </div>
  )
}
