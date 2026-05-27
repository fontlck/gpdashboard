'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useState, useRef, useEffect } from 'react'

function buildMonthOptions(count = 12) {
  const now = new Date()
  const options: { label: string; value: string }[] = []
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const year  = d.getFullYear()
    const month = d.getMonth() + 1
    const value = `${year}-${String(month).padStart(2, '0')}`
    const label = d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
    options.push({ label, value })
  }
  return options
}

export function MonthPicker({ selectedMonth }: { selectedMonth: string }) {
  const router      = useRouter()
  const pathname    = usePathname()
  const searchParams = useSearchParams()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const options = buildMonthOptions(12)
  const current = options.find(o => o.value === selectedMonth) ?? options[0]

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function pick(value: string) {
    setOpen(false)
    const params = new URLSearchParams(searchParams.toString())
    params.set('month', value)
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div ref={ref} style={{ position: 'relative', userSelect: 'none' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          background: 'rgba(255,255,255,.05)',
          border: `1px solid ${open ? 'rgba(96,165,250,.4)' : 'rgba(255,255,255,.1)'}`,
          borderRadius: '20px', padding: '7px 14px',
          fontSize: '12px', fontWeight: 600,
          color: '#93c5fd',
          cursor: 'pointer', transition: 'border-color .15s',
          whiteSpace: 'nowrap',
        }}
      >
        <span style={{ fontSize: '11px', opacity: 0.6 }}>📅</span>
        {current.label}
        <span style={{
          marginLeft: '2px', fontSize: '9px',
          color: 'rgba(255,255,255,.3)',
          transform: open ? 'rotate(180deg)' : 'none',
          display: 'inline-block', transition: 'transform .15s',
        }}>
          ▾
        </span>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', right: 0,
          minWidth: '210px', zIndex: 50,
          background: '#12152b',
          border: '1px solid rgba(255,255,255,.1)',
          borderRadius: '12px', overflow: 'hidden',
          boxShadow: '0 16px 40px rgba(0,0,0,.5)',
          maxHeight: '280px', overflowY: 'auto',
        }}>
          {options.map((opt, i) => (
            <button
              key={opt.value}
              onClick={() => pick(opt.value)}
              style={{
                width: '100%', textAlign: 'left',
                padding: '9px 14px', fontSize: '12px', fontWeight: 500,
                background: selectedMonth === opt.value ? 'rgba(37,99,235,.15)' : 'transparent',
                color: selectedMonth === opt.value ? '#93c5fd' : 'rgba(255,255,255,.55)',
                border: 'none', cursor: 'pointer',
                borderBottom: i < options.length - 1 ? '1px solid rgba(255,255,255,.04)' : 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                transition: 'background .1s',
              }}
              onMouseEnter={e => {
                if (selectedMonth !== opt.value)
                  (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,.04)'
              }}
              onMouseLeave={e => {
                if (selectedMonth !== opt.value)
                  (e.currentTarget as HTMLElement).style.background = 'transparent'
              }}
            >
              {opt.label}
              {i === 0 && (
                <span style={{
                  fontSize: '9px', fontWeight: 700,
                  background: 'rgba(37,99,235,.25)', color: '#93c5fd',
                  borderRadius: '8px', padding: '2px 7px', letterSpacing: '.06em',
                }}>
                  NOW
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
