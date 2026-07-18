/**
 * Onboarding.tsx — v2 flow
 *
 * 3 slides de introducción (Ritmo · Datos · Privacidad), estética "Bitácora":
 * ilustraciones como columnas impresas (papel/tinta, serif en numerales, ámbar = energía,
 * azul = interactivo). Botón "Continuar" avanza; "Saltar" y botón final van a 's-goal'.
 * Soporta swipe horizontal. Respeta prefers-reduced-motion.
 *
 * ScreenId: 's-onboarding'
 * Dispatch: { t: 'go', screen: 's-goal' }
 */
import { useState } from 'react'
import { motion, AnimatePresence, useReducedMotion, type PanInfo } from 'framer-motion'
import { Shield, BarChart2, Clock } from 'lucide-react'
import { useApp } from '../../lib/store'
import { Button } from '../ui/Button'
import { Glass } from '../ui/Glass'
import { EASE } from '../lib/motion'

// ── Ilustraciones (columnas impresas de ejemplo) ─────────────────────────────

/** Slide 0 — mini reporte de adherencia (ritmo/recordatorios) */
function IllustrationRitmo() {
  const weekDots = [true, true, false, true, true, true, false]
  // #23: usar las MISMAS abreviaturas que el editor de cadencia (WDS) — evita la confusión 'X' vs 'Mi'
  const dias = ['L', 'Ma', 'Mi', 'J', 'V', 'S', 'D']

  return (
    <Glass className="mx-auto flex w-full max-w-[280px] flex-col gap-3 p-4">
      {/* #20: etiqueta "Ejemplo" para que no parezca progreso real del usuario */}
      <span className="self-start rounded-full border border-hairline bg-raised px-2 py-0.5 font-mono text-[12px] font-medium uppercase tracking-[0.12em] text-ink-2">
        Ejemplo
      </span>
      <div className="flex items-center gap-2">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--blue)_12%,transparent)]">
          <Clock size={16} className="text-blue" />
        </span>
        <div>
          <p className="text-[13px] font-semibold text-ink">Adherencia</p>
          <p className="text-[12px] text-ink-2">Este mes · 22/30 días</p>
        </div>
        {/* Numeral serif — la voz */}
        <span className="ml-auto font-serif text-[22px] font-normal tabular-nums leading-none text-ink">
          74<span className="font-mono text-[12px] font-medium text-ink-2">%</span>
        </span>
      </div>

      {/* Tira semanal — el ámbar es la energía del registro */}
      <div className="flex gap-1.5">
        {dias.map((d, i) => (
          <div key={d} className="flex flex-1 flex-col items-center gap-1">
            {/* micro 11 — tick de eje decorativo, nunca info clave */}
            <span className="font-mono text-[11px] font-medium text-ink-3">{d}</span>
            <div
              className={`aspect-square w-full rounded-[2px] ${weekDots[i] ? 'bg-amber' : 'border border-hairline bg-raised'}`}
            />
          </div>
        ))}
      </div>

      {/* Seismograma simplificado — línea de energía ámbar */}
      <svg viewBox="0 0 244 36" fill="none" className="h-8 w-full" aria-hidden="true">
        <path
          d="M4 18 H40 L52 5 L64 31 L76 12 L88 24 L100 18 H244"
          stroke="var(--amber)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="52" cy="5" r="3.5" fill="var(--amber)" opacity="0.8" />
        <circle cx="64" cy="31" r="3.5" fill="var(--amber)" opacity="0.8" />
        <circle cx="76" cy="12" r="3" fill="var(--amber)" opacity="0.6" />
      </svg>

      {/* Dosis simulada — fila azul (interactivo) */}
      <div className="flex items-center gap-2 rounded-[8px] bg-[color-mix(in_srgb,var(--blue)_8%,transparent)] px-3 py-2">
        <span className="h-2 w-2 flex-shrink-0 rounded-full bg-blue" />
        <span className="text-[12px] text-ink">
          Dosis de hoy: <strong>08:00</strong>
        </span>
      </div>
    </Glass>
  )
}

