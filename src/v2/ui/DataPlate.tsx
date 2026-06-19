import { type HTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

// Placa opaca para números/datos críticos — contraste garantizado, independiente del blur.
export function DataPlate({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('data-plate', className)} {...props} />
}
