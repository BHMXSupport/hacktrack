import type { Config } from 'tailwindcss'

// Hacktrack — Design System "Bitácora". Reporte editorial de papel-y-tinta.
// Tokens (Papel claro + Tinta oscuro + alto contraste) en src/styles/globals.css.
// Fuentes self-hosted vía @fontsource en src/main.tsx (sin CDN de Google).
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // ── Tokens Bitácora (nuevos, para Stage 2+) ──
        paper: 'var(--paper)',
        surface: 'var(--surface)',
        raised: 'var(--raised)',
        ink: { DEFAULT: 'var(--ink)', 2: 'var(--ink-2)', 3: 'var(--ink-3)' },
        hairline: 'var(--hairline)',
        blue: { DEFAULT: 'var(--blue)', press: 'var(--blue-press)' },
        amber: { DEFAULT: 'var(--amber)', soft: 'var(--amber-soft)', ink: 'var(--amber-ink)' },
        ok: 'var(--ok)',
        warn: 'var(--warn)',
        alert: 'var(--alert)',
        // ── Alias legados (compat): el árbol vivo usa estas clases; apuntan a los
        //    mismos CSS vars remapeados a la paleta cálida → sigue renderizando. ──
        void: 'var(--void)',
        background: 'var(--background)',
        card: { DEFAULT: 'var(--card)', foreground: 'var(--card-foreground)' },
        foreground: 'var(--foreground)',
        muted: { DEFAULT: 'var(--muted)', foreground: 'var(--muted-foreground)' },
        secondary: { DEFAULT: 'var(--secondary)', foreground: 'var(--secondary-foreground)' },
        border: 'var(--border)',
        input: 'var(--input)',
        ring: 'var(--ring)',
        primary: { DEFAULT: 'var(--primary)', foreground: 'var(--primary-foreground)' },
        teal: { DEFAULT: 'var(--teal)', dim: 'var(--teal-dim)', bright: 'var(--teal-bright)' },
      },
      fontFamily: {
        // Body / UI (denso, legible, AA). Fraunces = voz (numerales/titulares). Mono = micro-labels/units.
        sans: ['"Inter Variable"', 'Inter', 'system-ui', 'sans-serif'],
        serif: ['"Fraunces Variable"', 'Georgia', 'serif'],
        display: ['"Fraunces Variable"', 'Georgia', 'serif'],
        mono: ['"JetBrains Mono Variable"', '"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        // Escala Bitácora (reemplaza valores arbitrarios). display = numerales hero (adherencia %, mg).
        display: ['clamp(3.5rem, 4vw + 2.4rem, 5.5rem)', { lineHeight: '0.95', letterSpacing: '-0.02em' }],
        h1: ['1.875rem', { lineHeight: '1.1', letterSpacing: '-0.01em' }],   // 30px — títulos de pantalla
        h2: ['1.375rem', { lineHeight: '1.15' }],                            // 22px
        title: ['1.0625rem', { lineHeight: '1.25', fontWeight: '600' }],     // 17px — títulos de card, nombres
        body: ['0.9375rem', { lineHeight: '1.45' }],                         // 15px — body mínimo
        label: ['0.75rem', { lineHeight: '1.3', letterSpacing: '0.08em' }],  // 12px — eyebrow/section (mono UPPER)
        micro: ['0.6875rem', { lineHeight: '1.3' }],                         // 11px — units/timestamps
        // Legado (Inicio hero usa text-readout) — se conserva para no romper el árbol vivo.
        readout: ['2.75rem', { lineHeight: '1', letterSpacing: '-0.02em' }],
      },
      // Escala de radios ÚNICA (se eliminó la duplicada de globals.css). 2xl/full = defaults de Tailwind.
      borderRadius: { xl: '26px', lg: '20px', md: '14px', sm: '10px' },
      boxShadow: {
        // Papel: sombra cálida suave. Obsidiana: panel (faceta + medio-pixel de oro-hoja).
        // glow sigue a var(--amber) (oro #E3B341 en oscuro) — antes clavaba el ámbar viejo de Tinta.
        soft: '0 1px 2px rgba(26,23,18,.04), 0 8px 24px rgba(26,23,18,.07)',
        panel: 'inset 0 1px 0 rgba(255,255,255,.06), 0 14px 36px rgba(0,0,0,.5), 0 0 0 .5px rgba(227,179,65,.06)',
        glass: '0 1px 2px rgba(26,23,18,.04), 0 8px 24px rgba(26,23,18,.07)',
        nav: '0 8px 30px rgba(26,23,18,.10), 0 0 0 .5px rgba(26,23,18,.06)',
        glow: '0 0 22px color-mix(in srgb, var(--amber) 35%, transparent)',
      },
      // Reservado para nav + sheet-asentado únicamente (no "vidrio en todas partes").
      backdropBlur: { sheet: '20px', nav: '28px' },
      keyframes: {
        // Se purgó 'focus-in' (animaba filter/blur → viola "nunca animar filter").
        'fade-up': { '0%': { opacity: '0', transform: 'translateY(12px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
      },
      animation: {
        // Easing firma Bitácora: cubic-bezier(0.16,1,0.3,1) (ease-out editorial).
        'fade-up': 'fade-up .5s cubic-bezier(0.16,1,0.3,1) both',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
} satisfies Config
