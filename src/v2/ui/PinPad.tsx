import { Delete } from 'lucide-react'
import { motion } from 'framer-motion'

// Teclado numérico + indicadores de 4 puntos, reutilizado por el gate de bloqueo y la creación de PIN.
// Teclado PROPIO (no el del sistema) → en iOS PWA es fiable y no levanta el teclado virtual sobre la pantalla.
// `value` lo controla el padre; al llegar a `length` dígitos, el padre dispara su lógica (comparar/guardar).
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

  return (
    <div className="flex flex-col items-center gap-8">
      {/* Puntos */}
      <motion.div
        className="flex gap-4"
        animate={shake ? { x: [0, -10, 10, -8, 8, 0] } : { x: 0 }}
        transition={{ duration: 0.4 }}
      >
        {Array.from({ length }).map((_, i) => (
          <span
            key={i}
            className={`h-3.5 w-3.5 rounded-full border-2 transition-colors ${
              i < value.length ? 'border-teal bg-teal' : 'border-white/30 bg-transparent'
            }`}
          />
        ))}
      </motion.div>

      {/* Teclado */}
      <div className="grid grid-cols-3 gap-3">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button
            key={d}
            type="button"
            disabled={disabled}
            onClick={() => press(d)}
            className="grid h-16 w-16 place-items-center rounded-full bg-white/8 text-[24px] font-light text-foreground active:bg-white/16 disabled:opacity-40"
          >
            {d}
          </button>
        ))}
        <span />
        <button
          type="button"
          disabled={disabled}
          onClick={() => press('0')}
          className="grid h-16 w-16 place-items-center rounded-full bg-white/8 text-[24px] font-light text-foreground active:bg-white/16 disabled:opacity-40"
        >
          0
        </button>
        <button
          type="button"
          aria-label="Borrar"
          disabled={disabled || value.length === 0}
          onClick={back}
          className="grid h-16 w-16 place-items-center rounded-full text-muted-foreground active:bg-white/8 disabled:opacity-30"
        >
          <Delete size={22} />
        </button>
      </div>
    </div>
  )
}
