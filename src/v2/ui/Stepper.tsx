import { Minus, Plus } from 'lucide-react'

// Stepper −/+ (tap targets 48px). Envuelve el número/contenido editable.
export function Stepper({
  onDec,
  onInc,
  children,
  decLabel = 'Disminuir',
  incLabel = 'Aumentar',
}: {
  onDec: () => void
  onInc: () => void
  children: React.ReactNode
  decLabel?: string
  incLabel?: string
}) {
  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        aria-label={decLabel}
        onClick={onDec}
        className="grid h-[52px] w-[52px] shrink-0 place-items-center rounded-full border border-white/12 bg-raised text-foreground active:scale-95"
      >
        <Minus size={22} />
      </button>
      <div className="flex-1">{children}</div>
      <button
        type="button"
        aria-label={incLabel}
        onClick={onInc}
        className="grid h-[52px] w-[52px] shrink-0 place-items-center rounded-full border border-white/12 bg-raised text-foreground active:scale-95"
      >
        <Plus size={22} />
      </button>
    </div>
  )
}
