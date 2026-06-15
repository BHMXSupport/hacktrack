import { useState } from 'react'
import { Sheet } from '../components/Sheet'
import { Disclaimer } from '../components/controls'
import { useApp } from '../lib/store'
import { MEDIDAS_FIELDS } from '../lib/catalog'
import type { Profile } from '../lib/types'
// STUB — lo rellena el equipo multiagente (KPI compuesto "Cambio de medidas").
export function Medidas() {
  const { dispatch } = useApp()
  const [vals, setVals] = useState<Record<string, string>>({})
  function save() {
    const values: Partial<Pick<Profile, 'peso' | 'est' | 'grasa' | 'musculo'>> = {}
    for (const f of MEDIDAS_FIELDS) {
      const n = parseFloat(vals[f.key as string])
      if (!isNaN(n)) (values as Record<string, number>)[f.key as string] = n
    }
    dispatch({ t: 'saveMedidas', values })
  }
  return (
    <Sheet title="Cambio de medidas" onClose={() => dispatch({ t: 'sheet', sheet: null })}>
      {MEDIDAS_FIELDS.map((f) => (
        <div key={f.key as string} style={{ marginBottom: 12 }}>
          <label className="label">{f.label} ({f.unit})</label>
          <input className="field" type="number" inputMode="decimal"
            value={vals[f.key as string] ?? ''}
            onChange={(e) => setVals((v) => ({ ...v, [f.key as string]: e.target.value }))} />
        </div>
      ))}
      <button className="btn btn-brand" onClick={save}>Guardar medidas</button>
      <Disclaimer kind="measure" />
    </Sheet>
  )
}
