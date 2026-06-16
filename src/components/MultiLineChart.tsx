// MultiLineChart — chart SVG multi-serie de decaimiento (sin librerías de charting).
// Líneas overlay por producto, gridlines suaves, línea "ahora", marcadores de inyección.
// (Optimizador de dashboards + diseñador del equipo multiagente.)
import { motion, useReducedMotion } from 'framer-motion'
import { dur, ease, spring } from '../lib/motion'
import type { Pt } from '../lib/pharma'

export interface ChartSeries {
  product: string
  color: string
  points: Pt[]
  markers: Pt[]
}

interface Props {
  series: ChartSeries[]
  domainX: [number, number]
  domainY: [number, number]
  nowTs: number
  height?: number
  yTicks?: number[]               // valores del eje Y a etiquetar
  formatY?: (v: number) => string
  xTicks?: { t: number; label: string }[]
}

const W = 360
const PAD = { l: 36, r: 14, t: 16, b: 26 }

function linePath(pts: [number, number][]): string {
  if (!pts.length) return ''
  return pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ')
}

// valor (y) interpolado linealmente en el instante t — para situar el punto "ahora" en su lugar real
function valueAt(points: Pt[], t: number): number | null {
  if (!points.length) return null
  if (t <= points[0][0]) return points[0][1]
  const lastP = points[points.length - 1]
  if (t >= lastP[0]) return lastP[1]
  for (let i = 1; i < points.length; i++) {
    if (points[i][0] >= t) {
      const [xa, ya] = points[i - 1]
      const [xb, yb] = points[i]
      const f = (t - xa) / ((xb - xa) || 1)
      return ya + f * (yb - ya)
    }
  }
  return lastP[1]
}

export function MultiLineChart({
  series, domainX, domainY, nowTs, height = 200, yTicks = [], formatY = (v) => String(Math.round(v)), xTicks = [],
}: Props) {
  const reduce = useReducedMotion()
  const H = height
  const plotW = W - PAD.l - PAD.r
  const plotH = H - PAD.t - PAD.b

  const [x0, x1] = domainX
  const [y0, y1] = domainY
  const spanX = x1 - x0 || 1
  const spanY = y1 - y0 || 1
  const sx = (t: number) => PAD.l + ((t - x0) / spanX) * plotW
  const sy = (v: number) => PAD.t + plotH - ((v - y0) / spanY) * plotH

  const nowX = sx(nowTs)

  return (
    <svg
      role="img"
      aria-label="Curvas de decaimiento de péptidos en el tiempo"
      width="100%"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ display: 'block', overflow: 'visible' }}
    >
      {/* gridlines + etiquetas Y */}
      {yTicks.map((v) => {
        const y = sy(v)
        return (
          <g key={`y${v}`}>
            <line x1={PAD.l} y1={y} x2={W - PAD.r} y2={y} stroke="var(--border)" strokeWidth={1} strokeDasharray="4 4" opacity={0.6} />
            <text x={PAD.l - 6} y={y + 3} textAnchor="end" fontSize={9} fontFamily="JetBrains Mono, monospace" fill="var(--ink-300)">
              {formatY(v)}
            </text>
          </g>
        )
      })}

      {/* etiquetas X */}
      {xTicks.map(({ t, label }, i) => (
        <text key={`x${i}`} x={sx(t)} y={H - 6} textAnchor="middle" fontSize={9} fontFamily="JetBrains Mono, monospace" fill="var(--ink-300)">
          {label}
        </text>
      ))}

      {/* línea "ahora" */}
      {nowTs >= x0 && nowTs <= x1 && (
        <g>
          <line x1={nowX} y1={PAD.t} x2={nowX} y2={PAD.t + plotH} stroke="var(--ink-300)" strokeWidth={1} strokeDasharray="2 4" />
          <text x={nowX} y={PAD.t - 5} textAnchor="middle" fontSize={9} fontFamily="JetBrains Mono, monospace" fill="var(--ink-400)">
            ahora
          </text>
        </g>
      )}

      {/* series */}
      {series.map((s) => {
        const px = s.points.map((p) => [sx(p[0]), sy(p[1])] as [number, number])
        const nowY = valueAt(s.points, nowTs)
        const showNowDot = nowY != null && nowTs >= x0 && nowTs <= x1
        return (
          <g key={s.product}>
            <motion.path
              d={linePath(px)}
              fill="none"
              stroke={s.color}
              strokeWidth={2.25}
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={reduce ? false : { pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: dur.draw, ease: ease.decelerate }}
            />
            {/* marcadores de inyección */}
            {s.markers.map((m, i) => (
              <circle key={i} cx={sx(m[0])} cy={sy(m[1])} r={3.5} fill={s.color} stroke="var(--card)" strokeWidth={1.5} />
            ))}
            {/* punto de presencia AHORA (interpolado en nowTs, no en el extremo futuro) */}
            {showNowDot && (
              <motion.circle
                cx={sx(nowTs)} cy={sy(nowY!)} r={4} fill={s.color} stroke="var(--card)" strokeWidth={1.5}
                initial={reduce ? false : { scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ ...spring.ui, delay: reduce ? 0 : dur.draw }}
                style={{ originX: `${sx(nowTs)}px`, originY: `${sy(nowY!)}px` }}
              />
            )}
          </g>
        )
      })}
    </svg>
  )
}
