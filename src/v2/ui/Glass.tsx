import { forwardRef, type HTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

// Card de vidrio (cockpit). El tint .72 garantiza contraste; el blur es decorativo.
export const Glass = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('glass rounded-lg p-4', className)} {...props} />
  ),
)
Glass.displayName = 'Glass'
