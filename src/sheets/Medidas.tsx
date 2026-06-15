import { useState } from 'react'
import { Sheet } from '../components/Sheet'
import { Disclaimer } from '../components/controls'
import { useApp } from '../lib/store'
import { MEDIDAS_FIELDS } from '../lib/catalog'
import { bmiCalc, bmiBand } from '../lib/bmi'
import type { Profile } from '../lib/types'

export function Medidas() {
  const { dispatch } = useApp()

  // Estado local: un string por campo (clave = MedidaField.key)
  const [vals, setVals] = useState<Record<string, string>>({})

  // Preview de IMC en vivo
  const pesoRaw = parseFloat(vals['peso'] ?? '')
  const estRaw  = parseFloat(vals['est']  ?? '')
  const bmi     = bmiCalc(pesoRaw, estRaw)
  const banda   = bmiBand(bmi)

  function handleChange(key: string, value: string) {
    setVals((prev) => ({ ...prev, [key]: value }))
  }

  function handleSave() {
    const values: Partial<Pick<Profile, 'peso' | 'est' | 'grasa' | 'musculo'>> = {}
    for (const f of MEDIDAS_FIELDS) {
      const n = parseFloat(vals[f.key as string] ?? '')
      if (!isNaN(n)) (values as Record<string, number>)[f.key as string] = n
    }
    dispatch({ t: 'saveMedidas', values })
  }

  return (
    <Sheet
      title="Cambio de medidas"
      onClose={() => dispatch({ t: 'sheet', sheet: null })}
    >
      <div style={{ padding: '0 20px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Campos numéricos */}
        {MEDIDAS_FIELDS.map((f) => (
          <div key={f.key as string}>
            <label className="label" htmlFor={`medidas-${f.key as string}`}>
              {f.label}{' '}
              <span style={{ color: 'var(--ink-400)', fontWeight: 400 }}>({f.unit})</span>
            </label>
            <input
              id={`medidas-${f.key as string}`}
              className="field"
              type="number"
              inputMode="decimal"
              step="any"
              min={0}
              placeholder="—"
              value={vals[f.key as string] ?? ''}
              onChange={(e) => handleChange(f.key as string, e.target.value)}
              aria-label={`${f.label} en ${f.unit}`}
              style={{ marginTop: 6 }}
            />
          </div>
        ))}

        {/* Preview IMC en vivo */}
        <div
          className="card"
          style={{
            padding: '16px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            borderLeft: '3px solid var(--brand-700)',
          }}
        >
          <p className="label" style={{ marginBottom: 2 }}>IMC calculado</p>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <span
              className="mono"
              style={{
                fontSize: 36,
                fontWeight: 700,
                color: bmi != null ? 'var(--brand-700)' : 'var(--ink-300)',
                lineHeight: 1,
              }}
            >
              {bmi != null ? bmi.toFixed(1) : '—'}
            </span>
            {bmi != null && (
              <span
                className="badge badge-mint"
                style={{ textTransform: 'lowercase' }}
              >
                {banda}
              </span>
            )}
          </div>
          <p className="sm" style={{ color: 'var(--ink-400)', marginTop: 2 }}>
            El IMC se calcula solo, no lo tecleas.
          </p>
        </div>

        {/* CTA */}
        <button
          className="btn btn-brand"
          onClick={handleSave}
          style={{ marginTop: 4 }}
        >
          Guardar medidas
        </button>

        {/* Disclaimer — mantener siempre visible (audit guardrail) */}
        <Disclaimer kind="measure" />
      </div>
    </Sheet>
  )
}
