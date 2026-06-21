import { type ButtonHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

// Pill seleccionable (unidades, filtros). Tap target estándar h-11 = 44px (--control-h, accesible).
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
        // Inactivo: borde marcado + relleno con opacidad suficiente + texto blanco → la pastilla NO se pierde sobre el cockpit.
        active ? 'bg-teal text-primary-foreground' : 'border border-white/35 bg-white/[0.22] text-foreground hover:bg-white/30',
        className,
      )}
      {...props}
    />
  )
}
