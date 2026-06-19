import type { Config } from 'tailwindcss'

// Hacktrack rebuild — "Precision × Accessible" design system.
// Cockpit oscuro premium + accesibilidad AA. Tokens en src/styles/globals.css.
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        void: 'var(--void)',
        background: 'var(--background)',
        raised: 'var(--raised)',
        card: { DEFAULT: 'var(--card)', foreground: 'var(--card-foreground)' },
        foreground: 'var(--foreground)',
        muted: { DEFAULT: 'var(--muted)', foreground: 'var(--muted-foreground)' },
        secondary: { DEFAULT: 'var(--secondary)', foreground: 'var(--secondary-foreground)' },
        border: 'var(--border)',
        input: 'var(--input)',
        ring: 'var(--ring)',
        primary: { DEFAULT: 'var(--primary)', foreground: 'var(--primary-foreground)' },
        teal: { DEFAULT: 'var(--teal)', dim: 'var(--teal-dim)', bright: 'var(--teal-bright)' },
        ok: 'var(--ok)',
        warn: 'var(--warn)',
        alert: 'var(--alert)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        readout: ['2.75rem', { lineHeight: '1', letterSpacing: '-0.02em' }],
      },
      borderRadius: { xl: '24px', lg: '20px', md: '16px', sm: '12px' },
      boxShadow: {
        glass: 'inset 0 1px 0 rgba(255,255,255,.06), 0 16px 40px rgba(0,0,0,.55), 0 0 0 .5px rgba(95,201,184,.10)',
        nav: 'inset 0 1px 0 rgba(255,255,255,.06), 0 16px 40px rgba(0,0,0,.6), 0 0 0 .5px rgba(95,201,184,.12)',
        glow: '0 0 22px rgba(95,201,184,.35)',
      },
      backdropBlur: { glass: '20px', nav: '28px' },
      keyframes: {
        'fade-up': { '0%': { opacity: '0', transform: 'translateY(12px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        'focus-in': { '0%': { opacity: '0', filter: 'blur(6px)' }, '100%': { opacity: '1', filter: 'blur(0)' } },
      },
      animation: {
        'fade-up': 'fade-up .35s cubic-bezier(0,0,0,1) both',
        'focus-in': 'focus-in .4s cubic-bezier(0,0,0,1) both',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
} satisfies Config
