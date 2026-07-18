import { Delete } from 'lucide-react'
import { motion } from 'framer-motion'

// Teclado numérico + indicadores de 4 puntos, reutilizado por el gate de bloqueo y la creación de PIN.
// Teclado PROPIO (no el del sistema) → en iOS PWA es fiable y no levanta el teclado virtual sobre la pantalla.
// `value` lo controla el padre; al llegar a `length` dígitos, el padre dispara su lógica (comparar/guardar).
// Restyle "Bitácora": dígitos SERIF (Fraunces, la voz editorial) sobre teclas cálidas de papel
// (superficie + hairline + sombra susurro — reglas, no vidrio); puntos llenos = azul tinta
// (interactivo/confianza). El shake de error y el disabled se conservan intactos.
export function PinPad({
  value,
  onChange,
  length = 4,
  shake = false,
  disabled = false,
}: {
  value: string
  onChange: (next: string) => void
  length?: number
  shake?: boolean
  disabled?: boolean
}) {
  const press = (d: string) => { if (!disabled && value.length < length) onChange(value + d) }
  const back = () => { if (!disabled && value.length > 0) onChange(value.slice(0, -1)) }

  // Tecla cálida de papel: superficie + hairline + susurro; presionar hunde (transform, GPU).
  const keyCls =
    'grid h-16 w-16 place-items-center rounded-full border border-hairline bg-surface ' +
    'font-serif text-[26px] font-normal tabular-nums text-ink shadow-[0_1px_2px_rgba(26,23,18,.08)] ' +
    'transition-colors active:scale-95 active:bg-raised disabled:opacity-40 ' +
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2'

  return (
    <div className="flex flex-col items-center gap-8">
      {/* Puntos — llenos = azul tinta (interactivo); vacíos = contorno ink-3 (visible en ambos temas) */}
      <motion.div
        className="flex gap-4"
        animate={shake ? { x: [0, -10, 10, -8, 8, 0] } : { x: 0 }}
        transition={{ duration: 0.4 }}
      >
        {Array.from({ length }).map((_, i) => (
          <span
            key={i}
            className={`h-3.5 w-3.5 rounded-full border-2 transition-colors ${
              i < value.length ? 'border-blue bg-blue' : 'border-ink-3 bg-transparent'
            }`}
          />
        ))}
      </motion.div>

      {/* Teclado */}
      <div className="grid grid-cols-3 gap-3">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button key={d} type="button" disabled={disabled} onClick={() => press(d)} className={keyCls}>
            {d}
          </button>
        ))}
        <span />
        <button type="button" disabled={disabled} onClick={() => press('0')} className={keyCls}>
          0
        </button>
        <button
          type="button"
          aria-label="Borrar"
          disabled={disabled || value.length === 0}
          onClick={back}
          className="grid h-16 w-16 place-items-center rounded-full text-ink-2 transition-colors active:scale-95 active:bg-raised disabled:opacity-30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
        >
          <Delete size={22} strokeWidth={1.6} />
        </button>
      </div>
    </div>
  )
}
