/**
 * MeasurePicker.tsx — v2 flow
 *
 * Selector de métricas a seguir según el objetivo elegido.
 * Máximo 6 chips; pre-selecciona los 4 primeros.
 * Avanza con setMeasures → go 's-account'.
 * Atrás → 's-baseline'.
 *
 * ScreenId: 's-measures'
 * Dispatch:
 *   { t: 'setMeasures', measures: string[] }
 *   { t: 'go', screen: 's-account' }
 */
import { useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { ChevronLeft, Check } from 'lucide-react'
import { useApp } from '../../lib/store'
import {
  MEASURES_BY,
  CATEGORY_COLOR,
  MEDIDAS_ONLY_MEASURES,
} from '../../lib/catalog'
import { Button } from '../ui/Button'
import { Chip } from '../ui/Chip'
import { Glass } from '../ui/Glass'

// ── Animación ─────────────────────────────────────────────────────────────────

const fade = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.26, ease: [0, 0, 0.2, 1] as [number, number, number, number] },
  },
}

const MAX_CHIPS = 6

// ── Componente principal ──────────────────────────────────────────────────────

export function MeasurePicker() {
  const { state, dispatch } = useApp()
  const reduce = useReducedMotion()

  const goal = state.curGoal ?? 'Explorar'
  const accentColor = CATEGORY_COLOR[goal as keyof typeof CATEGORY_COLOR] ?? '#5FC9B8'

  // Filtramos las medidas solo-medidas y tomamos máximo MAX_CHIPS
  const measures = (MEASURES_BY[goal] ?? MEASURES_BY['Explorar'])
    .filter((m) => !MEDIDAS_ONLY_MEASURES.includes(m))
    .slice(0, MAX_CHIPS)

  const defaults = measures.slice(0, 4)
  const [selected, setSelected] = useState<Set<string>>(new Set(defaults))

  function toggle(m: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(m)) next.delete(m)
      else next.add(m)
      return next
    })
  }

  function handleContinuar() {
    dispatch({ t: 'setMeasures', measures: [...selected] })
    dispatch({ t: 'go', screen: 's-protocol' })
  }

  function handleSaltar() {
    dispatch({ t: 'setMeasures', measures: defaults })
    dispatch({ t: 'go', screen: 's-protocol' })
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
          onClick={() => dispatch({ t: 'go', screen: 's-baseline' })}
          className="inline-flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
        >
          <ChevronLeft size={22} />
        </button>

        {/* Barra de progreso — paso ~65% */}
        <div className="flex-1" aria-hidden="true">
          <div className="h-1 overflow-hidden rounded-full bg-white/10">
            <div className="h-full w-[65%] rounded-full bg-teal" />
          </div>
        </div>

        <div className="w-11" />
      </header>

      <motion.div
        initial={reduce ? false : 'hidden'}
        animate="show"
        variants={{ show: { transition: { staggerChildren: 0.05 } } }}
        className="flex flex-1 flex-col gap-6 overflow-y-auto px-5 pt-2"
      >
        {/* Título */}
        <motion.div variants={fade}>
          <h1 className="text-[26px] font-bold leading-tight tracking-tight text-foreground">
            ¿Qué quieres seguir?
          </h1>
          {/* #18: deja claro que las métricas se adaptan al objetivo elegido */}
          <span className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-teal/25 bg-teal/10 px-2.5 py-1 text-[12px] font-semibold text-teal">
            Métricas para: {goal}
          </span>
          <p className="mt-2 text-[14px] text-secondary-foreground">
            Elige las que más te interesan. Puedes cambiarlas después.
          </p>
        </motion.div>

        {/* Chips de métricas */}
        <motion.div
          variants={fade}
          role="group"
          aria-label="Métricas disponibles"
          className="flex flex-wrap gap-2"
        >
          {measures.map((m) => {
            const active = selected.has(m)
            return (
              <Chip
                key={m}
                active={active}
                onClick={() => toggle(m)}
                className={active ? '' : ''}
                style={
                  active
                    ? {
                        background: `color-mix(in srgb, ${accentColor} 20%, rgba(30,41,59,0.8))`,
                        color: accentColor,
                        border: `1.5px solid color-mix(in srgb, ${accentColor} 50%, transparent)`,
                      }
                    : undefined
                }
              >
                {/* Checkmark animado */}
                <AnimatePresence>
                  {active && (
                    <motion.span
                      key="check"
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0 }}
                      transition={{ type: 'spring', stiffness: 340, damping: 24 }}
                      className="flex-shrink-0"
                    >
                      <Check size={12} strokeWidth={3} aria-hidden="true" />
                    </motion.span>
                  )}
                </AnimatePresence>
                {m}
              </Chip>
            )
          })}
        </motion.div>

        {/* Contador de selección */}
        <motion.div variants={fade}>
          <p
            role="status"
            aria-live="polite"
            className="min-h-[20px] text-[13px] text-muted-foreground"
          >
            {selected.size > 0
              ? `${selected.size} métrica${selected.size !== 1 ? 's' : ''} seleccionada${selected.size !== 1 ? 's' : ''}. Podrás ajustar esto más adelante.`
              : 'Elige las métricas que quieres registrar.'}
          </p>
        </motion.div>

        {/* Preview de selección */}
        {selected.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22 }}
          >
            <Glass className="flex flex-col gap-2 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Seguirás
              </p>
              <div className="flex flex-wrap gap-1.5">
                {[...selected].map((m) => (
                  <span
                    key={m}
                    className="rounded-full px-2.5 py-0.5 text-[12px] font-medium"
                    style={{
                      background: `color-mix(in srgb, ${accentColor} 12%, transparent)`,
                      color: accentColor,
                    }}
                  >
                    {m}
                  </span>
                ))}
              </div>
            </Glass>
          </motion.div>
        )}

        {/* Disclaimer */}
        <motion.div variants={fade}>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Hacktrack es una herramienta de seguimiento personal. No reemplaza consejo médico.
          </p>
        </motion.div>

        {/* CTAs */}
        <motion.div variants={fade} className="mt-auto flex flex-col gap-2">
          <Button size="full" onClick={handleContinuar} disabled={selected.size === 0} aria-disabled={selected.size === 0}>
            Continuar
          </Button>
          <Button size="full" variant="ghost" onClick={handleSaltar}>
            Saltar — usar recomendados
          </Button>
        </motion.div>
      </motion.div>
    </div>
  )
}
