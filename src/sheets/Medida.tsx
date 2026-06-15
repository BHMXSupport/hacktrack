import { useState } from 'react'
import { Sheet } from '../components/Sheet'
import { Chip, Disclaimer } from '../components/controls'
import { IcDrop } from '../components/icons'
import { useApp } from '../lib/store'
import { MEASURES_BY, MEASURE_META } from '../lib/catalog'

export function MedidaSheet() {
  const { state, dispatch } = useApp()

  // Medidas disponibles: las seleccionadas por el usuario; fallback al preset del objetivo activo o Explorar
  const available: string[] =
    state.selectedMeasures.length > 0
      ? state.selectedMeasures
      : MEASURES_BY[state.curGoal ?? 'Explorar'] ?? MEASURES_BY['Explorar']

  const [name, setName] = useState<string>(available[0] ?? '')
  const [numVal, setNumVal] = useState<string>('')
  const [scaleVal, setScaleVal] = useState<number | null>(null)

  const meta = name ? (MEASURE_META[name] ?? null) : null

  // Cuando cambia la medida seleccionada, reinicia los controles de valor
  function pickMeasure(n: string) {
    setName(n)
    setNumVal('')
    setScaleVal(null)
  }

  function handleSave() {
    if (!name) return
    if (!meta) return
    const v =
      meta.kind === 'num'
        ? parseFloat(numVal)
        : scaleVal
    if (v == null || isNaN(v as number)) return
    dispatch({ t: 'saveMeasure', name, value: v as number })
  }

  const canSave =
    !!name &&
    !!meta &&
    (meta.kind === 'num'
      ? numVal.trim() !== '' && !isNaN(parseFloat(numVal))
      : scaleVal !== null)

  // Etiqueta de escala según max
  function scaleGuide(max: number) {
    return max === 10
      ? 'Del 0 (nada) al 10 (máximo)'
      : 'Del 1 (bajo) al 5 (alto)'
  }

  return (
    <Sheet
      title="Registrar medida"
      onClose={() => dispatch({ t: 'sheet', sheet: null })}
    >
      <div style={{ padding: '0 20px 24px', display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* Selector de medida */}
        <section>
          <p className="label" style={{ marginBottom: 10 }}>¿Qué quieres registrar?</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {available.map((m) => (
              <Chip
                key={m}
                label={m}
                active={name === m}
                onClick={() => pickMeasure(m)}
              />
            ))}
          </div>
        </section>

        {/* Entrada de valor */}
        {meta && (
          <section>
            {meta.kind === 'num' && (
              <>
                <p className="label" style={{ marginBottom: 10 }}>
                  Valor
                  {meta.unit && (
                    <span
                      style={{
                        marginLeft: 6,
                        color: 'var(--ink-400)',
                        fontWeight: 400,
                      }}
                    >
                      ({meta.unit})
                    </span>
                  )}
                </p>
                <div className="card" style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <IcDrop size={20} style={{ color: 'var(--brand-700)', flexShrink: 0 }} />
                  <input
                    className="field mono"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="any"
                    placeholder="0"
                    value={numVal}
                    onChange={(e) => setNumVal(e.target.value)}
                    style={{
                      flex: 1,
                      fontSize: 28,
                      fontWeight: 700,
                      border: 'none',
                      outline: 'none',
                      background: 'transparent',
                      padding: 0,
                      width: '100%',
                    }}
                    aria-label={`Valor de ${name}${meta.unit ? ' en ' + meta.unit : ''}`}
                  />
                  {meta.unit && (
                    <span
                      className="sm"
                      style={{
                        color: 'var(--ink-400)',
                        flexShrink: 0,
                      }}
                    >
                      {meta.unit}
                    </span>
                  )}
                </div>
              </>
            )}

            {meta.kind === 'scale' && meta.max != null && (
              <>
                <p className="label" style={{ marginBottom: 4 }}>Valor</p>
                <p className="sm" style={{ color: 'var(--ink-400)', marginBottom: 12 }}>
                  {scaleGuide(meta.max)}
                </p>
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 8,
                  }}
                  role="group"
                  aria-label={`Escala de 0 a ${meta.max}`}
                >
                  {Array.from(
                    { length: meta.max === 10 ? 11 : meta.max },
                    (_, i) => (meta.max === 10 ? i : i + 1)
                  ).map((n) => {
                    const active = scaleVal === n
                    return (
                      <button
                        key={n}
                        aria-pressed={active}
                        onClick={() => setScaleVal(n)}
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 10,
                          border: active
                            ? '2px solid var(--brand-700)'
                            : '1.5px solid var(--border)',
                          background: active ? 'var(--brand-700)' : 'var(--card)',
                          color: active ? '#fff' : 'var(--ink-700)',
                          fontFamily: 'JetBrains Mono, monospace',
                          fontSize: 16,
                          fontWeight: 600,
                          cursor: 'pointer',
                          transition: 'background 120ms, border-color 120ms, color 120ms',
                          flexShrink: 0,
                        }}
                      >
                        {n}
                      </button>
                    )
                  })}
                </div>
              </>
            )}
          </section>
        )}

        {/* CTA */}
        <button
          className="btn btn-brand"
          disabled={!canSave}
          onClick={handleSave}
          style={{ opacity: canSave ? 1 : 0.45 }}
        >
          Guardar registro
        </button>

        {/* Disclaimer — siempre visible (audit guardrail: no reducir instancias) */}
        <Disclaimer kind="measure" />
      </div>
    </Sheet>
  )
}
