import { useEffect, useId, type ReactNode } from 'react'
import { motion, useMotionValue, useTransform, animate, useReducedMotion } from 'framer-motion'

// Anillo de progreso (adherencia/racha): arco con gradiente teal, track tenue, glow suave, draw-on + count-up.
// El número hero vive centrado MUY dentro del trazo; el `sub` se renderiza DEBAJO del aro (fuera del círculo)
// para que ningún texto choque con el trazo aunque crezca (bug del "racha · desde …" que se encimaba). #ring-redesign
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
  sub?: ReactNode
  size?: number
  stroke?: number
}) {
  const reduce = useReducedMotion()
  const uid = useId().replace(/[:]/g, '')
  const gradId = `ringGrad-${uid}`
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
    const o = animate(offset, circ * (1 - pct), { duration: 0.95, ease: [0.22, 1, 0.36, 1] })
    return () => {
      c.stop()
      o.stop()
    }
  }, [value, pct, circ, reduce, count, offset])

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative grid place-items-center" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90 overflow-visible" aria-hidden>
          <defs>
            <linearGradient id={gradId} gradientUnits="userSpaceOnUse" x1={stroke} y1={stroke} x2={size - stroke} y2={size - stroke}>
              <stop offset="0%" stopColor="var(--teal-dim)" />
              <stop offset="55%" stopColor="var(--teal)" />
              <stop offset="100%" stopColor="var(--teal-bright)" />
            </linearGradient>
          </defs>
          {/* track tenue */}
          <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,.06)" strokeWidth={stroke} fill="none" />
          {/* arco de progreso con gradiente + glow */}
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={`url(#${gradId})`}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circ}
            style={{
              strokeDashoffset: offset,
              filter: reached
                ? 'drop-shadow(0 0 9px rgba(95,201,184,.6))'
                : 'drop-shadow(0 0 4px rgba(95,201,184,.32))',
            }}
          />
        </svg>
        <div
          className="absolute inset-0 flex flex-col items-center justify-center"
          style={{ maxWidth: size - stroke * 2 - 8, marginInline: 'auto' }}
          aria-label={`${value}${unit} ${label}`}
        >
          <motion.span
            className="font-mono font-light tabular-nums text-[var(--teal-bright)]"
            style={{ fontSize: size * 0.24, letterSpacing: '-0.5px', lineHeight: 1 }}
          >
            {display}
          </motion.span>
          <span className="mt-1 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
            {label}
          </span>
        </div>
      </div>
      {sub != null &&
        (typeof sub === 'string' ? (
          <span className="max-w-[170px] text-center text-[11px] leading-tight text-muted-foreground">{sub}</span>
        ) : (
          sub
        ))}
    </div>
  )
}
