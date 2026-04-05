import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      // ── Brand Colours ────────────────────────────────────────
      colors: {
        // Canvas
        canvas:  '#080A10',
        surface: '#0D0F1A',
        'surface-2': '#13151F',
        'surface-3': '#1A1D2A',

        // Borders
        border:      'rgba(255,255,255,0.06)',
        'border-md': 'rgba(255,255,255,0.10)',
        'border-lg': 'rgba(255,255,255,0.16)',

        // Gold accent (partnership hero, highlights)
        gold: {
          DEFAULT: '#C4A35E',
          light:   '#D4BB82',
          muted:   'rgba(196,163,94,0.18)',
          border:  'rgba(196,163,94,0.45)',
        },

        // Text
        'text-primary': '#F0ECE4',
        'text-secondary': 'rgba(240,236,228,0.65)',
        'text-muted':    'rgba(240,236,228,0.35)',
        'text-faint':    'rgba(240,236,228,0.2)',

        // Semantic
        success: '#22C55E',
        warning: '#F59E0B',
        danger:  '#EF4444',
        info:    '#3B82F6',
      },

      // ── Typography ───────────────────────────────────────────
      fontFamily: {
        sans:  ['var(--font-dm-sans)', 'system-ui', 'sans-serif'],
        thai:  ['var(--font-prompt)',   'system-ui', 'sans-serif'],
        mono:  ['var(--font-mono)',     'monospace'],
      },

      // ── Spacing additions ────────────────────────────────────
      spacing: {
        '18': '4.5rem',
        '72': '18rem',
        '84': '21rem',
        '96': '24rem',
      },

      // ── Border radius ────────────────────────────────────────
      borderRadius: {
        'xl':  '12px',
        '2xl': '16px',
        '3xl': '20px',
      },

      // ── Box shadows ──────────────────────────────────────────
      boxShadow: {
        'card':   '0 4px 24px rgba(0,0,0,0.35)',
        'hero':   '0 8px 48px rgba(0,0,0,0.50)',
        'chip':   '0 4px 24px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.04)',
        'glow-gold': '0 0 24px rgba(196,163,94,0.15)',
      },

      // ── Animation ────────────────────────────────────────────
      keyframes: {
        'fade-in': {
          '0%':   { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'shimmer': {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.3s ease-out',
        'shimmer': 'shimmer 2s linear infinite',
      },
    },
  },
  plugins: [],
}

export default config
