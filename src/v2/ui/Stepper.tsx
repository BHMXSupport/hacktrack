import { Minus, Plus } from 'lucide-react'

// Stepper −/+ "Bitácora" (tap targets 52px). Botones sobre superficie cálida con hairline + tinta ink.
// Envuelve el número/contenido editable (que suele ser un StatNumber serif).
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
        className="grid h-[52px] w-[52px] shrink-0 place-items-center rounded-full border border-hairline bg-surface text-ink shadow-soft active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
      >
        <Minus size={22} />
      </button>
      <div className="flex-1">{children}</div>
      <button
        type="button"
        aria-label={incLabel}
        onClick={onInc}
        className="grid h-[52px] w-[52px] shrink-0 place-items-center rounded-full border border-hairline bg-surface text-ink shadow-soft active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
      >
        <Plus size={22} />
      </button>
    </div>
  )
}
