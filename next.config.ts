import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // ── Public env vars — provide build-time fallbacks so the Edge
  //    Middleware always has these values even if the Vercel project
  //    settings were not configured before the first deploy.
  //    These are public (anon) values; no secrets here.
  env: {
    NEXT_PUBLIC_SUPABASE_URL:
      process.env.NEXT_PUBLIC_SUPABASE_URL ??
      'https://pzwumotqnnmxnsrfjalz.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB6d3Vtb3Rxbm5teG5zcmZqYWx6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzNzcxNTksImV4cCI6MjA5MDk1MzE1OX0.sENwC9JJR2q2Ig272LxBKirya3lEryOtEIkTJrqWuD4',
  },

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
