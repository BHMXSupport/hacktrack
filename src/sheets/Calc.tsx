import { useState } from 'react'
import { Sheet } from '../components/Sheet'
import { Segmented, Disclaimer } from '../components/controls'
import { IcDrop } from '../components/icons'
import { useApp } from '../lib/store'
import { calcRecon, copyToRegisterToast } from '../lib/calc'
import type { SyringeScale } from '../lib/types'

const UNIT_OPTIONS = [
  { value: 'mg' as const, label: 'mg' },
  { value: 'mcg' as const, label: 'mcg' },
]

// Jeringas de insulina/péptidos = U-100. El selector elige el TAMAÑO del barril (no la concentración).
const SCALE_OPTIONS = [
  { value: 30 as SyringeScale, label: '30 U' },
  { value: 50 as SyringeScale, label: '50 U' },
  { value: 100 as SyringeScale, label: '100 U' },
]

// La calculadora SOLO convierte la dosis que el usuario teclea (P0-6, guardrail de compliance).
export function CalcSheet() {
  const { state, dispatch } = useApp()

  const [vialStr, setVialStr]   = useState('')
  const [aguaStr, setAguaStr]   = useState('')
  const [dosisStr, setDosisStr] = useState('')
  const [unit, setUnit]         = useState<'mg' | 'mcg'>('mg')

  const vial  = parseFloat(vialStr)
  const agua  = parseFloat(aguaStr)
  const dosis = parseFloat(dosisStr)

  // normaliza una escala persistida vieja (U-40/U-50 ya no son válidas) → 1 mL por defecto
  const scale: SyringeScale = ([30, 50, 100] as number[]).includes(state.scale) ? state.scale : 100
  const r = calcRecon({ vial, agua, dosis, unit, scale })

  function handleCopy() {
    if (!r) return
    dispatch({ t: 'setDraftDose', draft: { value: r.ui, unit: 'UI' } }) // precarga la dosis en Registrar
    dispatch({ t: 'toast', msg: copyToRegisterToast(r) })
    dispatch({ t: 'sheet', sheet: 'registrar' })
  }

  return (
    <Sheet
      title="Calculadora de unidades"
      onClose={() => dispatch({ t: 'sheet', sheet: 'registrar' })}
    >
      <div style={{ padding: '0 20px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Encabezado informativo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--ink-700)' }}>
          <IcDrop size={20} />
          <span className="sm" style={{ color: 'var(--ink-400)' }}>
            Ingresa los datos de tu reconstitución y tu dosis para convertir a unidades de jeringa.
          </span>
        </div>

        {/* Campo: Vial (mg) */}
        <div>
          <label className="label" htmlFor="calc-vial">Vial (mg)</label>
          <input
            id="calc-vial"
            className="field"
            type="number"
            inputMode="decimal"
            min="0"
            placeholder="ej. 10"
            value={vialStr}
            onChange={(e) => setVialStr(e.target.value)}
          />
        </div>

        {/* Campo: Agua (mL) */}
        <div>
          <label className="label" htmlFor="calc-agua">Agua (mL)</label>
          <input
            id="calc-agua"
            className="field"
            type="number"
            inputMode="decimal"
            min="0"
            placeholder="ej. 2"
            value={aguaStr}
            onChange={(e) => setAguaStr(e.target.value)}
          />
        </div>

        {/* Campo: Tu dosis + selector de unidad */}
        <div>
          <label className="label" htmlFor="calc-dosis">Tu dosis</label>
          <input
            id="calc-dosis"
            className="field"
            type="number"
            inputMode="decimal"
            min="0"
            placeholder="ej. 0.5"
            value={dosisStr}
            onChange={(e) => setDosisStr(e.target.value)}
          />
          <div style={{ marginTop: 10 }}>
            <Segmented
              options={UNIT_OPTIONS}
              value={unit}
              onChange={setUnit}
            />
          </div>
        </div>

        {/* Tamaño de jeringa — todas U-100; el barril solo limita la capacidad */}
        <div>
          <p className="label" style={{ marginBottom: 8 }}>Tamaño de jeringa <span style={{ color: 'var(--ink-300)', fontWeight: 400 }}>· U-100</span></p>
          <Segmented
            options={SCALE_OPTIONS}
            value={scale}
            onChange={(v) => dispatch({ t: 'setScale', scale: v })}
          />
        </div>

        {/* Resultado */}
        {r ? (
          <div
            className="card"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 6,
              padding: '24px 20px',
              background: 'var(--card)',
              textAlign: 'center',
            }}
          >
            <span
              className="mono display-l"
              style={{ fontSize: 48, fontWeight: 700, color: r.overCapacity ? 'var(--error)' : 'var(--brand-700)', lineHeight: 1 }}
            >
              {r.ui} UI
            </span>
            <span className="sm" style={{ color: 'var(--ink-400)' }}>
              ≈ {r.mL} mL · {r.conc} mg/mL · U-100
            </span>
            {r.overCapacity && (
              <span className="sm" style={{ color: 'var(--error)', fontWeight: 600, marginTop: 6 }}>
                No cabe en una jeringa de {r.scale} U.
              </span>
            )}
            {!r.overCapacity && r.lowPrecision && (
              <span className="sm" style={{ color: 'var(--warning)', marginTop: 6 }}>
                Menos de 5 UI: difícil de medir con precisión. Considera reconstituir con menos agua.
              </span>
            )}
          </div>
        ) : (
          <div
            className="card"
            style={{
              padding: '24px 20px',
              textAlign: 'center',
              background: 'var(--card)',
              color: 'var(--ink-300)',
            }}
          >
            <span className="body">Ingresa vial, agua y tu dosis para ver el resultado.</span>
          </div>
        )}

        {/* CTA: copiar a registro */}
        <button
          className="btn btn-brand"
          disabled={!r}
          onClick={handleCopy}
          style={{ width: '100%', opacity: r ? 1 : 0.4 }}
        >
          Copiar a mi registro
        </button>

        {/* Disclaimer de compliance — nunca omitir (audit guardrail) */}
        <Disclaimer kind="calc" />
      </div>
    </Sheet>
  )
}
