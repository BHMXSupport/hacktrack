import { Sheet } from '../components/Sheet'
import { useApp } from '../lib/store'
// STUB — lo rellena el equipo multiagente (confirmación destructiva reutilizable).
export function ConfirmDeleteSheet() {
  const { state, dispatch } = useApp()
  return (
    <Sheet title="Confirmar" onClose={() => dispatch({ t: 'sheet', sheet: null })}>
      <button className="btn btn-brand" style={{ background: 'var(--error)' }}
        onClick={() => state.sheetArg && dispatch({ t: 'deleteLog', id: state.sheetArg })}>
        Borrar
      </button>
    </Sheet>
  )
}
