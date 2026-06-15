// Controles compartidos: Segmented, Chip, Toggle, Stepper, Disclaimer.
import { DISCLAIMER } from '../lib/catalog'

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
    <button
      className={'chip' + (active ? ' active' : color ? ' chip-cat' : '')}
      style={style}
      aria-pressed={!!active}
      onClick={onClick}
    >
      {label}
    </button>
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
      <button className="stepbtn" aria-label="Restar" onClick={() => onChange(Math.max(min, value - step))}>−</button>
      <div className="mono" style={{ fontSize: 30, fontWeight: 700, minWidth: 64, textAlign: 'center' }}>{value}</div>
      <button className="stepbtn" aria-label="Sumar" onClick={() => onChange(Math.min(max, value + step))}>+</button>
    </div>
  )
}

// Disclaimer legal — usa una de las constantes unificadas (NO reducir instancias, audit guardrail)
export function Disclaimer({ kind = 'general' }: { kind?: keyof typeof DISCLAIMER }) {
  return <p className="disclaimer">{DISCLAIMER[kind]}</p>
}
