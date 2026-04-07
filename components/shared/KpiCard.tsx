interface KpiCardProps {
  label:      string
  value:      string | number
  sub?:       string
  trend?:     { value: string; up: boolean } | null
  accent?:    'gold' | 'green' | 'amber' | 'default'
  fullWidth?: boolean
}

const ACCENT_COLOUR = {
  gold:    '#F1F5F9',
  green:   '#4ADE80',
  amber:   '#F59E0B',
  default: '#F1F5F9',
}

// Bottom glow spread colour per accent
const GLOW_SPREAD = {
  gold:    'rgba(59,130,246,0.14)',
  green:   'rgba(34,197,94,0.14)',
  amber:   'rgba(245,158,11,0.16)',
  default: 'rgba(59,130,246,0.10)',
}

// Bottom glow line colour per accent
const GLOW_LINE = {
  gold:    'rgba(59,130,246,0.85)',
  green:   'rgba(74,222,128,0.85)',
  amber:   'rgba(245,158,11,0.85)',
  default: 'rgba(59,130,246,0.55)',
}

export function KpiCard({ label, value, sub, trend, accent = 'default', fullWidth }: KpiCardProps) {
  const accentColor = ACCENT_COLOUR[accent]
  const glowSpread  = GLOW_SPREAD[accent]
  const glowLine    = GLOW_LINE[accent]

  return (
    <div style={{
      background:    '#0C1018',
      border:        '1px solid rgba(255,255,255,0.07)',
      borderRadius:  '12px',
      padding:       '20px 22px 22px',
      display:       'flex',
      flexDirection: 'column',
      gap:           '8px',
      flex:          fullWidth ? '1 1 100%' : '1 1 0',
      minWidth:      '180px',
      position:      'relative',
      overflow:      'hidden',
    }}>

      {/* Grid background — fades up from bottom */}
      <div style={{
        position:      'absolute',
        inset:         0,
        backgroundImage: [
          'linear-gradient(rgba(59,130,246,0.055) 1px, transparent 1px)',
          'linear-gradient(90deg, rgba(59,130,246,0.055) 1px, transparent 1px)',
        ].join(','),
        backgroundSize: '28px 28px',
        WebkitMaskImage: 'linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 65%)',
        maskImage:       'linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 65%)',
        pointerEvents:   'none',
        borderRadius:    'inherit',
      }} />

      {/* Bottom radial glow spread */}
      <div style={{
        position:      'absolute',
        bottom:        0,
        left:          0,
        right:         0,
        height:        '64px',
        background:    `radial-gradient(ellipse at 50% 100%, ${glowSpread} 0%, transparent 70%)`,
        pointerEvents: 'none',
        borderRadius:  'inherit',
      }} />

      {/* Bottom glow line */}
      <div style={{
        position:      'absolute',
        bottom:        '-1px',
        left:          '12%',
        right:         '12%',
        height:        '1px',
        background:    `linear-gradient(90deg, transparent, ${glowLine}, transparent)`,
        pointerEvents: 'none',
      }} />

      {/* Top inner shimmer */}
      <div style={{
        position:      'absolute',
        top:           0,
        left:          0,
        right:         0,
        height:        '1px',
        background:    'linear-gradient(90deg, transparent, rgba(255,255,255,0.07), transparent)',
        pointerEvents: 'none',
      }} />

      {/* Content */}
      <span style={{
        fontSize:      '10px',
        fontWeight:    '600',
        letterSpacing: '0.13em',
        textTransform: 'uppercase',
        color:         'rgba(241,245,249,0.32)',
        position:      'relative',
        zIndex:        1,
      }}>
        {label}
      </span>

      <span style={{
        fontSize:           '28px',
        fontWeight:         '800',
        color:              accentColor,
        letterSpacing:      '-0.03em',
        lineHeight:         1,
        fontVariantNumeric: 'tabular-nums',
        position:           'relative',
        zIndex:             1,
      }}>
        {value}
      </span>

      <div style={{
        display:    'flex',
        alignItems: 'center',
        gap:        '8px',
        marginTop:  '2px',
        position:   'relative',
        zIndex:     1,
      }}>
        {sub && (
          <span style={{ fontSize: '11px', color: 'rgba(241,245,249,0.28)' }}>
            {sub}
          </span>
        )}
        {trend && (
          <span style={{
            fontSize:   '11px',
            fontWeight: '600',
            color:      trend.up ? '#4ADE80' : '#EF4444',
            background: trend.up ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
            padding:    '1px 6px',
            borderRadius: '999px',
          }}>
            {trend.up ? '↑' : '↓'} {trend.value}
          </span>
        )}
      </div>

    </div>
  )
}