/** Slide 1 — barras de progreso de KPIs (figura editorial) */
function IllustrationDatos() {
  // Colores de serie con tokens: ámbar = energía, azul = datos, tinta-2 = tercera serie.
  const kpis = [
    { label: 'Energía', pct: 78, color: 'var(--amber)' },
    { label: 'Sueño',   pct: 65, color: 'var(--blue)' },
    { label: 'Foco',    pct: 88, color: 'var(--ink-2)' },
  ]

  return (
    <Glass className="mx-auto flex w-full max-w-[280px] flex-col gap-4 p-4">
      <span className="self-start rounded-full border border-hairline bg-raised px-2 py-0.5 font-mono text-[12px] font-medium uppercase tracking-[0.12em] text-ink-2">
        Ejemplo
      </span>
      <div className="flex items-center gap-2">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--blue)_12%,transparent)]">
          <BarChart2 size={16} className="text-blue" />
        </span>
        <p className="text-[13px] font-semibold text-ink">Tu progreso</p>
      </div>
      {kpis.map(({ label, pct, color }) => (
        <div key={label} className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[12px] text-ink-2">{label}</span>
            {/* Numeral en tinta (AA); el color queda en la barra (elemento gráfico ≥3:1) */}
            <span className="font-mono text-[12px] font-medium tabular-nums text-ink">
              {pct}<span className="font-normal text-ink-3">/100</span>
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-raised">
            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
          </div>
        </div>
      ))}
      {/* Curva de tendencia — azul de datos */}
      <svg viewBox="0 0 244 36" fill="none" className="h-8 w-full opacity-60" aria-hidden="true">
        <path
          d="M4 30 C40 24 80 14 120 8 C160 2 200 14 240 6"
          stroke="var(--blue)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="4 4"
        />
        <circle cx="120" cy="8" r="4" fill="var(--blue)" />
      </svg>
    </Glass>
  )
}

