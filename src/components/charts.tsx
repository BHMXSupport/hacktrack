// Gráficas suaves "tus datos": Sparkline (mini) y LineChart (con área + draw-on).
import { useId, useMemo, useState, useCallback } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { dur, ease, spring } from '../lib/motion'

/**
 * SparkBar: mini-barras de adherencia de las últimas N semanas.
 * data[0] = semana más reciente. Cada valor: 0-100 o null (sin datos esa semana).
 */
export function SparkBar({
  data,
  color = 'var(--brand-500)',
  missColor = 'var(--warning)',
  barW = 10,
  barMaxH = 32,
  gap = 4,
}: {
  data: (number | null)[]
  color?: string
  missColor?: string
  barW?: number
  barMaxH?: number
  gap?: number
}) {
  const reduce = useReducedMotion()
  const totalW = data.length * (barW + gap) - gap
  return (
    <svg
      width={totalW}
      height={barMaxH}
      aria-hidden="true"
      style={{ display: 'block', overflow: 'visible' }}
    >
      {[...data].reverse().map((pct, i) => {
        const barH = pct == null ? 3 : Math.max(3, (pct / 100) * barMaxH)
        const y = barMaxH - barH
        const x = i * (barW + gap)
        const fill = pct == null
          ? 'var(--ink-100)'
          : pct >= 80 ? color : pct >= 50 ? missColor : 'var(--error)'
        return (
          <motion.rect
            key={i}
            x={x}
            y={y}
            width={barW}
            height={barH}
            rx={barW / 2}
            fill={fill}
            initial={reduce ? false : { scaleY: 0, originY: barMaxH }}
            animate={{ scaleY: 1 }}
            transition={{ duration: dur.base, ease: ease.decelerate, delay: reduce ? 0 : i * 0.04 }}
            style={{ transformOrigin: `${x + barW / 2}px ${barMaxH}px` }}
          />
        )
      })}
    </svg>
  )
}

function smoothPath(pts: [number, number][]): string {
  if (pts.length < 2) return ''
  let d = `M ${pts[0][0]} ${pts[0][1]}`
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1]
    const [x1, y1] = pts[i]
    const mx = (x0 + x1) / 2
    d += ` C ${mx} ${y0} ${mx} ${y1} ${x1} ${y1}`
  }
  return d
}

function toPoints(data: number[], w: number, h: number, pad = 4): [number, number][] {
  const min = Math.min(...data)
  const max = Math.max(...data)
  const span = max - min || 1
  const step = (w - pad * 2) / (data.length - 1 || 1)
  return data.map((v, i) => [pad + i * step, h - pad - ((v - min) / span) * (h - pad * 2)])
}

/** Interpolación lineal: dado un x en píxeles, devuelve el valor de datos correspondiente. */
export function valueAt(pts: [number, number][], data: number[], xPx: number): number | null {
  if (pts.length < 2) return null
  // encontrar el segmento
  for (let i = 1; i < pts.length; i++) {
    const [x0] = pts[i - 1]
    const [x1] = pts[i]
    if (xPx >= x0 && xPx <= x1) {
      const t = (xPx - x0) / (x1 - x0)
      return data[i - 1] + t * (data[i] - data[i - 1])
    }
  }
  if (xPx <= pts[0][0]) return data[0]
  if (xPx >= pts[pts.length - 1][0]) return data[data.length - 1]
  return null
}

/** Media móvil de N puntos (n=7). */
export function movingAverage(data: number[], n = 7): (number | null)[] {
  return data.map((_, i) => {
    const start = Math.max(0, i - n + 1)
    const window = data.slice(start, i + 1)
    if (window.length < Math.min(n, 3)) return null // necesita al menos 3 puntos
    return window.reduce((a, b) => a + b, 0) / window.length
  })
}

