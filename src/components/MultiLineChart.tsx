// MultiLineChart — chart SVG multi-serie de decaimiento (sin librerías de charting).
// Líneas por producto, gridlines, línea "ahora" con punto pulsante, marcadores de inyección,
// líneas de referencia y tooltip táctil (valor de cada serie en el instante tocado).
// (Optimizador de dashboards + diseñador del equipo multiagente — Loop 02.)
import { useRef, useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { dur, ease, spring } from '../lib/motion'
import type { Pt } from '../lib/pharma'
import { washoutMs } from '../lib/pharma'

export interface ChartSeries {
  product: string
  color: string
  points: Pt[]
  markers: Pt[]
  dashed?: boolean
  halfLifeH?: number
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
  refLines?: { y: number; label: string; tooltip?: string }[] // tooltip educativo al tap (item 380)
  mode?: 'percent' | 'absolute'
  verticalRefs?: { t: number; label: string; color?: string; tooltip?: string; dot?: boolean }[]
  secondarySeries?: { points: [number, number][]; color?: string; label?: string }
  showSecondaryAxis?: boolean
  domainY2?: [number, number]
  // item 280 — zona de washout sombreada desde este timestamp (opcional, retrocompatible)
  shadeFrom?: number
}

const W = 360
const PAD = { l: 42, r: 14, t: 16, b: 28 }

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

// formatea washoutMs en días/horas legibles
function formatWashout(halfLifeH: number): string {
  const ms = washoutMs(halfLifeH)
  const totalH = ms / 3_600_000
  if (totalH >= 48) return `~${Math.round(totalH / 24)}d`
  return `~${Math.round(totalH)}h`
}

export function MultiLineChart({
  series, domainX, domainY, nowTs, height = 200, yTicks = [], formatY = (v) => String(Math.round(v)), xTicks = [], refLines = [], mode,
  verticalRefs = [], secondarySeries, showSecondaryAxis, domainY2,
  shadeFrom,
}: Props) {
  const reduce = useReducedMotion()
  const svgRef = useRef<SVGSVGElement>(null)
  const [hoverT, setHoverT] = useState<number | null>(null)
  // item 380 — tooltip educativo en refLines al tap (índice de la línea activa, o null)
  const [activeRefLine, setActiveRefLine] = useState<number | null>(null)

  const H = height
  const plotW = W - PAD.l - PAD.r
  const plotH = H - PAD.t - PAD.b
  // 3+ series solapadas → atenuar los halos pulsantes del punto "ahora"
  const manySeries = series.length >= 3

  const [x0, x1] = domainX
  const [y0, y1] = domainY
  const spanX = x1 - x0 || 1
  const spanY = y1 - y0 || 1
  const sx = (t: number) => PAD.l + ((t - x0) / spanX) * plotW
  const sy = (v: number) => PAD.t + plotH - ((v - y0) / spanY) * plotH
  const nowX = sx(nowTs)

  // secondary axis (Y2) — narrower plot width to avoid overlap
  const plotW2 = plotW - 22
  const secDomainY2: [number, number] = domainY2 ?? (() => {
    if (!secondarySeries || !secondarySeries.points.length) return [0, 1]
    const vals = secondarySeries.points.map((p) => p[1])
    return [Math.min(...vals) - 0.5, Math.max(...vals) + 0.5]
  })()
  const [y2min, y2max] = secDomainY2
  const spanY2 = y2max - y2min || 1
  const sy2 = (v: number) => PAD.t + plotH - ((v - y2min) / spanY2) * plotH
  const sx2 = (t: number) => PAD.l + ((t - x0) / spanX) * plotW2

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
    rows: series.map((s) => ({
      product: s.product,
      color: s.color,
      v: valueAt(s.points, hoverT),
      halfLifeH: s.halfLifeH,
    })).filter((r) => r.v != null),
  }

  // box height con líneas de washout (approx 12px por fila extra)
  const rowH = 16
  const boxW = 140
  const boxH = hover
    ? 14 + hover.rows.reduce((acc, r) => {
        const hasWashout = mode === 'percent' && r.halfLifeH != null
        return acc + rowH + (hasWashout ? 11 : 0)
      }, 0)
    : 0
  const boxX = hover ? (sx(hover.t) > W / 2 ? Math.max(PAD.l, sx(hover.t) - boxW - 8) : Math.min(W - PAD.r - boxW, sx(hover.t) + 8)) : 0

  // calcular offsets de fila para el tooltip
  const rowOffsets: number[] = []
  if (hover) {
    let yOff = 16
    for (const r of hover.rows) {
      rowOffsets.push(yOff)
      const hasWashout = mode === 'percent' && r.halfLifeH != null
      yOff += rowH + (hasWashout ? 11 : 0)
    }
  }

  // item 280 — calcular zona de washout (shadeFrom → x1)
  const washoutShade = (() => {
    if (shadeFrom == null) return null
    const wx = sx(shadeFrom)
    if (wx >= W - PAD.r) return null // ya fuera del plot
    const left = Math.max(PAD.l, wx)
    const right = W - PAD.r
    if (left >= right) return null
    return { left, right, wx }
  })()

  // item 380 — tooltip box para refLines educativas
  const refLineTooltipW = 164
  const refLineTooltipH = 44

  return (
    <svg
      ref={svgRef}
      role="img"
      aria-label="Curvas de decaimiento de péptidos en el tiempo"
      width="100%"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ display: 'block', overflow: 'hidden', touchAction: 'pan-y' }}
      onClick={() => {
        // Cerrar tooltip educativo al tocar fuera
        if (activeRefLine !== null) setActiveRefLine(null)
      }}
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

      {/* item 280 — zona de washout sombreada */}
      {washoutShade && (
        <g>
          <rect
            x={washoutShade.left}
            y={PAD.t}
            width={washoutShade.right - washoutShade.left}
            height={plotH}
            fill="var(--ink-100)"
            opacity={0.55}
          />
          <text
            x={washoutShade.left + 4}
            y={PAD.t + 12}
            fontSize={8}
            fontFamily="JetBrains Mono, monospace"
            fill="var(--ink-300)"
          >
            washout
          </text>
        </g>
      )}

      {/* líneas de referencia (p.ej. 25%) — item 380: táctiles con tooltip educativo */}
      {refLines.map((r, ri) => {
        const y = sy(r.y)
        const isActive = activeRefLine === ri
        const hasTooltip = !!r.tooltip
        const ttX = Math.min(W - PAD.r - refLineTooltipW - 4, PAD.l + 4)
        const ttY = y - refLineTooltipH - 6
        return (
          <g
            key={`ref${r.y}`}
            style={{ cursor: hasTooltip ? 'pointer' : undefined }}
            onClick={hasTooltip ? (e) => { e.stopPropagation(); setActiveRefLine(isActive ? null : ri) } : undefined}
          >
            <line x1={PAD.l} y1={y} x2={W - PAD.r} y2={y} stroke="var(--ink-300)" strokeWidth={1} strokeDasharray="1 4" opacity={0.7} />
            <text x={W - PAD.r} y={y - 3} textAnchor="end" fontSize={8.5} fontFamily="JetBrains Mono, monospace" fill="var(--ink-300)">
              {r.label}
            </text>
            {/* hit area ampliado para tap */}
            {hasTooltip && (
              <rect x={PAD.l} y={y - 8} width={plotW} height={16} fill="transparent" />
            )}
            {/* item 380 — tooltip educativo expandible */}
            <AnimatePresence>
              {isActive && hasTooltip && (
                <motion.g
                  initial={{ opacity: 0, scale: 0.88 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.88 }}
                  transition={{ duration: dur.fast, ease: ease.standard }}
                  style={{ transformOrigin: `${ttX + refLineTooltipW / 2}px ${ttY + refLineTooltipH / 2}px` }}
                >
                  <rect
                    x={ttX} y={Math.max(PAD.t + 2, ttY)}
                    width={refLineTooltipW} height={refLineTooltipH}
                    rx={6}
                    fill="var(--card)" stroke="var(--border)" strokeWidth={1} opacity={0.97}
                  />
                  <foreignObject
                    x={ttX + 7}
                    y={Math.max(PAD.t + 6, ttY + 6)}
                    width={refLineTooltipW - 14}
                    height={refLineTooltipH - 10}
                  >
                    <div
                      style={{
                        fontSize: 8.5,
                        fontFamily: 'JetBrains Mono, monospace',
                        color: 'var(--ink-400)',
                        lineHeight: 1.35,
                        whiteSpace: 'normal',
                      }}
                    >
                      {r.tooltip}
                    </div>
                  </foreignObject>
                </motion.g>
              )}
            </AnimatePresence>
          </g>
        )
      })}

      {/* líneas de referencia VERTICALES (dibujadas antes de las series) */}
      {(() => {
        // Anti-overlape de etiquetas: en vez de dibujarlas todas a la misma altura (se encimaban
        // cuando hay varias tomas próximas en tiempos cercanos), las ESCALONO en hasta 3 filas según
        // su cercanía en X. La línea + el punto de color siempre se dibujan; solo la etiqueta baja de fila.
        const ROW_H = 13
        const ROWS = 4
        const refs = verticalRefs
          .map((r) => {
            const vx = sx(r.t)
            const max = r.dot ? 22 : 14
            const labelTxt = r.label.length > max ? r.label.slice(0, max - 1) + '…' : r.label
            return { r, vx, labelTxt, w: labelTxt.length * 4.9 + 12 }
          })
          .filter(({ vx }) => vx >= PAD.l && vx <= W - PAD.r)
        // asignar filas por orden de X (empacar en la primera fila libre). row = -1 → no cabe en ninguna
        // fila sin encimarse: se oculta SOLO el texto (la línea + el punto de color siguen visibles).
        const sorted = [...refs].sort((a, b) => a.vx - b.vx)
        const rowRight = new Array(ROWS).fill(-Infinity)
        const rowOf = new Map<typeof refs[number], number>()
        for (const it of sorted) {
          let row = -1
          for (let i = 0; i < ROWS; i++) { if (it.vx >= rowRight[i]) { row = i; break } }
          if (row >= 0) rowRight[row] = it.vx + it.w
          rowOf.set(it, row)
        }
        return refs.map((item) => {
          const { r, vx, labelTxt, w } = item
          const col = r.color ?? 'var(--brand-500)'
          const anchorEnd = vx > PAD.l + plotW / 2
          const row = rowOf.get(item) ?? 0
          const showLabel = row >= 0
          const yBase = PAD.t + (r.dot ? 8 : 12) + Math.max(0, row) * ROW_H
          return (
            <g key={`vref-${r.t}-${r.label}`}>
              <line
                x1={vx} y1={PAD.t} x2={vx} y2={PAD.t + plotH}
                stroke={col} strokeWidth={r.dot ? 1.4 : 1}
                strokeDasharray={r.dot ? '1 4' : '3 4'} strokeLinecap="round"
                opacity={r.dot ? 0.9 : 0.8}
              />
              {r.dot && (
                <circle cx={vx} cy={PAD.t + 3.5} r={3} fill={col} stroke="var(--card)" strokeWidth={1.2} />
              )}
              {showLabel && r.dot && (
                <rect
                  x={anchorEnd ? vx - 4 - w : vx + 4}
                  y={yBase} width={w} height={12} rx={6}
                  fill="var(--card)" opacity={0.85}
                />
              )}
              {showLabel && (
                <text
                  x={anchorEnd ? vx - (r.dot ? 8 : 3) : vx + (r.dot ? 8 : 3)}
                  y={yBase + (r.dot ? 9 : 8)}
                  textAnchor={anchorEnd ? 'end' : 'start'}
                  fontSize={r.dot ? 8.5 : 8} fontWeight={r.dot ? 600 : 400}
                  fontFamily="JetBrains Mono, monospace" fill={col}
                >
                  {labelTxt}
                </text>
              )}
            </g>
          )
        })
      })()}

      {/* etiquetas X */}
      {xTicks.map(({ t, label }, i) => (
        <text key={`x${i}`} x={sx(t)} y={H - 6} textAnchor="middle" fontSize={9} fontFamily="JetBrains Mono, monospace" fill="var(--ink-300)">
          {label}
        </text>
      ))}

      {/* línea "ahora" — motion.line para deslizar al cambiar ventana */}
      {nowTs >= x0 && nowTs <= x1 && (
        <g>
          <motion.line
            x1={nowX} y1={PAD.t} x2={nowX} y2={PAD.t + plotH}
            stroke="var(--brand-500)" strokeWidth={1} strokeDasharray="3 3"
            initial={{ x1: nowX, x2: nowX }}
            animate={{ x1: nowX, x2: nowX }}
            transition={{ duration: dur.base, ease: ease.standard }}
          />
          <text x={nowX} y={PAD.t - 5} textAnchor="middle" fontSize={9} fontFamily="JetBrains Mono, monospace" fill="var(--brand-500)">
            ahora
          </text>
        </g>
      )}

      {/* series */}
      {series.map((s, si) => {
        const px = s.points.map((p) => [sx(p[0]), sy(p[1])] as [number, number])
        const nowY = valueAt(s.points, nowTs)
        const showNowDot = nowY != null && nowTs >= x0 && nowTs <= x1
        const baseY = PAD.t + plotH
        const gid = `pharmaFill${si}`
        const areaD = px.length ? `${linePath(px)} L ${px[px.length - 1][0].toFixed(1)} ${baseY} L ${px[0][0].toFixed(1)} ${baseY} Z` : ''
        const haloDelay = si * 0.4
        return (
          <g key={s.product}>
            {/* relleno de área (suave) para distinguir cada curva */}
            {areaD && (
              <>
                <defs>
                  <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={s.color} stopOpacity={s.dashed ? 0.10 : 0.18} />
                    <stop offset="100%" stopColor={s.color} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <motion.path
                  d={areaD}
                  fill={`url(#${gid})`}
                  stroke="none"
                  initial={reduce ? { opacity: 1 } : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={reduce ? { duration: 0 } : { duration: dur.base, delay: dur.draw * 0.5 }}
                />
              </>
            )}
            <motion.path
              d={linePath(px)}
              fill="none"
              stroke={s.color}
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={s.dashed ? '6 4' : undefined}
              initial={reduce ? false : { pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: dur.draw, ease: ease.decelerate }}
            />
            {/* marcadores de inyección — motion.circle con pop escalonado */}
            {s.markers.map((m, i) => (
              <motion.circle
                key={i}
                cx={sx(m[0])} cy={sy(m[1])} r={3.5}
                fill={s.color} stroke="var(--card)" strokeWidth={1.5}
                style={{ transformOrigin: `${sx(m[0])}px ${sy(m[1])}px` }}
                initial={reduce ? false : { scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={reduce ? { duration: 0 } : {
                  ...spring.ui,
                  delay: dur.draw * 0.6 + i * 0.07 + si * 0.12,
                }}
              />
            ))}
            {/* punto de presencia AHORA, con halo pulsante "vivo" desfasado por serie.
                Con 3+ series solapadas el halo se reduce (r y opacidad) para no apilar círculos
                crecientes encima de la línea/etiqueta "ahora". El dot sólido queda siempre encima. */}
            {showNowDot && (
              <g>
                {!reduce && (
                  <motion.circle
                    cx={sx(nowTs)} cy={sy(nowY!)} fill={s.color}
                    initial={{ r: 4, opacity: manySeries ? 0.2 : 0.35 }}
                    animate={manySeries ? { r: [4, 6], opacity: [0.2, 0] } : { r: [4, 9], opacity: [0.35, 0] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeOut', delay: haloDelay }}
                  />
                )}
                <circle cx={sx(nowTs)} cy={sy(nowY!)} r={4} fill={s.color} stroke="var(--card)" strokeWidth={1.5} />
              </g>
            )}
          </g>
        )
      })}

      {/* overlay de serie secundaria (scatter + línea punteada + eje Y2) */}
      {secondarySeries && secondarySeries.points.length >= 2 && (() => {
        const col = secondarySeries.color ?? 'var(--ink-400)'
        const pts2 = secondarySeries.points.filter(([t]) => t >= x0 && t <= x1)
        const polyPts = pts2.map(([t, v]) => `${sx2(t).toFixed(1)},${sy2(v).toFixed(1)}`).join(' ')
        return (
          <g>
            {pts2.length >= 2 && (
              <polyline points={polyPts} fill="none" stroke="var(--ink-300)" strokeDasharray="2 3" strokeWidth={1} />
            )}
            {pts2.map(([t, v], i) => (
              <circle key={i} cx={sx2(t)} cy={sy2(v)} r={3} fill={col} />
            ))}
            {showSecondaryAxis && (
              <>
                {/* ticks min/max del eje Y2 */}
                <text x={W - 6} y={sy2(y2max) + 3} textAnchor="end" fontSize={8} fontFamily="JetBrains Mono, monospace" fill={col}>{y2max.toFixed(1)}</text>
                <text x={W - 6} y={sy2(y2min) + 3} textAnchor="end" fontSize={8} fontFamily="JetBrains Mono, monospace" fill={col}>{y2min.toFixed(1)}</text>
                {/* etiqueta rotada del eje Y2 */}
                <text
                  x={W - 6}
                  y={PAD.t + plotH / 2}
                  fontSize={8}
                  fontFamily="JetBrains Mono, monospace"
                  fill={col}
                  textAnchor="middle"
                  transform={`rotate(-90, ${W - 6}, ${PAD.t + plotH / 2})`}
                >
                  {secondarySeries.label ?? 'kg'}
                </text>
              </>
            )}
          </g>
        )
      })()}

      {/* tooltip táctil — AnimatePresence para fade/slide suave */}
      <AnimatePresence>
        {hover && (
          <motion.g
            key="tooltip"
            pointerEvents="none"
            initial={reduce ? { opacity: 1 } : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 4 }}
            transition={{ duration: dur.fast, ease: ease.standard }}
          >
            <line x1={sx(hover.t)} y1={PAD.t} x2={sx(hover.t)} y2={PAD.t + plotH} stroke="var(--ink-400)" strokeWidth={1} />
            {hover.rows.map((r) => (
              <circle key={r.product} cx={sx(hover.t)} cy={sy(r.v!)} r={3} fill={r.color} stroke="var(--card)" strokeWidth={1.5} />
            ))}
            <rect x={boxX} y={PAD.t} width={boxW} height={boxH} rx={6} fill="var(--card)" stroke="var(--border)" strokeWidth={1} opacity={0.97} />
            {hover.rows.map((r, i) => {
              const yOff = rowOffsets[i] ?? (14 + i * rowH)
              const hasWashout = mode === 'percent' && r.halfLifeH != null
              return (
                <g key={r.product} transform={`translate(${boxX + 8}, ${PAD.t + yOff})`}>
                  <circle cx={3} cy={-3} r={3.5} fill={r.color} />
                  <text x={12} y={0} fontSize={10} fontFamily="JetBrains Mono, monospace" fill="var(--ink-700)">
                    {r.product.length > 12 ? r.product.slice(0, 11) + '…' : r.product}
                  </text>
                  <text x={boxW - 16} y={0} textAnchor="end" fontSize={10.5} fontFamily="JetBrains Mono, monospace" fill="var(--ink-900)" fontWeight={700}>
                    {formatY(r.v!)}
                  </text>
                  {hasWashout && (
                    <text x={12} y={10} fontSize={8.5} fontFamily="JetBrains Mono, monospace" fill="var(--ink-300)">
                      washout {formatWashout(r.halfLifeH!)}
                    </text>
                  )}
                </g>
              )
            })}
          </motion.g>
        )}
      </AnimatePresence>

      {/* capa de captura del pointer (encima de todo) */}
      <rect
        x={PAD.l} y={PAD.t} width={plotW} height={plotH} fill="transparent"
        onPointerDown={onMove} onPointerMove={onMove} onPointerLeave={() => setHoverT(null)} onPointerUp={() => setHoverT(null)}
        style={{ cursor: 'crosshair' }}
      />
    </svg>
  )
}
