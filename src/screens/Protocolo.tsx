import { Disclaimer } from '../components/controls'
// STUB — lo rellena el equipo multiagente (tab "Protocolo").
export function Protocolo() {
  return (
    <div className="scroll has-nav">
      <div className="h1" style={{ marginBottom: 12 }}>Tu protocolo</div>
      <Disclaimer kind="proto" />
    </div>
  )
}
