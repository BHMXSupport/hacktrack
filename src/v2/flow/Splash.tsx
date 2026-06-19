/**
 * Splash.tsx — v2 flow
 *
 * Pantalla de bienvenida premium.  Auto-avanza a 's-onboarding' tras ~2 s.
 * Respeta prefers-reduced-motion: sin animaciones cuando está activo.
 *
 * ScreenId: 's-splash'
 * Dispatch: { t: 'go', screen: 's-onboarding' }
 */
import { useEffect } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { useApp } from '../../lib/store'
import posterSrc from '../../assets/rebuild/hero-poster.webp'

// Wordmark vectorial inline — sin dependencia de activos tipográficos externos.
// "Hack" blanco, "track" teal.
function Wordmark() {
  return (
    <svg
      aria-label="Hacktrack"
      viewBox="0 0 200 42"
      className="mx-auto w-[180px]"
      fill="none"
    >
      <text
        x="0"
        y="34"
        fontFamily="system-ui, -apple-system, sans-serif"
        fontWeight="800"
        fontSize="34"
        letterSpacing="-1"
        fill="#ffffff"
      >
        Hack
      </text>
      <text
        x="90"
        y="34"
        fontFamily="system-ui, -apple-system, sans-serif"
        fontWeight="800"
        fontSize="34"
        letterSpacing="-1"
        fill="var(--teal, #5FC9B8)"
      >
        track
      </text>
    </svg>
  )
}

// Ícono seismograma — identidad visual de la marca
function BrandIcon({ size = 72 }: { size?: number }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 76 76"
      fill="none"
    >
      <circle
        cx="38"
        cy="38"
        r="34"
        stroke="#5FC9B8"
        strokeWidth="2"
        opacity="0.35"
      />
      <path
        d="M12 38 H26 L31 22 L39 54 L44 38 H64"
        stroke="#5FC9B8"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function Splash() {
  const { dispatch } = useApp()
  const reduce = useReducedMotion()

  useEffect(() => {
    const delay = reduce ? 0 : 2200
    const timer = setTimeout(() => {
      dispatch({ t: 'go', screen: 's-onboarding' })
    }, delay)
    return () => clearTimeout(timer)
  }, [dispatch, reduce])

  // ── Reduced-motion: pantalla estática, sin video ni animaciones ─────────────
  if (reduce) {
    return (
      <div
        role="status"
        aria-label="Cargando Hacktrack"
        className="absolute inset-0 flex flex-col items-center justify-center bg-void"
      >
        <BrandIcon />
        <div className="mt-5 flex flex-col items-center gap-2">
          <Wordmark />
          <p className="text-[14px] text-muted-foreground">
            tu progreso, en una sola pantalla
          </p>
        </div>
      </div>
    )
  }

  // ── Versión animada ──────────────────────────────────────────────────────────
  return (
    <div
      role="status"
      aria-label="Cargando Hacktrack"
      className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden bg-void"
    >
      {/* Póster estático de base (esta pantalla casi siempre va cubierta por el gate/preloader). */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${posterSrc})`, opacity: 0.3 }}
      />

      {/* Gradiente para asegurar contraste */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#0D1117]/70 via-[#0D1117]/40 to-[#0D1117]/80" />

      {/* Contenido centrado */}
      <div className="relative flex flex-col items-center gap-5">
        {/* Ícono con trazo animado */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0, 0, 0.2, 1] }}
        >
          <BrandIcon size={80} />
        </motion.div>

        {/* Wordmark + tagline — stagger */}
        <motion.div
          initial="hidden"
          animate="show"
          variants={{
            show: {
              transition: { staggerChildren: 0.12, delayChildren: 0.35 },
            },
          }}
          className="flex flex-col items-center gap-2"
        >
          <motion.div
            variants={{
              hidden: { opacity: 0, y: 10 },
              show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0, 0, 0.2, 1] } },
            }}
          >
            <Wordmark />
          </motion.div>

          <motion.p
            variants={{
              hidden: { opacity: 0, y: 8 },
              show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0, 0, 0.2, 1] } },
            }}
            className="text-[14px] text-muted-foreground"
          >
            tu progreso, en una sola pantalla
          </motion.p>
        </motion.div>
      </div>

      {/* Teal line cargando — bottom-safe */}
      <motion.div
        className="absolute bottom-[max(36px,calc(28px+env(safe-area-inset-bottom)))] h-0.5 rounded-full bg-teal"
        initial={{ width: '0%', opacity: 0 }}
        animate={{ width: '40%', opacity: 0.6 }}
        transition={{ delay: 0.6, duration: 1.4, ease: 'easeInOut' }}
      />
    </div>
  )
}
