import { Sheet } from '../components/Sheet'
import { useApp } from '../lib/store'
import { KPIS } from '../lib/catalog'
// STUB — lo rellena el equipo multiagente (chooser del "+": Dosis héroe + grilla de KPIs).
export function Agregar() {
  const { dispatch } = useApp()
  return (
    <Sheet title="Agregar registro" onClose={() => dispatch({ t: 'sheet', sheet: null })}>
      <button className="btn btn-brand" onClick={() => dispatch({ t: 'sheet', sheet: 'registrar' })}>Dosis</button>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
        {KPIS.filter((k) => k.kind !== 'medidas').map((k) => (
          <button key={k.key} className="chip" onClick={() => dispatch({ t: 'sheet', sheet: 'medida', arg: k.key })}>
            {k.emoji} {k.label}
          </button>
        ))}
        <button className="chip" onClick={() => dispatch({ t: 'sheet', sheet: 'medidas' })}>📐 Cambio de medidas</button>
      </div>
    </Sheet>
  )
}
