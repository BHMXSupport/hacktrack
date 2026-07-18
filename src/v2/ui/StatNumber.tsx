import { useReducedMotion } from 'framer-motion'
import { ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { useCountUp } from '../lib/useCountUp'
import { DUR } from '../lib/motion'
import { cn } from '../../lib/cn'

// StatNumber "Bitácora" — el numeral serif que TODA métrica/KPI usa (adherencia %, 78.4 kg, 7.2 h…).
// "El número serif gigante es sagrado": Fraunces tabular, en tinta --ink (máximo contraste, editorial),
// con unidad mono pequeña de subíndice y flecha de delta opcional (ok/alert). Cuenta hacia arriba con
// useCountUp (honra reduced-motion). El estado del delta NUNCA es solo color: lleva flecha (forma) + signo.
type Tone = 'ok' | 'alert' | 'neutral'

// Formato tabular-seguro para el delta (entero → sin decimales; si no, 1 decimal).
function fmtDelta(n: number): string {
  const a = Math.abs(n)
  return Number.isInteger(a) ? String(a) : a.toFixed(1)
}

export function StatNumber({
  value,
  unit,
  decimals,
  size = 44,
  from,
  duration,
  label,
  delta,
  deltaTone,
  deltaLabel,
  animate = true,
  align = 'start',
  className,
  unitClass,
  unitSize,
}: {
  value: number
  unit?: string
  decimals?: number       // dígitos fijos; si se omite, se infiere (entero→0, si no→1)
  size?: number           // px del numeral serif
  from?: number
  duration?: number       // s (default DUR.count = 0.7)
  label?: string          // eyebrow mono UPPER opcional encima
  delta?: number          // cambio; el signo elige la flecha (▲/▼)
  deltaTone?: Tone         // override de color; default: +→ok, −→alert, 0→neutral
  deltaLabel?: string     // texto tras el delta (p.ej. "vs. semana")
  animate?: boolean       // false → valor final al instante
  align?: 'start' | 'center'
  className?: string
  unitClass?: string      // color/estilo de la unidad (p.ej. "text-amber" para el "%" héroe de la ref)
  unitSize?: number       // px de la unidad; default proporcional (28% del numeral, mín 12)
}) {
  const reduce = useReducedMotion()
  const display = useCountUp(value, {
    reduced: !animate || !!reduce,
    duration: duration ?? DUR.count,
    from,
    decimals,
  })
  const displayStr = decimals != null ? display.toFixed(decimals) : String(display)

  const hasDelta = delta != null
  const tone: Tone = deltaTone ?? (hasDelta ? (delta! > 0 ? 'ok' : delta! < 0 ? 'alert' : 'neutral') : 'neutral')
  const DeltaIcon = hasDelta ? (delta! > 0 ? ArrowUpRight : delta! < 0 ? ArrowDownRight : null) : null
  const toneClass = tone === 'ok' ? 'text-ok' : tone === 'alert' ? 'text-alert' : 'text-ink-2'

  return (
    <div className={cn('flex flex-col', align === 'center' && 'items-center text-center', className)}>
      {label && (
        <span className="mb-1 font-mono text-[12px] font-medium uppercase tracking-[0.12em] text-ink-2">{label}</span>
      )}
      {/* Peso 400: los numerales Fraunces de la ref van en regular (compuestos, no bold). */}
      <span
        className="flex items-baseline font-serif font-normal tabular-nums leading-none text-ink"
        style={{ fontSize: size, letterSpacing: '-0.02em' }}
      >
        <span>{displayStr}</span>
        {unit && (
          <span
            className={cn('ml-1 font-mono font-medium', unitClass ?? 'text-ink-2')}
            style={{ fontSize: unitSize ?? Math.max(12, size * 0.28) }}
          >
            {unit}
          </span>
        )}
      </span>
      {(hasDelta || deltaLabel) && (
        <span className={cn('mt-1.5 inline-flex items-center gap-1 text-[13px] font-medium', toneClass)}>
          {DeltaIcon && <DeltaIcon size={15} strokeWidth={2.5} className="shrink-0" aria-hidden />}
          {hasDelta && <span className="tabular-nums">{fmtDelta(delta!)}</span>}
          {deltaLabel && <span className="text-ink-2">{deltaLabel}</span>}
        </span>
      )}
    </div>
  )
}
