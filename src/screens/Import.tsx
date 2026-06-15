import { useApp } from '../lib/store'
// STUB — lo rellena el equipo multiagente (pantalla "Importar de tienda asociada").
export function Import() {
  const { dispatch } = useApp()
  return (
    <div className="scroll">
      <div className="h1" style={{ marginBottom: 12 }}>Importar productos</div>
      <button className="btn btn-outline" onClick={() => dispatch({ t: 'go', screen: 's-app' })}>Lo agrego manualmente</button>
    </div>
  )
}
