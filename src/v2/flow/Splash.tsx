/**
 * Splash.tsx — v2 flow
 *
 * Pantalla de bienvenida "Bitácora": masthead editorial sobre papel cálido.
 * Auto-avanza a 's-onboarding' tras ~2 s.
 * Respeta prefers-reduced-motion: sin animaciones cuando está activo.
 *
 * ScreenId: 's-splash'
 * Dispatch: { t: 'go', screen: 's-onboarding' }
 */
import { useEffect } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { useApp } from '../../lib/store'
import { EASE } from '../lib/motion'

// Wordmark editorial — serif Fraunces en tinta (la voz de la marca), sin activos externos.
function Wordmark() {
  return (
    <h1 className="font-serif text-[38px] font-normal leading-none tracking-[-0.01em] text-ink">
      Hacktrack
    </h1>
  )
}

// Ícono seismograma — identidad visual (línea de energía en ÁMBAR + bisel de tinta).
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
        stroke="var(--ink-3)"
        strokeWidth="1.5"
        strokeDasharray="2 5"
        opacity="0.6"
      />
      <path
        d="M12 38 H26 L31 22 L39 54 L44 38 H64"
        stroke="var(--amber)"
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

  // ── Reduced-motion: pantalla estática asentada ──────────────────────────────
  if (reduce) {
    return (
      <div
        role="status"
        aria-label="Cargando Hacktrack"
        className="absolute inset-0 flex flex-col items-center justify-center bg-paper"
      >
        <BrandIcon />
        <div className="mt-5 flex flex-col items-center gap-2">
          <Wordmark />
          <p className="font-mono text-[12px] font-medium uppercase tracking-[0.16em] text-ink-2">
            Tu bitácora
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
      className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden bg-paper"
    >
      {/* Contenido centrado */}
      <div className="relative flex flex-col items-center gap-5">
        {/* Ícono con entrada editorial */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE }}
        >
          <BrandIcon size={80} />
        </motion.div>

        {/* Wordmark + kicker — stagger */}
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
              show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE } },
            }}
          >
            <Wordmark />
          </motion.div>

          <motion.p
            variants={{
              hidden: { opacity: 0, y: 8 },
              show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE } },
            }}
            className="font-mono text-[12px] font-medium uppercase tracking-[0.16em] text-ink-2"
          >
            Tu bitácora
          </motion.p>
        </motion.div>
      </div>

      {/* Regla de carga que "se imprime" (rule-wipe ámbar, scaleX = GPU) — bottom-safe */}
      <div className="absolute bottom-[max(36px,calc(28px+env(safe-area-inset-bottom)))] flex w-full justify-center">
        <motion.div
          className="h-[2px] w-40 origin-left bg-amber"
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: 1, opacity: 0.8 }}
          transition={{ delay: 0.6, duration: 1.4, ease: EASE }}
        />
      </div>
    </div>
  )
}
