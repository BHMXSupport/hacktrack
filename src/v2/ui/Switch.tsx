// Toggle accesible reutilizable (track 28×48, knob 22px balanceado, sin borde). Fuente única para que
// todos los switches de la app se vean idénticos (Ajustes, titulación por fases, etc.).
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
      className={[
        'relative h-[28px] w-[48px] shrink-0 rounded-full transition-colors duration-200',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        checked ? 'bg-teal' : 'bg-white/15',
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
