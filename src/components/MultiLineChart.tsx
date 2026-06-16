// MultiLineChart — chart SVG multi-serie de decaimiento (sin librerías de charting).
// Líneas por producto, gridlines, línea "ahora" con punto pulsante, marcadores de inyección,
// líneas de referencia y tooltip táctil (valor de cada serie en el instante tocado).
// (Optimizador de dashboards + diseñador del equipo multiagente — Loop 02.)
import { useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { dur, ease } from '../lib/motion'
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
  yTicks?: number[]
  formatY?: (v: number) => string
  xTicks?: { t: number; label: string }[]
  refLines?: { y: number; label: string }[]   // líneas horizontales de referencia (p.ej. 25%)
}

const W = 360
const PAD = { l: 36, r: 14, t: 16, b: 26 }

function linePath(pts: [number, number][]): string {
  if (!pts.length) return ''
  return pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ')
}

// valor (y) interpolado linealmente en el instante t — para el punto "ahora" y el tooltip
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
  series, domainX, domainY, nowTs, height = 200, yTicks = [], formatY = (v) => String(Math.round(v)), xTicks = [], refLines = [],
}: Props) {
  const reduce = useReducedMotion()
  const svgRef = useRef<SVGSVGElement>(null)
  const [hoverT, setHoverT] = useState<number | null>(null)

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

  // pointer → instante de tiempo (toca/arrastra sobre el plot)
  const onMove = (e: React.PointerEvent) => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return
    const vbX = ((e.clientX - rect.left) / rect.width) * W
    const t = x0 + ((vbX - PAD.l) / plotW) * spanX
    setHoverT(Math.max(x0, Math.min(x1, t)))
  }

  // tooltip: valor de cada serie en hoverT
  const hover = hoverT == null ? null : {
    t: hoverT,
    rows: series.map((s) => ({ product: s.product, color: s.color, v: valueAt(s.points, hoverT) })).filter((r) => r.v != null),
  }
  const boxW = 132
  const boxH = hover ? 14 + hover.rows.length * 13 : 0
  const boxX = hover ? (sx(hover.t) > W / 2 ? Math.max(PAD.l, sx(hover.t) - boxW - 8) : Math.min(W - PAD.r - boxW, sx(hover.t) + 8)) : 0

  return (
    <svg
      ref={svgRef}
      role="img"
      aria-label="Curvas de decaimiento de péptidos en el tiempo"
      width="100%"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ display: 'block', overflow: 'visible', touchAction: 'pan-y' }}
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

      {/* líneas de referencia (p.ej. 25%) */}
      {refLines.map((r) => {
        const y = sy(r.y)
        return (
          <g key={`ref${r.y}`}>
            <line x1={PAD.l} y1={y} x2={W - PAD.r} y2={y} stroke="var(--ink-300)" strokeWidth={1} strokeDasharray="1 4" opacity={0.7} />
            <text x={W - PAD.r} y={y - 3} textAnchor="end" fontSize={8.5} fontFamily="JetBrains Mono, monospace" fill="var(--ink-300)">
              {r.label}
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
            {s.markers.map((m, i) => (
              <circle key={i} cx={sx(m[0])} cy={sy(m[1])} r={3.5} fill={s.color} stroke="var(--card)" strokeWidth={1.5} />
            ))}
            {/* punto de presencia AHORA, con halo pulsante "vivo" */}
            {showNowDot && (
              <g>
                {!reduce && (
                  <motion.circle
                    cx={sx(nowTs)} cy={sy(nowY!)} fill={s.color}
                    animate={{ r: [4, 9], opacity: [0.35, 0] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
                  />
                )}
                <circle cx={sx(nowTs)} cy={sy(nowY!)} r={4} fill={s.color} stroke="var(--card)" strokeWidth={1.5} />
              </g>
            )}
          </g>
        )
      })}

      {/* tooltip táctil */}
      {hover && (
        <g pointerEvents="none">
          <line x1={sx(hover.t)} y1={PAD.t} x2={sx(hover.t)} y2={PAD.t + plotH} stroke="var(--ink-400)" strokeWidth={1} />
          {hover.rows.map((r, i) => (
            <circle key={r.product} cx={sx(hover.t)} cy={sy(r.v!)} r={3} fill={r.color} stroke="var(--card)" strokeWidth={1.5} />
          ))}
          <rect x={boxX} y={PAD.t} width={boxW} height={boxH} rx={6} fill="var(--card)" stroke="var(--border)" strokeWidth={1} opacity={0.97} />
          {hover.rows.map((r, i) => (
            <g key={r.product} transform={`translate(${boxX + 8}, ${PAD.t + 14 + i * 13})`}>
              <circle cx={3} cy={-3} r={3.5} fill={r.color} />
              <text x={12} y={0} fontSize={9} fontFamily="JetBrains Mono, monospace" fill="var(--ink-700)">
                {r.product.length > 12 ? r.product.slice(0, 11) + '…' : r.product}
              </text>
              <text x={boxW - 16} y={0} textAnchor="end" fontSize={9} fontFamily="JetBrains Mono, monospace" fill="var(--ink-900)" fontWeight={600}>
                {formatY(r.v!)}
              </text>
            </g>
          ))}
        </g>
      )}

      {/* capa de captura del pointer (encima de todo) */}
      <rect
        x={PAD.l} y={PAD.t} width={plotW} height={plotH} fill="transparent"
        onPointerDown={onMove} onPointerMove={onMove} onPointerLeave={() => setHoverT(null)} onPointerUp={() => setHoverT(null)}
        style={{ cursor: 'crosshair' }}
      />
    </svg>
  )
}
