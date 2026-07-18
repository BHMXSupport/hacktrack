// Toggle accesible "Bitácora" (track 28×48, knob 22px, sin borde). Fuente única para que todos los
// switches se vean idénticos. Encendido = azul (interactivo/afirmativo); apagado = pozo neutro visible
// en ambos temas (ink-3 al 40%, theme-aware). Knob blanco con sombra → se lee sobre ambos estados.
export function Switch({
  checked,
  onChange,
  label,
  disabled = false,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      // Fondo del track por estilo inline (no utilidad Tailwind): en este setup el alfa sobre color-var
      // (bg-ink-3/40) NO se emite → el track apagado quedaría transparente/invisible. color-mix es
      // theme-aware (ink-3 existe en ambos temas) y produce CSS real → el apagado SIEMPRE se ve.
      style={{ backgroundColor: checked ? 'var(--blue)' : 'color-mix(in srgb, var(--ink-3) 45%, transparent)' }}
      className={[
        'relative h-[28px] w-[48px] shrink-0 rounded-full transition-colors duration-200',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2',
        'disabled:opacity-40 disabled:cursor-not-allowed',
      ].join(' ')}
    >
      <span
        className={[
          'absolute top-[3px] left-[3px] h-[22px] w-[22px] rounded-full bg-white shadow transition-transform duration-200',
          checked ? 'translate-x-[20px]' : 'translate-x-0',
        ].join(' ')}
      />
    </button>
  )
}
