import { useState } from 'react'
import { Sheet } from '../components/Sheet'
import { Segmented, Chip, Toggle, Stepper, Disclaimer } from '../components/controls'
import { useApp } from '../lib/store'
import { PEPTIDES, WDS } from '../lib/catalog'
import { rhythmLabel } from '../lib/cadence'
import type { CadMode, UserCadence } from '../lib/types'

// Editar (tunear) el protocolo: cadencia + titulación. Da el recomendado pero deja editar (punto 4).
export function ProtocoloEdit() {
  const { state, dispatch } = useApp()
  const p = state.protocol
  const [cad, setCad] = useState<UserCadence>(
    p?.cadence ?? { mode: 'dia', days: [true, true, true, true, true, true, true], every: 1, semDays: [true, false, false, false, false, false, false] },
  )
  const [progOn, setProgOn] = useState(p?.progOn ?? false)
  const [progN, setProgN] = useState(p?.progN ?? 2)
  // dosis por fase como strings (para los inputs); se parsean al guardar
  const [phaseDoses, setPhaseDoses] = useState<string[]>(
    (p?.phaseDoses ?? []).map((d) => (d == null ? '' : String(d))),
  )
  const setPhaseDose = (i: number, v: string) =>
    setPhaseDoses((arr) => {
      const next = arr.slice()
      while (next.length <= i) next.push('')
      next[i] = v
      return next
    })

  if (!p) return null
  const entry = PEPTIDES[p.product]
  const recomendado = entry ? rhythmLabel(entry) : 'Por uso'
  const displayMode: CadMode = (['dia', 'sem', 'mes', 'uso'] as string[]).includes(cad.mode)
    ? (cad.mode as CadMode)
    : 'dia'

  function setMode(m: CadMode) {
    setCad((c) => ({ ...c, mode: m, every: m === 'sem' || m === 'mes' ? Math.max(1, c.every) : 1 }))
  }
  function toggleDay(key: 'days' | 'semDays', i: number) {
    setCad((c) => {
      const arr = c[key].slice()
      arr[i] = !arr[i]
      return { ...c, [key]: arr }
    })
  }

  function save() {
    const doses: (number | null)[] = Array.from({ length: progN }, (_, i) => {
      const n = parseFloat(phaseDoses[i] ?? '')
      return isNaN(n) ? null : n
    })
    dispatch({ t: 'updateProtocol', patch: { cadence: cad, progOn, progN, phaseDoses: progOn ? doses : undefined } })
    dispatch({ t: 'toast', msg: 'Protocolo actualizado' })
    dispatch({ t: 'sheet', sheet: null })
  }

  return (
    <Sheet title="Editar protocolo" onClose={() => dispatch({ t: 'sheet', sheet: null })}>
      <div className="sm" style={{ marginBottom: 14 }}>
        {p.product} · ritmo recomendado: <strong>{recomendado}</strong>. Ajústalo a lo que TÚ haces.
      </div>

      <div className="label">Ritmo</div>
      <Segmented<CadMode>
        value={displayMode}
        onChange={setMode}
        options={[
          { value: 'dia', label: 'Por día' },
          { value: 'sem', label: 'Semana' },
          { value: 'mes', label: 'Mes' },
          { value: 'uso', label: 'Por uso' },
        ]}
      />

      {displayMode === 'dia' && (
        <div style={{ display: 'flex', gap: 6, marginTop: 14, flexWrap: 'wrap' }}>
          {WDS.map(([lbl], i) => (
            <Chip key={lbl} label={lbl} active={cad.days[i]} onClick={() => toggleDay('days', i)} />
          ))}
        </div>
      )}
      {displayMode === 'sem' && (
        <div style={{ marginTop: 14 }}>
          <div className="sm" style={{ marginBottom: 8 }}>Cada cuántas semanas</div>
          <Stepper value={cad.every} min={1} max={8} onChange={(v) => setCad((c) => ({ ...c, every: v }))} />
          <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
            {WDS.map(([lbl], i) => (
              <Chip key={lbl} label={lbl} active={cad.semDays[i]} onClick={() => toggleDay('semDays', i)} />
            ))}
          </div>
        </div>
      )}
      {displayMode === 'mes' && (
        <div style={{ marginTop: 14 }}>
          <div className="sm" style={{ marginBottom: 8 }}>Cada cuántos meses</div>
          <Stepper value={cad.every} min={1} max={12} onChange={(v) => setCad((c) => ({ ...c, every: v }))} />
        </div>
      )}
      {displayMode === 'uso' && (
        <p className="sm" style={{ marginTop: 14 }}>Sin horario fijo. Lo registras cuando lo usas — no programamos días.</p>
      )}

      {/* Titulación / fases */}
      <div className="rowlist card" style={{ marginTop: 18 }}>
        <div className="row" style={{ cursor: 'default' }}>
          <span className="row-main">
            <span className="row-label">Titulación por fases</span>
            <span className="row-sub">Subes la dosis por etapas que tú defines</span>
          </span>
          <span className="row-end"><Toggle on={progOn} onChange={setProgOn} label="Titulación por fases" /></span>
        </div>
        {progOn && (
          <div className="row" style={{ cursor: 'default' }}>
            <span className="row-main"><span className="row-label">Número de fases</span></span>
            <span className="row-end"><Stepper value={progN} min={2} max={8} onChange={setProgN} /></span>
          </div>
        )}
      </div>

      {/* Dosis por fase — el usuario la define (la app no prescribe) */}
      {progOn && (
        <div style={{ marginTop: 14 }}>
          <div className="label">Dosis por fase</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {Array.from({ length: progN }, (_, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="sm" style={{ width: 64, flexShrink: 0 }}>Fase {i + 1}</span>
                <input
                  className="field"
                  type="number"
                  inputMode="decimal"
                  step="any"
                  min={0}
                  placeholder="—"
                  aria-label={`Dosis de la fase ${i + 1} en mg`}
                  value={phaseDoses[i] ?? ''}
                  onChange={(e) => setPhaseDose(i, e.target.value)}
                  style={{ flex: 1 }}
                />
                <span className="sm" style={{ color: 'var(--ink-400)', flexShrink: 0 }}>mg</span>
              </div>
            ))}
          </div>
          <p className="sm" style={{ marginTop: 6, color: 'var(--ink-300)' }}>
            Tú defines la dosis de cada fase. Hacktrack no la prescribe.
          </p>
        </div>
      )}

      <button className="btn btn-brand" style={{ marginTop: 18 }} onClick={save}>Guardar cambios</button>
      <Disclaimer kind="proto" />
    </Sheet>
  )
}
