'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useState, useRef, useEffect } from 'react'

type Branch = { id: string; name: string }

export function BranchDropdown({
  branches,
  selectedId,
}: {
  branches: Branch[]
  selectedId: string | null
}) {
  const router   = useRouter()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const selected = branches.find(b => b.id === selectedId) ?? null

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function pick(id: string | null) {
    setOpen(false)
    const url = id ? `${pathname}?branch=${id}` : pathname
    router.push(url)
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
          color: selected ? '#93c5fd' : 'rgba(255,255,255,.45)',
          cursor: 'pointer', transition: 'border-color .15s',
          whiteSpace: 'nowrap',
        }}
      >
        {selected ? (
          <>
            <span style={{
              width: '6px', height: '6px', borderRadius: '50%',
              background: '#22c55e', flexShrink: 0,
            }} />
            {selected.name}
          </>
        ) : (
          'All branches'
        )}
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
          minWidth: '200px', zIndex: 50,
          background: '#12152b',
          border: '1px solid rgba(255,255,255,.1)',
          borderRadius: '12px', overflow: 'hidden',
          boxShadow: '0 16px 40px rgba(0,0,0,.5)',
        }}>
          {/* All branches */}
          <button
            onClick={() => pick(null)}
            style={{
              width: '100%', textAlign: 'left',
              padding: '9px 14px', fontSize: '12px', fontWeight: 600,
              background: !selected ? 'rgba(37,99,235,.1)' : 'transparent',
              color: !selected ? '#93c5fd' : 'rgba(255,255,255,.5)',
              border: 'none', cursor: 'pointer',
              borderBottom: '1px solid rgba(255,255,255,.06)',
              transition: 'background .1s',
            }}
            onMouseEnter={e => { if (selected) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,.04)' }}
            onMouseLeave={e => { if (selected) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
          >
            All branches
          </button>

          {/* Branch list */}
          {branches.map((b, i) => (
            <button
              key={b.id}
              onClick={() => pick(b.id)}
              style={{
                width: '100%', textAlign: 'left',
                padding: '9px 14px', fontSize: '12px', fontWeight: 500,
                background: selectedId === b.id ? 'rgba(37,99,235,.1)' : 'transparent',
                color: selectedId === b.id ? '#93c5fd' : 'rgba(255,255,255,.55)',
                border: 'none', cursor: 'pointer',
                borderBottom: i < branches.length - 1 ? '1px solid rgba(255,255,255,.04)' : 'none',
                display: 'flex', alignItems: 'center', gap: '8px',
                transition: 'background .1s',
              }}
              onMouseEnter={e => { if (selectedId !== b.id) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,.04)' }}
              onMouseLeave={e => { if (selectedId !== b.id) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
            >
              <span style={{
                width: '5px', height: '5px', borderRadius: '50%',
                background: '#22c55e', flexShrink: 0,
              }} />
              {b.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
