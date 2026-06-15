import { Sheet } from '../components/Sheet'
import { useApp } from '../lib/store'
// STUB — lo rellena el equipo multiagente (hoja "Registrar dosis").
export function RegistrarSheet() {
  const { dispatch } = useApp()
  return (
    <Sheet title="Registrar" onClose={() => dispatch({ t: 'sheet', sheet: null })}>
      <button className="btn btn-brand" onClick={() => dispatch({ t: 'logDose', product: 'Mi producto', value: null, unit: 'mg' })}>
        Guardar registro
      </button>
    </Sheet>
  )
}
