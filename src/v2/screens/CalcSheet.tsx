// CalcSheet v2 — calculadora de unidades / reconstitución
// Design system "Bitácora" (papel-y-tinta editorial). Reutiliza calc.ts de src/lib/.
// "Copiar a mi registro" → dispatch setDraftDose y abre 'registrar'.
// Compliance: la calculadora SOLO convierte la dosis que el usuario teclea; no la decide.
import { useState, useEffect, useRef } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { useApp } from '../../lib/store'
import { calcRecon, copyToRegisterToast } from '../../lib/calc'
import { Sheet } from '../ui/Sheet'
import { Button } from '../ui/Button'
import { DataPlate } from '../ui/DataPlate'
import { Chip } from '../ui/Chip'
import { TermInfo } from '../ui/TermInfo'
import { useModalStack } from '../ui/modalStack'
import { STORE_BUILD } from '../../lib/buildFlags'
import type { SyringeScale } from '../../lib/types'

// ── Clases compartidas "Bitácora" (solo presentación) ─────────────────────────
const KICKER = 'font-mono text-[12px] font-medium uppercase tracking-[0.16em] text-ink-2'
const LABEL = 'font-mono text-[12px] font-medium uppercase tracking-[0.08em] text-ink-2'
// Campo cálido; foco azul-tinta (color-mix porque el alfa sobre var() no se emite en este setup).
const FIELD =
  'rounded-[8px] border border-hairline bg-raised px-3 text-[15px] text-ink placeholder:text-ink-3 focus:outline-none focus:border-blue focus:ring-2 focus:ring-[color-mix(in_srgb,var(--blue)_30%,transparent)]'

// ── Interstitial de tienda (solo STORE_BUILD) ─────────────────────────────────
// Aviso de uso-de-investigación UNA vez por sesión, ANTES del primer uso de la
// calculadora. sessionStorage (no UserSettings): es por-sesión por diseño y no
// arrastra migración de esquema. En la PWA este bloque es código muerto (se elimina).
const CALC_ACK_SESSION_KEY = 'hacktrack:calcAckSession'
function calcAckPending(): boolean {
  if (!STORE_BUILD) return false
  try { return sessionStorage.getItem(CALC_ACK_SESSION_KEY) !== '1' } catch { return true /* modo privado: mostrar */ }
}

// ── Tipos ──────────────────────────────────────────────────────────────────────

type DosisUnit = 'mg' | 'mcg'

// Presets de dispositivo (íconos neutrales, sin jeringas visibles como producto)
interface DevicePreset {
  id: SyringeScale | 'pluma'
  label: string
  sub: string
}

const DEVICE_PRESETS: DevicePreset[] = [
  { id: 30,      label: '30 U',  sub: '0.3 mL' },
  { id: 50,      label: '50 U',  sub: '0.5 mL' },
  { id: 100,     label: '100 U', sub: '1 mL'   },
  { id: 'pluma', label: 'Pluma', sub: 'Clics'  },
]

const DEFAULT_CLIC_MG = 0.25

// Rangos razonables de volumen por producto (orientativo, no médico)
const REASONABLE_VOL_ML: Record<string, [number, number]> = {
  'BPC-157':      [0.05, 0.5],
  'TB-500':       [0.05, 1.0],
  'Semaglutida':  [0.05, 0.5],
  'Retatrutide':  [0.05, 0.5],
  'Tirzepatida':  [0.05, 0.5],
  'GHK-Cu':       [0.02, 0.3],
  'Ipamorelin':   [0.05, 0.5],
  'CJC-1295':     [0.05, 0.5],
  'Tesamorelin':  [0.1,  1.0],
  'MOTS-c':       [0.05, 1.0],
  '5-Amino-1MQ':  [0.05, 1.0],
  'SLU-PP-332':   [0.05, 1.0],
  'ARA 290':      [0.05, 1.0],
  'GLOW 70':      [0.05, 1.0],
  'KLOW 80':      [0.05, 1.0],
  'SS-31':        [0.05, 1.0],
  'L-Glutathione':[0.05, 1.0],
  'Semax':        [0.05, 1.0],
  'Selank':       [0.05, 1.0],
  'DSIP':         [0.05, 1.0],
  'Oxytocin':     [0.05, 1.0],
  'Kisspeptin-10':[0.05, 1.0],
  'PT-141':       [0.05, 1.0],
}
const DEFAULT_RANGE: [number, number] = [0.01, 2.0]