/** Slide 2 — privacidad local-first */
function IllustrationPrivacidad() {
  return (
    <div className="mx-auto flex w-full max-w-[280px] flex-col items-center gap-4">
      {/* Escudo — azul de confianza */}
      <svg viewBox="0 0 120 120" fill="none" className="h-28 w-28" aria-hidden="true">
        <circle cx="60" cy="60" r="56" fill="var(--blue)" fillOpacity="0.06" />
        <path
          d="M60 22 L92 36 L92 68 C92 88 60 100 60 100 C60 100 28 88 28 68 L28 36 Z"
          stroke="var(--blue)"
          strokeWidth="2.5"
          strokeLinejoin="round"
          fill="var(--blue)"
          fillOpacity="0.10"
        />
        <path
          d="M46 60 l10 10 18-20"
          stroke="var(--blue)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="28" cy="36" r="4" fill="var(--amber)" opacity="0.5" />
        <circle cx="98" cy="80" r="5" fill="var(--amber)" opacity="0.4" />
        <circle cx="22" cy="84" r="3" fill="var(--amber)" opacity="0.3" />
      </svg>

      {/* Bullets de privacidad — filas impresas */}
      <div className="flex w-full flex-col gap-2">
        {[
          'Tu historial se guarda solo en tu dispositivo',
          'Sin servidores externos ni venta de datos',
          'Puedes borrar todo cuando quieras (ARCO)',
        ].map((txt) => (
          <div
            key={txt}
            className="flex items-start gap-2.5 rounded-[8px] border border-hairline bg-surface px-3 py-2.5"
          >
            <Shield size={14} className="mt-0.5 flex-shrink-0 text-blue" />
            <span className="text-[12px] leading-snug text-ink-2">{txt}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Config ───────────────────────────────────────────────────────────────────

const SLIDES = [
  {
    key: 'ritmo',
    title: 'Nunca pierdas el ritmo',
    body: 'Recordatorios inteligentes y registro en un toque.',
    Illustration: IllustrationRitmo,
  },
  {
    key: 'datos',
    title: 'Mira tu progreso hacia tu meta',
    body: 'Tus datos, claros y en una sola pantalla.',
    Illustration: IllustrationDatos,
  },
  {
    key: 'privacidad',
    title: 'Tus datos son tuyos. Tú los controlas.',
    body: 'Sin servidores externos, sin venta de información.',
    Illustration: IllustrationPrivacidad,
  },
] as const

// ── Componente principal ─────────────────────────────────────────────────────

export function Onboarding() {
  const { dispatch } = useApp()
  const reduce = useReducedMotion()

  const [slide, setSlide] = useState(0)
  const [dir, setDir] = useState(1)

  const goTo = (idx: number) => {
    setDir(idx > slide ? 1 : -1)
    setSlide(idx)
  }
  const advance = () => { if (slide < SLIDES.length - 1) goTo(slide + 1) }
  const toGoal = () => dispatch({ t: 'go', screen: 's-goal' })

  const onSwipe = (_e: unknown, info: PanInfo) => {
    if (info.offset.x < -50) advance()
    else if (info.offset.x > 50 && slide > 0) goTo(slide - 1)
  }

  // Eje compartido X con la firma de easing editorial (motion.ts).
  const slideVariants = {
    initial: (d: number) => ({ opacity: 0, x: reduce ? 0 : d * 28 }),
    animate: { opacity: 1, x: 0, transition: { duration: reduce ? 0 : 0.32, ease: EASE } },
    exit: (d: number) => ({ opacity: 0, x: reduce ? 0 : d * -28, transition: { duration: reduce ? 0 : 0.22, ease: EASE } }),
  }

  const { title, body, Illustration } = SLIDES[slide]
  const isLast = slide === SLIDES.length - 1

  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden bg-paper">

      {/* A11y live region */}
      <div
        aria-live="polite"
        className="sr-only"
      >
        {`Paso ${slide + 1} de ${SLIDES.length}: ${title}`}
      </div>

      {/* Barra superior: "Iniciar sesión" (#7, para quien regresa) + "Saltar" */}
      <div
        className="flex flex-shrink-0 items-center justify-between px-5"
        style={{ paddingTop: 'max(20px, env(safe-area-inset-top))', minHeight: 56 }}
      >
        <button
          onClick={() => dispatch({ t: 'go', screen: 's-login' })}
          className="inline-flex h-11 items-center justify-center rounded-md px-2 text-[13px] font-semibold text-blue hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
        >
          Iniciar sesión
        </button>
        <button
          onClick={toGoal}
          className="inline-flex h-11 min-w-[44px] items-center justify-center rounded-md px-3 text-[14px] text-ink-2 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
        >
          Saltar
        </button>
      </div>

      {/* Área de ilustración — arrastrarable */}
      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.12}
        onDragEnd={onSwipe}
        className="relative mt-2 h-[220px] flex-shrink-0 overflow-hidden"
        style={{ touchAction: 'pan-y' }}
      >
        <AnimatePresence mode="wait" custom={dir}>
          <motion.div
            key={`ill-${slide}`}
            custom={dir}
            variants={slideVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="absolute inset-0 flex items-center justify-center px-5"
          >
            <Illustration />
          </motion.div>
        </AnimatePresence>
      </motion.div>

      {/* Indicadores de puntos — activo azul (interactivo) */}
      <nav
        aria-label="Pasos del recorrido"
        className="mt-5 flex flex-shrink-0 items-center justify-center gap-1.5"
      >
        {SLIDES.map((s, i) => (
          <button
            key={s.key}
            onClick={() => goTo(i)}
            aria-label={`${s.title} — paso ${i + 1} de ${SLIDES.length}`}
            aria-current={i === slide ? 'step' : undefined}
            className="flex h-5 w-5 items-center justify-center"
          >
            <motion.div
              animate={{ width: i === slide ? 22 : 7 }}
              transition={{ type: 'spring', stiffness: 340, damping: 28 }}
              className={`h-1.5 rounded-full transition-colors ${i === slide ? 'bg-blue' : 'bg-[color-mix(in_srgb,var(--ink-3)_45%,transparent)]'}`}
            />
          </button>
        ))}
      </nav>

      {/* Copy — titular serif (la voz editorial) */}
      <div className="relative mt-6 flex-1 overflow-hidden px-6">
        <AnimatePresence mode="wait" custom={dir}>
          <motion.div
            key={`copy-${slide}`}
            custom={dir}
            variants={slideVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="absolute inset-0 px-6"
          >
            <h1 className="mb-3 font-serif text-[28px] font-normal leading-[1.1] tracking-[-0.01em] text-ink">
              {title}
            </h1>
            <p className="text-[15px] leading-relaxed text-ink-2">
              {body}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Botones */}
      <div
        className="flex-shrink-0 px-6"
        style={{ paddingBottom: 'max(32px, calc(24px + env(safe-area-inset-bottom)))' }}
      >
        <AnimatePresence mode="wait">
          {!isLast ? (
            <motion.div
              key="btn-next"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
            >
              <Button size="full" onClick={advance}>
                Continuar
              </Button>
            </motion.div>
          ) : (
            <motion.div
              key="btn-start"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col gap-2"
            >
              <Button size="full" onClick={toGoal}>
                Comenzar
              </Button>
              <Button
                size="full"
                variant="ghost"
                onClick={() => dispatch({ t: 'go', screen: 's-login' })}
              >
                Ya tengo cuenta
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
