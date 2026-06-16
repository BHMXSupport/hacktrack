// Gráficas suaves "tus datos": Sparkline (mini) y LineChart (con área + draw-on).
import { useId, useMemo } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { dur, ease, spring } from '../lib/motion'

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

export function Sparkline({ data, color = 'var(--brand-500)', w = 76, h = 30, animKey }: {
  data: number[]; color?: string; w?: number; h?: number; animKey?: string | number
}) {
  const reduce = useReducedMotion()
  if (!data.length) return <svg width={w} height={h} />
  const pts = toPoints(data, w, h)
  return (
    <svg width={w} height={h} aria-hidden>
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
}: {
  data: number[]
  w?: number
  h?: number
  lineColor?: string
  trendColor?: string
  labels?: [string, string]
}) {
  const reduce = useReducedMotion()
  const n = data.length
  // regresión lineal memoizada (x = índice) — hook ANTES de cualquier early-return
  const { slope, intercept } = useMemo(() => {
    let sx = 0, sy = 0, sxx = 0, sxy = 0
    for (let i = 0; i < n; i++) { sx += i; sy += data[i]; sxx += i * i; sxy += i * data[i] }
    const den = n * sxx - sx * sx
    const sl = den ? (n * sxy - sx * sy) / den : 0
    return { slope: sl, intercept: n ? (sy - sl * sx) / n : 0 }
  }, [data, n])
  if (data.length < 2) return <svg width={w} height={h} />
  const tyA = intercept, tyB = intercept + slope * (n - 1)
  // escala incluyendo los extremos de la tendencia para no recortar
  const pad = 8
  const ch = labels ? h - 14 : h
  const min = Math.min(...data, tyA, tyB)
  const max = Math.max(...data, tyA, tyB)
  const span = max - min || 1
  const step = (w - pad * 2) / (n - 1)
  const X = (i: number) => pad + i * step
  const Y = (v: number) => ch - pad - ((v - min) / span) * (ch - pad * 2)
  const pts = data.map((v, i) => [X(i), Y(v)] as [number, number])
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid meet" aria-hidden>
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
      <circle cx={X(0)} cy={Y(data[0])} r={3} fill={lineColor} vectorEffect="non-scaling-stroke" />
      <circle cx={X(n - 1)} cy={Y(data[n - 1])} r={3.5} fill={trendColor} vectorEffect="non-scaling-stroke" />
      {labels && (
        <>
          <text x="2" y={h - 2} fontSize="10" fontFamily="JetBrains Mono" fill="var(--ink-400)">{labels[0]}</text>
          <text x={w - 2} y={h - 2} fontSize="10" fontFamily="JetBrains Mono" fill="var(--ink-400)" textAnchor="end">{labels[1]}</text>
        </>
      )}
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
