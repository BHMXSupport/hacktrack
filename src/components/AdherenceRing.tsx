import { useEffect } from 'react'
import { motion, useMotionValue, useTransform, animate, useReducedMotion } from 'framer-motion'
import { dur, ease, spring } from '../lib/motion'
import { useApp } from '../lib/store'
import { protocolStreak } from '../lib/calendar'

// Anillo de adherencia/racha: draw-on + count-up + celebración al cumplir meta.
// Segundo arco exterior (~4px) que mapea la racha actual (0–30 días → 0–360°).
export function AdherenceRing({
  value,
  goal,
  size = 168,
  stroke = 12,
  label = 'racha',
  unit = '',
  streak: streakProp,
}: {
  value: number
  goal: number
  size?: number
  stroke?: number
  label?: string
  unit?: string
  streak?: number
}) {
  const reduce = useReducedMotion()

  // Obtener racha del store si no se pasa como prop
  const { state } = useApp()
  const streak = streakProp ?? protocolStreak(state, new Date(state.todayTs))

  const STREAK_MAX = 30
  const streakPct = Math.min(1, streak / STREAK_MAX)
  const streakGap = 8    // espacio entre el arco principal y el de racha
  const streakStroke = 4
  const streakOffset = stroke / 2 + streakGap + streakStroke / 2
  const rStreak = (size - stroke) / 2 + streakOffset
  const circStreak = 2 * Math.PI * rStreak

  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const pct = goal > 0 ? Math.min(1, value / goal) : 0
  const reached = goal > 0 && value >= goal

  // count-up del número (MotionValue, sin setState por frame)
  const count = useMotionValue(reduce ? value : 0)
  const display = useTransform(count, (v) => Math.round(v) + unit)
  // draw-on del anillo principal (strokeDashoffset)
  const offset = useMotionValue(reduce ? circ * (1 - pct) : circ)
  // draw-on del arco de racha
  const streakOffsetMv = useMotionValue(reduce ? circStreak * (1 - streakPct) : circStreak)

  useEffect(() => {
    if (reduce) {
      count.set(value)
      offset.set(circ * (1 - pct))
      return
    }
    const c = animate(count, value, { duration: dur.draw, ease: ease.decelerate })
    const o = animate(offset, circ * (1 - pct), { duration: dur.draw, ease: ease.decelerate })
    return () => { c.stop(); o.stop() }
  }, [value, pct, circ, reduce, count, offset])

  useEffect(() => {
    if (reduce) {
      streakOffsetMv.set(circStreak * (1 - streakPct))
      return
    }
    const s = animate(streakOffsetMv, circStreak * (1 - streakPct), {
      duration: dur.draw,
      ease: ease.decelerate,
    })
    return () => s.stop()
  }, [streakPct, circStreak, reduce, streakOffsetMv])

  const streakColor = streak >= 7 ? 'var(--brand-700)' : 'var(--brand-300)'
  // tamaño del SVG expandido para contener el arco exterior
  const svgSize = size + streakOffset * 2
  const svgCenter = svgSize / 2

  // mostrar texto de racha si hay espacio suficiente y streak > 0
  const showStreakText = streak > 0 && size >= 120

  return (
    <motion.div
      style={{ position: 'relative', width: svgSize, height: svgSize }}
      animate={reached && !reduce ? { scale: [1, 1.04, 1] } : undefined}
      transition={spring.celebrate}
    >
      <svg
        width={svgSize}
        height={svgSize}
        style={{ transform: 'rotate(-90deg)', overflow: 'visible' }}
        aria-hidden
      >
        <defs>
          <linearGradient id="ringgrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#0E5A52" />
            <stop offset="100%" stopColor="#B6F09C" />
          </linearGradient>
        </defs>

        {/* Pista del arco de racha (exterior) */}
        <circle
          cx={svgCenter}
          cy={svgCenter}
          r={rStreak}
          stroke="var(--ink-100)"
          strokeWidth={streakStroke}
          fill="none"
        />
        {/* Arco de racha animado */}
        <motion.circle
          cx={svgCenter}
          cy={svgCenter}
          r={rStreak}
          stroke={streakColor}
          strokeWidth={streakStroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circStreak}
          style={{ strokeDashoffset: streakOffsetMv, translateZ: 0 }}
        />

        {/* Pista del anillo principal */}
        <circle cx={svgCenter} cy={svgCenter} r={r} stroke="var(--ink-100)" strokeWidth={stroke} fill="none" />
        {/* Anillo principal animado */}
        <motion.circle
          cx={svgCenter}
          cy={svgCenter}
          r={r}
          stroke="url(#ringgrad)"
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circ}
          style={{ strokeDashoffset: offset, translateZ: 0 }}
        />
      </svg>

      {/* Contenido central */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        aria-label={`${value}${unit} ${label}${streak > 0 ? `, ${streak} días seguidos` : ''}`}
      >
        <motion.div
          className="ring-num"
          style={{ fontSize: size * 0.26, color: 'var(--ink-900)' }}
          aria-hidden
        >
          {display}
        </motion.div>
        <div className="sm" style={{ textTransform: 'uppercase', letterSpacing: 0.6, fontSize: 11 }}>
          {label}
        </div>
        {showStreakText && (
          <div
            style={{
              fontSize: 10,
              color: streak >= 7 ? 'var(--brand-700)' : 'var(--brand-300)',
              marginTop: 2,
              letterSpacing: 0.3,
              whiteSpace: 'nowrap',
            }}
            aria-hidden
          >
            {streak} días seguidos
          </div>
        )}
      </div>
    </motion.div>
  )
}
