import { type ButtonHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

// Pastilla seleccionable "Bitácora" (unidades, filtros, rangos 24h/72h/7d). Píldora MONO (el
// "instrumento" de la ref: chips de rango/filtro van en mono 13px, ≥ piso de label 12). Tap target
// h-11 = 44px (accesible). Seleccionada = relleno azul (interactivo) con tinta --primary-foreground
// (AA por tema). Inactiva = contorno hairline + tinta secundaria; hover levanta al pozo cálido.
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
        'inline-flex h-11 items-center gap-1.5 rounded-full px-4 font-mono text-[13px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2',
        active
          ? 'bg-blue text-primary-foreground'
          : 'border border-hairline bg-transparent text-ink-2 hover:bg-raised',
        className,
      )}
      {...props}
    />
  )
}
