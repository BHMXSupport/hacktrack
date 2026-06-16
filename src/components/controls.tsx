// Controles compartidos: Segmented, Chip, Toggle, Stepper, Disclaimer, PasswordStrength.
import { motion } from 'framer-motion'
import { DISCLAIMER } from '../lib/catalog'
import { spring } from '../lib/motion'

export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="segmented" role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          className={value === o.value ? 'active' : ''}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Chip({
  label,
  active,
  color,
  onClick,
}: {
  label: string
  active?: boolean
  color?: string
  onClick?: () => void
}) {
  const style = color && !active ? ({ ['--c' as string]: color } as React.CSSProperties) : undefined
  return (
    <motion.button
      className={'chip' + (active ? ' active' : color ? ' chip-cat' : '')}
      style={style}
      aria-pressed={!!active}
      onClick={onClick}
      whileTap={{ scale: 0.95 }}
      animate={active ? { scale: [1, 1.05, 1] } : { scale: 1 }}
      transition={spring.ui}
    >
      {label}
    </motion.button>
  )
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      className={'toggle' + (on ? ' on' : '')}
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
    />
  )
}

export function Stepper({
  value,
  onChange,
  min = 0,
  max = 999,
  step = 1,
}: {
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: number
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
      <motion.button className="stepbtn" aria-label="Restar" whileTap={{ scale: 0.9 }} transition={spring.ui} onClick={() => onChange(Math.max(min, value - step))}>−</motion.button>
      <div className="mono" style={{ fontSize: 30, fontWeight: 700, minWidth: 64, textAlign: 'center', overflow: 'hidden' }}>
        <motion.div key={value} initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={spring.ui}>{value}</motion.div>
      </div>
      <motion.button className="stepbtn" aria-label="Sumar" whileTap={{ scale: 0.9 }} transition={spring.ui} onClick={() => onChange(Math.min(max, value + step))}>+</motion.button>
    </div>
  )
}

// Disclaimer legal — usa una de las constantes unificadas (NO reducir instancias, audit guardrail)
export function Disclaimer({ kind = 'general' }: { kind?: keyof typeof DISCLAIMER }) {
  return <p className="disclaimer">{DISCLAIMER[kind]}</p>
}

// Barra de fortaleza de contraseña — 4 niveles, accesible, no bloquea el submit.
function scorePassword(value: string): { level: 0 | 1 | 2 | 3; label: string } {
  if (!value) return { level: 0, label: '' }
  let score = 0
  if (value.length >= 8) score++
  if (value.length >= 12) score++
  if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score++
  if (/\d/.test(value)) score++
  if (/[^A-Za-z0-9]/.test(value)) score++
  if (score <= 1) return { level: 1, label: 'Débil' }
  if (score <= 2) return { level: 2, label: 'Media' }
  if (score <= 3) return { level: 2, label: 'Media' }
  return { level: 3, label: 'Fuerte' }
}

const PW_COLORS: Record<1 | 2 | 3, string> = {
  1: 'var(--error)',
  2: 'var(--warning)',
  3: 'var(--success)',
}

export function PasswordStrength({ value }: { value: string }) {
  if (!value) return null
  const { level, label } = scorePassword(value)
  const pct = (level / 3) * 100
  const color = PW_COLORS[level as 1 | 2 | 3]
  return (
    <div style={{ marginTop: 6 }}>
      <div
        role="meter"
        aria-label="Fortaleza de contraseña"
        aria-valuenow={level}
        aria-valuemin={0}
        aria-valuemax={3}
        aria-valuetext={label}
        style={{
          height: 4,
          borderRadius: 2,
          background: 'var(--border)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            background: color,
            borderRadius: 2,
            transition: 'width 0.25s ease, background 0.25s ease',
          }}
        />
      </div>
      <p
        aria-live="polite"
        className="sm"
        style={{ marginTop: 4, color, fontWeight: 600 }}
      >
        {label}
      </p>
    </div>
  )
}
