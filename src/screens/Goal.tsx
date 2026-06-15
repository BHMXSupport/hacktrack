import { useApp } from '../lib/store'
// STUB — lo rellena el equipo multiagente (pantalla "Selección de objetivos").
export function Goal() {
  const { dispatch } = useApp()
  return (
    <div className="scroll">
      <div className="h1" style={{ marginBottom: 12 }}>¿Qué quieres lograr?</div>
      <button className="btn btn-brand" onClick={() => dispatch({ t: 'go', screen: 's-account' })}>Continuar</button>
    </div>
  )
}
