import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // ── TypeScript & ESLint ──────────────────────────────────────
  typescript: { ignoreBuildErrors: false },
  eslint:     { ignoreDuringBuilds: false },

  // ── Image Optimisation ───────────────────────────────────────
  // Allow Supabase Storage images to be served via next/image
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'pzwumotqnnmxnsrfjalz.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },

  // ── Security Headers ─────────────────────────────────────────
  // Private portal — lock down framing and content types
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // Prevent clickjacking
          { key: 'X-Frame-Options',         value: 'DENY' },
          // Prevent MIME sniffing
          { key: 'X-Content-Type-Options',  value: 'nosniff' },
          // Referrer leakage control
          { key: 'Referrer-Policy',         value: 'strict-origin-when-cross-origin' },
          // Permissions policy — this portal needs no camera/mic/location
          { key: 'Permissions-Policy',      value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ]
  },

  // ── Logging (Vercel) ─────────────────────────────────────────
  logging: {
    fetches: {
      fullUrl: process.env.NODE_ENV === 'development',
    },
  },
}

export default nextConfig
