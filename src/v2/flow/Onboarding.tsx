/**
 * Onboarding.tsx — v2 flow
 *
 * 3 slides de introducción (Ritmo · Datos · Privacidad).
 * Botón "Continuar" avanza; "Saltar" y botón final van a 's-goal'.
 * Soporta swipe horizontal. Respeta prefers-reduced-motion.
 *
 * ScreenId: 's-onboarding'
 * Dispatch: { t: 'go', screen: 's-goal' }
 */
import { useState, useEffect } from 'react'
import { motion, AnimatePresence, useReducedMotion, type PanInfo } from 'framer-motion'
import { Shield, BarChart2, Clock } from 'lucide-react'
import { useApp } from '../../lib/store'
import { Button } from '../ui/Button'
import { Glass } from '../ui/Glass'

// ── Ilustraciones ────────────────────────────────────────────────────────────

/** Slide 0 — mini dashboard de adherencia (ritmo/recordatorios) */
function IllustrationRitmo() {
  const weekDots = [true, true, false, true, true, true, false]
  const dias = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

  return (
    <Glass className="w-full max-w-[280px] mx-auto flex flex-col gap-3 p-4">
      {/* Encabezado */}
      <div className="flex items-center gap-2">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-teal/15">
          <Clock size={16} className="text-teal" />
        </span>
        <div>
          <p className="text-[13px] font-bold text-foreground">Adherencia</p>
          <p className="text-[11px] text-muted-foreground">Este mes · 22/30 días</p>
        </div>
        <span className="ml-auto font-mono text-[18px] font-semibold text-teal tabular-nums">74%</span>
      </div>

      {/* Tira semanal */}
      <div className="flex gap-1.5">
        {dias.map((d, i) => (
          <div key={d} className="flex flex-1 flex-col items-center gap-1">
            <span className="text-[9px] font-semibold text-muted-foreground">{d}</span>
            <div
              className={`aspect-square w-full rounded-sm ${weekDots[i] ? 'bg-teal' : 'bg-white/10'}`}
            />
          </div>
        ))}
      </div>

      {/* Seismograma simplificado */}
      <svg viewBox="0 0 244 36" fill="none" className="h-8 w-full" aria-hidden="true">
        <path
          d="M4 18 H40 L52 5 L64 31 L76 12 L88 24 L100 18 H244"
          stroke="#5FC9B8"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="52" cy="5" r="3.5" fill="#5FC9B8" opacity="0.8" />
        <circle cx="64" cy="31" r="3.5" fill="#5FC9B8" opacity="0.8" />
        <circle cx="76" cy="12" r="3" fill="#5FC9B8" opacity="0.6" />
      </svg>

      {/* Dosis simulada */}
      <div className="flex items-center gap-2 rounded-md bg-teal/8 px-3 py-2">
        <span className="h-2 w-2 flex-shrink-0 rounded-full bg-teal" />
        <span className="text-[12px] text-foreground">
          Dosis de hoy: <strong>08:00</strong>
        </span>
      </div>
    </Glass>
  )
}

/** Slide 1 — barras de progreso de KPIs */
function IllustrationDatos() {
  const kpis = [
    { label: 'Energía',  pct: 78, color: '#E85D3A' },
    { label: 'Sueño',    pct: 65, color: '#5FC9B8' },
    { label: 'Foco',     pct: 88, color: '#6B7BE8' },
  ]

  return (
    <Glass className="w-full max-w-[280px] mx-auto flex flex-col gap-4 p-4">
      <div className="flex items-center gap-2">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-teal/15">
          <BarChart2 size={16} className="text-teal" />
        </span>
        <p className="text-[13px] font-bold text-foreground">Tu progreso</p>
      </div>
      {kpis.map(({ label, pct, color }) => (
        <div key={label} className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[12px] text-secondary-foreground">{label}</span>
            <span className="font-mono text-[12px] font-bold tabular-nums" style={{ color }}>
              {pct}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
          </div>
        </div>
      ))}
      {/* Curva de tendencia */}
      <svg viewBox="0 0 244 36" fill="none" className="h-8 w-full opacity-60" aria-hidden="true">
        <path
          d="M4 30 C40 24 80 14 120 8 C160 2 200 14 240 6"
          stroke="#6B7BE8"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="4 4"
        />
        <circle cx="120" cy="8" r="4" fill="#6B7BE8" />
      </svg>
    </Glass>
  )
}

