// Calculadora de unidades — bottom-sheet.
// Items: 322 (precargar reconstitución por producto), 323 (persistir borrador entre sesiones),
//        324 (historial de reconstituciones guardadas), 409 (validación de rango no-médica),
//        426 (selector visual de jeringa con siluetas + preset pluma)
import { useState, useEffect, useRef } from 'react'
import { Sheet } from '../components/Sheet'
import { Segmented, Disclaimer } from '../components/controls'
import { IcDrop } from '../components/icons'
import { Glyph } from '../components/glyphs'
import { useApp } from '../lib/store'
import { calcRecon, copyToRegisterToast } from '../lib/calc'
import type { SyringeScale } from '../lib/types'

const UNIT_OPTIONS = [
  { value: 'mg' as const, label: 'mg' },
  { value: 'mcg' as const, label: 'mcg' },
]

// item 426: presets visuales de jeringa (incluyendo pluma dosificadora)
interface SyringePreset {
  id: SyringeScale | 'pluma'
  label: string
  sublabel: string
  capacityUI: number | null
  svgPath: string  // silueta simplificada (viewBox 0 0 32 80)
}

const SYRINGE_PRESETS: SyringePreset[] = [
  {
    id: 30, label: '30 U', sublabel: '0.3 mL', capacityUI: 30,
    svgPath: 'M14 4h4v2h2l1 8H11l1-8h2V4zM12 14v42H20V14H12z',
  },
  {
    id: 50, label: '50 U', sublabel: '0.5 mL', capacityUI: 50,
    svgPath: 'M13 4h6v2h3l1 8H9l1-8h3V4zM11 14v52H21V14H11z',
  },
  {
    id: 100, label: '100 U', sublabel: '1 mL', capacityUI: 100,
    svgPath: 'M12 4h8v2h3l1 8H8l1-8h3V4zM10 14v62H22V14H10z',
  },
  {
    // item 426: pluma dosificadora — cada clic ≈ mg por factor configurable
    id: 'pluma', label: 'Pluma', sublabel: 'Clics', capacityUI: null,
    svgPath: 'M14 2h4l2 4v60l-2 4h-4l-2-4V6l2-4zM12 10h8M12 58h8',
  },
]

// Conversión de clics de pluma a mg (factor configurable; por defecto Ozempic: 1 clic = 0.25 mg)
const DEFAULT_CLIC_MG = 0.25

// item 409: rangos razonables de volumen en mL por producto (orientativo, no médico)
const REASONABLE_VOL_ML: Record<string, [number, number]> = {
  'BPC 157': [0.05, 0.5],
  'TB-500': [0.05, 1.0],
  'Semaglutida': [0.05, 0.5],
  'Retatrutide': [0.05, 0.5],
  'Tirzepatida': [0.05, 0.5],
  'GHK-Cu': [0.02, 0.3],
  'Ipamorelin': [0.05, 0.5],
  'CJC-1295': [0.05, 0.5],
}
const DEFAULT_REASONABLE: [number, number] = [0.01, 2.0]

