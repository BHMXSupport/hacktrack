// Medidas — sheet de medidas corporales numéricas.
// Item 321: delta vs medición anterior al guardar con feedback visual.
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sheet } from '../components/Sheet'
import { Disclaimer } from '../components/controls'
import { useApp } from '../lib/store'
import { MEDIDAS_FIELDS } from '../lib/catalog'
import { bmiCalc, bmiBand } from '../lib/bmi'
import type { Profile } from '../lib/types'

// item 321: obtiene el último valor de un campo del historial
function lastVal(history: Record<string, { value: number; ts: number }[]>, key: string, profile: Profile): number | null {
  // primero del historial
  const arr = history[key] ?? history[PROF_TO_KEY[key] ?? ''] ?? []
  if (arr.length > 0) return arr[arr.length - 1].value
  // fallback al perfil
  if (key === 'peso' && profile.peso != null) return profile.peso
  if (key === 'est' && profile.est != null) return profile.est
  if (key === 'grasa' && profile.grasa != null) return profile.grasa
  if (key === 'musculo' && profile.musculo != null) return profile.musculo
  return null
}

// Mapa campo → clave de historial
const PROF_TO_KEY: Record<string, string> = { peso: 'Peso', est: 'Altura', grasa: '% grasa', musculo: '% músculo' }

// item 321: formatea delta con dirección semántica (down=bueno si baja)
// Para las medidas corporales: peso/grasa/cintura → down=true; músculo → down=false
const FIELD_DOWN: Record<string, boolean> = { peso: true, est: false, grasa: true, musculo: false }

function fmtDelta(delta: number, fieldKey: string, unit: string): { text: string; good: boolean } {
  const sign = delta > 0 ? '+' : ''
  const down = FIELD_DOWN[fieldKey] ?? false
  const good = down ? delta < 0 : delta > 0
  return {
    text: `${sign}${Math.abs(delta) < 0.1 ? delta.toFixed(2) : delta.toFixed(1)} ${unit}`,
    good,
  }
}

