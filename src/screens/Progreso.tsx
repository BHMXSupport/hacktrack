import { useState } from 'react'
import { Segmented, Disclaimer } from '../components/controls'
// STUB — lo rellena el equipo multiagente (tab "Progreso": calendario de dosis + dashboard de KPIs).
export function Progreso() {
  const [view, setView] = useState<'cal' | 'avances'>('cal')
  return (
    <div className="scroll has-nav">
      <div className="h1" style={{ marginBottom: 12 }}>Progreso</div>
      <Segmented
        value={view}
        onChange={setView}
        options={[{ value: 'cal', label: 'Calendario' }, { value: 'avances', label: 'Avances' }]}
      />
      <div style={{ marginTop: 16 }} className="sm">
        {view === 'cal' ? 'Calendario de dosis (próximamente).' : 'Dashboard de progreso (próximamente).'}
      </div>
      <Disclaimer kind="proto" />
    </div>
  )
}
