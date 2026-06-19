import { type ButtonHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

// Pill seleccionable (unidades, filtros). Tap target cómodo (h-9 = 36px mínimo visual; usar en filas).
export function Chip({
  active,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        'inline-flex h-11 items-center gap-1.5 rounded-full px-4 text-[13px] font-semibold transition-colors',
        active ? 'bg-teal text-primary-foreground' : 'bg-white/6 text-secondary-foreground hover:bg-white/10',
        className,
      )}
      {...props}
    />
  )
}
