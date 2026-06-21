/**
 * Goal.tsx — v2 flow
 *
 * Selección de objetivo(s) de onboarding (hasta 3 categorías).
 * NO precarga producto (P0-4).
 * Avanza a 's-account' vía dispatch setGoals + go.
 *
 * ScreenId: 's-goal'
 * Dispatch: { t: 'setGoals', cats: Category[] }  →  { t: 'go', screen: 's-account' }
 */
import { useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { ChevronLeft, Check, Flame, HeartPulse, Zap, Sparkles, Hourglass, Dumbbell, Flower2, Compass, Circle, type LucideIcon } from 'lucide-react'
import { useApp } from '../../lib/store'
import { GOALS, CATEGORY_COLOR } from '../../lib/catalog'
import type { Category } from '../../lib/types'
import { Button } from '../ui/Button'
import { Glass } from '../ui/Glass'

// Íconos de categoría (lucide SVG — sin emojis en la app)
const CAT_ICON: Record<string, LucideIcon> = {
  'Metabolismo':  Flame,
  'Recuperación': HeartPulse,
  'Cognitivo':    Zap,
  'Piel':         Sparkles,
  'Anti-Aging':   Hourglass,
  'Crecimiento':  Dumbbell,
  'Reproductivo': Flower2,
  'Explorar':     Compass,
}

const MAX_GOALS = 3

const fade = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.28, ease: [0, 0, 0.2, 1] as [number, number, number, number] },
  },
}

export function Goal() {
  const { dispatch } = useApp()
  const reduce = useReducedMotion()

  const [selected, setSelected] = useState<Set<string>>(new Set())

  const toggle = (cat: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(cat)) {
        next.delete(cat)
      } else if (next.size < MAX_GOALS) {
        next.add(cat)
      }
      return next
    })
  }

  const handleContinue = () => {
    if (selected.size === 0) return
    dispatch({
      t: 'setGoals',
      cats: [...selected] as Category[],
    })
    dispatch({ t: 'go', screen: 's-baseline' })
  }

  return (
    <div
      className="flex h-full flex-col bg-void"
      style={{ paddingBottom: 'max(40px, calc(32px + env(safe-area-inset-bottom)))' }}
    >
      {/* App bar */}
      <header
        className="flex flex-shrink-0 items-center gap-4 px-4"
        style={{
          paddingTop: 'max(14px, env(safe-area-inset-top))',
          paddingBottom: 12,
        }}
      >
        <button
          aria-label="Atrás"
          onClick={() => dispatch({ t: 'go', screen: 's-onboarding' })}
          className="inline-flex h-11 w-11 items-center justify-center rounded-md text-secondary-foreground hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
        >
          <ChevronLeft size={22} />
        </button>

        {/* Barra de progreso — paso 1 de 4 */}
        <div className="flex-1 flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-secondary-foreground">Paso 1 de 4</span>
            <span className="text-[11px] text-secondary-foreground">Configúralo en 2–3 min</span>
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuenow={1} aria-valuemin={1} aria-valuemax={4} aria-label="Paso 1 de 4">
            <div className="h-full w-[25%] rounded-full bg-teal" />
          </div>
        </div>

        {/* Spacer balanceador */}
        <div className="w-11" />
      </header>

      {/* Encabezado */}
      <motion.div
        initial={reduce ? false : 'hidden'}
        animate="show"
        variants={{ show: { transition: { staggerChildren: 0.06 } } }}
        className="px-5 pb-5 pt-3 text-center"
      >
        <motion.h1
          variants={fade}
          className="text-[26px] font-bold leading-tight tracking-tight text-foreground"
        >
          ¿Qué quieres lograr?
        </motion.h1>
        <motion.p variants={fade} className="mt-2 text-[14px] text-secondary-foreground">
          Elige tu enfoque principal para personalizar tu experiencia.{' '}
          <span className="text-secondary-foreground">(Elige hasta {MAX_GOALS})</span>
        </motion.p>
      </motion.div>

      {/* Lista de objetivos */}
      <motion.div
        initial={reduce ? false : 'hidden'}
        animate="show"
        variants={{ show: { transition: { staggerChildren: 0.035 } } }}
        className="flex flex-1 flex-col gap-3 overflow-y-auto px-4"
      >
        {GOALS.map((g) => {
          const color = CATEGORY_COLOR[g.cat] ?? '#5FC9B8'
          const isActive = selected.has(g.cat)
          const CatIcon = CAT_ICON[g.cat] ?? Circle

          return (
            <motion.div key={g.cat} variants={fade}>
              <button
                type="button"
                aria-pressed={isActive}
                onClick={() => toggle(g.cat)}
                className="w-full text-left"
              >
                <Glass
                  className={[
                    'flex items-center gap-4 p-4 transition-[border-color,box-shadow] duration-150',
                    isActive
                      ? 'ring-2 ring-inset'
                      : 'ring-0',
                  ].join(' ')}
                  style={
                    isActive
                      ? {
                          borderColor: color,
                          boxShadow: `0 0 0 1px ${color}33`,
                          // subtle background tint
                          background: `color-mix(in srgb, ${color} 6%, var(--glass-bg, rgba(30,41,59,0.72)))`,
                        }
                      : {}
                  }
                >
                  {/* Ícono */}
                  <span
                    className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full"
                    style={{
                      background: `color-mix(in srgb, ${color} 14%, transparent)`,
                    }}
                    aria-hidden="true"
                  >
                    <CatIcon size={22} style={{ color }} />
                  </span>

                  {/* Texto */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground">{g.label}</p>
                    <p className="text-[13px] text-secondary-foreground">{g.sub}</p>
                  </div>

                  {/* Check animado */}
                  <AnimatePresence>
                    {isActive && (
                      <motion.span
                        key="check"
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 340, damping: 24 }}
                        className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full"
                        style={{ background: color }}
                      >
                        <Check size={14} strokeWidth={3} color="#fff" />
                      </motion.span>
                    )}
                  </AnimatePresence>
                </Glass>
              </button>
            </motion.div>
          )
        })}
      </motion.div>

      {/* CTA */}
      <div className="mt-4 flex flex-shrink-0 flex-col items-center gap-3 px-4 pt-2">
        <Button
          size="full"
          onClick={handleContinue}
          disabled={selected.size === 0}
          aria-disabled={selected.size === 0}
        >
          Continuar
        </Button>

        <p
          role="status"
          aria-live="polite"
          className="min-h-[20px] text-[13px] text-secondary-foreground"
        >
          {selected.size > 0
            ? `${selected.size} objetivo${selected.size > 1 ? 's' : ''} elegido${selected.size > 1 ? 's' : ''}. Podrás ajustar esto más adelante.`
            : 'Elige al menos una opción para continuar.'}
        </p>

        {/* Disclaimer de investigación */}
        <p className="text-center text-[11px] leading-relaxed text-secondary-foreground">
          Hacktrack es una herramienta de seguimiento personal. No reemplaza consejo médico.
        </p>
      </div>
    </div>
  )
}
