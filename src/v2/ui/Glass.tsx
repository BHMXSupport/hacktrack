import { forwardRef, type HTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

// Card editorial "Bitácora" — la "columna impresa" de la ref canónica (docs/design-refs):
// superficie opaca + hairline + sombra susurro (Papel) / panel cálido + realce (Tinta), vía .glass.
// Radio 10 (rounded-sm): columna de revista casi cuadrada, no vidrio glassy.
export const Glass = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('glass rounded-sm p-4', className)} {...props} />
  ),
)
Glass.displayName = 'Glass'
