// Registrar dosis — bottom-sheet. Un solo archivo, sin props, usa useApp().
// Compliance: sin jeringas (IcDrop/IcLeaf), el usuario teclea su dosis,
// calculadora solo convierte, sin venta in-app, disclaimers presentes.
import { useState, useCallback } from 'react'
import { Sheet } from '../components/Sheet'
import { Segmented, Chip, Disclaimer } from '../components/controls'
import { IcDrop } from '../components/icons'
import { useApp } from '../lib/store'
import { PEPTIDES, WDS } from '../lib/catalog'
import { presetCad } from '../lib/cadence'
import type { UserCadence, CadMode } from '../lib/types'

// Unidades disponibles (el usuario elige — NUNCA precargamos dosis)
type DoseUnit = 'UI' | 'clics' | 'mg' | 'mcg' | 'mL'
const UNITS: { value: DoseUnit; label: string }[] = [
  { value: 'UI',   label: 'UI' },
  { value: 'clics', label: 'clics' },
  { value: 'mg',   label: 'mg' },
  { value: 'mcg',  label: 'mcg' },
  { value: 'mL',   label: 'mL' },
]

const CADENCE_OPTS: { value: CadMode; label: string }[] = [
  { value: 'dia', label: 'Por día' },
  { value: 'sem', label: 'Semana' },
  { value: 'mes', label: 'Mes' },
  { value: 'uso', label: 'Por uso' },
]

// Catálogo + importados — para el picker de producto
function buildProductList(importedProducts: string[]): string[] {
  const catalog = Object.keys(PEPTIDES)
  const all = [...new Set([...importedProducts, ...catalog])]
  return all
}

