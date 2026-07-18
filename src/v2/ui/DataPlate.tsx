import { type HTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

// Placa opaca para números/datos críticos — contraste garantizado, independiente del tema.
// Ref canónica: el pozo opaco bajo readouts lleva numerales SERIF tabulares (la voz Fraunces);
// las unidades/labels internas pueden sobreescribir con font-mono.
export function DataPlate({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('data-plate font-serif tabular-nums', className)} {...props} />
}
