import { Sheet } from '../components/Sheet'
import { Disclaimer } from '../components/controls'
import { useApp } from '../lib/store'
// STUB — lo rellena el equipo multiagente (hoja "Registrar medida").
export function MedidaSheet() {
  const { dispatch } = useApp()
  return (
    <Sheet title="Registrar medida" onClose={() => dispatch({ t: 'sheet', sheet: null })}>
      <Disclaimer kind="measure" />
    </Sheet>
  )
}