/** Slide 2 — privacidad local-first */
function IllustrationPrivacidad() {
  return (
    <div className="flex w-full max-w-[280px] mx-auto flex-col items-center gap-4">
      {/* Escudo */}
      <svg viewBox="0 0 120 120" fill="none" className="w-28 h-28" aria-hidden="true">
        <circle cx="60" cy="60" r="56" fill="#5FC9B8" fillOpacity="0.08" />
        <path
          d="M60 22 L92 36 L92 68 C92 88 60 100 60 100 C60 100 28 88 28 68 L28 36 Z"
          stroke="#5FC9B8"
          strokeWidth="2.5"
          strokeLinejoin="round"
          fill="#5FC9B8"
          fillOpacity="0.12"
        />
        <path
          d="M46 60 l10 10 18-20"
          stroke="#5FC9B8"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="28" cy="36" r="4" fill="#5FC9B8" opacity="0.3" />
        <circle cx="98" cy="80" r="5" fill="#5FC9B8" opacity="0.25" />
        <circle cx="22" cy="84" r="3" fill="#5FC9B8" opacity="0.2" />
      </svg>

      {/* Bullets de privacidad */}
      <div className="flex w-full flex-col gap-2">
        {[
          'Tu historial se guarda solo en tu dispositivo',
          'Sin servidores externos ni venta de datos',
          'Puedes borrar todo cuando quieras (ARCO)',
        ].map((txt) => (
          <div
            key={txt}
            className="flex items-start gap-2.5 rounded-md border border-teal/15 bg-teal/6 px-3 py-2.5"
          >
            <Shield size={14} className="mt-0.5 flex-shrink-0 text-teal" />
            <span className="text-[12px] leading-snug text-secondary-foreground">{txt}</span>
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

  const slideVariants = {
    initial: (d: number) => ({ opacity: 0, x: reduce ? 0 : d * 28 }),
    animate: { opacity: 1, x: 0, transition: { duration: reduce ? 0 : 0.32, ease: [0, 0, 0.2, 1] as [number, number, number, number] } },
    exit: (d: number) => ({ opacity: 0, x: reduce ? 0 : d * -28, transition: { duration: reduce ? 0 : 0.22, ease: [0.4, 0, 1, 1] as [number, number, number, number] } }),
  }

  const { title, body, Illustration } = SLIDES[slide]
  const isLast = slide === SLIDES.length - 1

  return (
    <div className="absolute inset-0 flex flex-col bg-void overflow-hidden">

      {/* A11y live region */}
      <div
        aria-live="polite"
        className="sr-only"
      >
        {`Paso ${slide + 1} de ${SLIDES.length}: ${title}`}
      </div>

      {/* Barra superior: "Saltar" a la derecha */}
      <div
        className="flex flex-shrink-0 items-center justify-end px-5"
        style={{ paddingTop: 'max(20px, env(safe-area-inset-top))', minHeight: 56 }}
      >
        <button
          onClick={toGoal}
          className="inline-flex h-11 min-w-[44px] items-center justify-center rounded-md px-3 text-[14px] text-muted-foreground hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
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
        className="flex-shrink-0 h-[220px] relative overflow-hidden mt-2"
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

      {/* Indicadores de puntos */}
      <nav
        aria-label="Pasos del recorrido"
        className="flex flex-shrink-0 items-center justify-center gap-1.5 mt-5"
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
              animate={{
                width: i === slide ? 22 : 7,
                backgroundColor: i === slide ? '#5FC9B8' : 'rgba(255,255,255,0.2)',
              }}
              transition={{ type: 'spring', stiffness: 340, damping: 28 }}
              className="h-1.5 rounded-full"
            />
          </button>
        ))}
      </nav>

      {/* Copy */}
      <div className="relative flex-1 overflow-hidden mt-6 px-6">
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
            <h1 className="text-[26px] font-bold leading-tight tracking-tight text-foreground mb-3">
              {title}
            </h1>
            <p className="text-[15px] leading-relaxed text-secondary-foreground">
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
