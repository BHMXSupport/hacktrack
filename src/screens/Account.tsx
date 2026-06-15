import { useApp } from '../lib/store'
// STUB — lo rellena el equipo multiagente (pantalla "Crear cuenta").
export function Account() {
  const { dispatch } = useApp()
  return (
    <div className="scroll">
      <div className="h1" style={{ marginBottom: 12 }}>Crea tu cuenta</div>
      <button className="btn btn-brand" onClick={() => { dispatch({ t: 'tab', tab: 'inicio' }); dispatch({ t: 'go', screen: 's-app' }) }}>Crear cuenta</button>
    </div>
  )
}