export function RegistrarSheet() {
  const { state, dispatch } = useApp()

  // ── Producto ──────────────────────────────────────────────────────────────
  const defaultProduct =
    state.protocol?.product ??
    state.importedProducts[0] ??
    Object.keys(PEPTIDES)[0] ??
    ''

  const [product, setProduct] = useState<string>(defaultProduct)
  const [showPicker, setShowPicker] = useState(false)
  const [customProduct, setCustomProduct] = useState('')
  const [pickingCustom, setPickingCustom] = useState(false)

  const allProducts = buildProductList(state.importedProducts)

  // ── Cadencia local (semilla: protocol.cadence ?? presetCad del catálogo) ─
  const seedCad: UserCadence =
    state.protocol?.cadence ?? presetCad(PEPTIDES[product])

  const [localCad, setLocalCad] = useState<UserCadence>(seedCad)

  // Cuando la cadencia es 'cadaN' o 'ciclo' (venida del catálogo),
  // la UI la muestra como modo informativo (no editable en la segmentada de 4),
  // pero el usuario puede cambiar a dia/sem/mes/uso.
  const cadMode = (['dia', 'sem', 'mes', 'uso'] as CadMode[]).includes(
    localCad.mode as CadMode,
  )
    ? (localCad.mode as CadMode)
    : 'dia'

  function setCadMode(m: CadMode) {
    setLocalCad((prev) => ({
      ...prev,
      mode: m,
      // reset every al cambiar entre sem/mes (bug P0-3)
      every: m === 'sem' || m === 'mes' ? 1 : prev.every,
    }))
  }

  function toggleDay(i: number) {
    setLocalCad((prev) => {
      const days = [...prev.days]
      days[i] = !days[i]
      return { ...prev, days }
    })
  }

  // ── Dosis — campo controlado, NUNCA precargado ────────────────────────────
  const [dose, setDose] = useState('')
  const [unit, setUnit] = useState<DoseUnit>('mg')

  function stepDose(delta: number) {
    const current = parseFloat(dose) || 0
    const next = Math.max(0, current + delta)
    setDose(String(next % 1 === 0 ? next : parseFloat(next.toFixed(2))))
  }

  // ── Hora ──────────────────────────────────────────────────────────────────
  const [hora, setHora] = useState('Ahora')

  // ── Selección de producto ─────────────────────────────────────────────────
  function pickProduct(p: string) {
    setProduct(p)
    setShowPicker(false)
    setPickingCustom(false)
    // Re-sembrar cadencia al cambiar producto
    setLocalCad(presetCad(PEPTIDES[p]))
  }

  function confirmCustom() {
    const name = customProduct.trim()
    if (!name) return
    setProduct(name)
    setShowPicker(false)
    setPickingCustom(false)
    setLocalCad(presetCad(undefined))
  }

  // ── Guardar ───────────────────────────────────────────────────────────────
  const handleSave = useCallback(() => {
    const finalProduct = product || 'Mi producto'
    // Persistir cadencia si hay protocolo activo
    if (state.protocol) {
      dispatch({ t: 'setCadence', cadence: localCad })
    }
    // Registrar dosis (P0-1: entra al diario + racha + activa dash)
    dispatch({
      t: 'logDose',
      product: finalProduct,
      value: parseFloat(dose) || null,
      unit,
    })
    dispatch({ t: 'sheet', sheet: null })
  }, [state.protocol, localCad, product, dose, unit, dispatch])

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Sheet title="Registrar" onClose={() => dispatch({ t: 'sheet', sheet: null })}>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 120px', display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* ── Producto ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span className="sm" style={{ color: 'var(--ink-400)' }}>Producto</span>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 16px', borderRadius: 12,
            border: '1px solid var(--border)', background: 'var(--card)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 40, height: 40, borderRadius: '50%',
                background: 'color-mix(in srgb, var(--brand-700) 10%, transparent)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--brand-700)',
              }}>
                <IcDrop size={20} />
              </div>
              <span className="body" style={{ fontWeight: 500 }}>
                {product || 'Selecciona un producto'}
              </span>
            </div>
            <button
              className="btn-ghost sm"
              style={{ color: 'var(--brand-700)', fontWeight: 600 }}
              onClick={() => setShowPicker((v) => !v)}
            >
              Cambiar
            </button>
          </div>

          {/* Picker de chips */}
          {showPicker && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
              {allProducts.map((p) => (
                <Chip
                  key={p}
                  label={p}
                  active={p === product && !pickingCustom}
                  onClick={() => pickProduct(p)}
                />
              ))}
              <Chip
                label="Otro"
                active={pickingCustom}
                onClick={() => { setPickingCustom(true) }}
              />
              {pickingCustom && (
                <div style={{ width: '100%', display: 'flex', gap: 8, marginTop: 4 }}>
                  <input
                    className="field body"
                    placeholder="Nombre del producto"
                    value={customProduct}
                    onChange={(e) => setCustomProduct(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && confirmCustom()}
                    style={{ flex: 1 }}
                    autoFocus
                  />
                  <button className="btn btn-brand btn-sm" onClick={confirmCustom}>
                    Listo
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Cadencia ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <span className="sm" style={{ color: 'var(--ink-400)' }}>Cadencia</span>
          <Segmented
            options={CADENCE_OPTS}
            value={cadMode}
            onChange={setCadMode}
          />

          {/* Modo día: chips de día de semana */}
          {cadMode === 'dia' && (
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6, marginTop: 4 }}>
              {WDS.map(([label], i) => (
                <button
                  key={label}
                  aria-pressed={!!localCad.days[i]}
                  onClick={() => toggleDay(i)}
                  style={{
                    width: 40, height: 40, borderRadius: '50%',
                    fontSize: 13, fontWeight: 600,
                    background: localCad.days[i] ? 'var(--brand-700)' : 'var(--ink-100)',
                    color: localCad.days[i] ? '#fff' : 'var(--ink-400)',
                    border: 'none', cursor: 'pointer',
                    transition: 'background .15s',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {/* Modo sem: cada N semanas */}
          {cadMode === 'sem' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span className="sm" style={{ color: 'var(--ink-400)' }}>Cada</span>
              <button className="stepbtn" aria-label="Menos"
                onClick={() => setLocalCad((p) => ({ ...p, every: Math.max(1, p.every - 1) }))}>
                −
              </button>
              <span className="mono" style={{ minWidth: 24, textAlign: 'center' }}>
                {localCad.every}
              </span>
              <button className="stepbtn" aria-label="Más"
                onClick={() => setLocalCad((p) => ({ ...p, every: p.every + 1 }))}>
                +
              </button>
              <span className="sm" style={{ color: 'var(--ink-400)' }}>
                {localCad.every === 1 ? 'semana' : 'semanas'}
              </span>
            </div>
          )}

          {/* Modo mes: cada N meses */}
          {cadMode === 'mes' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span className="sm" style={{ color: 'var(--ink-400)' }}>Cada</span>
              <button className="stepbtn" aria-label="Menos"
                onClick={() => setLocalCad((p) => ({ ...p, every: Math.max(1, p.every - 1) }))}>
                −
              </button>
              <span className="mono" style={{ minWidth: 24, textAlign: 'center' }}>
                {localCad.every}
              </span>
              <button className="stepbtn" aria-label="Más"
                onClick={() => setLocalCad((p) => ({ ...p, every: p.every + 1 }))}>
                +
              </button>
              <span className="sm" style={{ color: 'var(--ink-400)' }}>
                {localCad.every === 1 ? 'mes' : 'meses'}
              </span>
            </div>
          )}

          {/* Modo uso: sin horario */}
          {cadMode === 'uso' && (
            <p className="sm" style={{ color: 'var(--ink-400)', margin: 0 }}>
              Sin horario fijo. Lo registras cuando lo usas — no programamos días.
            </p>
          )}
        </div>

        {/* ── Dosis (el usuario teclea — NUNCA precargado) ── */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '8px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {/* Botón − */}
            <button
              className="stepbtn"
              aria-label="Disminuir dosis"
              style={{ width: 56, height: 56, borderRadius: '50%', border: '1px solid var(--border)', fontSize: 24 }}
              onClick={() => stepDose(-1)}
            >
              −
            </button>

            {/* Input grande controlado */}
            <input
              type="text"
              inputMode="decimal"
              aria-label="Cantidad de dosis"
              className="mono"
              placeholder="0"
              value={dose}
              onChange={(e) => {
                // solo dígitos y punto/coma
                const v = e.target.value.replace(',', '.')
                if (/^\d*\.?\d*$/.test(v)) setDose(v)
              }}
              style={{
                width: 128, textAlign: 'center', fontSize: 40, fontWeight: 800,
                background: 'transparent', border: 'none', outline: 'none',
                color: 'var(--ink-900)',
              }}
            />

            {/* Botón + */}
            <button
              className="stepbtn"
              aria-label="Aumentar dosis"
              style={{ width: 56, height: 56, borderRadius: '50%', border: '1px solid var(--border)', fontSize: 24 }}
              onClick={() => stepDose(1)}
            >
              +
            </button>
          </div>

          {/* Chips de unidad */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
            {UNITS.map((u) => (
              <Chip
                key={u.value}
                label={u.label}
                active={unit === u.value}
                onClick={() => setUnit(u.value)}
              />
            ))}
          </div>
        </div>

        {/* ── Link: calculadora de unidades ── */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <button
            className="btn-ghost sm"
            style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--brand-700)', fontWeight: 500 }}
            onClick={() => dispatch({ t: 'sheet', sheet: 'calc' })}
          >
            <IcDrop size={16} />
            Calculadora de unidades
          </button>
        </div>

        {/* ── Hora de registro ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span className="sm" style={{ color: 'var(--ink-400)' }}>Hora de registro</span>
          <input
            type="text"
            className="field body"
            value={hora}
            onChange={(e) => setHora(e.target.value)}
            onFocus={(e) => { if (e.target.value === 'Ahora') setHora('') }}
            onBlur={(e) => { if (!e.target.value.trim()) setHora('Ahora') }}
            style={{ width: '100%' }}
          />
        </div>

        {/* ── Disclaimer (dose) — guardrail de compliance ── */}
        <Disclaimer kind="dose" />

      </div>

      {/* ── CTA fijo al fondo ── */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        padding: '16px 20px 24px',
        background: 'linear-gradient(to top, var(--card) 80%, transparent)',
      }}>
        <button
          className="btn btn-brand"
          style={{ width: '100%', height: 52, borderRadius: 16, fontSize: 16, fontWeight: 600 }}
          onClick={handleSave}
        >
          Guardar registro
        </button>
      </div>

    </Sheet>
  )
}
