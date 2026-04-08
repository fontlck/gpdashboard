'use client'

import { useEffect } from 'react'

/** Triggers window.print() once the page has fully rendered. */
export function PrintTrigger() {
  useEffect(() => {
    const t = setTimeout(() => window.print(), 400)
    return () => clearTimeout(t)
  }, [])
  return null
}
