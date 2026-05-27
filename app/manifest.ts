import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'GP Dashboard',
    short_name: 'GP Dash',
    description: 'Partner revenue reporting dashboard',
    start_url: '/admin',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#06080F',
    theme_color: '#06080F',
    icons: [
      {
        src: '/logo-mark.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    categories: ['finance', 'business'],
  }
}
