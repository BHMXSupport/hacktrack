import { useEffect } from 'react'
import { motion, useMotionValue, useTransform, animate, useReducedMotion } from 'framer-motion'
import { dur, ease, spring } from '../lib/motion'

// Anillo de adherencia/racha: draw-on + count-up + celebración al cumplir meta.
export function AdherenceRing({
  value,
  goal,
  size = 168,
  stroke = 12,
  label = 'racha',
  unit = '',
}: {
  value: number
  goal: number
  size?: number
  stroke?: number
  label?: string
  unit?: string
}) {
  const reduce = useReducedMotion()
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const pct = goal > 0 ? Math.min(1, value / goal) : 0
  const reached = goal > 0 && value >= goal

  // count-up del número (MotionValue, sin setState por frame)
  const count = useMotionValue(reduce ? value : 0)
  const display = useTransform(count, (v) => Math.round(v) + unit)
  // draw-on del anillo (strokeDashoffset)
  const offset = useMotionValue(reduce ? circ * (1 - pct) : circ)

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

  return (
    <motion.div
      style={{ position: 'relative', width: size, height: size }}
      animate={reached && !reduce ? { scale: [1, 1.04, 1] } : undefined}
      transition={spring.celebrate}
    >
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <defs>
          <linearGradient id="ringgrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#0E5A52" />
            <stop offset="100%" stopColor="#B6F09C" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--ink-100)" strokeWidth={stroke} fill="none" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="url(#ringgrad)"
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circ}
          style={{ strokeDashoffset: offset, translateZ: 0 }}
        />
      </svg>
      <div
        style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
        aria-label={`${value}${unit} ${label}`}
      >
        <motion.div className="ring-num" style={{ fontSize: size * 0.26, color: 'var(--ink-900)' }} aria-hidden>
          {display}
        </motion.div>
        <div className="sm" style={{ textTransform: 'uppercase', letterSpacing: 0.6, fontSize: 11 }}>{label}</div>
      </div>
    </motion.div>
  )
}
