import { motion, useReducedMotion } from 'framer-motion'
import { cn } from '../../lib/cn'

// Segmentado de vidrio con pastilla deslizante (layoutId). Accesible (role=tablist).
export function SegmentedTabs<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
  className?: string
}) {
  const reduce = useReducedMotion()
  return (
    <div role="tablist" className={cn('flex gap-1 rounded-full bg-white/6 p-1', className)}>
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn(
              'relative flex h-10 flex-1 items-center justify-center rounded-full text-[14px] font-semibold transition-colors',
              active ? 'text-foreground' : 'text-muted-foreground',
            )}
          >
            {active && (
              <motion.span
                layoutId="seg-pill"
                transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 320, damping: 30 }}
                className="absolute inset-0 rounded-full bg-card shadow-[0_1px_0_rgba(255,255,255,.06)_inset,0_8px_20px_rgba(0,0,0,.4)]"
              />
            )}
            <span className="relative">{o.label}</span>
          </button>
        )
      })}
    </div>
  )
}