export function Sparkline({ data, color = 'var(--brand-500)', w = 76, h = 30, animKey, interactive, refY }: {
  data: number[]; color?: string; w?: number; h?: number; animKey?: string | number
  /** Activar tooltip táctil (n=347) */
  interactive?: boolean
  /** Línea de referencia horizontal (valor en escala de datos) (n=354) */
  refY?: number
}) {
  const reduce = useReducedMotion()
  const [tip, setTip] = useState<{ x: number; y: number; val: number } | null>(null)

  // computado de forma segura para data vacía (los hooks DEBEN ir antes del early-return)
  const pad = 4
  const hasData = data.length > 0
  const pts = hasData ? toPoints(data, w, h, pad) : []
  const min = hasData ? Math.min(...data) : 0
  const max = hasData ? Math.max(...data) : 1
  const span = max - min || 1

  // calcular Y de la línea de meta
  const refYPx = refY != null
    ? h - pad - ((Math.min(Math.max(refY, min), max) - min) / span) * (h - pad * 2)
    : null

  const handlePointerMove = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (!interactive) return
    const rect = e.currentTarget.getBoundingClientRect()
    const xPx = (e.clientX - rect.left) * (w / rect.width)
    const val = valueAt(pts, data, xPx)
    if (val != null) {
      const yPx = h - pad - ((val - min) / span) * (h - pad * 2)
      setTip({ x: xPx, y: yPx, val: Math.round(val * 10) / 10 })
    }
  }, [interactive, pts, data, w, h, pad, min, span])

  const handlePointerLeave = useCallback(() => setTip(null), [])

  if (!hasData) return <svg width={w} height={h} />

  return (
    <svg
      width={w} height={h} aria-hidden
      onPointerMove={interactive ? handlePointerMove : undefined}
      onPointerLeave={interactive ? handlePointerLeave : undefined}
      style={interactive ? { cursor: 'crosshair', touchAction: 'none' } : undefined}
    >
      {/* línea de meta */}
      {refYPx != null && (
        <line
          x1={pad} y1={refYPx} x2={w - pad} y2={refYPx}
          stroke="var(--brand-300)" strokeWidth={1.5} strokeDasharray="3 3"
        />
      )}
      <motion.path
        key={animKey}
        d={smoothPath(pts)}
        fill="none"
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap="round"
        initial={reduce ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: dur.draw, ease: ease.decelerate }}
      />
      {/* tooltip táctil */}
      {interactive && tip && (
        <>
          <circle cx={tip.x} cy={tip.y} r={3.5} fill={color} />
          <rect
            x={Math.min(tip.x + 4, w - 36)} y={tip.y - 14}
            width={32} height={14} rx={3}
            fill="var(--card)" stroke="var(--border)" strokeWidth={0.5}
          />
          <text
            x={Math.min(tip.x + 20, w - 20)} y={tip.y - 4}
            fontSize={8} fontFamily="JetBrains Mono" fill="var(--ink-700)"
            textAnchor="middle"
          >{tip.val}</text>
        </>
      )}
    </svg>
  )
}

