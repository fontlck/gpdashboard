import React from 'react'

// ── Cool Blue palette — 4 shades that cycle by name hash ─────────────────────

const PALETTE = [
  { bg: 'rgba(59,130,246,0.20)',  color: '#93C5FD', border: '1px solid rgba(59,130,246,0.30)'  },
  { bg: 'rgba(14,165,233,0.18)',  color: '#7DD3FC', border: '1px solid rgba(14,165,233,0.28)'  },
  { bg: 'rgba(99,102,241,0.18)',  color: '#A5B4FC', border: '1px solid rgba(99,102,241,0.28)'  },
  { bg: 'rgba(6,182,212,0.15)',   color: '#67E8F9', border: '1px solid rgba(6,182,212,0.25)'   },
]

/** Deterministic index from artist name so colours never change on re-render */
function paletteIndex(name: string): number {
  let h = 0
  for (let i = 0; i < name.length; i++) {
    h = Math.imul(31, h) + name.charCodeAt(i) | 0
  }
  return Math.abs(h) % PALETTE.length
}

/** Two-letter initials: first char of each word (max 2), or first 2 chars */
export function getInitials(name: string): string {
  if (!name || name === '(Unknown)') return '?'
  const words = name.trim().split(/\s+/)
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

// ── Component ─────────────────────────────────────────────────────────────────

type Props = {
  name:     string
  imageUrl: string | null | undefined
  size?:    number   // defaults to 36
}

export function ArtistAvatar({ name, imageUrl, size = 36 }: Props) {
  const isUnknown = !name || name === '(Unknown)'
  const fontSize  = size <= 36 ? 11 : Math.round(size * 0.3)

  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt={name ?? ''}
        style={{
          width: size, height: size, borderRadius: '50%',
          objectFit: 'cover',
          border: '1px solid rgba(255,255,255,0.1)',
          display: 'block', flexShrink: 0,
        }}
      />
    )
  }

  if (isUnknown) {
    return (
      <div style={{
        width: size, height: size, borderRadius: '50%',
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.08)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: fontSize, color: 'rgba(240,236,228,0.2)',
        flexShrink: 0,
      }}>?</div>
    )
  }

  const p = PALETTE[paletteIndex(name)]

  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: p.bg, border: p.border,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: fontSize, fontWeight: 700, letterSpacing: '0.04em',
      color: p.color,
      flexShrink: 0,
      userSelect: 'none',
    }}>
      {getInitials(name)}
    </div>
  )
}
