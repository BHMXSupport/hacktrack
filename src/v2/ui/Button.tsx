import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/cn'

// Botón "Bitácora". CTA primario = azul-tinta sólido (Papel) / azul brillante (Tinta) — la acción
// nunca es de vidrio. Radio 8 (rectángulo de imprenta — la ref canónica manda sobre la píldora del
// borrador v1; las píldoras quedan para chips/segmentos). Press-scale es transform (GPU). El color
// de la tinta del texto lo resuelve --primary-foreground por tema (blanco cálido sobre azul profundo
// en Papel; tinta oscura sobre azul brillante en Tinta) → contraste AA en AMBOS temas. Sin glow ámbar
// (el ámbar es energía del anillo, no del botón).
const buttonVariants = cva(
  // #D1: disabled a opacity-60 (no 40) → el estado deshabilitado mantiene contraste AA y se distingue de "no existe".
  // Solo se transiciona transform/color/sombra (GPU-baratas; nunca filter).
  'inline-flex items-center justify-center gap-2 rounded-[8px] font-semibold transition-[transform,background-color,box-shadow,border-color] active:scale-[.98] disabled:opacity-60 disabled:pointer-events-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2',
  {
    variants: {
      variant: {
        // Primario: relleno azul + tinta --primary-foreground (AA por tema). Sombra susurro, sin glow.
        primary: 'bg-primary text-primary-foreground shadow-[0_1px_2px_rgba(26,23,18,.20)] hover:bg-blue-press',
        // Fantasma (secundario "Hoy no" de la ref): contorno hairline + tinta secundaria; hover al pozo.
        ghost: 'border border-hairline bg-transparent text-ink-2 hover:bg-raised',
        // Contorno azul con tinte (el ".mark / Registrar (atrasada)" de la ref). color-mix en clase
        // arbitraria porque el alfa sobre var(--x) (bg-blue/10) NO se emite en este setup.
        outline:
          'border border-blue text-blue bg-[color-mix(in_srgb,var(--blue)_8%,transparent)] hover:bg-[color-mix(in_srgb,var(--blue)_14%,transparent)]',
        // Placa: fila/pozo cálido con hairline.
        plate: 'bg-raised text-ink border border-hairline',
      },
      size: {
        md: 'h-12 px-5 text-[15px]',
        sm: 'h-11 px-4 text-sm',
        icon: 'h-11 w-11',
        full: 'h-12 w-full text-[15px]',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
)

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  ),
)
Button.displayName = 'Button'
export { buttonVariants }
