import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title:       { default: 'GP Dashboard', template: '%s | GP Dashboard' },
  description: 'Partner revenue reporting dashboard',
  robots:      'noindex, nofollow', // private portal — do not index
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body>{children}</body>
    </html>
  )
}
