interface KpiCardProps {
  label:       string
  value:       string | number
  sub?:        string
  trend?:      { value: string; up: boolean } | null
  accent?:     'gold' | 'green' | 'amber' | 'default'
  fullWidth?:  boolean
}

const ACCENT_COLOUR = {
  gold:    '#F1F5F9',
  green:   '#22C55E',
  amber:   '#F59E0B',
  default: '#F1F5F9',
}

export function KpiCard({ label, value, sub, trend, accent = 'default', fullWidth }: KpiCardProps) {
  const accentColor = ACCENT_COLOUR[accent]

  return (
    <div style={{
      background:   '#0C1018',
      border:       '1px solid rgba(255,255,255,0.07)',
      borderRadius: '12px',
      padding:      '24px',
      display:      'flex',
      flexDirection:'column',
      gap:          '8px',
      flex:         fullWidth ? '1 1 100%' : '1 1 0',
      minWidth:     '180px',
      position:     'relative',
      overflow:     'hidden',
    }}>
      {/* Subtle top accent */}
      {accent !== 'default' && (
        <div style={{
          position: 'absolute', top: 0, left: '20%', right: '20%', height: '1px',
          background: `linear-gradient(90deg, transparent, ${accentColor}55, transparent)`,
        }}/>
      )}

      <span style={{ fontSize: '11px', fontWeight: '600', letterSpacing: '0.12em',
        textTransform: 'uppercase', color: 'rgba(241,245,249,0.4)' }}>
        {label}
      </span>

      <span style={{ fontSize: '28px', fontWeight: '700', color: accentColor,
        letterSpacing: '-0.02em', lineHeight: 1.1 }}>
        {value}
      </span>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
        {sub && (
          <span style={{ fontSize: '12px', color: 'rgba(241,245,249,0.35)' }}>
            {sub}
          </span>
        )}
        {trend && (
          <span style={{
            fontSize: '11px', fontWeight: '600',
            color: trend.up ? '#22C55E' : '#EF4444',
            background: trend.up ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
            padding: '1px 6px', borderRadius: '999px',
          }}>
            {trend.up ? '↑' : '↓'} {trend.value}
          </span>
        )}
      </div>
    </div>
  )
}
