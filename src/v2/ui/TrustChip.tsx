import { Lock } from 'lucide-react'
import { cn } from '../../lib/cn'

// TrustChip "Bitácora" — graft del veredicto v2: señal de confianza "Tus datos son tuyos" para el
// header de Inicio o Perfil. Al tocar abre el resumen de privacidad (callback del consumidor —
// este chip no navega por sí mismo). Píldora hairline discreta, mono 12 (piso de label); el botón
// extiende el área de toque a ≥44px sin engordar la píldora visual. Candado = metáfora segura.
export function TrustChip({
  onOpen,
  label = 'Tus datos son tuyos',
  className,
}: {
  onOpen: () => void   // abre el resumen de privacidad (sheet/vista del consumidor)
  label?: string
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-haspopup="dialog"
      className={cn(
        'group inline-flex min-h-[44px] min-w-[44px] items-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 rounded-full',
        className,
      )}
    >
      <span className="inline-flex h-8 items-center gap-1.5 rounded-full border border-hairline bg-surface px-3 font-mono text-[12px] font-medium text-ink-2 transition-colors group-hover:bg-raised group-active:bg-raised">
        <Lock size={12} strokeWidth={1.6} aria-hidden className="shrink-0" />
        {label}
      </span>
    </button>
  )
}
