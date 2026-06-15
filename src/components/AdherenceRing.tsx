// Anillo de adherencia/racha: gradiente kelp→lime. value/goal define el llenado.
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
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const pct = goal > 0 ? Math.min(1, value / goal) : 0
  const offset = circ * (1 - pct)
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <defs>
          <linearGradient id="ringgrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#0E5A52" />
            <stop offset="100%" stopColor="#B6F09C" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--ink-100)" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="url(#ringgrad)"
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset .8s cubic-bezier(.2,.8,.2,1)' }}
        />
      </svg>
      <div
        style={{
          position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
        }}
      >
        <div className="ring-num" style={{ fontSize: size * 0.26, color: 'var(--ink-900)' }}>
          {value}
          {unit}
        </div>
        <div className="sm" style={{ textTransform: 'uppercase', letterSpacing: 0.6, fontSize: 11 }}>{label}</div>
      </div>
    </div>
  )
}
