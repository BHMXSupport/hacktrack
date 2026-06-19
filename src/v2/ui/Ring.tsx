import { useEffect } from 'react'
import { motion, useMotionValue, useTransform, animate, useReducedMotion } from 'framer-motion'

// Anillo de progreso (adherencia/racha): draw-on + count-up + glow al completar.
// Solo anima stroke/opacity (regla de perf). Respeta reduced-motion.
export function Ring({
  value,
  goal,
  unit = '',
  label,
  sub,
  size = 160,
  stroke = 12,
}: {
  value: number
  goal: number
  unit?: string
  label: string
  sub?: string
  size?: number
  stroke?: number
}) {
  const reduce = useReducedMotion()
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const pct = goal > 0 ? Math.min(1, value / goal) : 0
  const reached = goal > 0 && value >= goal

  const count = useMotionValue(reduce ? value : 0)
  const display = useTransform(count, (v) => Math.round(v) + unit)
  const offset = useMotionValue(reduce ? circ * (1 - pct) : circ)

  useEffect(() => {
    if (reduce) {
      count.set(value)
      offset.set(circ * (1 - pct))
      return
    }
    const c = animate(count, value, { duration: 0.7, ease: [0, 0, 0, 1] })
    const o = animate(offset, circ * (1 - pct), { duration: 0.85, ease: [0.22, 1, 0.36, 1] })
    return () => {
      c.stop()
      o.stop()
    }
  }, [value, pct, circ, reduce, count, offset])

  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90 overflow-visible" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,.08)" strokeWidth={stroke} fill="none" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="var(--teal)"
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circ}
          style={{
            strokeDashoffset: offset,
            filter: reached ? 'drop-shadow(0 0 7px rgba(95,201,184,.55))' : undefined,
          }}
        />
      </svg>
      <div
        className="absolute inset-0 flex flex-col items-center justify-center"
        aria-label={`${value}${unit} ${label}`}
      >
        <motion.span
          className="font-mono font-semibold tabular-nums text-foreground"
          style={{ fontSize: size * 0.24 }}
        >
          {display}
        </motion.span>
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</span>
        {sub && <span className="mt-0.5 text-[11px] text-teal">{sub}</span>}
      </div>
    </div>
  )
}
