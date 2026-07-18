import { useEffect, type ReactNode } from 'react'
import { motion, useMotionValue, animate, useReducedMotion } from 'framer-motion'
import { useCountUp } from '../lib/useCountUp'
import { DUR, EASE } from '../lib/motion'

// Anillo "Bitácora" — LA firma, copiado del dial de la ref canónica (docs/design-refs):
//  · bezel de ticks de instrumento (círculo punteado con dasharray) + 4 ticks mayores en cuartos
//  · arco ÁMBAR SÓLIDO (energía) con draw-on (strokeDashoffset ~0.9s) sobre pista cálida (pozo)
//  · punta-aguja en el término del arco (dot superficie + ámbar vivo) que se asienta al final
//  · numeral hero central SERIF (Fraunces) en tinta --ink (el ámbar es solo-gráfico: como texto
//    no pasaría AA en Papel) con la unidad serif en superíndice, y cuenta con useCountUp
// El glow del arco se intensifica al llegar a meta (no se anima el filter). Bezel/aguja solo en
// anillos grandes (size ≥ 110). Reduced-motion → todo asentado al instante. Geometría en viewBox
// 200×200 fijo (la de la ref), escalada por width/height. El `sub` va DEBAJO del aro.
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
  const pct = goal > 0 ? Math.min(1, value / goal) : 0
  const reached = goal > 0 && value >= goal

  // Geometría de la ref (viewBox 200): bezel r94/​grosor 7; hueco de 3 hasta el arco.
  const instrument = size >= 110
  const strokeVB = stroke * (200 / size)
  const r = (instrument ? 87.5 : 97) - strokeVB / 2
  const circ = 2 * Math.PI * r

  // Numeral hero: cuenta hacia arriba (redondeo a entero, como el readout histórico). Honra reduced-motion.
  const displayValue = useCountUp(value, { reduced: !!reduce, duration: DUR.count, decimals: 0 })

  // draw-on del arco: strokeDashoffset de circ → circ*(1-pct). Motion value (sin re-render).
  const offset = useMotionValue(reduce ? circ * (1 - pct) : circ)
  useEffect(() => {
    if (reduce) {
      offset.set(circ * (1 - pct))
      return
    }
    const o = animate(offset, circ * (1 - pct), { duration: DUR.draw, ease: EASE })
    return () => o.stop()
  }, [pct, circ, reduce, offset])

  // Punta-aguja en el término del arco (coordenadas sin rotar; el arco vive en un grupo -90°).
  const tipAngle = pct * 2 * Math.PI - Math.PI / 2
  const tipX = 100 + r * Math.cos(tipAngle)
  const tipY = 100 + r * Math.sin(tipAngle)
  const showTip = instrument && pct > 0.02

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative grid place-items-center" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox="0 0 200 200" fill="none" aria-hidden>
          {instrument && (
            <>
              {/* Bezel de ticks (instrumento silencioso): círculo punteado, decorativo. */}
              <circle
                cx="100" cy="100" r="94"
                stroke="var(--ink-3)" strokeOpacity={0.45} strokeWidth="7"
                strokeDasharray="1.6 8.24"
              />
              {/* Ticks mayores en cuartos. */}
              <g stroke="var(--ink-3)" strokeWidth="2">
                <line x1="100" y1="6" x2="100" y2="16" />
                <line x1="194" y1="100" x2="184" y2="100" />
                <line x1="100" y1="194" x2="100" y2="184" />
                <line x1="6" y1="100" x2="16" y2="100" />
              </g>
            </>
          )}
          <g transform="rotate(-90 100 100)">
            {/* Pista cálida (pozo). */}
            <circle cx="100" cy="100" r={r} stroke="var(--raised)" strokeWidth={strokeVB} />
            {/* Arco ámbar sólido con glow (más fuerte al llegar a meta; NO se anima el filter). */}
            <motion.circle
              cx="100"
              cy="100"
              r={r}
              stroke="var(--amber)"
              strokeWidth={strokeVB}
              strokeLinecap="round"
              strokeDasharray={circ}
              style={{
                strokeDashoffset: offset,
                filter: reached
                  ? 'drop-shadow(0 0 10px color-mix(in srgb, var(--amber) 60%, transparent))'
                  : 'drop-shadow(0 0 5px color-mix(in srgb, var(--amber) 35%, transparent))',
              }}
            />
          </g>
          {/* Punta-aguja: se asienta cuando el arco terminó de trazarse. */}
          {showTip && (
            <motion.g
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.15, delay: reduce ? 0 : DUR.draw }}
            >
              <circle cx={tipX} cy={tipY} r="8" fill="var(--surface)" />
              <circle cx={tipX} cy={tipY} r="5.5" fill="color-mix(in srgb, var(--amber) 78%, white)" />
            </motion.g>
          )}
        </svg>
        <div
          className="absolute inset-0 flex flex-col items-center justify-center px-2"
          aria-label={`${value}${unit} ${label}`}
        >
          <span
            className="flex items-start font-serif font-normal tabular-nums leading-[0.9] text-ink"
            style={{ fontSize: size * 0.3, letterSpacing: '-0.03em' }}
          >
            {displayValue}
            {unit && (
              <span
                className="font-serif font-normal text-ink-2"
                style={{ fontSize: size * 0.12, marginTop: size * 0.035, marginLeft: 1 }}
              >
                {unit}
              </span>
            )}
          </span>
          <span className="mt-1.5 font-mono font-medium uppercase tracking-[0.12em] text-ink-2" style={{ fontSize: 12 }}>
            {label}
          </span>
        </div>
      </div>
      {sub != null &&
        (typeof sub === 'string' ? (
          <span className="max-w-[170px] text-center text-[12px] leading-tight text-ink-2">{sub}</span>
        ) : (
          sub
        ))}
    </div>
  )
}