// ── Componente ─────────────────────────────────────────────────────────────────

export function CalcSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, dispatch } = useApp()

  // Sembrar desde borrador guardado en store (item 323)
  const draft = state.calcDraft
  const [vialStr, setVialStr]   = useState(draft?.vialStr   ?? '')
  const [aguaStr, setAguaStr]   = useState(draft?.aguaStr   ?? '')
  const [dosisStr, setDosisStr] = useState(draft?.dosisStr  ?? '')
  const [unit, setUnit]         = useState<DosisUnit>(
    (draft?.unit === 'mg' || draft?.unit === 'mcg') ? draft.unit : 'mg',
  )

  // Modo pluma
  const [plumaMode, setPlumaMode] = useState(draft?.plumaMode ?? false)
  const [clicMgStr, setClicMgStr] = useState(draft?.clicMgStr ?? String(DEFAULT_CLIC_MG))

  // Mis viales guardados
  const [showSaved, setShowSaved] = useState(false)
  const [showSaveForm, setShowSaveForm] = useState(false)
  const [saveLabel, setSaveLabel] = useState('')

  // Interstitial de tienda: pendiente hasta "Entendido" (una vez por sesión).
  const [ackPending, setAckPending] = useState(calcAckPending)
  const acknowledge = () => {
    try { sessionStorage.setItem(CALC_ACK_SESSION_KEY, '1') } catch { /* modo privado */ }
    setAckPending(false)
  }
  // En la pila modal DESPUÉS del Sheet (efecto del padre corre tras el del hijo) →
  // Escape descarta el interstitial (equivale a "Entendido"), no la hoja completa.
  useModalStack(open && STORE_BUILD && ackPending, acknowledge)

  // Precargar reconstitución recordada del producto activo (item 322)
  useEffect(() => {
    if (draft) return
    const product = state.protocol?.product ?? state.activeProduct
    if (!product) return
    const rec = state.productRecon[product]
    if (rec) {
      setVialStr(String(rec.vialMg))
      setAguaStr(String(rec.aguaMl))
      setSaveLabel(product)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Persistir borrador con debounce (item 323)
  const debRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (debRef.current) clearTimeout(debRef.current)
    debRef.current = setTimeout(() => {
      dispatch({ t: 'setCalcDraft', draft: { vialStr, aguaStr, dosisStr, unit, plumaMode, clicMgStr } })
    }, 300)
    return () => { if (debRef.current) clearTimeout(debRef.current) }
  }, [vialStr, aguaStr, dosisStr, unit, plumaMode, clicMgStr, dispatch])

  // Reset al cerrar
  useEffect(() => {
    if (!open) {
      setShowSaved(false)
      setShowSaveForm(false)
    }
  }, [open])

  // ── Cálculos ─────────────────────────────────────────────────────────────────

  const vial  = parseFloat(vialStr)
  const agua  = parseFloat(aguaStr)
  const dosis = parseFloat(dosisStr)

  const scale: SyringeScale = ([30, 50, 100] as number[]).includes(state.scale) ? state.scale : 100
  const r = calcRecon({ vial, agua, dosis, unit, scale })

  const clicMg = parseFloat(clicMgStr) || DEFAULT_CLIC_MG
  const plumaResult = plumaMode && dosis > 0 ? dosis * clicMg : null

  // Validación de rango (item 409)
  const product = state.protocol?.product ?? state.activeProduct ?? ''
  const [rangeMin, rangeMax] = REASONABLE_VOL_ML[product] ?? DEFAULT_RANGE
  const volMl = r?.mL ?? null
  const rangeWarning = r && volMl != null && (volMl < rangeMin || volMl > rangeMax)

  // ── Acciones ─────────────────────────────────────────────────────────────────

  function handleCopy() {
    // #11: modo pluma — calcRecon (r) es null, pero plumaResult (mg) sí existe; copiarlo como mg.
    if (plumaMode) {
      if (plumaResult == null) return
      dispatch({ t: 'setCalcDraft', draft: null })
      dispatch({ t: 'setDraftDose', draft: { value: Math.round(plumaResult * 1000) / 1000, unit: 'mg' } })
      dispatch({ t: 'toast', msg: 'Dosis copiada a tu registro' })
      dispatch({ t: 'sheet', sheet: 'registrar' })
      return
    }
    if (!r) return
    dispatch({ t: 'setCalcDraft', draft: null })
    dispatch({
      t: 'setDraftDose',
      draft: { value: r.ui, unit: 'UI', recon: { vialMg: vial, aguaMl: agua } },
    })
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

  function loadSaved(rec: { vialMg: number; aguaMl: number; label: string }) {
    setVialStr(String(rec.vialMg))
    setAguaStr(String(rec.aguaMl))
    setSaveLabel(rec.label)
    setShowSaved(false)
    dispatch({ t: 'toast', msg: `Cargado: ${rec.label}` })
  }

  const savedRecons = state.savedRecons ?? []

  // debt-102: saveRecon fusiona por nombre — si ya existe una reconstitución con esta etiqueta y
  // otros valores, el guardado la REEMPLAZA. Hacerlo explícito en el botón en vez de pisar en silencio.
  const existingRecon = savedRecons.find((r) => r.label.toLowerCase() === saveLabel.trim().toLowerCase())
  const wouldOverwrite = !!existingRecon && (existingRecon.vialMg !== vial || existingRecon.aguaMl !== agua)

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <Sheet open={open} onClose={onClose} title="Calculadora de reconstitución">
      {STORE_BUILD && ackPending ? (
        /* Interstitial de tienda: sustituye el contenido hasta "Entendido" — la calculadora
           no se usa sin ver el aviso. En la PWA esta rama es código muerto (eliminada). */
        <div className="flex flex-col gap-5 py-2">
          <p className="text-[15px] leading-relaxed text-ink-2">
            Esta calculadora solo hace aritmética (reconstitución/conversión) con los datos que tú
            ingresas. No recomienda ni sugiere dosis.
          </p>
          <Button variant="primary" size="full" onClick={acknowledge}>
            Entendido
          </Button>
        </div>
      ) : (
      <div className="flex flex-col gap-5">

        {/* Descripción */}
        <p className="text-[14px] text-ink-2">
          Ingresa los datos de tu vial y tu dosis para convertir a unidades de dispositivo.
        </p>

        {/* Mis viales guardados (item 324) */}
        {savedRecons.length > 0 && (
          <div className="flex flex-col gap-2">
            <button
              type="button"
              className="flex min-h-[44px] items-center gap-1.5 text-[13px] font-semibold text-blue"
              onClick={() => setShowSaved((v) => !v)}
            >
              {showSaved ? '▲' : '▼'} Mis viales ({savedRecons.length})
            </button>
            {showSaved && (
              <div className="flex flex-col gap-2">
                {savedRecons.map((rec) => (
                  <div
                    key={rec.id}
                    className="flex items-center justify-between gap-3 rounded-sm border border-hairline bg-raised px-4 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      {/* Nombre del vial en serif (la voz editorial de los productos) */}
                      <p className="truncate font-serif text-[16px] font-medium leading-tight text-ink">{rec.label}</p>
                      <p className="mt-0.5 font-mono text-[12px] tabular-nums text-ink-2">{rec.vialMg} mg / {rec.aguaMl} mL</p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button variant="outline" size="sm" onClick={() => loadSaved(rec)}>
                        Usar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Borrar ${rec.label}`}
                        onClick={() => dispatch({ t: 'deleteRecon', id: rec.id })}
                        className="text-alert"
                      >
                        <X size={14} />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Campo: Vial (mg) ── */}
        <div className="flex flex-col gap-1.5">
          <label className={LABEL} htmlFor="calc-vial">
            Vial (mg)
          </label>
          <input
            id="calc-vial"
            type="number"
            inputMode="decimal"
            min="0"
            placeholder="ej. 10"
            value={vialStr}
            onChange={(e) => setVialStr(e.target.value)}
            className={`h-11 w-full font-mono tabular-nums ${FIELD}`}
          />
        </div>

        {/* ── Campo: Agua (mL) ── */}
        <div className="flex flex-col gap-1.5">
          <label className={LABEL} htmlFor="calc-agua">
            Agua (mL)
          </label>
          <input
            id="calc-agua"
            type="number"
            inputMode="decimal"
            min="0"
            placeholder="ej. 2"
            value={aguaStr}
            onChange={(e) => setAguaStr(e.target.value)}
            className={`h-11 w-full font-mono tabular-nums ${FIELD}`}
          />
        </div>

        {/* Guardar reconstitución (item 324) */}
        {vial > 0 && agua > 0 && (
          <div>
            {!showSaveForm ? (
              <button
                type="button"
                className="flex min-h-[44px] items-center gap-1 text-[13px] font-semibold text-blue"
                onClick={() => setShowSaveForm(true)}
              >
                + Guardar esta reconstitución
              </button>
            ) : (
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Nombre (ej. BPC 157 10mg)"
                    value={saveLabel}
                    onChange={(e) => setSaveLabel(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveRecon()}
                    autoFocus
                    className={`h-11 flex-1 ${FIELD}`}
                  />
                  <Button variant="primary" size="sm" onClick={handleSaveRecon} disabled={!saveLabel.trim()}>
                    {wouldOverwrite ? 'Sobrescribir' : 'Guardar'}
                  </Button>
                  <Button variant="ghost" size="sm" aria-label="Cancelar" onClick={() => setShowSaveForm(false)}>
                    <X size={14} />
                  </Button>
                </div>
                {wouldOverwrite && existingRecon && (
                  <p className="flex items-center gap-1.5 text-[13px] text-ink-2">
                    <AlertTriangle size={13} aria-hidden className="shrink-0 text-warn" />
                    Ya tienes "{existingRecon.label}" ({existingRecon.vialMg} mg / {existingRecon.aguaMl} mL) — se reemplazará.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Campo: Tu dosis + unidad ── */}
        <div className="flex flex-col gap-2">
          <label className={LABEL} htmlFor="calc-dosis">
            {plumaMode ? 'Número de clics' : 'Tu dosis'}
          </label>
          <input
            id="calc-dosis"
            type="number"
            inputMode="decimal"
            min="0"
            placeholder={plumaMode ? 'ej. 4 clics' : 'ej. 0.5'}
            value={dosisStr}
            onChange={(e) => setDosisStr(e.target.value)}
            className={`h-11 w-full font-mono tabular-nums ${FIELD}`}
          />
          <div className="flex gap-2">
            {(['mg', 'mcg'] as DosisUnit[]).map((u) => (
              <Chip key={u} active={unit === u && !plumaMode} onClick={() => { setUnit(u); setPlumaMode(false) }}>
                {u}
              </Chip>
            ))}
          </div>
        </div>

        {/* ── Dispositivo ── */}
        <div className="flex flex-col gap-2">
          <p className={`${KICKER} flex items-center gap-1.5`}>
            Dispositivo
            <TermInfo term="U-100">Las marcas de una jeringa de insulina U-100: 100 UI equivalen a 1 mL.</TermInfo>
          </p>
          <div className="flex gap-2">
            {DEVICE_PRESETS.map((p) => {
              const isPluma = p.id === 'pluma'
              const isActive = isPluma ? plumaMode : (!plumaMode && scale === p.id)
              return (
                <button
                  key={String(p.id)}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => {
                    if (isPluma) {
                      setPlumaMode(true)
                    } else {
                      setPlumaMode(false)
                      dispatch({ t: 'setScale', scale: p.id as SyringeScale })
                    }
                  }}
                  className={[
                    'flex flex-1 min-h-[48px] flex-col items-center justify-center gap-0.5 rounded-[8px] border px-2 py-2 transition-colors text-center',
                    isActive
                      ? 'border-blue bg-[color-mix(in_srgb,var(--blue)_8%,transparent)] text-blue'
                      : 'border-hairline bg-raised text-ink-2',
                  ].join(' ')}
                >
                  <span className="text-[13px] font-semibold leading-none">{p.label}</span>
                  <span className="font-mono text-[11px] leading-none opacity-70">{p.sub}</span>
                </button>
              )
            })}
          </div>

          {/* Modo pluma: factor clics → mg */}
          {plumaMode && (
            <div className="flex flex-col gap-2 rounded-sm border border-hairline bg-raised p-3">
              <p className="text-[13px] text-ink-2">
                Pluma dosificadora — cada clic equivale a:
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  inputMode="decimal"
                  min="0.01"
                  step="0.01"
                  placeholder="0.25"
                  value={clicMgStr}
                  onChange={(e) => setClicMgStr(e.target.value)}
                  className={`h-11 flex-1 text-center font-mono text-[16px] font-semibold tabular-nums ${FIELD}`}
                />
                <span className="shrink-0 font-mono text-[12px] font-medium text-ink-2">mg / clic</span>
              </div>
              {plumaResult != null && (
                <p className="text-center font-mono text-[14px] font-semibold tabular-nums text-blue">
                  {dosis} clics = {plumaResult < 1 ? plumaResult.toFixed(3) : plumaResult.toFixed(2)} mg
                </p>
              )}
              <p className="text-[12px] text-ink-2">
                Factor orientativo — verifica la concentración en tu dispositivo. No es consejo médico.
              </p>
            </div>
          )}
        </div>

        {/* ── Resultado — placa de instrumento con numeral SERIF (colores fijos: la placa es oscura en ambos temas) ── */}
        {r ? (
          <DataPlate className="flex flex-col items-center gap-2 py-6 text-center">
            <span
              className="flex items-baseline font-serif text-[52px] font-normal leading-none tabular-nums tracking-[-0.02em]"
              style={{ color: r.overCapacity ? '#F0705C' : '#F2EDE3' }}
            >
              {r.ui}
              <span className="ml-1.5 font-mono text-[14px] font-medium tracking-normal text-[#B4AC9B]">UI</span>
            </span>
            <span className="font-mono text-[13px] leading-snug tabular-nums text-[#B4AC9B]">
              ≈ {r.mL} mL · {r.conc} mg/mL
              <br />
              U-100
            </span>

            {r.overCapacity && (
              <p className="mt-1 flex items-center gap-1.5 font-sans text-[13px] font-semibold text-[#F0705C]">
                <AlertTriangle size={14} aria-hidden className="shrink-0" />
                No cabe en una {r.scale} U — prueba con un barril mayor.
              </p>
            )}
            {!r.overCapacity && r.lowPrecision && (
              <p className="mt-1 flex items-center gap-1.5 font-sans text-[13px] text-[#E8B24A]">
                <AlertTriangle size={14} aria-hidden className="shrink-0" />
                Menos de 5 UI: difícil de medir con precisión.
              </p>
            )}

            {/* Advertencia de rango (item 409) */}
            {rangeWarning && (
              <div className="mt-2 w-full rounded-[8px] border border-[rgba(232,178,74,.35)] bg-[rgba(232,178,74,.10)] px-3 py-2 text-left">
                <p className="flex items-center gap-1.5 font-sans text-[12px] font-semibold text-[#E8B24A]">
                  <AlertTriangle size={13} aria-hidden className="shrink-0" />
                  Volumen fuera del rango habitual ({rangeMin}–{rangeMax} mL)
                </p>
                <p className="mt-0.5 font-sans text-[12px] text-[#B4AC9B]">
                  Verifica tu reconstitución. No es consejo médico.
                </p>
              </div>
            )}
          </DataPlate>
        ) : (
          <DataPlate className="py-8 text-center">
            <span className="font-sans text-[14px] text-[#B4AC9B]">
              Ingresa vial, agua y tu dosis para ver el resultado.
            </span>
          </DataPlate>
        )}

        {/* ── CTA: copiar a mi registro ── */}
        <Button
          variant="primary"
          size="full"
          disabled={plumaMode ? plumaResult == null : !r}
          onClick={handleCopy}
        >
          Copiar a mi registro
        </Button>

        {/* Disclaimer */}
        <p className="text-center text-[12px] leading-relaxed text-ink-2">
          Esta calculadora convierte la dosis que tú ingresas. No recomienda dosis ni es consejo médico.
        </p>

      </div>
      )}
    </Sheet>
  )
}
