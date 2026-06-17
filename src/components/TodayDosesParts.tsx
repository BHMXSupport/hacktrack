// Piezas auto-contenidas de TodayDoses (confetti, mini-heatmap semanal, botón long-press) — split.
import { useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { doseTakenOnProduct } from '../lib/calendar'
import { dur, ease } from '../lib/motion'
import { IcCheck } from './icons'

// ── Loop 135: confetti particles ──────────────────────────────────────────────
const CONFETTI_COLORS = ['#5eead4', '#2FB57C', '#B6F09C', '#1B8A7D', '#5FC9B8', '#7BC96F', '#D6F2EC', '#0E5A52']
const PARTICLES = Array.from({ length: 8 }, (_, i) => i)

export function Confetti() {
  const prefersReduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (prefersReduced) return null
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden', borderRadius: 'inherit' }}>
      {PARTICLES.map((i) => {
        const x = 10 + Math.random() * 80  // % from left
        const delay = i * 0.06
        const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length]
        return (
          <motion.div
            key={i}
            initial={{ opacity: 1, y: '-10%', x: `${x}vw`, scale: 0.8 }}
            animate={{ opacity: [1, 1, 0], y: ['0%', '90%'], scale: [0.8, 1.1, 0.7] }}
            transition={{ duration: 1.2, delay, ease: 'easeOut' }}
            style={{
              position: 'absolute', top: 0, left: 0,
              width: 7, height: 7, borderRadius: i % 2 === 0 ? 999 : 2,
              background: color,
            }}
          />
        )
      })}
    </div>
  )
}

// ── Loop 169: mini-heatmap 7×1 de adherencia ─────────────────────────────────
const DAY_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

export function WeekHeatmap({ product, state, today }: { product: string; state: any; today: Date }) {
  const prefersReduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  // Build last-7-days array (Mon–Sun of this week, aligned)
  const cells = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today)
    // offset to Monday of this week
    const dow = today.getDay() // 0=Sun
    const mondayOffset = dow === 0 ? -6 : 1 - dow
    d.setDate(today.getDate() + mondayOffset + i)
    const isFuture = d > today
    const taken = !isFuture && doseTakenOnProduct(state, d, product)
    const isToday = d.toDateString() === today.toDateString()
    return { d, taken, isFuture, isToday, label: DAY_LABELS[i] }
  })

  return (
    <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', padding: '2px 0 0' }}>
      {cells.map((cell, i) => (
        <motion.div
          key={i}
          initial={prefersReduced ? false : { opacity: 0, scaleY: 0.4 }}
          animate={{ opacity: 1, scaleY: 1 }}
          transition={{ delay: i * 0.01, duration: dur.fast, ease: ease.decelerate }}
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
          }}
        >
          <div style={{
            width: 8, height: 8, borderRadius: 2,
            background: cell.isFuture
              ? 'var(--border)'
              : cell.taken
                ? 'var(--success)'
                : cell.isToday
                  ? 'var(--ink-200)'
                  : 'var(--ink-200)',
            opacity: cell.isFuture ? 0.4 : 1,
            outline: cell.isToday ? '1.5px solid var(--brand-500)' : 'none',
            outlineOffset: 1,
          }} />
          <span style={{ fontSize: 7, color: 'var(--ink-400)', lineHeight: 1 }}>{cell.label}</span>
        </motion.div>
      ))}
    </div>
  )
}

// ── n°434: LongPressButton — tap directo; long-press 500ms → acción alternativa ──
interface LongPressButtonProps {
  onTap: () => void
  onLongPress: () => void
  ariaLabel: string
  active: boolean
  color: string
}

export function LongPressButton({ onTap, onLongPress, ariaLabel, active, color: _color }: LongPressButtonProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const didLongPress = useRef(false)

  // Limpia el timer de long-press si el botón se desmonta a medio press (evita disparo tras unmount)
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])

  function startPress() {
    didLongPress.current = false
    timerRef.current = setTimeout(() => {
      didLongPress.current = true
      onLongPress()
    }, 500)
  }

  function endPress() {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (!didLongPress.current) onTap()
  }

  function cancelPress() {
    if (timerRef.current) clearTimeout(timerRef.current)
    didLongPress.current = false
  }

  return (
    <button
      onPointerDown={startPress}
      onPointerUp={endPress}
      onPointerLeave={cancelPress}
      onPointerCancel={cancelPress}
      aria-label={ariaLabel}
      title={active ? 'Toca para deshacer · mantén para editar' : 'Toca para marcar · mantén para elegir hora'}
      style={{
        display: 'flex', alignItems: 'center', gap: 6, height: 34, padding: '0 14px', borderRadius: 999,
        cursor: 'pointer', fontWeight: 600, fontSize: 13,
        border: active ? 'none' : '1.5px solid var(--border)',
        background: active ? 'var(--success)' : 'transparent',
        color: active ? 'var(--ink-0)' : 'var(--ink-400)',
        userSelect: 'none', WebkitUserSelect: 'none',
      }}
    >
      <AnimatePresence>
        {active && (
          <motion.span
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.6, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
            style={{ display: 'flex', alignItems: 'center' }}
          >
            <IcCheck size={15} />
          </motion.span>
        )}
      </AnimatePresence>
      {active ? 'Hecho' : 'Marcar'}
    </button>
  )
}