export function Medidas() {
  const { state, dispatch } = useApp()

  const [vals, setVals] = useState<Record<string, string>>({})
  const [savedDeltas, setSavedDeltas] = useState<Record<string, { text: string; good: boolean }>>({})
  const [showDeltaChip, setShowDeltaChip] = useState(false)

  // Preview de IMC en vivo
  const pesoRaw = parseFloat(vals['peso'] ?? '')
  const estRaw  = parseFloat(vals['est']  ?? '')
  const bmi     = bmiCalc(pesoRaw, estRaw)
  const banda   = bmiBand(bmi)

  function handleChange(key: string, value: string) {
    setVals((prev) => ({ ...prev, [key]: value }))
  }

  const values: Partial<Pick<Profile, 'peso' | 'est' | 'grasa' | 'musculo'>> = {}
  for (const f of MEDIDAS_FIELDS) {
    const n = parseFloat(vals[f.key as string] ?? '')
    if (!isNaN(n)) (values as Record<string, number>)[f.key as string] = n
  }
  const hasAny = Object.keys(values).length > 0

  function handleSave() {
    if (!hasAny) return

    // item 321: calcular deltas antes de guardar
    const deltas: Record<string, { text: string; good: boolean }> = {}
    for (const f of MEDIDAS_FIELDS) {
      const newVal = parseFloat(vals[f.key as string] ?? '')
      if (isNaN(newVal)) continue
      const prev = lastVal(
        state.history as Record<string, { value: number; ts: number }[]>,
        f.key as string,
        state.profile
      )
      if (prev != null && Math.abs(newVal - prev) > 0.001) {
        deltas[f.key as string] = fmtDelta(newVal - prev, f.key as string, f.unit)
      }
    }

    dispatch({ t: 'saveMedidas', values })

    if (Object.keys(deltas).length > 0) {
      setSavedDeltas(deltas)
      setShowDeltaChip(true)
      setTimeout(() => {
        setShowDeltaChip(false)
        setTimeout(() => dispatch({ t: 'sheet', sheet: null }), 400)
      }, 2000)
    } else {
      dispatch({ t: 'sheet', sheet: null })
    }
  }

  return (
    <Sheet title="Cambio de medidas" onClose={() => dispatch({ t: 'sheet', sheet: null })}>
      <div style={{ padding: '0 20px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Campos numéricos con hint de valor anterior (item 321) */}
        {MEDIDAS_FIELDS.map((f) => {
          const prev = lastVal(
            state.history as Record<string, { value: number; ts: number }[]>,
            f.key as string,
            state.profile
          )
          const newVal = parseFloat(vals[f.key as string] ?? '')
          const hasNew = !isNaN(newVal)
          const delta = (hasNew && prev != null) ? fmtDelta(newVal - prev, f.key as string, f.unit) : null

          return (
            <div key={f.key as string}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                <label className="label" htmlFor={`medidas-${f.key as string}`}>
                  {f.label}{' '}
                  <span style={{ color: 'var(--ink-400)', fontWeight: 400 }}>({f.unit})</span>
                </label>
                {/* item 321: último valor como hint */}
                {prev != null && (
                  <span className="sm" style={{ color: 'var(--ink-300)' }}>
                    Ant: {prev} {f.unit}
                  </span>
                )}
              </div>
              <input
                id={`medidas-${f.key as string}`}
                className="field"
                type="number"
                inputMode="decimal"
                step="any"
                min={0}
                placeholder={prev != null ? `${prev}` : '—'}
                value={vals[f.key as string] ?? ''}
                onChange={(e) => handleChange(f.key as string, e.target.value)}
                aria-label={`${f.label} en ${f.unit}`}
              />
              {/* item 321: delta inline al escribir */}
              <AnimatePresence>
                {delta && Math.abs(newVal - (prev ?? 0)) > 0.001 && (
                  <motion.span
                    initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                    className="sm"
                    style={{
                      display: 'inline-block', marginTop: 4,
                      color: delta.good ? 'var(--success)' : 'var(--warning)',
                      fontWeight: 600,
                    }}
                  >
                    {delta.text}
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
          )
        })}

        {/* Preview IMC en vivo */}
        <div className="card"
          style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 6, borderLeft: '3px solid var(--brand-700)' }}>
          <p className="label" style={{ marginBottom: 2 }}>IMC calculado</p>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <span className="mono"
              style={{ fontSize: 36, fontWeight: 700, color: bmi != null ? 'var(--brand-700)' : 'var(--ink-300)', lineHeight: 1 }}>
              {bmi != null ? bmi.toFixed(1) : '—'}
            </span>
            {bmi != null && (
              <span className="badge badge-mint" style={{ textTransform: 'lowercase' }}>{banda}</span>
            )}
          </div>
          <p className="sm" style={{ color: 'var(--ink-400)', marginTop: 2 }}>El IMC se calcula solo, no lo tecleas.</p>
        </div>

        {/* item 321: chip de deltas al guardar */}
        <AnimatePresence>
          {showDeltaChip && Object.keys(savedDeltas).length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              style={{
                padding: '12px 16px', borderRadius: 'var(--r-md)',
                background: 'color-mix(in srgb, var(--brand-700) 8%, transparent)',
                border: '1px solid color-mix(in srgb, var(--brand-700) 30%, transparent)',
                display: 'flex', flexDirection: 'column', gap: 4,
              }}
            >
              {MEDIDAS_FIELDS.filter((f) => savedDeltas[f.key as string]).map((f) => {
                const d = savedDeltas[f.key as string]
                return (
                  <div key={f.key as string} style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span className="sm" style={{ color: 'var(--ink-700)' }}>{f.label}</span>
                    <span className="sm mono" style={{ fontWeight: 700, color: d.good ? 'var(--success)' : 'var(--warning)' }}>
                      {d.text}
                    </span>
                  </div>
                )
              })}
            </motion.div>
          )}
        </AnimatePresence>

        {/* CTA */}
        <button
          className="btn btn-brand"
          onClick={handleSave}
          disabled={!hasAny}
          style={{ marginTop: 4, opacity: hasAny ? 1 : 0.45, cursor: hasAny ? 'pointer' : 'not-allowed' }}
        >
          Guardar medidas
        </button>

        <Disclaimer kind="measure" />
      </div>
    </Sheet>
  )
}
