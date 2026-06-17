// Sub-componentes auto-contenidos extraídos de PharmaDashboard.tsx (split de mantenibilidad).
import { motion } from 'framer-motion'
import { dur, ease } from '../lib/motion'

const H_MS = 3_600_000

// ── Mini SVG histograma de intervalos (sin librería) ──────────────────────────
// item 290: muestra la distribución de intervalos entre dosis consecutivas
export function IntervalHistogram({ intervalsH, targetH, color }: { intervalsH: number[]; targetH?: number; color: string }) {
  if (intervalsH.length === 0) return null
  const W = 120; const H = 36
  const min = Math.min(...intervalsH)
  const max = Math.max(...intervalsH)
  const span = (max - min) || 1
  const bins = 6
  const counts = Array(bins).fill(0)
  for (const v of intervalsH) {
    const b = Math.min(bins - 1, Math.floor(((v - min) / span) * bins))
    counts[b]++
  }
  const maxCount = Math.max(...counts) || 1
  const barW = (W - 4) / bins - 2

  // posición X del target (intervalo objetivo)
  const targetX = targetH != null && targetH >= min && targetH <= max
    ? 2 + ((targetH - min) / span) * (W - 4)
    : null

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
      {counts.map((c, i) => {
        const bh = (c / maxCount) * (H - 10)
        const bx = 2 + i * (barW + 2)
        return (
          <rect
            key={i}
            x={bx}
            y={H - 10 - bh}
            width={barW}
            height={bh}
            fill={color}
            opacity={0.55}
            rx={1.5}
          />
        )
      })}
      {targetX != null && (
        <>
          <line x1={targetX} y1={4} x2={targetX} y2={H - 10} stroke="var(--ink-400)" strokeWidth={1} strokeDasharray="2 2" />
          <text x={targetX + 2} y={10} fontSize={7} fontFamily="JetBrains Mono, monospace" fill="var(--ink-400)">obj.</text>
        </>
      )}
      {/* eje X mínimo/máximo */}
      <text x={2} y={H - 1} fontSize={7} fontFamily="JetBrains Mono, monospace" fill="var(--ink-300)">
        {min < 48 ? `${Math.round(min)}h` : `${Math.round(min / 24)}d`}
      </text>
      <text x={W - 2} y={H - 1} textAnchor="end" fontSize={7} fontFamily="JetBrains Mono, monospace" fill="var(--ink-300)">
        {max < 48 ? `${Math.round(max)}h` : `${Math.round(max / 24)}d`}
      </text>
    </svg>
  )
}

// ── Pill "Próxima dosis en ~X h" ─────────────────────────────────────────────
// item 377
export function NextDosePill({ nextTs, now }: { nextTs: number; now: number }) {
  const diffMs = nextTs - now
  if (diffMs < 0) return null
  const diffH = diffMs / H_MS
  let label: string
  if (diffH < 1) label = `~${Math.round(diffH * 60)} min`
  else if (diffH < 48) label = `~${diffH < 1.5 ? '1' : Math.round(diffH)} h`
  else label = `~${Math.round(diffH / 24)} d`

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: dur.fast, ease: ease.standard }}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '3px 10px',
        borderRadius: 999,
        background: 'var(--brand-100)',
        border: '1px solid var(--brand-300)',
        marginTop: 8,
      }}
    >
      <span style={{ fontSize: 9, color: 'var(--brand-700)', fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>
        Próxima dosis en {label}
      </span>
    </motion.div>
  )
}
