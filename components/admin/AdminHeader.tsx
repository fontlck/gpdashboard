import type { ReactNode } from 'react'

interface AdminHeaderProps {
  title:     string
  subtitle?: string
  actions?:  ReactNode
}

export function AdminHeader({ title, subtitle, actions }: AdminHeaderProps) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
      marginBottom: '24px', gap: '16px',
    }}>
      <div>
        <h1 style={{
          fontSize: '20px', fontWeight: '700', color: '#F1F5F9',
          letterSpacing: '-0.02em', lineHeight: 1.2, margin: 0,
        }}>
          {title}
        </h1>
        {subtitle && (
          <p style={{
            fontSize: '13px', color: 'rgba(241,245,249,0.45)',
            marginTop: '3px', lineHeight: 1.5,
          }}>
            {subtitle}
          </p>
        )}
      </div>
      {actions && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          {actions}
        </div>
      )}
    </div>
  )
}
