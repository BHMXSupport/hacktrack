// Gráficas suaves "tus datos": Sparkline (mini) y LineChart (con área de gradiente).

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

export function Sparkline({ data, color = 'var(--brand-500)', w = 76, h = 30 }: {
  data: number[]; color?: string; w?: number; h?: number
}) {
  if (!data.length) return <svg width={w} height={h} />
  const pts = toPoints(data, w, h)
  return (
    <svg width={w} height={h} aria-hidden>
      <path d={smoothPath(pts)} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" />
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
  if (data.length < 2) return <svg width={w} height={h} />
  const ch = h - 22
  const pts = toPoints(data, w, ch, 6)
  const id = 'lg' + Math.round(data[0] * 1000)
  const area = `${smoothPath(pts)} L ${pts[pts.length - 1][0]} ${ch} L ${pts[0][0]} ${ch} Z`
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.16" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path d={smoothPath(pts)} fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r={4} fill={color} />
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
