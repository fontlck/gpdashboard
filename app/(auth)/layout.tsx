import type { ReactNode } from 'react'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Sign In' }

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh flex items-center justify-center"
         style={{ background: 'radial-gradient(ellipse at 60% 0%, rgba(59,130,246,0.05) 0%, transparent 60%), #06080F' }}>
      {children}
    </div>
  )
}
