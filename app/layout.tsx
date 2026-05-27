import type { ReactNode } from 'react'
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title:       { default: 'GP Dashboard', template: '%s | GP Dashboard' },
  description: 'Partner revenue reporting dashboard',
  robots:      'noindex, nofollow',
  manifest:    '/manifest.webmanifest',
  themeColor:  '#06080F',
  appleWebApp: {
    capable:        true,
    title:          'GP Dashboard',
    statusBarStyle: 'black-translucent',
    startupImage:   '/apple-touch-icon.png',
  },
  icons: {
    apple: '/apple-touch-icon.png',
    icon:  [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
}

export default function RootLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body>{children}</body>
    </html>
  )
}
