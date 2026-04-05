interface AdminHeaderProps {
  title:    string
  subtitle?: string
  actions?: React.ReactNode
}

export function AdminHeader({ title, subtitle, actions }: AdminHeaderProps) {
  return (
    <div style={{
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'space-between',
      marginBottom:   '28px',
      gap:            '16px',
    }}>
      <div>
        <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#F0ECE4',
          letterSpacing: '-0.02em', lineHeight: 1.2 }}>
          {title}
        </h1>
        {subtitle && (
          <p style={{ fontSize: '13px', color: 'rgba(240,236,228,0.4)', marginTop: '4px' }}>
            {subtitle}
          </p>
        )}
      </div>
      {actions && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
          {actions}
        </div>
      )}
    </div>
  )
}
