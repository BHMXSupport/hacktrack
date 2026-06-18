// ProtocoloEdit — editar cadencia, titulación, fechas y recordatorio por producto.
// Items: 330 (validar ≥1 día seleccionado), 331 (preview próximas 5 tomas),
//        332 (historial reciente colapsable), 333 (dosis real promedio vs planeada),
//        402 (recordatorio de hora por producto)
import { useState } from 'react'
import { Sheet } from '../components/Sheet'
import { Segmented, Chip, Toggle, Stepper, Disclaimer } from '../components/controls'
import { useApp } from '../lib/store'
import { PEPTIDES, WDS } from '../lib/catalog'
import { rhythmLabel, proximasCadence } from '../lib/cadence'
import type { CadMode, UserCadence } from '../lib/types'

// epoch ms ⇄ 'YYYY-MM-DD'
const toInputDate = (ms: number) => {
  const d = new Date(ms)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const fromInputDate = (v: string) => {
  const [y, m, d] = v.split('-').map(Number)
  return new Date(y, m - 1, d).getTime()
}

// Formato corto de fecha (lun 16)
function fmtShortDate(d: Date): string {
  return d.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric' }).replace('.', '')
}

// item 333: promedio real de dosis para una fase del producto (del log)
function avgDoseForPhase(
  log: ReturnType<typeof useApp>['state']['log'],
  product: string,
  phaseIdx: number,
  totalPhases: number,
  startDate: number,
  endDate: number | null,
): number | null {
  if (totalPhases <= 0) return null
  const start = startDate
  const end = endDate ?? Date.now()
  const span = end - start
  const phaseLen = span / totalPhases
  const phaseStart = start + phaseIdx * phaseLen
  const phaseEnd = start + (phaseIdx + 1) * phaseLen

  const doses: number[] = []
  for (const group of log) {
    for (const it of group.items) {
      if (it.type !== 'dose' || it.product !== product) continue
      if (it.ts < phaseStart || it.ts > phaseEnd) continue
      if (it.value != null && it.value > 0) doses.push(it.value)
    }
  }
  if (doses.length === 0) return null
  return doses.reduce((a, b) => a + b, 0) / doses.length
}

// item 332: obtiene las últimas N dosis del producto del log
function lastDosesForProduct(
  log: ReturnType<typeof useApp>['state']['log'],
  product: string,
  n = 10,
): { value: number | null; unit: string; ts: number }[] {
  const out: { value: number | null; unit: string; ts: number }[] = []
  for (const group of log) {
    for (const it of group.items) {
      if (it.type === 'dose' && it.product === product) {
        out.push({ value: it.value ?? null, unit: it.unit as string, ts: it.ts })
        if (out.length >= n) return out
      }
    }
  }
  return out
}

function fmtTime12(ts: number): string {
  return new Date(ts).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
}

export function ProtocoloEdit() {
  const { state, dispatch } = useApp()
  // Editar el producto indicado por sheetArg (foco de edición explícito) SIN cambiar el "activo" visible de
  // Inicio. Fallback al activo si no se pasó arg (compat). Antes se despachaba setActiveProduct → abrir el
  // editor de un producto secundario reasignaba silenciosamente el producto primario de la pantalla Inicio.
  const editProduct = state.sheetArg && state.protocols[state.sheetArg] ? state.sheetArg : state.activeProduct
  const p = editProduct ? state.protocols[editProduct] : null
  const [startStr, setStartStr] = useState(toInputDate(p?.startDate ?? state.todayTs))
  const [endStr, setEndStr] = useState(p?.endDate ? toInputDate(p.endDate) : '')
  const [cad, setCad] = useState<UserCadence>(
    p?.cadence ?? { mode: 'dia', days: [true, true, true, true, true, true, true], every: 1, semDays: [true, false, false, false, false, false, false] },
  )
  const [progOn, setProgOn] = useState(p?.progOn ?? false)
  const [progN, setProgN] = useState(p?.progN ?? 2)
  const [phaseDoses, setPhaseDoses] = useState<string[]>(
    (p?.phaseDoses ?? []).map((d) => (d == null ? '' : String(d))),
  )
  const setPhaseDose = (i: number, v: string) =>
    setPhaseDoses((arr) => { const next = arr.slice(); while (next.length <= i) next.push(''); next[i] = v; return next })

  // item 402: hora de recordatorio por producto
  const [reminderTime, setReminderTime] = useState<string>(p?.reminderTime ?? '08:00')

  // item 332: historial colapsable
  const [showHistory, setShowHistory] = useState(false)

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
    setCad((c) => { const arr = c[key].slice(); arr[i] = !arr[i]; return { ...c, [key]: arr } })
  }

  // item 330: validación ≥1 día
  const daysValid = displayMode === 'dia'
    ? cad.days.some(Boolean)
    : displayMode === 'sem'
    ? cad.semDays.some(Boolean)
    : true

  // item 331: preview de próximas 5 tomas
  const startDate = startStr ? new Date(fromInputDate(startStr)) : new Date(p.startDate)
  const proximas = proximasCadence(cad, startDate, new Date(), 5)

  // item 332: historial reciente
  const historial = lastDosesForProduct(state.log, p.product, 10)

  function save() {
    // item 330: validar ≥1 día
    if (!daysValid) {
      dispatch({ t: 'toast', msg: 'Selecciona al menos un día' })
      return
    }
    const doses: (number | null)[] = Array.from({ length: progN }, (_, i) => {
      const n = parseFloat(phaseDoses[i] ?? '')
      return isNaN(n) ? null : n
    })
    const sd = startStr ? fromInputDate(startStr) : p!.startDate
    const ed = endStr ? fromInputDate(endStr) : null
    if (ed != null && ed < sd) {
      dispatch({ t: 'toast', msg: 'La fecha de fin no puede ser antes del inicio' })
      return
    }
    dispatch({ t: 'updateProtocolFor', product: p!.product, patch: {
      cadence: cad, progOn, progN,
      phaseDoses: progOn ? doses : undefined,
      startDate: sd, endDate: ed,
      reminderTime,  // item 402
    } })
    dispatch({ t: 'toast', msg: 'Protocolo actualizado' })
    dispatch({ t: 'sheet', sheet: null })
  }

  return (
    <Sheet title="Editar protocolo" onClose={() => dispatch({ t: 'sheet', sheet: null })}>
      <div style={{ padding: '0 20px 40px', display: 'flex', flexDirection: 'column', gap: 18 }}>

        <div className="sm">
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
          <>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {WDS.map(([lbl], i) => (
                <Chip key={lbl} label={lbl} active={cad.days[i]} onClick={() => toggleDay('days', i)} />
              ))}
            </div>
            {/* item 330: error inline */}
            {!cad.days.some(Boolean) && (
              <p className="sm" style={{ color: 'var(--error)', margin: 0 }}>
                Selecciona al menos un día
              </p>
            )}
          </>
        )}
        {displayMode === 'sem' && (
          <div>
            <div className="sm" style={{ marginBottom: 8 }}>Cada cuántas semanas</div>
            <Stepper value={cad.every} min={1} max={8} onChange={(v) => setCad((c) => ({ ...c, every: v }))} />
            <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
              {WDS.map(([lbl], i) => (
                <Chip key={lbl} label={lbl} active={cad.semDays[i]} onClick={() => toggleDay('semDays', i)} />
              ))}
            </div>
            {!cad.semDays.some(Boolean) && (
              <p className="sm" style={{ color: 'var(--error)', marginTop: 4 }}>Selecciona al menos un día</p>
            )}
          </div>
        )}
        {displayMode === 'mes' && (
          <div>
            <div className="sm" style={{ marginBottom: 8 }}>Cada cuántos meses</div>
            <Stepper value={cad.every} min={1} max={12} onChange={(v) => setCad((c) => ({ ...c, every: v }))} />
          </div>
        )}
        {displayMode === 'uso' && (
          <p className="sm">Sin horario fijo. Lo registras cuando lo usas — no programamos días.</p>
        )}

        {/* item 331: preview de próximas 5 tomas */}
        {proximas.length > 0 && displayMode !== 'uso' && (
          <div>
            <p className="sm" style={{ color: 'var(--ink-400)', marginBottom: 6 }}>Próximas tomas con esta cadencia:</p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {proximas.map((d, i) => (
                <span key={i}
                  style={{
                    padding: '3px 10px', borderRadius: 99, fontSize: 12, fontWeight: 600,
                    background: 'color-mix(in srgb, var(--brand-300) 15%, transparent)',
                    color: 'var(--brand-700)',
                    border: '1px solid color-mix(in srgb, var(--brand-300) 40%, transparent)',
                  }}>
                  {fmtShortDate(d)}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* item 402: hora de recordatorio por producto */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label className="label" htmlFor="proto-reminder">Hora de recordatorio</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input
              id="proto-reminder"
              type="time"
              className="field"
              value={reminderTime}
              onChange={(e) => setReminderTime(e.target.value)}
              style={{ flex: 1 }}
              aria-label={`Hora del recordatorio para ${p.product}`}
            />
            <span className="sm" style={{ color: 'var(--ink-400)' }}>
              Solo para {p.product}
            </span>
          </div>
        </div>

        {/* Vigencia */}
        <div className="label">Vigencia</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span className="sm" style={{ color: 'var(--ink-400)' }}>Empieza</span>
            <input className="field" type="date" aria-label="Fecha de inicio del protocolo"
              value={startStr} onChange={(e) => setStartStr(e.target.value)} />
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span className="sm" style={{ color: 'var(--ink-400)' }}>Termina <span style={{ color: 'var(--ink-300)' }}>(opcional)</span></span>
            <input className="field" type="date" aria-label="Fecha de fin del protocolo"
              min={startStr} value={endStr} onChange={(e) => setEndStr(e.target.value)} />
          </div>
        </div>
        {endStr && (
          <button className="btn btn-ghost btn-sm"
            style={{ width: 'auto', padding: '0 12px', alignSelf: 'flex-start' }}
            onClick={() => setEndStr('')}>
            Quitar fecha de fin
          </button>
        )}

        {/* Titulación / fases */}
        <div className="rowlist card">
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

        {progOn && (
          <div>
            <div className="label">Dosis por fase</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {Array.from({ length: progN }, (_, i) => {
                // item 333: promedio real
                const avg = avgDoseForPhase(
                  state.log, p.product, i, progN,
                  p.startDate, p.endDate ?? null,
                )
                return (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span className="sm" style={{ width: 64, flexShrink: 0 }}>Fase {i + 1}</span>
                      <input className="field" type="number" inputMode="decimal" step="any" min={0}
                        placeholder="—" aria-label={`Dosis de la fase ${i + 1} en mg`}
                        value={phaseDoses[i] ?? ''} onChange={(e) => setPhaseDose(i, e.target.value)}
                        style={{ flex: 1 }} />
                      <span className="sm" style={{ color: 'var(--ink-400)', flexShrink: 0 }}>mg</span>
                    </div>
                    {/* item 333: promedio real vs planeado */}
                    {avg != null && (
                      <div style={{ paddingLeft: 72, display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span className="sm" style={{ color: 'var(--ink-300)' }}>
                          Promedio real: <strong style={{ color: 'var(--ink-700)' }}>{avg.toFixed(2)} mg</strong>
                        </span>
                        {phaseDoses[i] && parseFloat(phaseDoses[i]) > 0 && (
                          <span className="sm" style={{
                            color: Math.abs(avg - parseFloat(phaseDoses[i])) < 0.05 ? 'var(--success)' : 'var(--warning)',
                            fontWeight: 600,
                          }}>
                            {avg > parseFloat(phaseDoses[i]) ? `+${(avg - parseFloat(phaseDoses[i])).toFixed(2)}` : (avg - parseFloat(phaseDoses[i])).toFixed(2)} vs planeado
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            <p className="sm" style={{ marginTop: 6, color: 'var(--ink-300)' }}>
              Tú defines la dosis de cada fase. Hacktrack no la prescribe.
            </p>
          </div>
        )}

        {/* item 332: historial reciente colapsable */}
        <div>
          <button className="btn-ghost sm"
            style={{ color: 'var(--brand-700)', fontWeight: 600 }}
            onClick={() => setShowHistory((v) => !v)}>
            {showHistory ? '▲ Ocultar historial' : `▼ Últimas ${Math.min(historial.length, 10)} dosis`}
          </button>
          {showHistory && historial.length > 0 && (
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {historial.map((d, i) => (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '6px 10px', borderRadius: 'var(--r-sm)',
                  background: 'var(--card)', border: '1px solid var(--border)',
                }}>
                  <span className="sm mono" style={{ color: 'var(--ink-400)' }}>
                    {new Date(d.ts).toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' })}
                    {' '}{fmtTime12(d.ts)}
                  </span>
                  <span className="sm" style={{ fontWeight: 600 }}>
                    {d.value != null ? `${d.value} ${d.unit}` : '—'}
                  </span>
                </div>
              ))}
            </div>
          )}
          {showHistory && historial.length === 0 && (
            <p className="sm" style={{ color: 'var(--ink-300)', marginTop: 6 }}>Sin dosis registradas aún.</p>
          )}
        </div>

        <button className="btn btn-brand"
          onClick={save}
          disabled={!daysValid}
          style={{ opacity: daysValid ? 1 : 0.45 }}>
          Guardar cambios
        </button>
        <Disclaimer kind="proto" />
      </div>
    </Sheet>
  )
}