// Mini-gráfica de tendencia: serie real (tenue) + línea de regresión (resaltada). Para "Tu protocolo en números".
export function TrendChart({
  data,
  w = 280,
  h = 60,
  lineColor = 'var(--ink-300)',
  trendColor = 'var(--brand-700)',
  labels,
  events,
  showBand,
  projectionEtaTs,
  projectionStartTs,
}: {
  data: number[]
  w?: number
  h?: number
  lineColor?: string
  trendColor?: string
  labels?: [string, string]
  /** Marcadores verticales de eventos con etiqueta (n=343) */
  events?: { idx: number; label: string }[]
  /** Mostrar banda ±1σ alrededor de la tendencia (n=348) */
  showBand?: boolean
  /** Timestamp ETA de la proyección (n=294) — si se pasa, dibuja curva punteada proyectada */
  projectionEtaTs?: number | null
  /** Timestamp del inicio del protocolo (para posicionar ETA en el eje X) */
  projectionStartTs?: number
}) {
  const reduce = useReducedMotion()
  const n = data.length
  // regresión lineal memoizada (x = índice) — hook ANTES de cualquier early-return
  const { slope, intercept, sigma, r2 } = useMemo(() => {
    let sx = 0, sy = 0, sxx = 0, sxy = 0
    for (let i = 0; i < n; i++) { sx += i; sy += data[i]; sxx += i * i; sxy += i * data[i] }
    const den = n * sxx - sx * sx
    const sl = den ? (n * sxy - sx * sy) / den : 0
    const ic = n ? (sy - sl * sx) / n : 0
    // R² y σ
    const mean = sy / (n || 1)
    let ssTot = 0, ssRes = 0
    for (let i = 0; i < n; i++) {
      ssTot += (data[i] - mean) ** 2
      ssRes += (data[i] - (ic + sl * i)) ** 2
    }
    const r2v = ssTot > 0 ? 1 - ssRes / ssTot : 1
    const sigmaV = n > 1 ? Math.sqrt(ssRes / (n - 1)) : 0
    return { slope: sl, intercept: ic, sigma: sigmaV, r2: Math.max(0, Math.min(1, r2v)) }
  }, [data, n])
  const uid = useId() // hook ANTES de cualquier early-return
  if (data.length < 2) return <svg width={w} height={h} />
  const tyA = intercept, tyB = intercept + slope * (n - 1)
  // escala incluyendo los extremos de la tendencia para no recortar
  const pad = 8
  const ch = labels ? h - 14 : h

  // si hay proyección, calcular cuántos puntos extra proyectar
  let projSteps = 0
  if (projectionEtaTs != null && projectionEtaTs > 0 && n >= 2) {
    // estimación: la serie cubre N-1 intervalos de tiempo; extrapolar días hasta ETA
    projSteps = Math.min(Math.round(n * 0.6), 12) // máximo 60% extra, hasta 12 pasos
  }
  const totalN = n + projSteps

  const min = Math.min(...data, tyA, tyB, projSteps > 0 ? intercept + slope * (totalN - 1) : Infinity)
  const max = Math.max(...data, tyA, tyB, projSteps > 0 ? intercept + slope * (totalN - 1) : -Infinity)
  const minSafe = isFinite(min) ? min : Math.min(...data)
  const maxSafe = isFinite(max) ? max : Math.max(...data)
  const span = maxSafe - minSafe || 1
  const step = (w - pad * 2) / (totalN - 1 || 1)
  const X = (i: number) => pad + i * step
  const Y = (v: number) => ch - pad - ((v - minSafe) / span) * (ch - pad * 2)
  const pts = data.map((v, i) => [X(i), Y(v)] as [number, number])

  // puntos de la proyección punteada
  const projPts: [number, number][] = projSteps > 0
    ? Array.from({ length: projSteps + 1 }, (_, k) => [X(n - 1 + k), Y(intercept + slope * (n - 1 + k))] as [number, number])
    : []

  // banda ±1σ: path de área alrededor de la tendencia
  const bandPath = showBand && sigma > 0 ? (() => {
    const trendPts = data.map((_, i) => [X(i), Y(intercept + slope * i)] as [number, number])
    const upper = trendPts.map(([x, y]) => [x, Y(intercept + slope * trendPts.indexOf([x, y]) + sigma)] as [number, number])
    // Upper: i→0..n-1: Y(trend[i] + sigma); Lower reversed
    const upperPath = trendPts.map((_, i) => [X(i), Y(intercept + slope * i - sigma)] as [number, number])
    const lowerPath = trendPts.map((_, i) => [X(i), Y(intercept + slope * i + sigma)] as [number, number])
    const fwd = lowerPath.map(([x, y]) => `${x},${y}`).join(' L ')
    const rev = [...upperPath].reverse().map(([x, y]) => `${x},${y}`).join(' L ')
    return `M ${fwd} L ${rev} Z`
  })() : null

  // Banda σ simplificada (sin depender del indexOf de arrays)
  const bandPathSimple = showBand && sigma > 0 ? (() => {
    const lo = data.map((_, i) => [X(i), Y(intercept + slope * i + sigma)] as [number, number])
    const hi = data.map((_, i) => [X(i), Y(intercept + slope * i - sigma)] as [number, number])
    const fwd = lo.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' L ')
    const rev = [...hi].reverse().map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' L ')
    return `M ${fwd} L ${rev} Z`
  })() : null

  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid meet" aria-hidden>
      {/* banda ±1σ */}
      {bandPathSimple && (
        <path d={bandPathSimple} fill={trendColor} fillOpacity={0.08} stroke="none" />
      )}
      {/* serie real (tenue) */}
      <motion.path
        d={smoothPath(pts)}
        fill="none"
        stroke={lineColor}
        strokeWidth={2}
        strokeLinecap="round"
        initial={reduce ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: dur.draw, ease: ease.decelerate }}
      />
      {/* línea de tendencia (regresión), discontinua y resaltada */}
      <motion.line
        x1={X(0)} y1={Y(tyA)} x2={X(n - 1)} y2={Y(tyB)}
        stroke={trendColor}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeDasharray="5 4"
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: dur.base, delay: reduce ? 0 : dur.draw * 0.5 }}
      />
      {/* curva proyectada hasta ETA (n=294) */}
      {projPts.length >= 2 && (
        <motion.path
          d={smoothPath(projPts)}
          fill="none"
          stroke={trendColor}
          strokeWidth={1.5}
          strokeDasharray="3 4"
          strokeOpacity={0.45}
          strokeLinecap="round"
          initial={reduce ? false : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: dur.base, delay: reduce ? 0 : dur.draw * 0.8 }}
        />
      )}
      {/* punto ETA */}
      {projPts.length >= 2 && (
        <circle
          cx={projPts[projPts.length - 1][0]}
          cy={projPts[projPts.length - 1][1]}
          r={3}
          fill={trendColor}
          fillOpacity={0.5}
          vectorEffect="non-scaling-stroke"
        />
      )}
      {/* marcadores de eventos verticales (n=343) */}
      {(events ?? []).map((ev, ei) => {
        const xEv = X(ev.idx)
        return (
          <g key={ei}>
            <line x1={xEv} y1={pad} x2={xEv} y2={ch - pad}
              stroke="var(--ink-300)" strokeWidth={1} strokeDasharray="2 2" />
            <text x={xEv + 2} y={pad + 8} fontSize={7} fontFamily="JetBrains Mono"
              fill="var(--ink-400)" style={{ pointerEvents: 'none' }}>
              {ev.label.slice(0, 8)}
            </text>
          </g>
        )
      })}
      <circle cx={X(0)} cy={Y(data[0])} r={3} fill={lineColor} vectorEffect="non-scaling-stroke" />
      <circle cx={X(n - 1)} cy={Y(data[n - 1])} r={3.5} fill={trendColor} vectorEffect="non-scaling-stroke" />
      {labels && (
        <>
          <text x="2" y={h - 2} fontSize="10" fontFamily="JetBrains Mono" fill="var(--ink-400)">{labels[0]}</text>
          <text x={w - 2} y={h - 2} fontSize="10" fontFamily="JetBrains Mono" fill="var(--ink-400)" textAnchor="end">{labels[1]}</text>
        </>
      )}
      {/* etiqueta ETA en el eje X */}
      {projPts.length >= 2 && projectionEtaTs != null && (
        <text
          x={Math.min(projPts[projPts.length - 1][0], w - 2)}
          y={ch - 1}
          fontSize={7} fontFamily="JetBrains Mono" fill={trendColor}
          fillOpacity={0.7} textAnchor="end"
        >
          ETA
        </text>
      )}
    </svg>
  )
}

