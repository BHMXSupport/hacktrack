import { useApp } from '../lib/store'
// STUB — lo rellena el equipo multiagente (tab "Ajustes").
export function Ajustes() {
  const { dispatch } = useApp()
  return (
    <div className="scroll has-nav">
      <div className="h1" style={{ marginBottom: 12 }}>Ajustes</div>
      <button className="btn btn-outline" onClick={() => dispatch({ t: 'sheet', sheet: 'perfil' })}>Perfil y privacidad</button>
    </div>
  )
}
