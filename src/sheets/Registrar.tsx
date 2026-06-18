// Registrar dosis — bottom-sheet. Un solo archivo, sin props, usa useApp().
// Compliance: sin jeringas (IcDrop/IcLeaf), el usuario teclea su dosis,
// calculadora solo convierte, sin venta in-app, disclaimers presentes.
// Items: 301 (nota libre), 308 (picker con búsqueda + recientes), 309 (step adaptativo + long-press),
//        310 (última dosis), 311 (wizard 3 pasos), 337 (sitio inyección), 424 (fecha reconstitución),
//        428 (toggle unidad inline), 429 (recordar unidad), 430 (chips últimas 3 dosis)
import { useState, useCallback, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { Sheet } from '../components/Sheet'
import { Segmented, Chip, Disclaimer } from '../components/controls'
import { IcDrop } from '../components/icons'
import { Glyph } from '../components/glyphs'
import { TimeWheel } from '../components/TimeWheel'
import { spring, ease } from '../lib/motion'
import { useApp, SITE_OPTIONS_FULL, siteLabel } from '../lib/store'
import { PEPTIDES, WDS } from '../lib/catalog'
import { presetCad, cadenceLabel, fmtTime } from '../lib/cadence'
import { doseToMg, needsRecon } from '../lib/calc'
import { tapHaptic } from '../lib/haptics'
import type { UserCadence, CadMode, InjectionSite } from '../lib/types'

// Unidades disponibles (el usuario elige — NUNCA precargamos dosis)
type DoseUnit = 'UI' | 'clics' | 'mg' | 'mcg' | 'mL'
const UNITS: { value: DoseUnit; label: string }[] = [
  { value: 'UI',   label: 'UI/clics' },
  { value: 'mg',   label: 'mg' },
  { value: 'mcg',  label: 'mcg' },
  { value: 'mL',   label: 'mL' },
]

// Step adaptativo por unidad (item 309)
const UNIT_STEP: Record<DoseUnit, number> = {
  mcg: 50, mg: 0.1, UI: 1, clics: 1, mL: 0.05,
}

const CADENCE_OPTS: { value: CadMode; label: string }[] = [
  { value: 'dia', label: 'Por día' },
  { value: 'sem', label: 'Semana' },
  { value: 'mes', label: 'Mes' },
  { value: 'uso', label: 'Por uso' },
]

// Sitios de inyección disponibles (item 337)
// Nombres completos centralizados (store.SITE_OPTIONS_FULL): "Abdomen izquierdo", etc.
const INJECTION_SITES = SITE_OPTIONS_FULL

function buildProductList(importedProducts: string[]): string[] {
  const catalog = Object.keys(PEPTIDES)
  return [...new Set([...importedProducts, ...catalog])]
}

function parseHora(label: string, todayTs: number): number | undefined {
  if (label === 'Ahora') return undefined
  const m = label.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (!m) return undefined
  let h = parseInt(m[1], 10) % 12
  if (/pm/i.test(m[3])) h += 12
  const d = new Date(todayTs)
  d.setHours(h, parseInt(m[2], 10), 0, 0)
  return d.getTime()
}

// Chip de sitio de inyección sugerido (item 337)
function nextSite(last?: InjectionSite): InjectionSite {
  const sites = INJECTION_SITES.map((s) => s.value)
  if (!last) return sites[0]
  const idx = sites.indexOf(last)
  return sites[(idx + 1) % sites.length]
}

// Obtiene las últimas 3 dosis únicas del producto (item 430)
function lastDoses(
  log: ReturnType<typeof useApp>['state']['log'],
  product: string,
): { value: number; unit: string }[] {
  const seen = new Set<string>()
  const out: { value: number; unit: string }[] = []
  for (const group of log) {
    for (const it of group.items) {
      if (it.type !== 'dose' || it.product !== product || it.value == null) continue
      const key = `${it.value}|${it.unit}`
      if (!seen.has(key)) { seen.add(key); out.push({ value: it.value, unit: it.unit as string }) }
      if (out.length >= 3) return out
    }
  }
  return out
}

// Obtiene la última dosis del producto (item 310)
function lastDoseInfo(
  log: ReturnType<typeof useApp>['state']['log'],
  product: string,
): { value: number | null; unit: string; ts: number } | null {
  for (const group of log) {
    for (const it of group.items) {
      if (it.type === 'dose' && it.product === product) {
        return { value: it.value ?? null, unit: it.unit as string, ts: it.ts }
      }
    }
  }
  return null
}

function fmtRelative(ts: number): string {
  const diff = (Date.now() - ts) / 3600000
  if (diff < 1) return `hace ${Math.round(diff * 60)} min`
  if (diff < 24) return `hace ${Math.round(diff)} h`
  const days = Math.round(diff / 24)
  return `hace ${days} ${days === 1 ? 'día' : 'días'}`
}

// Wizard steps (item 311)
type WizardStep = 'producto' | 'cadencia' | 'dosis'

export function RegistrarSheet() {
  const { state, dispatch } = useApp()

  // ── Producto ──────────────────────────────────────────────────────────────
  const defaultProduct = state.sheetArg ?? state.protocol?.product ?? state.importedProducts[0] ?? ''
  const isWizard = !defaultProduct  // item 311: sin producto → flujo wizard

  const [product, setProduct] = useState<string>(defaultProduct)
  const cadenceLocked = !!product && !!state.protocols[product]
  const [showPicker, setShowPicker] = useState(!defaultProduct)
  const [customProduct, setCustomProduct] = useState('')
  const [pickingCustom, setPickingCustom] = useState(false)

  // item 308: búsqueda de producto
  const [searchQuery, setSearchQuery] = useState('')
  const allProducts = buildProductList(state.importedProducts)
  const recentProducts = (() => {
    const seen = new Set<string>()
    const out: string[] = []
    for (const group of state.log) {
      for (const it of group.items) {
        if (it.type === 'dose' && it.product && !seen.has(it.product)) {
          seen.add(it.product); out.push(it.product)
        }
      }
      if (out.length >= 5) break
    }
    return out.slice(0, 5)
  })()
  const filteredProducts = searchQuery.trim().length > 0
    ? allProducts.filter((p) => p.toLowerCase().includes(searchQuery.toLowerCase()))
    : allProducts

  // item 311: wizard step
  const [wizardStep, setWizardStep] = useState<WizardStep>(isWizard ? 'producto' : 'dosis')

  // ── Cadencia ──────────────────────────────────────────────────────────────
  const seedCad: UserCadence =
    state.protocols[product]?.cadence ?? presetCad(PEPTIDES[product])
  const [localCad, setLocalCad] = useState<UserCadence>(seedCad)

  useEffect(() => {
    const arg = state.sheetArg
    if (!arg || arg === product) return
    setProduct(arg)
    setShowPicker(false)
    setPickingCustom(false)
    setLocalCad(state.protocols[arg]?.cadence ?? presetCad(PEPTIDES[arg]))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.sheetArg])

  const cadMode = (['dia', 'sem', 'mes', 'uso'] as CadMode[]).includes(localCad.mode as CadMode)
    ? (localCad.mode as CadMode)
    : 'dia'

  function setCadMode(m: CadMode) {
    setLocalCad((prev) => ({ ...prev, mode: m, every: m === 'sem' || m === 'mes' ? 1 : prev.every }))
  }
  function toggleDay(i: number) {
    setLocalCad((prev) => { const days = [...prev.days]; days[i] = !days[i]; return { ...prev, days } })
  }

  // ── Dosis — campo controlado ──────────────────────────────────────────────
  // item 429: recordar unidad por producto (localStorage)
  function getStoredUnit(prod: string): DoseUnit | null {
    try { return (localStorage.getItem(`ht_unit_${prod}`) as DoseUnit) || null } catch { return null }
  }
  const savedUnit = product ? getStoredUnit(product) : null
  const [dose, setDose] = useState(() => (state.draftDose ? String(state.draftDose.value) : ''))
  const [unit, setUnit] = useState<DoseUnit>(() => (state.draftDose?.unit as DoseUnit) ?? savedUnit ?? 'mg')

  // cuando cambia producto, restaurar unidad recordada
  const prevProduct = useRef(product)
  useEffect(() => {
    if (product && product !== prevProduct.current) {
      prevProduct.current = product
      const pu = getStoredUnit(product)
      if (pu) setUnit(pu)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product])

  useEffect(() => {
    if (state.draftDose) dispatch({ t: 'setDraftDose', draft: null })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // item 309: step adaptativo + long-press
  const rampRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const rampTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function stepDose(delta: number) {
    const step = UNIT_STEP[unit] ?? 1
    const sign = delta > 0 ? 1 : -1
    const current = parseFloat(dose) || 0
    const next = Math.max(0, current + sign * step)
    setDose(String(next % 1 === 0 ? next : parseFloat(next.toFixed(4)).toString().replace(/\.?0+$/, '')))
  }

  function startRamp(delta: number) {
    rampTimeoutRef.current = setTimeout(() => {
      rampRef.current = setInterval(() => stepDose(delta), 200)
    }, 300)
  }
  function stopRamp() {
    if (rampRef.current) clearInterval(rampRef.current)
    if (rampTimeoutRef.current) clearTimeout(rampTimeoutRef.current)
    rampRef.current = null; rampTimeoutRef.current = null
  }

  // ── Reconstitución del vial ──────────────────────────────────────────────
  const seedRecon = state.draftDose?.recon ?? state.productRecon[defaultProduct]
  const [vialStr, setVialStr] = useState(() => (seedRecon ? String(seedRecon.vialMg) : ''))
  const [aguaStr, setAguaStr] = useState(() => (seedRecon ? String(seedRecon.aguaMl) : ''))
  // item 424: fecha de reconstitución
  const [reconDate, setReconDate] = useState<number | undefined>(() => state.productRecon[defaultProduct]?.reconDate)

  const reconFirst = useRef(true)
  useEffect(() => {
    if (reconFirst.current) { reconFirst.current = false; return }
    const rec = state.productRecon[product]
    setVialStr(rec ? String(rec.vialMg) : '')
    setAguaStr(rec ? String(rec.aguaMl) : '')
    setReconDate(rec?.reconDate)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product])
  const showRecon = needsRecon(unit)
  // densidad: panel de reconstitución colapsado por defecto (se abre solo si ya hay datos)
  const [showReconPanel, setShowReconPanel] = useState(false)
  useEffect(() => {
    if (vialStr && aguaStr) setShowReconPanel(true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product])
  // Al AGREGAR un producto nuevo (wizard), abre la reconstitución para fijar mg de vial + ml de agua
  // de una vez → así registrar dosis después en UI/clics es directo (no hay que convertir cada vez).
  useEffect(() => {
    if (isWizard && showRecon) setShowReconPanel(true)
  }, [isWizard, showRecon])

  // item 424: alerta de caducidad (>28 días)
  const reconStale = reconDate != null && (Date.now() - reconDate) > 28 * 24 * 3600000

  // ── item 301: nota libre ──────────────────────────────────────────────────
  const [nota, setNota] = useState('')
  const [showNota, setShowNota] = useState(false)

  // ── item 337: sitio de inyección ──────────────────────────────────────────
  const suggestedSite = product ? nextSite(state.lastInjectionSite?.[product]) : undefined
  const [site, setSite] = useState<InjectionSite | undefined>(undefined)
  const [showSites, setShowSites] = useState(false)
  // reset sitio al cambiar producto
  useEffect(() => { setSite(undefined) }, [product])

  // ── Item 106: advertencia de doble dosis ──────────────────────────────────
  const doubleDoseWarning = (() => {
    if (!product) return null
    let lastTs: number | null = null
    for (const group of state.log) {
      for (const it of group.items) {
        if (it.type === 'dose' && it.product === product) {
          if (lastTs === null || it.ts > lastTs) lastTs = it.ts
        }
      }
    }
    if (!lastTs) return null
    const windowH = cadMode === 'dia' ? 8 : 12
    const elapsed = (Date.now() - lastTs) / 3600000
    if (elapsed >= windowH) return null
    const elapsedText = elapsed < 1 ? `${Math.round(elapsed * 60)} min` : `${elapsed.toFixed(1).replace('.0', '')} h`
    return { elapsedText, lastTs }
  })()
  const [dismissWarning, setDismissWarning] = useState(false)
  useEffect(() => { setDismissWarning(false) }, [product])

  // ── Hora ──────────────────────────────────────────────────────────────────
  const [hora, setHora] = useState('Ahora')

  // ── Selección de producto ─────────────────────────────────────────────────
  function pickProduct(p: string) {
    setProduct(p)
    setShowPicker(false)
    setPickingCustom(false)
    setSearchQuery('')
    setLocalCad(presetCad(PEPTIDES[p]))
    // item 311: avanzar wizard
    if (isWizard && wizardStep === 'producto') setWizardStep('cadencia')
  }

  function confirmCustom() {
    const name = customProduct.trim()
    if (!name) return
    setProduct(name)
    setShowPicker(false)
    setPickingCustom(false)
    setLocalCad(presetCad(undefined))
    if (isWizard && wizardStep === 'producto') setWizardStep('cadencia')
  }

  // ── Guardar ───────────────────────────────────────────────────────────────
  const [saving, setSaving] = useState(false)
  // Prompt de reconciliación de hora (1ª dosis registrada "Ahora" con desfase vs recordatorio). null = oculto.
  const [reconcile, setReconcile] = useState<{ reminderTime: string } | null>(null)

  // Guardado real. tsOverride: hora explícita (p.ej. la del recordatorio). openEditAfter: abrir el editor
  // de protocolo al terminar (para que el usuario ajuste SU recordatorio — no lo cambiamos nosotros).
  const commitSave = useCallback((tsOverride?: number, openEditAfter?: boolean) => {
    if (saving) return
    const finalProduct = product.trim()
    if (!finalProduct) return
    setReconcile(null)
    setSaving(true)
    tapHaptic()
    const ts = tsOverride !== undefined ? tsOverride : parseHora(hora, state.todayTs)
    window.setTimeout(() => {
      if (state.protocols[finalProduct]) {
        if (state.activeProduct === finalProduct) dispatch({ t: 'setCadence', cadence: localCad })
      } else if (finalProduct in PEPTIDES) {
        dispatch({ t: 'setProtocol', product: finalProduct })
        dispatch({ t: 'setCadence', cadence: localCad })
      }
      const val = parseFloat(dose)
      const vialMg = parseFloat(vialStr)
      const aguaMl = parseFloat(aguaStr)
      const doseMg = doseToMg(val, unit, vialMg, aguaMl) ?? undefined
      const recon = needsRecon(unit) && vialMg > 0 && aguaMl > 0 ? { vialMg, aguaMl } : undefined
      const noteStr = nota.trim().slice(0, 200) || undefined
      // El sitio sugerido se muestra resaltado en la píldora; si el usuario no lo cambia, igual se persiste
      // (antes quedaba undefined → la dosis se guardaba sin zona y el mapa de inyección no la coloreaba).
      dispatch({ t: 'logDose', product: finalProduct, value: val || null, unit, ts, doseMg, recon, site: site ?? suggestedSite, note: noteStr })
      // item 429: guardar unidad por producto en localStorage
      try { localStorage.setItem(`ht_unit_${finalProduct}`, unit) } catch { /* noop */ }
      if (openEditAfter) dispatch({ t: 'sheet', sheet: 'protocolo-edit', arg: finalProduct })
      else dispatch({ t: 'sheet', sheet: null })
    }, 640)
  }, [saving, state.protocols, state.activeProduct, state.todayTs, localCad, product, dose, unit, vialStr, aguaStr, hora, nota, site, suggestedSite, dispatch])

  const handleSave = useCallback(() => {
    if (saving) return
    const finalProduct = product.trim()
    if (!finalProduct) {
      dispatch({ t: 'toast', msg: 'Elige un producto primero' })
      setShowPicker(true)
      return
    }
    // 1ª dosis de este producto registrada "Ahora" con desfase ≥1h vs el recordatorio → preguntar qué hacer con la hora.
    if (hora === 'Ahora') {
      // recordatorio de ESTE producto (o el default '08:00' que recibirá un protocolo nuevo) — no el del activo
      const reminderTime = state.protocols[finalProduct]?.reminderTime || '08:00'
      const isFirstDose = !state.log.some((g) => g.items.some((it) => it.type === 'dose' && it.product === finalProduct))
      const [rh, rm] = reminderTime.split(':').map(Number)
      const now = new Date()
      const diffMin = Math.abs((now.getHours() * 60 + now.getMinutes()) - ((rh || 0) * 60 + (rm || 0)))
      if (isFirstDose && diffMin > 60) {
        setReconcile({ reminderTime })
        return
      }
    }
    commitSave(undefined, false)
  }, [saving, product, hora, state.protocols, state.protocol, state.log, commitSave, dispatch])

  // ── item 310: última dosis del producto ──────────────────────────────────
  const lastDoseData = product ? lastDoseInfo(state.log, product) : null

  // ── item 430: chips de últimas 3 dosis ───────────────────────────────────
  const doseChips = product ? lastDoses(state.log, product) : []

  // ── Render: wizard step indicator (item 311) ──────────────────────────────
  const WIZARD_STEPS: WizardStep[] = ['producto', 'cadencia', 'dosis']

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Sheet title="Registrar dosis" onClose={() => dispatch({ t: 'sheet', sheet: null })}>

      {/* Reconciliación de hora — 1ª dosis "Ahora" con desfase vs el recordatorio.
          El usuario decide qué hora cuenta; "ajustar recordatorio" lo manda al editor (no lo cambiamos nosotros). */}
      {reconcile && (() => {
        const [rh, rm] = reconcile.reminderTime.split(':').map(Number)
        const rDate = new Date(state.todayTs); rDate.setHours(rh || 0, rm || 0, 0, 0)
        const reminderLabel = fmtTime(rDate)
        const nowLabel = fmtTime(new Date())
        return (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            onClick={() => setReconcile(null)}
            style={{ position: 'absolute', inset: 0, zIndex: 20, background: 'color-mix(in srgb, var(--ink-900) 55%, transparent)', display: 'flex', alignItems: 'flex-end' }}
          >
            <motion.div
              initial={{ y: 28 }} animate={{ y: 0 }} transition={spring.ui}
              onClick={(e) => e.stopPropagation()}
              style={{ width: '100%', background: 'var(--surface)', borderRadius: '20px 20px 0 0', padding: '22px 20px calc(20px + env(safe-area-inset-bottom))', display: 'flex', flexDirection: 'column', gap: 10 }}
            >
              <h3 className="h3" style={{ margin: 0, color: 'var(--ink-900)' }}>¿A qué hora te la inyectaste?</h3>
              <p className="sm" style={{ margin: '0 0 4px', color: 'var(--ink-400)' }}>
                Tu recordatorio está a las <strong>{reminderLabel}</strong>, pero estás registrando ahora (<strong>{nowLabel}</strong>).
              </p>
              <button className="btn btn-brand" style={{ height: 48, width: '100%' }} onClick={() => commitSave(undefined, false)}>
                Me la inyecté ahora ({nowLabel})
              </button>
              <button className="btn btn-outline" style={{ height: 48, width: '100%' }} onClick={() => commitSave(rDate.getTime(), false)}>
                Me la inyecté a las {reminderLabel}
              </button>
              <button className="btn btn-ghost" style={{ height: 44, width: '100%' }} onClick={() => commitSave(undefined, true)}>
                Registrar ahora y ajustar mi recordatorio →
              </button>
            </motion.div>
          </motion.div>
        )
      })()}

      {/* Confirmación — checkmark draw-on */}
      {saving && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{
            position: 'absolute', inset: 0, zIndex: 10, background: 'var(--surface)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16,
          }}
        >
          <motion.div
            initial={{ scale: 0.6 }}
            animate={{ scale: 1 }}
            transition={spring.celebrate}
            style={{ width: 88, height: 88, borderRadius: 999, background: 'var(--brand-700)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <motion.path d="M5 12l5 5L20 6" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.5, ease: ease.decelerate, delay: 0.12 }} />
            </svg>
          </motion.div>
          <motion.div className="h2" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.32 }}>
            Empezaste tu cambio
          </motion.div>
        </motion.div>
      )}

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 16px', display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* Item 311: barra de progreso del wizard */}
        {isWizard && (
          <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
            {WIZARD_STEPS.map((s, i) => (
              <div key={s} style={{
                flex: 1, height: 3, borderRadius: 99,
                background: WIZARD_STEPS.indexOf(wizardStep) >= i ? 'var(--brand-700)' : 'var(--ink-100)',
                transition: 'background .2s',
              }} />
            ))}
          </div>
        )}

        {/* ── Item 106: advertencia de doble dosis ── */}
        {doubleDoseWarning && !dismissWarning && (
          <div style={{
            background: 'color-mix(in srgb, var(--warning) 12%, transparent)',
            border: '1px solid color-mix(in srgb, var(--warning) 40%, transparent)',
            borderRadius: 'var(--r-sm)', padding: '10px 14px',
            display: 'flex', flexDirection: 'column', gap: 6,
          }}>
            <p className="sm" style={{ margin: 0, fontWeight: 700, color: 'var(--warning)' }}>
              ¡Ya registraste {product} hace {doubleDoseWarning.elapsedText}!
            </p>
            <p className="sm" style={{ margin: 0, color: 'var(--ink-700)' }}>
              ¿Seguro que quieres registrar otra dosis?
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-outline btn-sm"
                style={{ width: 'auto', padding: '0 12px', color: 'var(--warning)', borderColor: 'color-mix(in srgb, var(--warning) 50%, transparent)' }}
                onClick={() => setDismissWarning(true)} aria-label="Sí, registrar de todas formas">
                Sí, registrar igual
              </button>
              <button className="btn btn-ghost btn-sm"
                style={{ width: 'auto', padding: '0 12px' }}
                onClick={() => dispatch({ t: 'sheet', sheet: null })}>
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* ── Producto (siempre visible) ── */}
        {(!isWizard || wizardStep === 'producto' || wizardStep === 'cadencia' || wizardStep === 'dosis') && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span className="sm" style={{ color: 'var(--ink-400)' }}>Producto</span>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 16px', borderRadius: 12,
              border: '1px solid var(--border)', background: 'var(--card)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: '50%',
                  background: 'color-mix(in srgb, var(--brand-700) 10%, transparent)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--brand-700)', flexShrink: 0,
                }}>
                  <IcDrop size={20} />
                </div>
                <span className="body" style={{ fontWeight: 500, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {product || 'Selecciona un producto'}
                </span>
              </div>
              <button className="btn-ghost sm"
                style={{ color: 'var(--brand-700)', fontWeight: 600, flexShrink: 0 }}
                onClick={() => setShowPicker((v) => !v)}>
                Cambiar
              </button>
            </div>

            {/* item 310: última dosis del producto */}
            {lastDoseData && !showPicker && (
              <p className="sm" style={{ margin: 0, color: 'var(--ink-400)', paddingLeft: 4 }}>
                Última vez:{' '}
                <span style={{ fontWeight: 600 }}>
                  {lastDoseData.value != null ? `${lastDoseData.value} ${lastDoseData.unit}` : '(sin valor)'}
                </span>
                {' · '}{fmtRelative(lastDoseData.ts)}
              </p>
            )}

            {/* item 308: picker con búsqueda + recientes */}
            {showPicker && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
                {/* Campo de búsqueda */}
                <input
                  type="search"
                  className="field sm"
                  placeholder="Buscar producto…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoFocus
                  style={{ padding: '8px 12px' }}
                />

                {/* Recientes (solo si no hay query) */}
                {!searchQuery && recentProducts.length > 0 && (
                  <div>
                    <p className="sm" style={{ margin: '0 0 6px', color: 'var(--ink-400)' }}>Recientes</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {recentProducts.map((p) => (
                        <Chip key={p} label={p} active={p === product && !pickingCustom} onClick={() => pickProduct(p)} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Lista filtrada */}
                <div>
                  {!searchQuery && <p className="sm" style={{ margin: '0 0 6px', color: 'var(--ink-400)' }}>Catálogo</p>}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {filteredProducts.map((p) => (
                      <Chip key={p} label={p} active={p === product && !pickingCustom} onClick={() => pickProduct(p)} />
                    ))}
                    {filteredProducts.length === 0 && (
                      <p className="sm" style={{ color: 'var(--ink-300)', margin: 0 }}>Sin resultados</p>
                    )}
                    <Chip label="Otro" active={pickingCustom} onClick={() => { setPickingCustom(true) }} />
                  </div>
                </div>

                {pickingCustom && (
                  <div style={{ width: '100%', display: 'flex', gap: 8 }}>
                    <input
                      className="field body"
                      placeholder="Nombre del producto"
                      value={customProduct}
                      onChange={(e) => setCustomProduct(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && confirmCustom()}
                      style={{ flex: 1 }}
                      autoFocus
                    />
                    <button className="btn btn-brand btn-sm" onClick={confirmCustom}>Listo</button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Cadencia (wizard: paso 2; normal: siempre) ── */}
        {(!isWizard || wizardStep === 'cadencia') && (
          <>
            {cadenceLocked ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span className="sm" style={{ color: 'var(--ink-400)' }}>Cadencia</span>
                  <span className="body" style={{ fontWeight: 600 }}>{cadenceLabel(localCad)}</span>
                </div>
                <button className="btn btn-outline btn-sm" style={{ width: 'auto', padding: '0 14px' }}
                  onClick={() => {
                    // editar ESTE producto sin reasignar el primario de Inicio (arg = foco de edición)
                    dispatch({ t: 'sheet', sheet: 'protocolo-edit', arg: product })
                  }}>
                  Editar
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <span className="sm" style={{ color: 'var(--ink-400)' }}>Cadencia</span>
                <Segmented options={CADENCE_OPTS} value={cadMode} onChange={setCadMode} />
                {cadMode === 'dia' && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6, marginTop: 4 }}>
                    {WDS.map(([label], i) => (
                      <button key={label} aria-pressed={!!localCad.days[i]} onClick={() => toggleDay(i)}
                        style={{
                          width: 40, height: 40, borderRadius: '50%',
                          fontSize: 13, fontWeight: 600,
                          background: localCad.days[i] ? 'var(--brand-700)' : 'var(--ink-100)',
                          color: localCad.days[i] ? '#fff' : 'var(--ink-400)',
                          border: 'none', cursor: 'pointer', transition: 'background .15s',
                        }}>
                        {label}
                      </button>
                    ))}
                  </div>
                )}
                {cadMode === 'sem' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <span className="sm" style={{ color: 'var(--ink-400)' }}>Cada</span>
                    <button className="stepbtn" aria-label="Menos"
                      onClick={() => setLocalCad((p) => ({ ...p, every: Math.max(1, p.every - 1) }))}>−</button>
                    <span className="mono" style={{ minWidth: 24, textAlign: 'center' }}>{localCad.every}</span>
                    <button className="stepbtn" aria-label="Más"
                      onClick={() => setLocalCad((p) => ({ ...p, every: p.every + 1 }))}>+</button>
                    <span className="sm" style={{ color: 'var(--ink-400)' }}>{localCad.every === 1 ? 'semana' : 'semanas'}</span>
                  </div>
                )}
                {cadMode === 'mes' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <span className="sm" style={{ color: 'var(--ink-400)' }}>Cada</span>
                    <button className="stepbtn" aria-label="Menos"
                      onClick={() => setLocalCad((p) => ({ ...p, every: Math.max(1, p.every - 1) }))}>−</button>
                    <span className="mono" style={{ minWidth: 24, textAlign: 'center' }}>{localCad.every}</span>
                    <button className="stepbtn" aria-label="Más"
                      onClick={() => setLocalCad((p) => ({ ...p, every: p.every + 1 }))}>+</button>
                    <span className="sm" style={{ color: 'var(--ink-400)' }}>{localCad.every === 1 ? 'mes' : 'meses'}</span>
                  </div>
                )}
                {cadMode === 'uso' && (
                  <p className="sm" style={{ color: 'var(--ink-400)', margin: 0 }}>
                    Sin horario fijo. Lo registras cuando lo usas — no programamos días.
                  </p>
                )}
              </div>
            )}
            {/* Botón siguiente del wizard */}
            {isWizard && wizardStep === 'cadencia' && (
              <button className="btn btn-outline" onClick={() => setWizardStep('dosis')}>
                Siguiente →
              </button>
            )}
          </>
        )}

        {/* ── Dosis (wizard: paso 3; normal: siempre) ── */}
        {(!isWizard || wizardStep === 'dosis') && (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '8px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                {/* Botón − con long-press (item 309) */}
                <button
                  className="stepbtn"
                  aria-label="Disminuir dosis"
                  style={{ width: 56, height: 56, borderRadius: '50%', border: '1px solid var(--border)', fontSize: 24 }}
                  onClick={() => stepDose(-1)}
                  onPointerDown={() => startRamp(-1)}
                  onPointerUp={stopRamp}
                  onPointerLeave={stopRamp}
                >
                  −
                </button>

                <input
                  type="text" inputMode="decimal" aria-label="Cantidad de dosis"
                  className="mono" placeholder="0" value={dose}
                  onChange={(e) => {
                    const v = e.target.value.replace(',', '.')
                    if (/^\d*\.?\d*$/.test(v)) setDose(v)
                  }}
                  style={{ width: 128, textAlign: 'center', fontSize: 40, fontWeight: 800, background: 'transparent', border: 'none', outline: 'none', color: 'var(--ink-900)' }}
                />

                {/* Botón + con long-press (item 309) */}
                <button
                  className="stepbtn"
                  aria-label="Aumentar dosis"
                  style={{ width: 56, height: 56, borderRadius: '50%', border: '1px solid var(--border)', fontSize: 24 }}
                  onClick={() => stepDose(1)}
                  onPointerDown={() => startRamp(1)}
                  onPointerUp={stopRamp}
                  onPointerLeave={stopRamp}
                >
                  +
                </button>
              </div>

              {/* item 428: chips de unidad inline */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                {UNITS.map((u) => (
                  <Chip key={u.value} label={u.label} active={unit === u.value}
                    onClick={() => {
                      setUnit(u.value)
                      // item 429: se persiste al guardar
                    }} />
                ))}
              </div>
              <p className="sm" style={{ margin: 0, color: 'var(--ink-300)', textAlign: 'center' }}>
                Paso: {UNIT_STEP[unit]} {unit}
                <span style={{ color: 'var(--ink-200)' }}> · mantén ± para rampa</span>
              </p>

              {/* item 430: chips de últimas 3 dosis — solo cuando el campo está vacío (menos ruido) */}
              {doseChips.length > 0 && !dose && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%', alignItems: 'center' }}>
                  <p className="sm" style={{ margin: 0, color: 'var(--ink-400)' }}>Dosis recientes</p>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {doseChips.map((d, i) => (
                      <button key={i}
                        onClick={() => { setDose(String(d.value)); setUnit(d.unit as DoseUnit) }}
                        style={{
                          padding: '4px 12px', borderRadius: 99, fontSize: 13, fontWeight: 600,
                          border: '1.5px solid var(--brand-300)',
                          background: 'color-mix(in srgb, var(--brand-300) 10%, transparent)',
                          color: 'var(--brand-700)', cursor: 'pointer',
                        }}>
                        {d.value} {d.unit}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Reconstitución del vial — colapsable (densidad) */}
              {showRecon && !showReconPanel && (
                <button className="btn-ghost sm"
                  style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--brand-700)', fontWeight: 500 }}
                  onClick={() => setShowReconPanel(true)}>
                  <IcDrop size={14} /> ¿Convertir a mg? (reconstitución del vial)
                </button>
              )}
              {showRecon && showReconPanel && (
                <div style={{ marginTop: 14, padding: '14px 16px', borderRadius: 'var(--r-sm)', background: 'var(--border)', width: '100%', boxSizing: 'border-box' }}>
                  <div className="sm" style={{ color: 'var(--ink-400)', marginBottom: 10, textAlign: 'center' }}>
                    Reconstitución del vial <span style={{ color: 'var(--ink-300)' }}>· para saber cuántos mg son tus {unit === 'mL' ? 'mL' : 'unidades'}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <label className="label" htmlFor="reg-vial">Vial (mg)</label>
                      <input id="reg-vial" className="field" type="number" inputMode="decimal" min="0" placeholder="ej. 10"
                        value={vialStr} onChange={(e) => setVialStr(e.target.value)} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label className="label" htmlFor="reg-agua">Agua (mL)</label>
                      <input id="reg-agua" className="field" type="number" inputMode="decimal" min="0" placeholder="ej. 2"
                        value={aguaStr} onChange={(e) => setAguaStr(e.target.value)} />
                    </div>
                  </div>
                  {(() => {
                    const mg = doseToMg(parseFloat(dose), unit, parseFloat(vialStr), parseFloat(aguaStr))
                    return mg != null ? (
                      <div className="sm mono" style={{ color: 'var(--brand-700)', textAlign: 'center', marginTop: 10, fontWeight: 600 }}>
                        = {mg < 1 ? mg.toFixed(3) : mg < 10 ? mg.toFixed(2) : mg.toFixed(1)} mg
                      </div>
                    ) : (
                      <div className="sm" style={{ color: 'var(--ink-300)', textAlign: 'center', marginTop: 10 }}>
                        Ingresa vial y agua para convertir a mg
                      </div>
                    )
                  })()}

                  {/* item 424: fecha de reconstitución */}
                  {reconStale && (
                    <div style={{
                      marginTop: 10, padding: '8px 10px', borderRadius: 'var(--r-sm)',
                      background: 'color-mix(in srgb, var(--warning) 12%, transparent)',
                      border: '1px solid color-mix(in srgb, var(--warning) 40%, transparent)',
                    }}>
                      <p className="sm" style={{ margin: 0, color: 'var(--warning)', fontWeight: 600 }}>
                        <Glyph name="efecto" size={13} color="currentColor" style={{ verticalAlign: '-2px', marginRight: 3 }} /> Vial reconstituido hace más de 28 días — verifica la estabilidad antes de usar.
                      </p>
                      <p className="sm" style={{ margin: '4px 0 0', color: 'var(--ink-400)' }}>Dato orientativo. No es consejo médico.</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── item 337: sitio de inyección (nombres completos, controles completos) ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <span className="sm" style={{ color: 'var(--ink-400)' }}>Sitio de inyección</span>
                <button className="btn-link" onClick={() => setShowSites((v) => !v)}>
                  {showSites ? 'Ocultar' : site ? 'Cambiar' : 'Elegir otro'}
                </button>
              </div>

              {/* Colapsado: pill completa con el sitio elegido o el sugerido (nombre completo) */}
              {!showSites && (
                <button
                  type="button"
                  onClick={() => { if (!site && suggestedSite) setSite(suggestedSite) }}
                  aria-label={site ? `Sitio elegido: ${siteLabel(site)}` : suggestedSite ? `Usar sitio sugerido: ${siteLabel(suggestedSite)}` : 'Elegir sitio'}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left',
                    padding: '11px 13px', borderRadius: 'var(--r-sm)', cursor: site ? 'default' : 'pointer',
                    border: `1.5px solid ${site ? 'var(--brand-500)' : 'var(--border)'}`,
                    background: site ? 'color-mix(in srgb, var(--brand-500) 8%, transparent)' : 'var(--bg)',
                  }}
                >
                  <IcDrop size={17} />
                  <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                    <span className="sm" style={{ color: 'var(--ink-900)', fontWeight: 600 }}>
                      {site ? siteLabel(site) : suggestedSite ? siteLabel(suggestedSite) : 'Elegir un sitio'}
                    </span>
                    {!site && suggestedSite && (
                      <span className="sm" style={{ color: 'var(--ink-400)', fontSize: 11 }}>Rotación sugerida</span>
                    )}
                  </span>
                  {!site && suggestedSite && (
                    <span className="sm" style={{ color: 'var(--brand-700)', fontWeight: 700, flexShrink: 0 }}>Usar</span>
                  )}
                </button>
              )}

              {/* Expandido: chips con nombre completo */}
              {showSites && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {INJECTION_SITES.map((s) => (
                    <Chip key={s.value} label={s.label}
                      active={site === s.value || (!site && s.value === suggestedSite)}
                      onClick={() => { setSite(s.value); setShowSites(false) }} />
                  ))}
                  <Chip label="Sin registrar" active={site === undefined}
                    onClick={() => { setSite(undefined); setShowSites(false) }} />
                </div>
              )}
            </div>

            {/* ── Calculadora de unidades — botón outline completo ── */}
            <button
              className="btn btn-outline btn-sm"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
              onClick={() => dispatch({ t: 'sheet', sheet: 'calc' })}>
              <IcDrop size={16} />
              Calculadora de unidades
            </button>

            {/* ── Hora de registro ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span className="sm" style={{ color: 'var(--ink-400)' }}>Hora de registro</span>
                <Chip label="Ahora" active={hora === 'Ahora'} onClick={() => setHora('Ahora')} />
              </div>
              <TimeWheel onChange={(label) => setHora(label)} />
            </div>

            {/* ── item 301: nota libre ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <button className="btn-ghost sm"
                style={{ alignSelf: 'flex-start', color: 'var(--ink-400)', fontWeight: 500 }}
                onClick={() => setShowNota((v) => !v)}>
                {showNota ? '▲ Ocultar nota' : <><Glyph name="editar" size={13} color="currentColor" style={{ verticalAlign: '-2px', marginRight: 3 }} /> Añadir nota (opcional)</>}
              </button>
              {showNota && (
                <div style={{ position: 'relative' }}>
                  <textarea
                    className="field"
                    rows={2}
                    maxLength={200}
                    placeholder="Sitio de inyección, notas personales, estado general…"
                    value={nota}
                    onChange={(e) => setNota(e.target.value)}
                    style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit', fontSize: 14, boxSizing: 'border-box', paddingBottom: 24 }}
                    aria-label="Nota opcional del registro"
                  />
                  <span className="sm" style={{ position: 'absolute', bottom: 8, right: 10, color: 'var(--ink-300)', background: 'var(--card)', padding: '0 2px', borderRadius: 4, pointerEvents: 'none' }}>
                    {nota.length}/200
                  </span>
                </div>
              )}
            </div>

            <Disclaimer kind="dose" />
          </>
        )}

      </div>

      {/* ── CTA al fondo ── sticky (en flujo) para NO encimarse sobre los productos.
          Antes era position:absolute pegado al fondo del CONTENIDO del .sheet → tapaba la última fila. */}
      <div style={{
        position: 'sticky', bottom: 0, zIndex: 1,
        padding: '16px 20px',
        paddingBottom: 'max(24px, calc(16px + env(safe-area-inset-bottom, 0px)))',
        background: 'linear-gradient(to top, var(--surface) 70%, transparent)',
      }}>
        {isWizard && wizardStep !== 'dosis' ? (
          <button className="btn btn-brand"
            style={{ width: '100%', height: 52, borderRadius: 16, fontSize: 16, fontWeight: 600 }}
            onClick={() => {
              if (wizardStep === 'producto') {
                if (!product) { dispatch({ t: 'toast', msg: 'Elige un producto primero' }); return }
                setWizardStep('cadencia')
              } else {
                setWizardStep('dosis')
              }
            }}>
            Siguiente →
          </button>
        ) : (
          <button className="btn btn-brand"
            style={{ width: '100%', height: 52, borderRadius: 16, fontSize: 16, fontWeight: 600 }}
            onClick={handleSave}>
            Guardar registro
          </button>
        )}
      </div>

    </Sheet>
  )
}
