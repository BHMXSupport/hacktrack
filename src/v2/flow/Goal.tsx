/**
 * Goal.tsx — v2 flow
 *
 * Selección de objetivo(s) de onboarding (hasta 3 categorías), estética "Bitácora":
 * folio editorial de paso, titular serif, selección en azul (interactivo).
 * NO precarga producto (P0-4).
 * Avanza a 's-baseline' vía dispatch setGoals + go.
 *
 * ScreenId: 's-goal'
 * Dispatch: { t: 'setGoals', cats: Category[] }  →  { t: 'go', screen: 's-baseline' }
 */
import { useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { ChevronLeft, Check, Flame, HeartPulse, Zap, Sparkles, Hourglass, Dumbbell, Flower2, Compass, Circle, type LucideIcon } from 'lucide-react'
import { useApp } from '../../lib/store'
import { GOALS } from '../../lib/catalog'
import type { Category } from '../../lib/types'
import { Button } from '../ui/Button'
import { Glass } from '../ui/Glass'
import { FolioLabel } from '../ui/FolioLabel'
import { fadeUp, staggerContainer } from '../lib/motion'

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
      className="relative z-10 flex h-full flex-col"
      style={{ paddingBottom: 'max(40px, calc(32px + env(safe-area-inset-bottom)))' }}
    >
      {/* App bar — folio editorial de paso + barra de progreso */}
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
          className="inline-flex h-11 w-11 items-center justify-center rounded-md text-ink-2 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
        >
          <ChevronLeft size={22} />
        </button>

        {/* Folio "§ 01 · Paso 1 de 5" + regla de avance */}
        <div className="flex flex-1 flex-col gap-1.5">
          <FolioLabel n={1}>Paso 1 de 5 · 2–3 min</FolioLabel>
          <div className="h-1 overflow-hidden rounded-full bg-raised" role="progressbar" aria-valuenow={1} aria-valuemin={1} aria-valuemax={5} aria-label="Paso 1 de 5">
            <div className="h-full w-[20%] rounded-full bg-blue" />
          </div>
        </div>

        {/* Spacer balanceador */}
        <div className="w-11" />
      </header>

      {/* Encabezado */}
      <motion.div
        initial={reduce ? false : 'hidden'}
        animate="show"
        variants={staggerContainer}
        className="px-5 pb-5 pt-3 text-center"
      >
        <motion.h1
          variants={fadeUp}
          className="font-serif text-[28px] font-normal leading-[1.1] tracking-[-0.01em] text-ink"
        >
          ¿Qué quieres lograr?
        </motion.h1>
        <motion.p variants={fadeUp} className="mt-2 text-[14px] text-ink-2">
          Elige tu enfoque principal para personalizar tu experiencia.{' '}
          <span className="text-ink-2">(Elige hasta {MAX_GOALS})</span>
        </motion.p>
      </motion.div>

      {/* Lista de objetivos — filas de columna impresa; seleccionado = azul interactivo */}
      <motion.div
        initial={reduce ? false : 'hidden'}
        animate="show"
        variants={{ show: { transition: { staggerChildren: 0.035 } } }}
        className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4"
      >
        {GOALS.map((g) => {
          const isActive = selected.has(g.cat)
          const CatIcon = CAT_ICON[g.cat] ?? Circle

          return (
            <motion.div key={g.cat} variants={fadeUp}>
              <button
                type="button"
                aria-pressed={isActive}
                onClick={() => toggle(g.cat)}
                className="w-full text-left"
              >
                <Glass
                  className={[
                    'flex items-center gap-4 p-4 transition-[border-color,box-shadow,background-color] duration-150',
                    isActive
                      ? 'border-blue bg-[color-mix(in_srgb,var(--blue)_7%,var(--surface))] shadow-[0_0_0_1px_var(--blue)]'
                      : '',
                  ].join(' ')}
                >
                  {/* Ícono — pozo cálido; activo pasa a azul */}
                  <span
                    className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full border border-hairline ${isActive ? 'bg-[color-mix(in_srgb,var(--blue)_12%,transparent)]' : 'bg-raised'}`}
                    aria-hidden="true"
                  >
                    <CatIcon size={22} className={isActive ? 'text-blue' : 'text-ink-2'} />
                  </span>

                  {/* Texto */}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-ink">{g.label}</p>
                    <p className="text-[13px] text-ink-2">{g.sub}</p>
                  </div>

                  {/* Check animado — azul interactivo */}
                  <AnimatePresence>
                    {isActive && (
                      <motion.span
                        key="check"
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 340, damping: 24 }}
                        className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue text-primary-foreground"
                      >
                        <Check size={14} strokeWidth={3} />
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
          className="min-h-[20px] text-[13px] text-ink-2"
        >
          {selected.size > 0
            ? `${selected.size} objetivo${selected.size > 1 ? 's' : ''} elegido${selected.size > 1 ? 's' : ''}. Podrás ajustar esto más adelante.`
            : 'Elige al menos una opción para continuar.'}
        </p>

        {/* Disclaimer de investigación */}
        <p className="text-center text-[12px] leading-relaxed text-ink-2">
          Hacktrack es una herramienta de seguimiento personal. No reemplaza consejo médico.
        </p>
      </div>
    </div>
  )
}
