/**
 * MeasurePicker.tsx — v2 flow
 *
 * Selector de métricas a seguir según el objetivo elegido. Estética "Bitácora":
 * chips mono (el instrumento), selección en azul interactivo, folio editorial de paso.
 * Máximo 6 chips; pre-selecciona los 4 primeros.
 * Avanza con setMeasures → go 's-protocol'.
 * Atrás → 's-baseline'.
 *
 * ScreenId: 's-measures'
 * Dispatch:
 *   { t: 'setMeasures', measures: string[] }
 *   { t: 'go', screen: 's-protocol' }
 */
import { useState, useMemo } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { ChevronLeft, Check } from 'lucide-react'
import { useApp } from '../../lib/store'
import {
  MEASURES_BY,
  MEDIDAS_ONLY_MEASURES,
} from '../../lib/catalog'
import { Button } from '../ui/Button'
import { Chip } from '../ui/Chip'
import { FolioLabel } from '../ui/FolioLabel'
import { fadeUp } from '../lib/motion'

const MAX_CHIPS = 6

// ── Componente principal ──────────────────────────────────────────────────────

export function MeasurePicker() {
  const { state, dispatch } = useApp()
  const reduce = useReducedMotion()

  // Una pantalla de métricas POR cada objetivo elegido (curGoal + secundarios), deduplicado.
  const goals = useMemo(() => {
    const g = [state.curGoal, ...(state.secondaryGoals ?? [])].filter(Boolean) as string[]
    return [...new Set(g)].length ? [...new Set(g)] : ['Explorar']
  }, [state.curGoal, state.secondaryGoals])

  const [goalIndex, setGoalIndex] = useState(0)
  const currentGoal = goals[Math.min(goalIndex, goals.length - 1)]
  const isLastGoal = goalIndex >= goals.length - 1

  const measuresFor = (g: string) =>
    (MEASURES_BY[g] ?? MEASURES_BY['Explorar']).filter((m) => !MEDIDAS_ONLY_MEASURES.includes(m)).slice(0, MAX_CHIPS)
  const measures = measuresFor(currentGoal)

  // Pre-selección: las primeras 4 métricas de CADA objetivo (acumuladas, deduplicadas)
  const allDefaults = useMemo(() => {
    const s = new Set<string>()
    for (const g of goals) for (const m of measuresFor(g).slice(0, 4)) s.add(m)
    return s
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goals])
  const [selected, setSelected] = useState<Set<string>>(() => new Set(allDefaults))

  function toggle(m: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(m)) next.delete(m)
      else next.add(m)
      return next
    })
  }

  function handleContinuar() {
    if (!isLastGoal) { setGoalIndex((i) => i + 1); return }
    dispatch({ t: 'setMeasures', measures: [...selected] })
    dispatch({ t: 'go', screen: 's-protocol' })
  }

  function handleSaltar() {
    // Saltar el resto: fusiona lo seleccionado con los defaults de TODOS los objetivos
    // para no perder métricas de goals no visitados.
    const measures = [...new Set([...selected, ...allDefaults])]
    dispatch({ t: 'setMeasures', measures })
    dispatch({ t: 'go', screen: 's-protocol' })
  }

  function handleBack() {
    if (goalIndex > 0) { setGoalIndex((i) => i - 1); return }
    dispatch({ t: 'go', screen: 's-baseline' })
  }

  return (
    <div
      className="relative z-10 flex h-full flex-col"
      style={{ paddingBottom: 'max(40px, calc(32px + env(safe-area-inset-bottom)))' }}
    >
      {/* App bar — folio editorial */}
      <header
        className="flex flex-shrink-0 items-center gap-4 px-4"
        style={{
          paddingTop: 'max(14px, env(safe-area-inset-top))',
          paddingBottom: 12,
        }}
      >
        <button
          aria-label="Atrás"
          onClick={handleBack}
          className="inline-flex h-11 w-11 items-center justify-center rounded-md text-ink-2 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
        >
          <ChevronLeft size={22} />
        </button>

        <div className="flex flex-1 flex-col gap-1.5">
          <FolioLabel n={3}>Paso 3 de 5</FolioLabel>
          <div className="h-1 overflow-hidden rounded-full bg-raised" role="progressbar" aria-valuenow={3} aria-valuemin={1} aria-valuemax={5} aria-label="Paso 3 de 5">
            <div className="h-full w-[60%] rounded-full bg-blue" />
          </div>
        </div>

        <div className="w-11" />
      </header>

      <motion.div
        initial={reduce ? false : 'hidden'}
        animate="show"
        variants={{ show: { transition: { staggerChildren: 0.05 } } }}
        className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-5 pt-2"
      >
        {/* Título serif + kicker del objetivo actual */}
        <motion.div variants={fadeUp}>
          <h1 className="font-serif text-[28px] font-normal leading-[1.1] tracking-[-0.01em] text-ink">
            ¿Qué quieres seguir?
          </h1>
          {/* Métricas POR objetivo + progreso cuando hay varios — kicker mono con tick ámbar */}
          <span className="mt-2.5 inline-flex items-center gap-2 font-mono text-[12px] font-medium uppercase tracking-[0.12em] text-ink-2">
            <span aria-hidden className="h-1.5 w-1.5 shrink-0 bg-amber" />
            Métricas para: {currentGoal}
            {goals.length > 1 && (
              <span className="normal-case tracking-normal text-ink-3">· Objetivo {goalIndex + 1} de {goals.length}</span>
            )}
          </span>
          <p className="mt-2 text-[14px] text-ink-2">
            Elige las que más te interesan. Puedes cambiarlas después.
          </p>
        </motion.div>

        {/* Chips de métricas — píldoras mono; activa = relleno azul (tokens del Chip) */}
        <motion.div
          variants={fadeUp}
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
        <motion.div variants={fadeUp}>
          <p
            role="status"
            aria-live="polite"
            className="min-h-[20px] text-[13px] text-ink-2"
          >
            {selected.size > 0
              ? `${selected.size} métrica${selected.size !== 1 ? 's' : ''} seleccionada${selected.size !== 1 ? 's' : ''}. Podrás ajustar esto más adelante.`
              : 'Elige las métricas que quieres registrar.'}
          </p>
        </motion.div>

        {/* Preview de selección — columna impresa con etiquetas mono */}
        {selected.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22 }}
          >
            <div className="flex flex-col gap-2.5 rounded-sm border border-hairline bg-surface p-4 shadow-[0_1px_2px_rgba(26,23,18,.05)]">
              <p className="font-mono text-[12px] font-medium uppercase tracking-[0.16em] text-ink-2">
                Seguirás
              </p>
              <div className="flex flex-wrap gap-1.5">
                {[...selected].map((m) => (
                  <span
                    key={m}
                    className="rounded-full border border-hairline bg-raised px-2.5 py-1 font-mono text-[12px] font-medium text-ink"
                  >
                    {m}
                  </span>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* Disclaimer */}
        <motion.div variants={fadeUp}>
          <p className="text-[12px] leading-relaxed text-ink-2">
            Hacktrack es una herramienta de seguimiento personal. No reemplaza consejo médico.
          </p>
        </motion.div>

        {/* CTAs */}
        <motion.div variants={fadeUp} className="mt-auto flex flex-col gap-2">
          <Button
            size="full"
            onClick={handleContinuar}
            disabled={selected.size === 0}
            aria-disabled={selected.size === 0}
            aria-label={isLastGoal ? 'Guardar métricas elegidas y continuar' : 'Confirmar métricas de este objetivo y pasar al siguiente'}
          >
            {isLastGoal ? 'Continuar' : 'Siguiente objetivo'}
          </Button>
          <Button
            size="full"
            variant="outline"
            onClick={handleSaltar}
            aria-label="Omitir selección y usar las métricas recomendadas para todos mis objetivos"
          >
            Usar métricas recomendadas
          </Button>
        </motion.div>
      </motion.div>
    </div>
  )
}
