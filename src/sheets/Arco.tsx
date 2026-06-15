import { Sheet } from '../components/Sheet'
import { useApp } from '../lib/store'
// STUB — lo rellena el equipo multiagente (hoja "Derechos ARCO").
export function ArcoSheet() {
  const { dispatch } = useApp()
  return (
    <Sheet title="Derechos ARCO" onClose={() => dispatch({ t: 'sheet', sheet: 'perfil' })}>
      <p className="body">Acceso · Rectificación · Cancelación · Oposición</p>
    </Sheet>
  )
}
