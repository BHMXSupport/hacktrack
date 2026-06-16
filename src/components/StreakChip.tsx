// Item 131: chip de racha global (compositeStreak) en la cabecera de Home.
// Count-up animado + micro-celebración al cruzar milestones 7 / 14 / 30 / 60 / 90.
import { useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion, useMotionValue, animate, AnimatePresence } from 'framer-motion'
import { dur, ease, spring } from '../lib/motion'

const MILESTONES = [7, 14, 30, 60, 90, 180, 365]

function isMilestone(n: number): boolean {
  return MILESTONES.includes(n)
}

/**
 * StreakChip: muestra la racha de días consecutivos con dosis.
 * - count-up animado al montar o cuando cambia el valor
 * - ring de celebración al alcanzar un milestone (7/14/30…)
 * - reduced-motion safe
 */
export function StreakChip({ streak }: { streak: number }) {
  const reduce = useReducedMotion() ?? false
  const mv = useMotionValue(reduce ? streak : 0)
  const displayRef = useRef<HTMLSpanElement>(null)
  const [celebrate, setCelebrate] = useState(false)
  const prevRef = useRef(streak)

  // count-up
  useEffect(() => {
    if (reduce) { mv.set(streak); return }
    const ctrl = animate(mv, streak, { duration: dur.slow, ease: ease.decelerate })
    const unsub = mv.on('change', (v) => {
      if (displayRef.current) displayRef.current.textContent = String(Math.round(v))
    })
    return () => { ctrl.stop(); unsub() }
  }, [streak, reduce]) // eslint-disable-line react-hooks/exhaustive-deps

  // micro-celebración al cruzar milestone
  useEffect(() => {
    if (streak !== prevRef.current && isMilestone(streak)) {
      setCelebrate(true)
      const t = setTimeout(() => setCelebrate(false), 800)
      prevRef.current = streak
      return () => clearTimeout(t)
    }
    prevRef.current = streak
  }, [streak])

  if (streak === 0) return null

  return (
    <div
      aria-label={`Racha: ${streak} día${streak === 1 ? '' : 's'} consecutivo${streak === 1 ? '' : 's'}`}
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
    >
      <motion.div
        animate={celebrate && !reduce ? { scale: [1, 1.18, 1] } : { scale: 1 }}
        transition={celebrate ? spring.celebrate : { duration: dur.fast }}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          background: 'var(--brand-100)',
          border: '1px solid var(--brand-300)',
          borderRadius: 999,
          padding: '4px 10px 4px 8px',
          userSelect: 'none',
        }}
      >
        {/* llama emoji — solo visual, aria-hidden */}
        <span aria-hidden="true" style={{ fontSize: 14, lineHeight: 1 }}>🔥</span>
        <span
          ref={displayRef}
          className="sm mono"
          style={{ fontWeight: 700, color: 'var(--brand-700)', lineHeight: 1, minWidth: 12 }}
        >
          {streak}
        </span>
        <span className="sm" style={{ color: 'var(--brand-700)', fontWeight: 500 }}>
          {streak === 1 ? 'día' : 'días'}
        </span>
      </motion.div>

      {/* ring de celebración — aparece y desaparece */}
      <AnimatePresence>
        {celebrate && !reduce && (
          <motion.div
            key="ring"
            aria-hidden="true"
            initial={{ scale: 0.8, opacity: 0.8 }}
            animate={{ scale: 1.6, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: ease.decelerate }}
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: 999,
              border: '2px solid var(--brand-500)',
              pointerEvents: 'none',
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

/**
 * ProductStreakBadge: badge inline de racha por producto (para usar en listas de producto).
 * Pequeño, sin animación de celebración (solo count-up).
 */
export function ProductStreakBadge({ streak }: { streak: number }) {
  const reduce = useReducedMotion() ?? false
  const mv = useMotionValue(reduce ? streak : 0)
  const displayRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (reduce) { mv.set(streak); return }
    const ctrl = animate(mv, streak, { duration: dur.base, ease: ease.decelerate })
    const unsub = mv.on('change', (v) => {
      if (displayRef.current) displayRef.current.textContent = String(Math.round(v))
    })
    return () => { ctrl.stop(); unsub() }
  }, [streak, reduce]) // eslint-disable-line react-hooks/exhaustive-deps

  if (streak === 0) return null

  return (
    <span
      aria-label={`${streak} día${streak === 1 ? '' : 's'} de racha`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        background: 'var(--brand-100)',
        border: '1px solid var(--brand-300)',
        borderRadius: 999,
        padding: '2px 7px 2px 5px',
        fontSize: 11,
        fontWeight: 600,
        color: 'var(--brand-700)',
        lineHeight: 1,
      }}
    >
      <span aria-hidden="true">🔥</span>
      <span ref={displayRef} className="mono">{streak}</span>
    </span>
  )
}