// Chip R² de calidad de proyección (n=349)
export function R2Chip({ r2, n }: { r2: number; n: number }) {
  if (n < 5) return <span className="sm" style={{ color: 'var(--ink-300)' }}>Escasos datos</span>
  const label = r2 >= 0.6 ? 'Tendencia sólida' : r2 >= 0.3 ? 'Tendencia débil' : 'Señal ruidosa'
  const col = r2 >= 0.6 ? 'var(--success)' : r2 >= 0.3 ? 'var(--warning)' : 'var(--ink-300)'
  return (
    <span className="sm" style={{ color: col, background: col + '18', padding: '2px 7px', borderRadius: 999 }}>
      {label} · R²&thinsp;{r2.toFixed(2)}
    </span>
  )
}

// MacroBar: barra horizontal apilada P/C/G (n=292/353)
export function MacroBar({
  protein, carbs, fat,
  goalProtein, goalCarbs, goalFat,
  w = 280, h = 20,
}: {
  protein: number; carbs: number; fat: number
  goalProtein?: number | null; goalCarbs?: number | null; goalFat?: number | null
  w?: number; h?: number
}) {
  const total = protein + carbs + fat || 1
  const pPct = (protein / total) * 100
  const cPct = (carbs / total) * 100
  const fPct = (fat / total) * 100
  const goalTotal = (goalProtein ?? 0) + (goalCarbs ?? 0) + (goalFat ?? 0)
  const goalPPct = goalTotal > 0 ? ((goalProtein ?? 0) / goalTotal) * 100 : null

  // colores semánticos
  const PCOL = 'var(--brand-700)'
  const CCOL = 'var(--brand-300)'
  const FCOL = 'var(--ink-300)'

  const rx = h / 2

  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} aria-hidden style={{ display: 'block' }}>
      <defs>
        <clipPath id="macroclip">
          <rect x={0} y={0} width={w} height={h} rx={rx} />
        </clipPath>
      </defs>
      <rect x={0} y={0} width={w} height={h} fill="var(--ink-100)" rx={rx} />
      <g clipPath="url(#macroclip)">
        {/* Proteína */}
        <rect x={0} y={0} width={(pPct / 100) * w} height={h} fill={PCOL} />
        {/* Carbos */}
        <rect x={(pPct / 100) * w} y={0} width={(cPct / 100) * w} height={h} fill={CCOL} />
        {/* Grasas */}
        <rect x={((pPct + cPct) / 100) * w} y={0} width={(fPct / 100) * w} height={h} fill={FCOL} />
      </g>
      {/* línea de meta de proteína */}
      {goalPPct != null && (
        <line
          x1={(goalPPct / 100) * w} y1={0}
          x2={(goalPPct / 100) * w} y2={h}
          stroke="var(--bg)" strokeWidth={2} strokeDasharray="2 2"
        />
      )}
    </svg>
  )
}

