import { useId } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { cn } from '../../lib/cn'

// Segmentado "Bitácora" — dos variantes de la ref canónica:
//  · 'toggle' (default): el toggle agrupado ("% del pico | mg") — contenedor píldora con hairline
//    y pastilla deslizante AZUL (interactivo) con layoutId; labels mono (instrumento).
//  · 'pills': el pillset de ventana ("24 h · 72 h · 7 d") — píldoras SUELTAS con contorno; la
//    activa se rellena EN TINTA (fondo --ink, texto --paper), sin pastilla deslizante.
// Semántica en ambas: group de botones toggle (aria-pressed), NO tablist — no hay paneles
// asociados. Altura 44px (piso de tap target) en ambas variantes.
export function SegmentedTabs<T extends string>({
  options,
  value,
  onChange,
  className,
  variant = 'toggle',
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
  className?: string
  variant?: 'toggle' | 'pills'
}) {
  const reduce = useReducedMotion()
  const pillId = useId()

  if (variant === 'pills') {
    return (
      <div role="group" className={cn('flex gap-1.5', className)}>
        {options.map((o) => {
          const active = o.value === value
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(o.value)}
              className={cn(
                'flex h-11 items-center justify-center whitespace-nowrap rounded-full border px-3.5 font-mono text-[12px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring',
                active
                  ? 'border-ink bg-ink text-paper'
                  : 'border-hairline bg-surface text-ink-2 hover:bg-raised',
              )}
            >
              {o.label}
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <div role="group" className={cn('flex gap-1 rounded-full border border-hairline bg-surface p-1', className)}>
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={cn(
              'relative flex h-11 flex-1 items-center justify-center rounded-full px-3.5 font-mono text-[13px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring',
              active ? 'text-primary-foreground' : 'text-ink-2',
            )}
          >
            {active && (
              <motion.span
                layoutId={`${pillId}-seg-pill`}
                transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 320, damping: 30 }}
                className="absolute inset-0 rounded-full bg-blue"
              />
            )}
            <span className="relative whitespace-nowrap">{o.label}</span>
          </button>
        )
      })}
    </div>
  )
}