// La calculadora SOLO convierte la dosis que el usuario teclea (P0-6, guardrail de compliance).
export function CalcSheet() {
  const { state, dispatch } = useApp()

  // item 323: sembrar desde borrador guardado
  const draft = state.calcDraft
  const [vialStr, setVialStr]   = useState(draft?.vialStr ?? '')
  const [aguaStr, setAguaStr]   = useState(draft?.aguaStr ?? '')
  const [dosisStr, setDosisStr] = useState(draft?.dosisStr ?? '')
  const [unit, setUnit]         = useState<'mg' | 'mcg'>(
    (draft?.unit === 'mg' || draft?.unit === 'mcg') ? draft.unit : 'mg'
  )

  // item 426: modo pluma (local, no persiste en store — SyringeScale no admite 'pluma')
  const [plumaMode, setPlumaMode] = useState(false)
  const [clicMgStr, setClicMgStr] = useState(String(DEFAULT_CLIC_MG))

  // item 324: nombre para guardar una reconstitución
  const [saveLabel, setSaveLabel] = useState('')
  const [showSaveForm, setShowSaveForm] = useState(false)
  const [showSavedList, setShowSavedList] = useState(false)

  // item 322: si hay producto activo, precargar su reconstitución recordada
  useEffect(() => {
    if (draft) return  // ya hay borrador, no pisar
    const product = state.protocol?.product ?? state.activeProduct
    if (!product) return
    const rec = state.productRecon[product]
    if (rec) {
      setVialStr(String(rec.vialMg))
      setAguaStr(String(rec.aguaMl))
      // precargar label sugerida
      setSaveLabel(product)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // item 323: debounce para persistir borrador
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      dispatch({ t: 'setCalcDraft', draft: { vialStr, aguaStr, dosisStr, unit } })
    }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [vialStr, aguaStr, dosisStr, unit, dispatch])

  const vial  = parseFloat(vialStr)
  const agua  = parseFloat(aguaStr)
  const dosis = parseFloat(dosisStr)

  // item 426: pluma — resultado en mg (después de parsear dosis)
  const clicMg = parseFloat(clicMgStr) || DEFAULT_CLIC_MG
  const plumaResult = plumaMode && dosis > 0 ? dosis * clicMg : null

  // normaliza escala persistida vieja → 100 por defecto
  const scale: SyringeScale = ([30, 50, 100] as number[]).includes(state.scale) ? state.scale : 100
  const r = calcRecon({ vial, agua, dosis, unit, scale })

  // item 409: validación de rango (orientativa, no médica)
  const product = state.protocol?.product ?? state.activeProduct ?? ''
  const [rangeMin, rangeMax] = REASONABLE_VOL_ML[product] ?? DEFAULT_REASONABLE
  const volMl = r?.mL ?? null
  const rangeWarning = r && volMl != null && (volMl < rangeMin || volMl > rangeMax)

  function handleCopy() {
    if (!r) return
    // limpiar borrador al copiar (item 323)
    dispatch({ t: 'setCalcDraft', draft: null })
    dispatch({ t: 'setDraftDose', draft: { value: r.ui, unit: 'UI', recon: { vialMg: vial, aguaMl: agua } } })
    dispatch({ t: 'toast', msg: copyToRegisterToast(r) })
    dispatch({ t: 'sheet', sheet: 'registrar' })
  }

  function handleSaveRecon() {
    const lbl = saveLabel.trim()
    if (!lbl || !vial || !agua) return
    dispatch({ t: 'saveRecon', entry: { label: lbl, vialMg: vial, aguaMl: agua, createdAt: Date.now() } })
    dispatch({ t: 'toast', msg: `Reconstitución "${lbl}" guardada` })
    setShowSaveForm(false)
  }

  function loadSavedRecon(rec: { vialMg: number; aguaMl: number; label: string }) {
    setVialStr(String(rec.vialMg))
    setAguaStr(String(rec.aguaMl))
    setSaveLabel(rec.label)
    setShowSavedList(false)
    dispatch({ t: 'toast', msg: `Cargado: ${rec.label}` })
  }

  const savedRecons = state.savedRecons ?? []

  return (
    <Sheet title="Calculadora de reconstitución" onClose={() => dispatch({ t: 'sheet', sheet: 'registrar' })}>
      <div style={{ padding: '0 20px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Encabezado */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--ink-700)' }}>
          <IcDrop size={20} />
          <span className="sm" style={{ color: 'var(--ink-400)' }}>
            Ingresa los datos de tu reconstitución y tu dosis para convertir a unidades de jeringa.
          </span>
        </div>

        {/* item 324: Mis viales guardados */}
        {savedRecons.length > 0 && (
          <div>
            <button className="btn-ghost sm" style={{ color: 'var(--brand-700)', fontWeight: 600, marginBottom: 4 }}
              onClick={() => setShowSavedList((v) => !v)}>
              {showSavedList ? '▲ Ocultar mis viales' : `▼ Mis viales (${savedRecons.length})`}
            </button>
            {showSavedList && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {savedRecons.map((rec) => (
                  <div key={rec.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 14px', borderRadius: 'var(--r-sm)',
                    background: 'var(--card)', border: '1px solid var(--border)',
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p className="sm" style={{ margin: 0, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rec.label}</p>
                      <p className="sm" style={{ margin: 0, color: 'var(--ink-400)' }}>{rec.vialMg} mg / {rec.aguaMl} mL</p>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                      <button className="btn btn-outline btn-sm" style={{ width: 'auto', padding: '0 10px' }}
                        onClick={() => loadSavedRecon(rec)}>
                        Usar
                      </button>
                      <button className="btn btn-ghost btn-sm" style={{ width: 'auto', padding: '0 10px', color: 'var(--error)' }}
                        onClick={() => dispatch({ t: 'deleteRecon', id: rec.id })}
                        aria-label={`Borrar ${rec.label}`}>
                        <Glyph name="cross" size={14} color="currentColor" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Campo: Vial (mg) */}
        <div>
          <label className="label" htmlFor="calc-vial">Vial (mg)</label>
          <input id="calc-vial" className="field" type="number" inputMode="decimal" min="0" placeholder="ej. 10"
            value={vialStr} onChange={(e) => setVialStr(e.target.value)} />
        </div>

        {/* Campo: Agua (mL) */}
        <div>
          <label className="label" htmlFor="calc-agua">Agua (mL)</label>
          <input id="calc-agua" className="field" type="number" inputMode="decimal" min="0" placeholder="ej. 2"
            value={aguaStr} onChange={(e) => setAguaStr(e.target.value)} />
        </div>

        {/* item 324: guardar reconstitución */}
        {vial > 0 && agua > 0 && (
          <div>
            {!showSaveForm ? (
              <button className="btn-ghost sm" style={{ color: 'var(--brand-700)' }}
                onClick={() => setShowSaveForm(true)}>
                + Guardar esta reconstitución
              </button>
            ) : (
              <div style={{ display: 'flex', gap: 8 }}>
                <input className="field sm" placeholder="Nombre (ej. BPC 157 10mg)" value={saveLabel}
                  onChange={(e) => setSaveLabel(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveRecon()}
                  style={{ flex: 1 }} autoFocus />
                <button className="btn btn-brand btn-sm" onClick={handleSaveRecon}
                  disabled={!saveLabel.trim()}>
                  Guardar
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => setShowSaveForm(false)} aria-label="Cancelar">
                  <Glyph name="cross" size={14} color="currentColor" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Campo: Tu dosis + selector de unidad */}
        <div>
          <label className="label" htmlFor="calc-dosis">Tu dosis</label>
          <input id="calc-dosis" className="field" type="number" inputMode="decimal" min="0" placeholder="ej. 0.5"
            value={dosisStr} onChange={(e) => setDosisStr(e.target.value)} />
          <div style={{ marginTop: 10 }}>
            <Segmented options={UNIT_OPTIONS} value={unit} onChange={setUnit} />
          </div>
        </div>

        {/* item 426: selector visual de jeringa con siluetas SVG + preset pluma */}
        <div>
          <p className="label" style={{ marginBottom: 10 }}>
            Dispositivo <span style={{ color: 'var(--ink-300)', fontWeight: 400 }}>· jeringa o pluma</span>
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            {SYRINGE_PRESETS.map((p) => {
              const isPluma = p.id === 'pluma'
              const isActive = isPluma ? plumaMode : (!plumaMode && scale === p.id)
              return (
                <button key={String(p.id)}
                  onClick={() => {
                    if (isPluma) {
                      setPlumaMode(true)
                    } else {
                      setPlumaMode(false)
                      dispatch({ t: 'setScale', scale: p.id as SyringeScale })
                    }
                  }}
                  style={{
                    flex: 1, minWidth: 0, padding: '8px 4px', borderRadius: 'var(--r-sm)',
                    border: isActive ? '2px solid var(--brand-700)' : '1.5px solid var(--border)',
                    background: isActive ? 'color-mix(in srgb, var(--brand-700) 8%, transparent)' : 'var(--card)',
                    cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                    transition: 'all .12s',
                  }}
                  aria-pressed={isActive}>
                  {/* silueta SVG simplificada de jeringa/pluma */}
                  <svg width="20" height="40" viewBox="0 0 32 80" fill="none" aria-hidden="true"
                    style={{ opacity: isActive ? 1 : 0.4 }}>
                    {isPluma ? (
                      /* silueta de pluma dosificadora */
                      <>
                        <rect x="12" y="2" width="8" height="62" rx="4" fill={isActive ? 'var(--brand-300)' : 'var(--ink-100)'} />
                        <rect x="14" y="62" width="4" height="10" rx="2" fill="var(--ink-300)" />
                        <rect x="11" y="8" width="10" height="2" rx="1" fill="var(--brand-700)" opacity="0.5" />
                        <rect x="11" y="20" width="10" height="2" rx="1" fill="var(--brand-700)" opacity="0.5" />
                        <rect x="11" y="32" width="10" height="2" rx="1" fill="var(--brand-700)" opacity="0.5" />
                      </>
                    ) : (
                      /* silueta de jeringa */
                      <>
                        <rect x="12" y="0" width="8" height="4" rx="1" fill="var(--brand-700)" />
                        <rect x="10" y="4" width="12" height={p.id === 30 ? 42 : p.id === 50 ? 52 : 62} rx="2" fill={isActive ? 'var(--brand-300)' : 'var(--ink-100)'} />
                        <rect x="14" y={4 + (p.id === 30 ? 42 : p.id === 50 ? 52 : 62)} width="4" height="10" rx="1" fill="var(--ink-300)" />
                      </>
                    )}
                  </svg>
                  <span className="sm" style={{ fontWeight: 600, color: isActive ? 'var(--brand-700)' : 'var(--ink-700)', whiteSpace: 'nowrap' }}>
                    {p.label}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--ink-400)', whiteSpace: 'nowrap' }}>{p.sublabel}</span>
                </button>
              )
            })}
          </div>

          {/* item 426: modo pluma — campo de factor clics→mg */}
          {plumaMode && (
            <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 'var(--r-sm)', background: 'var(--card)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <p className="sm" style={{ margin: 0, color: 'var(--ink-400)' }}>
                Pluma dosificadora — cada clic equivale a:
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input className="field mono" type="number" inputMode="decimal" min="0.01" step="0.01" placeholder="0.25"
                  value={clicMgStr} onChange={(e) => setClicMgStr(e.target.value)}
                  style={{ flex: 1, fontSize: 16, fontWeight: 700, textAlign: 'center' }} />
                <span className="sm" style={{ color: 'var(--ink-700)', fontWeight: 600 }}>mg / clic</span>
              </div>
              {plumaResult != null && (
                <p className="sm mono" style={{ margin: 0, color: 'var(--brand-700)', fontWeight: 700, textAlign: 'center' }}>
                  {dosis} clics = {plumaResult < 1 ? plumaResult.toFixed(3) : plumaResult.toFixed(2)} mg
                </p>
              )}
              <p style={{ margin: 0, fontSize: 10, color: 'var(--ink-300)' }}>
                Factor orientativo — verifica la concentración en tu dispositivo. No es consejo médico.
              </p>
            </div>
          )}
        </div>

        {/* Resultado */}
        {r ? (
          <div className="card"
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '24px 20px', background: 'var(--card)', textAlign: 'center' }}>
            <span className="mono display-l"
              style={{ fontSize: 48, fontWeight: 700, color: r.overCapacity ? 'var(--error)' : 'var(--brand-700)', lineHeight: 1 }}>
              {r.ui} UI
            </span>
            <span className="sm" style={{ color: 'var(--ink-400)', textAlign: 'center', maxWidth: '100%', lineHeight: 1.5 }}>
              ≈ {r.mL} mL · {r.conc} mg/mL
              <br />U-100
            </span>
            {r.overCapacity && (
              <span className="sm" style={{ color: 'var(--error)', fontWeight: 600, marginTop: 6 }}>
                No cabe en una jeringa de {r.scale} U.
              </span>
            )}
            {!r.overCapacity && r.lowPrecision && (
              <span className="sm" style={{ color: 'var(--warning-ink)', marginTop: 6 }}>
                Menos de 5 UI: difícil de medir con precisión.
              </span>
            )}

            {/* item 409: validación de rango orientativa */}
            {rangeWarning && (
              <div style={{
                marginTop: 10, padding: '8px 12px', borderRadius: 'var(--r-sm)', textAlign: 'left',
                background: 'color-mix(in srgb, var(--warning) 10%, transparent)',
                border: '1px solid color-mix(in srgb, var(--warning) 40%, transparent)',
              }}>
                <p className="sm" style={{ margin: 0, fontWeight: 700, color: 'var(--warning-ink)' }}>
                  Volumen fuera del rango habitual ({rangeMin}–{rangeMax} mL)
                </p>
                <p className="sm" style={{ margin: '4px 0 0', color: 'var(--ink-400)' }}>
                  Verifica tu reconstitución — puede haber un error en los datos. No es consejo médico.
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="card"
            style={{ padding: '24px 20px', textAlign: 'center', background: 'var(--card)', color: 'var(--ink-300)' }}>
            <span className="body">Ingresa vial, agua y tu dosis para ver el resultado.</span>
          </div>
        )}

        {/* CTA */}
        <button className="btn btn-brand" disabled={!r} onClick={handleCopy}
          style={{ width: '100%', opacity: r ? 1 : 0.4 }}>
          Copiar a mi registro
        </button>

        <Disclaimer kind="calc" />
      </div>
    </Sheet>
  )
}
