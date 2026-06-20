import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/cn'

// Botón shadcn-style. CTA primario = sólido teal (acción nunca es de vidrio).
const buttonVariants = cva(
  // #D1: disabled a opacity-60 (no 40) → el estado deshabilitado del CTA teal mantiene contraste AA (~3:1+) y se distingue de "no existe".
  'inline-flex items-center justify-center gap-2 rounded-md font-semibold transition-[transform,background,filter] active:scale-[.98] disabled:opacity-60 disabled:pointer-events-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-foreground shadow-glow',
        ghost: 'bg-transparent text-foreground hover:bg-white/5',
        outline: 'border border-teal/50 text-teal bg-transparent hover:bg-teal/5',
        plate: 'bg-raised text-foreground border border-white/10',
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
