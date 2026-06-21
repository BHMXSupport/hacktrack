// CalcSheet v2 — calculadora de unidades / reconstitución
// Design system "Precision × Accessible". Reutiliza calc.ts de src/lib/.
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
import type { SyringeScale } from '../../lib/types'

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

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <Sheet open={open} onClose={onClose} title="Calculadora de reconstitución">
      <div className="flex flex-col gap-5">

        {/* Descripción */}
        <p className="text-[13px] text-muted-foreground">
          Ingresa los datos de tu vial y tu dosis para convertir a unidades de dispositivo.
        </p>

        {/* Mis viales guardados (item 324) */}
        {savedRecons.length > 0 && (
          <div className="flex flex-col gap-2">
            <button
              type="button"
              className="flex min-h-[44px] items-center gap-1.5 text-[13px] font-semibold text-teal"
              onClick={() => setShowSaved((v) => !v)}
            >
              {showSaved ? '▲' : '▼'} Mis viales ({savedRecons.length})
            </button>
            {showSaved && (
              <div className="flex flex-col gap-2">
                {savedRecons.map((rec) => (
                  <div
                    key={rec.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-raised px-4 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold text-foreground">{rec.label}</p>
                      <p className="text-[12px] font-mono text-muted-foreground">{rec.vialMg} mg / {rec.aguaMl} mL</p>
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
          <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground" htmlFor="calc-vial">
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
            className="h-11 w-full rounded-lg border border-white/10 bg-raised px-3 font-mono text-[15px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-teal/50"
          />
        </div>

        {/* ── Campo: Agua (mL) ── */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground" htmlFor="calc-agua">
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
            className="h-11 w-full rounded-lg border border-white/10 bg-raised px-3 font-mono text-[15px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-teal/50"
          />
        </div>

        {/* Guardar reconstitución (item 324) */}
        {vial > 0 && agua > 0 && (
          <div>
            {!showSaveForm ? (
              <button
                type="button"
                className="text-[13px] font-semibold text-teal min-h-[44px] flex items-center gap-1"
                onClick={() => setShowSaveForm(true)}
              >
                + Guardar esta reconstitución
              </button>
            ) : (
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Nombre (ej. BPC 157 10mg)"
                  value={saveLabel}
                  onChange={(e) => setSaveLabel(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveRecon()}
                  autoFocus
                  className="h-11 flex-1 rounded-lg border border-white/10 bg-raised px-3 text-[14px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-teal/50"
                />
                <Button variant="primary" size="sm" onClick={handleSaveRecon} disabled={!saveLabel.trim()}>
                  Guardar
                </Button>
                <Button variant="ghost" size="sm" aria-label="Cancelar" onClick={() => setShowSaveForm(false)}>
                  <X size={14} />
                </Button>
              </div>
            )}
          </div>
        )}

        {/* ── Campo: Tu dosis + unidad ── */}
        <div className="flex flex-col gap-2">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground" htmlFor="calc-dosis">
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
            className="h-11 w-full rounded-lg border border-white/10 bg-raised px-3 font-mono text-[15px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-teal/50"
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
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Dispositivo
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
                    'flex flex-1 min-h-[48px] flex-col items-center justify-center gap-0.5 rounded-lg border px-2 py-2 transition-all text-center',
                    isActive
                      ? 'border-teal/60 bg-teal/10 text-teal'
                      : 'border-white/10 bg-raised text-muted-foreground',
                  ].join(' ')}
                >
                  <span className="text-[13px] font-bold leading-none">{p.label}</span>
                  <span className="text-[11px] leading-none opacity-70">{p.sub}</span>
                </button>
              )
            })}
          </div>

          {/* Modo pluma: factor clics → mg */}
          {plumaMode && (
            <div className="flex flex-col gap-2 rounded-lg border border-white/10 bg-raised/60 p-3">
              <p className="text-[12px] text-muted-foreground">
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
                  className="h-11 flex-1 rounded-lg border border-white/10 bg-raised px-3 text-center font-mono text-[16px] font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-teal/50"
                />
                <span className="text-[13px] font-semibold text-muted-foreground shrink-0">mg / clic</span>
              </div>
              {plumaResult != null && (
                <p className="text-center font-mono text-[14px] font-bold text-teal">
                  {dosis} clics = {plumaResult < 1 ? plumaResult.toFixed(3) : plumaResult.toFixed(2)} mg
                </p>
              )}
              <p className="text-[11px] text-muted-foreground/60">
                Factor orientativo — verifica la concentración en tu dispositivo. No es consejo médico.
              </p>
            </div>
          )}
        </div>

        {/* ── Resultado ── */}
        {r ? (
          <DataPlate className="flex flex-col items-center gap-2 py-6 text-center">
            <span
              className="font-mono text-[52px] font-bold tabular-nums leading-none"
              style={{ color: r.overCapacity ? 'var(--alert, #ef4444)' : 'var(--teal-bright, #5FC9B8)' }}
            >
              {r.ui} UI
            </span>
            <span className="text-[13px] text-muted-foreground leading-snug">
              ≈ {r.mL} mL · {r.conc} mg/mL
              <br />
              U-100
            </span>

            {r.overCapacity && (
              <p className="flex items-center gap-1.5 text-[13px] font-semibold text-alert mt-1">
                <AlertTriangle size={14} aria-hidden className="shrink-0" />
                No cabe en una {r.scale} U — prueba con un barril mayor.
              </p>
            )}
            {!r.overCapacity && r.lowPrecision && (
              <p className="flex items-center gap-1.5 text-[13px] text-yellow-400 mt-1">
                <AlertTriangle size={14} aria-hidden className="shrink-0" />
                Menos de 5 UI: difícil de medir con precisión.
              </p>
            )}

            {/* Advertencia de rango (item 409) */}
            {rangeWarning && (
              <div className="mt-2 w-full rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-left">
                <p className="flex items-center gap-1.5 text-[12px] font-semibold text-yellow-400">
                  <AlertTriangle size={13} aria-hidden className="shrink-0" />
                  Volumen fuera del rango habitual ({rangeMin}–{rangeMax} mL)
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Verifica tu reconstitución. No es consejo médico.
                </p>
              </div>
            )}
          </DataPlate>
        ) : (
          <DataPlate className="py-8 text-center">
            <span className="text-[14px] text-muted-foreground">
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
        <p className="text-center text-[11px] text-muted-foreground/60 leading-relaxed">
          Esta calculadora convierte la dosis que tú ingresas. No recomienda dosis ni es consejo médico.
        </p>

      </div>
    </Sheet>
  )
}