// ConsistencyHeatmap: 7 columnas (días) × 3 filas (Dosis/Agua/Comida) (n=362)
export function ConsistencyHeatmap({
  days,
}: {
  /** 7 elementos, day[0]=lunes de la semana. Cada uno: { dose, water, meal } */
  days: { dose: boolean; water: boolean; meal: boolean }[]
}) {
  const ROWS = ['Dosis', 'Agua', 'Comida'] as const
  const COLS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
  const CW = 32, CH = 20, GAP = 4

  const getValue = (di: number, ri: number) => {
    const d = days[di]
    if (!d) return false
    if (ri === 0) return d.dose
    if (ri === 1) return d.water
    return d.meal
  }

  const totalW = 7 * (CW + GAP) - GAP + 36
  const totalH = 3 * (CH + GAP) - GAP + 14

  return (
    <svg width="100%" viewBox={`0 0 ${totalW} ${totalH}`} aria-hidden style={{ display: 'block' }}>
      {/* headers de columna */}
      {COLS.map((c, ci) => (
        <text key={c} x={36 + ci * (CW + GAP) + CW / 2} y={10}
          fontSize={9} fontFamily="JetBrains Mono" fill="var(--ink-400)"
          textAnchor="middle">{c}</text>
      ))}
      {ROWS.map((row, ri) => (
        <g key={row}>
          {/* etiqueta de fila */}
          <text x={0} y={14 + ri * (CH + GAP) + CH / 2}
            fontSize={8} fontFamily="JetBrains Mono" fill="var(--ink-400)"
            dominantBaseline="middle">{row.slice(0, 5)}</text>
          {days.map((_, di) => {
            const ok = getValue(di, ri)
            return (
              <rect
                key={di}
                x={36 + di * (CW + GAP)}
                y={14 + ri * (CH + GAP)}
                width={CW} height={CH}
                rx={4}
                fill={ok ? 'var(--brand-700)' : 'var(--ink-100)'}
                fillOpacity={ok ? 1 : 1}
              />
            )
          })}
        </g>
      ))}
    </svg>
  )
}

// Línea suave con área de gradiente (~12%). Siempre etiquetada "tus datos" por el caller.
export function LineChart({
  data,
  color = '#0E5A52',
  w = 320,
  h = 150,
  labels,
}: {
  data: number[]
  color?: string
  w?: number
  h?: number
  labels?: [string, string]
}) {
  const reduce = useReducedMotion()
  const uid = useId()
  if (data.length < 2) return <svg width={w} height={h} />
  const ch = h - 22
  const pts = toPoints(data, w, ch, 6)
  const id = `lg-${uid}`
  const area = `${smoothPath(pts)} L ${pts[pts.length - 1][0]} ${ch} L ${pts[0][0]} ${ch} Z`
  const last = pts[pts.length - 1]
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.16" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* área: fade-in 120ms después del trazo */}
      <motion.path
        d={area}
        fill={`url(#${id})`}
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: dur.base, delay: reduce ? 0 : dur.draw * 0.6 }}
      />
      {/* línea: se dibuja izq→der */}
      <motion.path
        d={smoothPath(pts)}
        fill="none"
        stroke={color}
        strokeWidth={3}
        strokeLinecap="round"
        style={{ translateZ: 0 }}
        initial={reduce ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: dur.draw, ease: ease.decelerate }}
      />
      {/* último punto: pop */}
      <motion.circle
        cx={last[0]}
        cy={last[1]}
        r={4}
        fill={color}
        vectorEffect="non-scaling-stroke"
        initial={reduce ? false : { scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ ...spring.ui, delay: reduce ? 0 : dur.draw }}
        style={{ originX: `${last[0]}px`, originY: `${last[1]}px` }}
      />
      {labels && (
        <>
          <text x="6" y={h - 4} fontSize="10" fontFamily="JetBrains Mono" fill="var(--ink-400)">{labels[0]}</text>
          <text x={w - 6} y={h - 4} fontSize="10" fontFamily="JetBrains Mono" fill="var(--ink-400)" textAnchor="end">
            {labels[1]}
          </text>
        </>
      )}
    </svg>
  )
}
