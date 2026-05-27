'use client'

import { useRef, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import type { ReactNode, TouchEvent } from 'react'

function shiftMonth(value: string, delta: number): string {
  const [y, m] = value.split('-').map(Number)
  const date = new Date(y, m - 1 + delta, 1)
  const ny = date.getFullYear()
  const nm = date.getMonth() + 1
  const now = new Date()
  if (ny > now.getFullYear() || (ny === now.getFullYear() && nm > now.getMonth() + 1)) return value
  return `${ny}-${String(nm).padStart(2, '0')}`
}

export function SwipeMonthWrapper({
  children,
  currentMonth,
  branchId,
}: {
  children: ReactNode
  currentMonth: string
  branchId?: string | null
}) {
  const router   = useRouter()
  const pathname = usePathname()
  const startX   = useRef<number | null>(null)

  const onTouchStart = useCallback((e: TouchEvent<HTMLDivElement>) => {
    startX.current = e.touches[0].clientX
  }, [])

  const onTouchEnd = useCallback((e: TouchEvent<HTMLDivElement>) => {
    if (startX.current === null) return
    const dx = e.changedTouches[0].clientX - startX.current
    startX.current = null

    if (Math.abs(dx) < 60) return

    const delta = dx < 0 ? 1 : -1 // swipe left → next month, swipe right → prev month
    const next  = shiftMonth(currentMonth, delta)
    if (next === currentMonth) return

    const params = new URLSearchParams()
    params.set('month', next)
    if (branchId) params.set('branch', branchId)
    router.push(`${pathname}?${params.toString()}`)
  }, [currentMonth, branchId, pathname, router])

  return (
    <div onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} style={{ minHeight: 0 }}>
      {children}
    </div>
  )
}
