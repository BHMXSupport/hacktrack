import { Sheet } from '../components/Sheet'
import { Disclaimer } from '../components/controls'
import { useApp } from '../lib/store'
// STUB — lo rellena el equipo multiagente (hoja "Calculadora de unidades").
export function CalcSheet() {
  const { dispatch } = useApp()
  return (
    <Sheet title="Calculadora de unidades" onClose={() => dispatch({ t: 'sheet', sheet: 'registrar' })}>
      <Disclaimer kind="calc" />
    </Sheet>
  )
}
