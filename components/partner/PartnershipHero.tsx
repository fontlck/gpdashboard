'use client'

import { useMemo } from 'react'
import { calculatePartnershipDuration, formatFullDate } from '@/lib/utils/date'

// ── Stat chip ──────────────────────────────────────────────────
function DurationChip({ value, label }: { value: number; label: string }) {
  return (
    <div style={{
      background:   'linear-gradient(145deg,#16192A 0%,#0F1120 100%)',
      border:       '1px solid rgba(196,163,94,0.18)',
      borderTop:    '2px solid rgba(196,163,94,0.55)',
      borderRadius: '12px',
      padding:      '20px 32px',
      display:      'flex',
      flexDirection:'column',
      alignItems:   'center',
      gap:          '6px',
      minWidth:     '110px',
      boxShadow:    '0 4px 24px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.04)',
      position:     'relative',
      overflow:     'hidden',
    }}>
      {/* Inner shimmer line */}
      <div style={{
        position:'absolute', top:0, left:'50%', transform:'translateX(-50%)',
        width:'60%', height:'1px',
        background:'linear-gradient(90deg,transparent,rgba(196,163,94,0.6),transparent)',
      }}/>
      <span style={{
        fontSize:'42px', fontWeight:'700', letterSpacing:'-0.02em',
        lineHeight:1, color:'#F2EBD9', fontVariantNumeric:'tabular-nums',
      }}>
        {String(value).padStart(2, '0')}
      </span>
      <span style={{
        fontSize:'10px', fontWeight:'600', letterSpacing:'0.14em',
        textTransform:'uppercase', color:'#C4A35E', opacity:0.85,
      }}>
        {label}
      </span>
    </div>
  )
}

// ── Divider ────────────────────────────────────────────────────
function GoldDivider() {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:'12px', width:'100%' }}>
      <div style={{ flex:1, height:'1px', background:'rgba(255,255,255,0.07)' }}/>
      <div style={{ width:'4px', height:'4px', borderRadius:'50%', background:'rgba(196,163,94,0.5)' }}/>
      <div style={{ flex:1, height:'1px', background:'rgba(255,255,255,0.07)' }}/>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────
interface PartnershipHeroProps {
  /** Partner display name */
  partnerName: string
  /** Optional branch name — shown if different from partnerName */
  branchName?: string | null
  /** ISO date string (YYYY-MM-DD) or null */
  partnershipStartDate?: string | null
  /** Source of start date — not shown to partner */
  partnershipStartDateSource?: string | null
}

export function PartnershipHero({
  partnerName,
  branchName,
  partnershipStartDate,
}: PartnershipHeroProps) {
  const duration = useMemo(() => {
    if (!partnershipStartDate) return null
    return calculatePartnershipDuration(partnershipStartDate)
  }, [partnershipStartDate])

  const sinceLabel = partnershipStartDate ? formatFullDate(partnershipStartDate) : null

  return (
    <section style={{
      position:   'relative',
      width:      '100%',
      borderRadius:'20px',
      overflow:   'hidden',
      background: 'linear-gradient(160deg,#0D0F1A 0%,#0A0C15 60%,#0D0F1A 100%)',
      border:     '1px solid rgba(255,255,255,0.06)',
      boxShadow:  '0 8px 48px rgba(0,0,0,0.5)',
    }}>
      {/* Grid texture */}
      <div style={{
        position:'absolute', inset:0, pointerEvents:'none',
        backgroundImage:'radial-gradient(circle at 1px 1px,rgba(255,255,255,0.025) 1px,transparent 0)',
        backgroundSize:'32px 32px',
      }}/>
      {/* Top-right ambient glow */}
      <div style={{
        position:'absolute', top:'-80px', right:'-80px',
        width:'320px', height:'320px', borderRadius:'50%', pointerEvents:'none',
        background:'radial-gradient(circle,rgba(196,163,94,0.07) 0%,transparent 70%)',
      }}/>
      {/* Bottom-left ambient glow */}
      <div style={{
        position:'absolute', bottom:'-60px', left:'-60px',
        width:'250px', height:'250px', borderRadius:'50%', pointerEvents:'none',
        background:'radial-gradient(circle,rgba(99,120,255,0.04) 0%,transparent 70%)',
      }}/>

      {/* Content */}
      <div style={{
        position:'relative', zIndex:1,
        padding:'40px 48px 44px',
        display:'flex', flexDirection:'column', gap:'28px',
      }}>
        {/* Greeting */}
        <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
          <span style={{
            fontSize:'11px', fontWeight:'600', letterSpacing:'0.18em',
            textTransform:'uppercase', color:'#C4A35E', opacity:0.8,
          }}>
            ✦ &nbsp; Welcome back
          </span>
          <h1 style={{
            margin:0, fontSize:'32px', fontWeight:'700',
            letterSpacing:'-0.025em', lineHeight:1.15, color:'#F0ECE4',
          }}>
            {partnerName}
          </h1>
          {branchName && branchName !== partnerName && (
            <span style={{ fontSize:'13px', color:'rgba(255,255,255,0.3)', letterSpacing:'0.04em' }}>
              {branchName}
            </span>
          )}
        </div>

        <GoldDivider />

        {/* Duration */}
        {duration ? (
          <div style={{ display:'flex', flexDirection:'column', gap:'20px' }}>
            <p style={{
              margin:0, fontSize:'13px', color:'rgba(255,255,255,0.4)',
              letterSpacing:'0.06em', fontWeight:'400',
            }}>
              You have been partnering with us for
            </p>

            {/* Chips */}
            <div style={{ display:'flex', gap:'12px', flexWrap:'wrap' }}>
              {duration.years > 0 && (
                <DurationChip value={duration.years} label={duration.years === 1 ? 'Year' : 'Years'} />
              )}
              <DurationChip value={duration.months} label={duration.months === 1 ? 'Month' : 'Months'} />
              <DurationChip value={duration.days}   label={duration.days   === 1 ? 'Day'   : 'Days'}   />
            </div>

            {/* Since label */}
            <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
              <div style={{ width:'3px', height:'3px', borderRadius:'50%', background:'rgba(196,163,94,0.6)' }}/>
              <span style={{ fontSize:'12px', color:'rgba(255,255,255,0.3)', letterSpacing:'0.05em' }}>
                Partner since:{' '}
                <span style={{ color:'rgba(255,255,255,0.5)', fontWeight:'500' }}>
                  {sinceLabel}
                </span>
              </span>
            </div>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
            <p style={{ margin:0, fontSize:'15px', color:'rgba(255,255,255,0.5)',
              fontStyle:'italic', letterSpacing:'0.03em' }}>
              Welcome — your partnership journey begins here.
            </p>
            <span style={{ fontSize:'12px', color:'rgba(255,255,255,0.22)', letterSpacing:'0.04em' }}>
              Your first report will set the start of your partnership timeline.
            </span>
          </div>
        )}
      </div>

      {/* Bottom accent line */}
      <div style={{
        position:'absolute', bottom:0, left:0, right:0, height:'1px',
        background:'linear-gradient(90deg,transparent 0%,rgba(196,163,94,0.3) 30%,rgba(196,163,94,0.3) 70%,transparent 100%)',
      }}/>
    </section>
  )
}
