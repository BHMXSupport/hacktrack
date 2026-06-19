// Alimentación — "Registro Relámpago": predicciones por franja horaria (1 toque), barra inteligente
// con búsqueda en tu biblioteca, copiar de ayer, porciones, proteína + meta. (Torneo multiagente → audit.)
import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useApp, isoKey, mealSlot } from '../lib/store'
import {
  dayMacros, predictions, predictionConfidence, fuzzySearch, protocolNumbers, anchorProduct,
  tdee, tdeeChip, kcalFromMacros, proteinSuggestion, waterGoalGlasses, kcalSeries, litersFromMl, waterGoalLiters,
  proteinRemaining, fastingMinutes, fastingLabel, kcalBySlot, macroPercents, proteinQualityScore,
  isProteinUnbalanced, weeklyDiversityScore, proteinQualityStreak, recentFoods,
  exportNutritionCsv, shareDayText,
} from '../lib/nutrition'
import { Sparkline, TrendChart } from '../components/charts'
import { PremiumGate } from '../components/PremiumGate'
import { TimeWheel } from '../components/TimeWheel'
import { EmptyState } from '../components/EmptyState'
import { IcDrop, IcClose, IcChevron } from '../components/icons'
import { Glyph } from '../components/glyphs'
import { tapHaptic } from '../lib/haptics'
import { staggerParent, staggerItem } from '../lib/motion'
import { PEPTIDES } from '../lib/catalog'
import type { FoodFav, Meal } from '../lib/types'

// WATER_GOAL is now dynamic (waterGoalGlasses), kept for backwards-compat w/ compositeStreak
const WATER_GOAL = 8
const PORTIONS: (number | null)[] = [null, 0.5, 1, 1.5, 2] // null = "auto" (porción aprendida)
// "9:05 AM" → ts de hoy; 'Ahora' → null
function parseHoraLabel(label: string, todayTs: number): number | null {
  if (label === 'Ahora') return null
  const m = label.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (!m) return null
  let h = parseInt(m[1], 10) % 12
  if (/pm/i.test(m[3])) h += 12
  const d = new Date(todayTs); d.setHours(h, parseInt(m[2], 10), 0, 0)
  return d.getTime()
}
// copy del estado vacío según la franja del día
const SLOT_PROMPT: Record<string, string> = {
  'desayuno': '¿Qué desayunas? Regístralo abajo y lo recordaré.',
  'colación de la mañana': '¿Una colación? Regístrala abajo y la recordaré.',
  'comida': '¿Qué comes hoy? Regístralo abajo y lo recordaré.',
  'colación de la tarde': '¿Una colación? Regístrala abajo y la recordaré.',
  'cena': '¿Qué cenas? Regístralo abajo y lo recordaré.',
  'antojo nocturno': '¿Algún antojo nocturno? Regístralo abajo y lo recordaré.',
}
// toastId for undo operations
let _toastUndoId: ReturnType<typeof setTimeout> | null = null
let _delMealTimer: ReturnType<typeof setTimeout> | null = null
const porLabel = (p: number | null) => (p == null ? 'auto' : p === 0.5 ? '½' : p === 1.5 ? '1½' : `${p}×`)
const fmtTime = (ts: number) => new Date(ts).toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' })

// ── Chevron SVG rotable (reemplaza ▾/▴ de texto) ──
function Caret({ open, color = 'var(--brand-700)' }: { open: boolean; color?: string }) {
  return (
    <IcChevron
      size={16}
      style={{ color, transform: open ? 'rotate(-90deg)' : 'rotate(90deg)', transition: 'transform 0.18s ease', flexShrink: 0 }}
    />
  )
}

// ── Punto de color controlado (reemplaza el carácter ● de texto) ──
function Dot({ color, size = 7 }: { color: string; size?: number }) {
  return <span style={{ width: size, height: size, borderRadius: '50%', background: color, flexShrink: 0, display: 'inline-block' }} />
}

// ── Mini heatmap semanal de kcal (7 días) ──
function WeekHeatmap({ s }: { s: ReturnType<typeof useApp>['state'] }) {
  const series = kcalSeries(s, 7)
  const goal = s.kcalGoal ?? tdee(s)
  const max = Math.max(...series.map((d) => d.kcal), goal ?? 1, 1)
  const days = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
  return (
    <div style={{ position: 'relative', overflow: 'hidden' }}>
      <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 36 }}>
        {series.map(({ ts, kcal, has }) => {
          const pct = Math.min(1, kcal / max)
          const dayIdx = new Date(ts).getDay() // 0=Dom
          const label = days[(dayIdx + 6) % 7]
          const color = !has ? 'var(--ink-100)' : goal && kcal > goal * 1.05 ? 'var(--warning)' : kcal > 0 ? 'var(--brand-500)' : 'var(--ink-100)'
          return (
            <div key={ts} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <div style={{ width: '100%', background: color, height: Math.max(4, Math.round(pct * 28)), borderRadius: 3, transition: 'height 0.25s ease' }} title={has ? `${kcal} kcal` : 'Sin registro'} />
              <span className="sm" style={{ fontSize: 11, color: 'var(--ink-300)', fontWeight: 600 }}>{label}</span>
            </div>
          )
        })}
      </div>
      {goal && (
        /* línea de meta — dentro del ancho real, sin offsets negativos que sangren */
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: Math.round((goal / max) * 28) + 12, height: 1, borderTop: '1px dashed var(--border)', pointerEvents: 'none' }} />
      )}
    </div>
  )
}

// ── Barra apilada P·C·G ──
function MacroStackBar({ protein, carbs, fat }: { protein: number; carbs: number; fat: number }) {
  const pcts = macroPercents(protein, carbs, fat)
  const total = pcts.protein + pcts.carbs + pcts.fat
  if (total === 0) return null
  return (
    <div style={{ display: 'flex', height: 6, borderRadius: 999, overflow: 'hidden', marginTop: 6 }}>
      <div style={{ width: `${pcts.protein}%`, background: 'var(--brand-700)', transition: 'width 0.3s ease' }} title={`Proteína ${pcts.protein}%`} />
      <div style={{ width: `${pcts.carbs}%`, background: 'var(--warning)', transition: 'width 0.3s ease' }} title={`Carbos ${pcts.carbs}%`} />
      <div style={{ width: `${pcts.fat}%`, background: 'var(--brand-300)', transition: 'width 0.3s ease' }} title={`Grasa ${pcts.fat}%`} />
    </div>
  )
}

export function Alimentacion() {
  const { state, dispatch } = useApp()
  const now = Date.now()
  const key = isoKey(state.todayTs)
  const day = state.nutrition[key] ?? { water: 0, meals: [] }
  const kcal = day.meals.reduce((sum, m) => sum + m.kcal, 0)
  const macros = dayMacros(day.meals)

  const [portion, setPortion] = useState<number | null>(null)
  const [horaLabel, setHoraLabel] = useState('Ahora') // 'Ahora' o '9:05 AM'
  const [showWheel, setShowWheel] = useState(false)
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)
  const [kcalStr, setKcalStr] = useState('')
  const [showMacros, setShowMacros] = useState(false)
  const [pStr, setPStr] = useState('')
  const [cStr, setCStr] = useState('')
  const [fStr, setFStr] = useState('')
  const [manageFav, setManageFav] = useState(false)
  const [macroWarning, setMacroWarning] = useState<string | null>(null)
  const [kcalWarning, setKcalWarning] = useState<string | null>(null)
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const [undoPending, setUndoPending] = useState<boolean>(false)
  // nuevos estados de UI
  const [macroMode, setMacroMode] = useState<'g' | 'pct'>('g')

  // edición inline de comidas (n°201 + n°221)
  const [editingMealId, setEditingMealId] = useState<string | null>(null)
  const [editMealDraft, setEditMealDraft] = useState<{ label: string; kcalStr: string; pStr: string; cStr: string; fStr: string; noteStr: string }>({ label: '', kcalStr: '', pStr: '', cStr: '', fStr: '', noteStr: '' })
  // undo al borrar comida (n°202)
  const [pendingDelMeal, setPendingDelMeal] = useState<Meal | null>(null)
  const [delUndoPending, setDelUndoPending] = useState(false)

  // n°356: tamaño de vaso configurable (ml), persiste en localStorage
  const [glassMl, setGlassMl] = useState<number>(() => {
    try { return Number(localStorage.getItem('hacktrack-glass-ml') ?? '250') || 250 } catch { return 250 }
  })
  const [showGlassConfig, setShowGlassConfig] = useState(false)
  const GLASS_OPTIONS = [250, 330, 500] as const
  const totalMl = day.water  // 'water' ahora es VOLUMEN en ml (no conteo de vasos)
  const totalL = litersFromMl(totalMl)

  // n°476: barcode scanner (BarcodeDetector Web API)
  const [scannerActive, setScannerActive] = useState(false)
  const [scanResult, setScanResult] = useState<{ name: string; kcal: number; protein?: number; carbs?: number; fat?: number } | null>(null)
  const [scanError, setScanError] = useState<string | null>(null)

  const openBarcodeScanner = async () => {
    setScanError(null)
    if (typeof (window as any).BarcodeDetector === 'undefined') {
      setScanError('Tu navegador no soporta BarcodeDetector — escanea manualmente o usa Chrome en Android.')
      return
    }
    setScannerActive(true)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      const video = document.createElement('video')
      video.srcObject = stream
      await video.play()
      const detector = new (window as any).BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] })
      const canvas = document.createElement('canvas')
      let found = false
      for (let i = 0; i < 30 && !found; i++) {
        await new Promise((r) => setTimeout(r, 200))
        canvas.width = video.videoWidth; canvas.height = video.videoHeight
        canvas.getContext('2d')?.drawImage(video, 0, 0)
        const barcodes = await detector.detect(canvas)
        if (barcodes.length > 0) {
          found = true
          const code = barcodes[0].rawValue
          stream.getTracks().forEach((t: MediaStreamTrack) => t.stop())
          // Query Open Food Facts
          const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${code}.json`)
          const json = await res.json()
          if (json.status === 1) {
            const p = json.product
            const kcalPer100 = p.nutriments?.['energy-kcal_100g'] ?? 0
            const portionG = p.serving_quantity ?? 100
            const factor = portionG / 100
            setScanResult({
              name: p.product_name_es ?? p.product_name ?? code,
              kcal: Math.round(kcalPer100 * factor),
              protein: p.nutriments?.proteins_100g != null ? Math.round(p.nutriments.proteins_100g * factor) : undefined,
              carbs: p.nutriments?.carbohydrates_100g != null ? Math.round(p.nutriments.carbohydrates_100g * factor) : undefined,
              fat: p.nutriments?.fat_100g != null ? Math.round(p.nutriments.fat_100g * factor) : undefined,
            })
          } else {
            setScanError(`Código ${code} no encontrado en Open Food Facts`)
          }
        }
      }
      if (!found) {
        stream.getTracks().forEach((t: MediaStreamTrack) => t.stop())
        setScanError('No se detectó código — acércate más a la etiqueta')
      }
    } catch (e) {
      setScanError('No se pudo acceder a la cámara')
    } finally {
      setScannerActive(false)
    }
  }

  // n°477: electrolitos del día (localStorage por fecha, sin store)
  const electroKey = `hacktrack-electro-${key}`
  const [electrolytes, setElectrolytes] = useState<{ na: number; k: number; mg: number }>(() => {
    try { return JSON.parse(localStorage.getItem(electroKey) ?? 'null') ?? { na: 0, k: 0, mg: 0 } } catch { return { na: 0, k: 0, mg: 0 } }
  })
  const updateElectrolyte = (field: 'na' | 'k' | 'mg', delta: number) => {
    setElectrolytes((prev) => {
      const next = { ...prev, [field]: Math.max(0, prev[field] + delta) }
      try { localStorage.setItem(electroKey, JSON.stringify(next)) } catch { /* noop */ }
      return next
    })
  }
  // GLP-1 alert: bajo sodio es informativo (no consejo médico)
  const GLP1_NAMES = ['Semaglutida', 'Tirzepatida', 'Retatrutide', 'Ozempic', 'Wegovy']
  const hasGlp1Protocol = Object.keys(state.protocols).some((p) => GLP1_NAMES.some((g) => p.toLowerCase().includes(g.toLowerCase())))

  const tdeeVal = useMemo(() => tdee(state), [state])
  const goalKcal = state.kcalGoal ?? tdeeVal
  const goalP = state.macroGoals?.protein ?? null
  const peso = state.profile?.peso ?? null
  // Glucosa en ayunas — el REGISTRO vive aquí (Comida); Inicio solo muestra la tendencia
  const hasMetabolismo = Object.values(state.protocols).some((p) => PEPTIDES[p.product]?.cat === 'Metabolismo')
  const [glucosaInput, setGlucosaInput] = useState('')
  const glucosaHoy = (() => {
    const series = state.history['Glucosa ayunas']
    if (!series || series.length === 0) return null
    const sorted = [...series].sort((a, b) => b.ts - a.ts)
    const dG = new Date(sorted[0].ts); const tG = new Date(state.todayTs)
    return dG.toDateString() === tG.toDateString() ? sorted[0].value : null
  })()
  // hora de registro elegida (ahora, o una hora de HOY para backfill); la franja se DERIVA de la hora
  const whenTs = parseHoraLabel(horaLabel, state.todayTs) ?? now
  const whenSlot = mealSlot(whenTs)
  const preds = predictions(state, whenTs, 3)
  const results = fuzzySearch(state.foodLibrary, query)
  const yd = new Date(state.todayTs); yd.setDate(yd.getDate() - 1)
  const hasYesterday = (state.nutrition[isoKey(yd.getTime())]?.meals.length ?? 0) > 0

  // Derived water goal from weight (§82)
  const waterGoal = peso ? waterGoalGlasses(peso) : WATER_GOAL
  // Suggested protein from weight (§82)
  const suggestedProtein = (!goalP && peso) ? proteinSuggestion(peso) : null

  // Chip TDEE inteligente (tdeeVal ya memoizado arriba)
  const chipTdee = (tdeeVal && kcal > 0) ? tdeeChip(kcal, tdeeVal) : null

  // Proteína restante accionable
  const protRem = (goalP && goalP > 0 && macros.protein < goalP)
    ? proteinRemaining(macros.protein, goalP, now)
    : null

  // Ventana de ayuno
  const fastMins = fastingMinutes(state.lastMealTs ?? null, now)
  const showFasting = fastMins !== null && fastMins >= 120 // solo mostrar si ≥2 h sin comer

  // Caloric balance label (§83)
  const deficitLabel = goalKcal
    ? kcal >= goalKcal * 0.97 && kcal <= goalKcal * 1.03
      ? { text: 'En meta', color: 'var(--success-ink)' }
      : kcal > goalKcal
        ? { text: `Superávit +${kcal - goalKcal} kcal`, color: 'var(--warning-ink)' }
        : { text: `Déficit −${goalKcal - kcal} kcal`, color: 'var(--brand-700)' }
    : null

  // Totals footer for meals list (§83) — solo desglose de macros (el kcal ya domina arriba)
  const hasDayMacros = macros.hasMacros
  const dayTotals = hasDayMacros ? `P: ${macros.protein} g · C: ${macros.carbs} g · G: ${macros.fat} g` : null

  // Distribución por franja
  const slotDist = useMemo(() => kcalBySlot(day.meals), [day.meals])

  // Calidad proteica (observacional) — memoizados: no deben recalcular en cada tecla del buscador
  const pqScore = useMemo(() => proteinQualityScore(day.meals), [day.meals])
  const pUnbalanced = useMemo(() => isProteinUnbalanced(day.meals), [day.meals])

  // Racha de calidad (proteína)
  const pStreak = useMemo(() => proteinQualityStreak(state), [state])

  // Diversidad semanal
  const diversity = useMemo(() => weeklyDiversityScore(state), [state])

  // Recientes (7 días)
  const recientes = useMemo(() => recentFoods(state, 8), [state])

  const showToast = (msg: string) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 3000)
  }

  // d = ± vasos; se convierte a ml con el tamaño actual del vaso (cambiar el tamaño no altera lo ya tomado)
  const addWater = (d: number) => { tapHaptic(); dispatch({ t: 'water', delta: d * glassMl }) }
  const waterGoalL = waterGoalLiters(peso)
  const saveGlucosa = () => {
    const v = parseFloat(glucosaInput)
    if (!isNaN(v) && v > 0) { dispatch({ t: 'saveMeasure', name: 'Glucosa ayunas', value: v }); setGlucosaInput(''); showToast('Glucosa guardada') }
  }
  const logFav = (f: FoodFav) => {
    tapHaptic()
    dispatch({ t: 'addFavMeal', id: f.id, portion: portion ?? undefined, ts: whenTs })
    showToast(`${f.label} — ${Math.round(f.kcal * (portion ?? (f.defaultMultiplier && f.defaultMultiplier > 0 ? f.defaultMultiplier : 1)))} kcal agregado`)
    setQuery('')
  }
  // Para recientes efímeros (id empieza con _raw_): usar addMeal en lugar de addFavMeal
  const logReciente = (f: FoodFav) => {
    tapHaptic()
    if (f.id.startsWith('_raw_')) {
      dispatch({ t: 'addMeal', kcal: f.kcal, protein: f.protein, carbs: f.carbs, fat: f.fat, label: f.label, fav: true, ts: whenTs })
      showToast(`${f.label} — ${f.kcal} kcal agregado`)
    } else {
      logFav(f)
    }
  }
  const multOf = (f: FoodFav) => portion ?? (f.defaultMultiplier && f.defaultMultiplier > 0 ? f.defaultMultiplier : 1)

  const createAndLog = () => {
    const k = parseFloat(kcalStr)
    if (!(k > 0)) return
    // Guardrails §85 — non-blocking
    if (k < 20) { setKcalWarning('¿unidad o porción pequeña?'); return }
    if (k > 2000) { setKcalWarning('¿una comida o todo el día?') } else { setKcalWarning(null) }
    // Macro-kcal coherence check §81
    const p = parseFloat(pStr) || 0
    const c = parseFloat(cStr) || 0
    const f = parseFloat(fStr) || 0
    if (p || c || f) {
      const computed = kcalFromMacros(p, c, f)
      const diff = Math.abs(computed - k) / k
      setMacroWarning(diff > 0.15 ? 'Las kcal no cuadran con los macros' : null)
    } else {
      setMacroWarning(null)
    }
    tapHaptic()
    const label = query.trim() || undefined
    dispatch({ t: 'addMeal', kcal: k, protein: parseFloat(pStr) || null, carbs: parseFloat(cStr) || null, fat: parseFloat(fStr) || null, label, fav: !!query.trim(), ts: whenTs })
    showToast(`${label ?? 'Comida'} — ${k} kcal agregado`)
    setQuery(''); setKcalStr(''); setPStr(''); setCStr(''); setFStr(''); setShowMacros(false); setCreating(false); setMacroWarning(null); setKcalWarning(null)
  }

  // §84 — Repetir última: meal with highest ts
  const lastMeal = day.meals.length > 0 ? day.meals.reduce((a, b) => (a.ts > b.ts ? a : b)) : null

  // §89 — Copiar de ayer with undo
  const copyYesterday = () => {
    if (day.meals.length > 0) {
      setUndoPending(true)
      showToast('Comidas de ayer copiadas — Deshacer')
      if (_toastUndoId) clearTimeout(_toastUndoId)
      _toastUndoId = setTimeout(() => {
        dispatch({ t: 'copyYesterday' })
        setUndoPending(false)
      }, 3500)
    } else {
      tapHaptic()
      dispatch({ t: 'copyYesterday' })
    }
  }
  const undoCopy = () => {
    if (_toastUndoId) clearTimeout(_toastUndoId)
    setUndoPending(false)
    setToastMsg(null)
  }

  // ── Abrir edición inline de una comida ──
  const openEditMeal = (m: Meal) => {
    setEditingMealId(m.id)
    setEditMealDraft({
      label: m.label ?? '',
      kcalStr: String(m.kcal),
      pStr: m.protein != null ? String(m.protein) : '',
      cStr: m.carbs != null ? String(m.carbs) : '',
      fStr: m.fat != null ? String(m.fat) : '',
      noteStr: m.note ?? '',
    })
  }

  const closeEditMeal = () => setEditingMealId(null)

  const commitEditMeal = (id: string) => {
    const k = parseFloat(editMealDraft.kcalStr)
    if (!(k > 0)) { closeEditMeal(); return }
    tapHaptic()
    dispatch({
      t: 'editMeal', id,
      patch: {
        kcal: Math.round(k),
        label: editMealDraft.label.trim() || null,
        protein: parseFloat(editMealDraft.pStr) > 0 ? parseFloat(editMealDraft.pStr) : null,
        carbs: parseFloat(editMealDraft.cStr) > 0 ? parseFloat(editMealDraft.cStr) : null,
        fat: parseFloat(editMealDraft.fStr) > 0 ? parseFloat(editMealDraft.fStr) : null,
        note: editMealDraft.noteStr.trim().slice(0, 100) || null,
      },
    })
    showToast('Comida actualizada')
    closeEditMeal()
  }

  // ── Borrar comida con undo (n°202) ──
  const handleDelMeal = (m: Meal) => {
    tapHaptic()
    setPendingDelMeal(m)
    setDelUndoPending(true)
    setToastMsg(`Comida eliminada · Deshacer`)
    if (_delMealTimer) clearTimeout(_delMealTimer)
    _delMealTimer = setTimeout(() => {
      dispatch({ t: 'delMeal', id: m.id })
      setDelUndoPending(false)
      setPendingDelMeal(null)
      setToastMsg(null)
    }, 3500)
  }

  const undoDelMeal = () => {
    if (_delMealTimer) clearTimeout(_delMealTimer)
    setDelUndoPending(false)
    setPendingDelMeal(null)
    setToastMsg(null)
  }

  // Exportar CSV
  const handleExportCsv = () => {
    const csv = exportNutritionCsv(state, 7)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `nutricion-${isoKey(state.todayTs)}.csv`
    a.click(); URL.revokeObjectURL(url)
    showToast('CSV exportado (7 días)')
  }

  // Compartir día (Web Share API)
  const handleShare = async () => {
    const text = shareDayText(state)
    if ('share' in navigator) {
      try {
        await (navigator as Navigator & { share: (d: { text: string }) => Promise<void> }).share({ text })
        return
      } catch { /* ignorar cancelación */ }
    }
    // Fallback: copiar al portapapeles
    try {
      await navigator.clipboard.writeText(text)
      showToast('Copiado al portapapeles')
    } catch {
      showToast('No se pudo compartir')
    }
  }

  return (
    <div className="scroll has-nav">
      <motion.div variants={staggerParent} initial="initial" animate="animate" style={{ padding: 'max(44px, env(safe-area-inset-top, 44px)) 20px 40px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <motion.h1 variants={staggerItem} className="h1" style={{ margin: 0 }}>Alimentación</motion.h1>

        {/* ── Strip de hidratación (#356 tamaño de vaso configurable) ── */}
        <motion.section variants={staggerItem} className="card" style={{ padding: '12px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <IcDrop size={20} style={{ color: 'var(--brand-700)', flexShrink: 0 }} />
            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2, minWidth: 0, overflow: 'hidden' }}>
              <span className="sm mono" style={{ color: totalL >= waterGoalL ? 'var(--success)' : 'var(--ink-700)', fontWeight: 700, whiteSpace: 'nowrap' }}>{totalL} / {waterGoalL} L{totalL >= waterGoalL ? ' ✓' : ''}</span>
              <span className="xs" style={{ color: 'var(--ink-400)', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>≈ {Math.round(day.water / glassMl)} vasos · {glassMl} ml/vaso</span>
            </div>
            <div
              role="progressbar"
              aria-valuenow={totalL}
              aria-valuemin={0}
              aria-valuemax={waterGoalL}
              aria-label="Meta de hidratación en litros"
              style={{ flex: 1, minWidth: 60, height: 6, background: 'var(--ink-100)', borderRadius: 999, overflow: 'hidden' }}
            >
              <div style={{ width: `${Math.min(100, waterGoalL > 0 ? (totalL / waterGoalL) * 100 : 0)}%`, height: '100%', background: totalL >= waterGoalL ? 'var(--success)' : 'var(--brand-500)', borderRadius: 999, transition: 'width 0.25s ease, background 0.25s ease' }} />
            </div>
            <button className="iconbtn" aria-label="Quitar vaso" onClick={() => addWater(-1)} disabled={day.water === 0} style={{ minWidth: 44, minHeight: 44, width: 44, height: 44, flexShrink: 0, opacity: day.water === 0 ? 0.4 : 1, cursor: day.water === 0 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
            <button className="iconbtn" aria-label="Agregar vaso" onClick={() => addWater(1)} disabled={day.water >= waterGoalL * 2000} style={{ minWidth: 44, minHeight: 44, width: 44, height: 44, flexShrink: 0, background: 'var(--brand-700)', color: '#fff', opacity: day.water >= waterGoalL * 2000 ? 0.4 : 1, cursor: day.water >= waterGoalL * 2000 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
          </div>
          {/* Config de vaso a segundo nivel (libera ancho en la fila principal) */}
          <button
            aria-label="Configurar tamaño de vaso"
            aria-expanded={showGlassConfig}
            onClick={() => setShowGlassConfig((p) => !p)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 8, background: 'none', border: 0, padding: 0, cursor: 'pointer', color: showGlassConfig ? 'var(--brand-700)' : 'var(--ink-400)' }}
            className="sm"
          >
            <Glyph name="engrane" size={14} color="currentColor" /> Tamaño de vaso <Caret open={showGlassConfig} color="currentColor" />
          </button>
          <AnimatePresence>
            {showGlassConfig && (
              <motion.div
                key="glass-config"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                style={{ overflow: 'hidden' }}
              >
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10, alignItems: 'center' }}>
                  {GLASS_OPTIONS.map((ml) => (
                    <button
                      key={ml}
                      className="chip sm"
                      onClick={() => {
                        setGlassMl(ml)
                        try { localStorage.setItem('hacktrack-glass-ml', String(ml)) } catch { /* noop */ }
                      }}
                      style={{
                        padding: '4px 12px',
                        background: glassMl === ml ? 'var(--brand-700)' : 'var(--bg)',
                        color: glassMl === ml ? '#fff' : 'var(--ink-700)',
                        border: `1px solid ${glassMl === ml ? 'var(--brand-700)' : 'var(--border)'}`,
                        borderRadius: 'var(--r-sm)',
                        cursor: 'pointer',
                        fontWeight: glassMl === ml ? 700 : 400,
                      }}
                    >{ml} ml</button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.section>

        {/* ── Glucosa en ayunas (#124) — el REGISTRO vive aquí; Inicio solo muestra la tendencia ── */}
        {hasMetabolismo && (
          <motion.section variants={staggerItem} className="card" style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span className="sm" style={{ fontWeight: 600, color: 'var(--ink-700)' }}>Glucosa en ayunas</span>
              {glucosaHoy !== null && <span className="sm mono" style={{ color: 'var(--brand-700)', fontWeight: 700 }}>{glucosaHoy} mg/dL hoy</span>}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                className="field"
                type="number" inputMode="decimal"
                placeholder={glucosaHoy !== null ? String(glucosaHoy) : 'mg/dL'}
                value={glucosaInput}
                onChange={(e) => setGlucosaInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') saveGlucosa() }}
                aria-label="Glucosa en ayunas en mg/dL"
                style={{ flex: 1, minWidth: 0, height: 44, fontSize: 16 }}
              />
              <button
                className="btn btn-brand btn-sm"
                style={{ width: 'auto', flexShrink: 0, padding: '0 16px' }}
                disabled={!glucosaInput || isNaN(parseFloat(glucosaInput))}
                onClick={saveGlucosa}
                aria-label="Guardar glucosa en ayunas"
              >Guardar</button>
            </div>
            <p className="sm" style={{ margin: 0, color: 'var(--ink-300)', fontSize: 11 }}>Registro personal — no es consejo médico.</p>
          </motion.section>
        )}

        {/* ── Electrolitos del día (#477) — siempre visible ── */}
        <motion.section variants={staggerItem} className="card" style={{ padding: '12px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, width: '100%' }}>
            <span className="sm" style={{ fontWeight: 700, color: 'var(--ink-700)', minWidth: 0 }}><Glyph name="energia" size={13} color="currentColor" style={{ verticalAlign: '-2px', marginRight: 3 }} /> Electrolitos del día</span>
          </div>
          <>
          <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
            {([
              { key: 'na' as const, label: 'Sodio', daily: 2300, color: 'var(--warning-ink)' },
              { key: 'k' as const, label: 'Potasio', daily: 3500, color: 'var(--brand-500)' },
              { key: 'mg' as const, label: 'Magnesio', daily: 400, color: 'var(--success-ink)' },
            ] as const).map(({ key, label, daily, color }) => {
              const val = electrolytes[key]
              const pct = Math.min(100, (val / daily) * 100)
              return (
                <div key={key} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span className="xs" style={{ color: 'var(--ink-400)', fontWeight: 600 }}>{label}</span>
                  <span className="sm mono" style={{ fontWeight: 700, color }}>{val} mg</span>
                  <div style={{ height: 4, background: 'var(--ink-100)', borderRadius: 999, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 999, transition: 'width 0.25s ease' }} />
                  </div>
                  <span className="xs" style={{ color: 'var(--ink-300)', fontSize: 11 }}>{Math.round(pct)}% de {daily} mg</span>
                  <div style={{ display: 'flex', gap: 4, marginTop: 2 }}>
                    <button className="iconbtn" style={{ flex: 1, minHeight: 44, height: 44, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => updateElectrolyte(key, -100)} disabled={val === 0}>−</button>
                    <button className="iconbtn" style={{ flex: 1, minHeight: 44, height: 44, fontSize: 13, background: color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => updateElectrolyte(key, 100)}>+100</button>
                  </div>
                </div>
              )
            })}
          </div>
          {hasGlp1Protocol && electrolytes.na < 1000 && (
            <div style={{ marginTop: 10, padding: '8px 12px', background: 'color-mix(in srgb, var(--warning) 10%, transparent)', border: '1px solid var(--warning)', borderRadius: 'var(--r-sm)' }}>
              <span className="xs" style={{ color: 'var(--ink-700)' }}>
                <Glyph name="hidratacion" size={13} color="currentColor" style={{ verticalAlign: '-2px', marginRight: 3 }} /> <strong>Info educativa:</strong> Con GLP-1 el apetito disminuye, lo que puede reducir la ingesta de sodio. Asegúrate de consumir alimentos ricos en electrolitos. Consulta a tu médico.
              </span>
            </div>
          )}
          </>
        </motion.section>

        {/* ── Resumen del día ── */}
        <motion.section variants={staggerItem} className="card">
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <span className="mono" style={{ fontSize: 30, fontWeight: 800, color: 'var(--ink-900)', lineHeight: 1.1, minWidth: 0 }}>
              {kcal}<span className="sm" style={{ color: 'var(--ink-400)', fontWeight: 600 }}>{goalKcal ? ` / ${goalKcal} kcal` : ' kcal'}</span>
            </span>
            <GoalEditor />
          </div>
          {goalKcal && (
            <>
              <div
                role="progressbar"
                aria-valuenow={kcal}
                aria-valuemin={0}
                aria-valuemax={goalKcal}
                aria-label="Meta calórica del día"
                style={{ height: 7, background: 'var(--ink-100)', borderRadius: 999, overflow: 'hidden', margin: '10px 0' }}
              >
                <div style={{ width: `${Math.min(100, (kcal / goalKcal) * 100)}%`, height: '100%', background: kcal > goalKcal ? 'var(--warning)' : 'var(--brand-700)', borderRadius: 999, transition: 'width 0.3s ease, background 0.3s ease' }} />
              </div>
              {deficitLabel && (
                <span className="sm" style={{ color: deficitLabel.color, fontWeight: 600 }}>{deficitLabel.text}</span>
              )}
            </>
          )}

          {/* Chip TDEE inteligente (Déficit / Mantenimiento / Superávit) */}
          {chipTdee && (
            <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span className="chip sm" style={{ background: chipTdee.zone === 'deficit-agresivo' ? 'color-mix(in srgb, var(--error) 10%, transparent)' : chipTdee.zone === 'superavit' ? 'color-mix(in srgb, var(--warning) 10%, transparent)' : 'var(--bg)', color: chipTdee.color, border: `1px solid ${chipTdee.color}`, fontWeight: 700, padding: '2px 10px' }}>
                {chipTdee.label}
              </span>
              <span className="sm" style={{ color: 'var(--ink-400)' }}>{chipTdee.detail}</span>
              {chipTdee.zone === 'deficit-agresivo' && (
                <span className="sm" style={{ color: 'var(--error)', fontWeight: 600 }}><Glyph name="efecto" size={13} color="currentColor" style={{ verticalAlign: '-2px', marginRight: 3 }} /> Déficit muy agresivo — registra más o considera si es intencional</span>
              )}
            </div>
          )}

          {/* Macros con toggle g / % + barra apilada */}
          {(macros.hasMacros || goalP) && (
            <div style={{ marginTop: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <span className="sm mono" style={{ color: 'var(--ink-900)', fontWeight: 700, background: 'var(--brand-100)', padding: '3px 10px', borderRadius: 999 }}>
                  {macroMode === 'g'
                    ? `P: ${macros.protein}${goalP ? `/${goalP}` : ''} g`
                    : `P: ${macroPercents(macros.protein, macros.carbs, macros.fat).protein}%`}
                </span>
                {macros.hasMacros && (
                  <>
                    <span className="sm mono" style={{ color: 'var(--ink-400)' }}>
                      {macroMode === 'g'
                        ? `C: ${macros.carbs} g · G: ${macros.fat} g`
                        : `C: ${macroPercents(macros.protein, macros.carbs, macros.fat).carbs}% · G: ${macroPercents(macros.protein, macros.carbs, macros.fat).fat}%`}
                    </span>
                    <button
                      className="chip sm"
                      style={{ marginLeft: 'auto', background: 'var(--bg)', border: '1px solid var(--border)', cursor: 'pointer', fontWeight: 700 }}
                      onClick={() => setMacroMode((m) => m === 'g' ? 'pct' : 'g')}
                      aria-label="Cambiar modo: gramos o porcentaje"
                    >{macroMode === 'g' ? 'g→%' : '%→g'}</button>
                  </>
                )}
                {goalP != null && macros.protein < goalP && (
                  <span className="sm" style={{ color: 'var(--ink-400)' }}>faltan {goalP - macros.protein} g</span>
                )}
              </div>
              {/* Barra apilada P·C·G */}
              {macros.hasMacros && <MacroStackBar protein={macros.protein} carbs={macros.carbs} fat={macros.fat} />}
            </div>
          )}

          {/* Detalle de proteína — colapsado por defecto (regla de ≤1-2 chips a la vista) */}
          {(suggestedProtein != null || (protRem && protRem.remaining > 0) || (pUnbalanced && macros.hasMacros && macros.protein > 20) || pqScore !== 'sin-datos') && (
            <>
              <span
                className="sm"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 10, color: 'var(--ink-700)', fontWeight: 600 }}
              >
                Detalle de proteína
              </span>
              {(
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                  {/* §82 — Chip sugerencia de proteína si no hay meta y hay peso */}
                  {suggestedProtein != null && (
                    <button
                      className="chip"
                      style={{ alignSelf: 'flex-start', maxWidth: '100%', background: 'var(--brand-100)', color: 'var(--brand-700)', fontWeight: 600, border: '1px dashed var(--brand-300)', cursor: 'pointer', whiteSpace: 'normal' }}
                      onClick={() => dispatch({ t: 'setMacroGoals', goals: { protein: suggestedProtein, carbs: (state.macroGoals?.carbs ?? 0), fat: (state.macroGoals?.fat ?? 0) } })}
                    >
                      Meta sugerida: {suggestedProtein} g proteína →
                    </button>
                  )}

                  {/* Proteína restante accionable */}
                  {protRem && protRem.remaining > 0 && (
                    <div className="sm" style={{ color: 'var(--brand-700)', fontWeight: 600 }}>
                      Faltan {protRem.remaining} g de proteína
                      {protRem.perMeal && protRem.mealsLeft > 0
                        ? ` en ~${protRem.mealsLeft} ${protRem.mealsLeft === 1 ? 'comida' : 'comidas'} → ~${protRem.perMeal} g/comida`
                        : ''}
                    </div>
                  )}

                  {/* Alerta distribución proteína desigual */}
                  {pUnbalanced && macros.hasMacros && macros.protein > 20 && (
                    <div className="sm" style={{ color: 'var(--warning-ink)', fontWeight: 600 }}>
                      Mayoría de proteína en una sola toma — distribuir puede ayudar a la síntesis (observacional)
                    </div>
                  )}

                  {/* Calidad proteica */}
                  {pqScore !== 'sin-datos' && (
                    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                      <span className="sm" style={{ color: 'var(--ink-400)' }}>Calidad proteica:</span>
                      <span className="chip sm" style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        background: pqScore === 'alta' ? 'color-mix(in srgb, var(--success) 12%, transparent)' : pqScore === 'media' ? 'color-mix(in srgb, var(--warning) 12%, transparent)' : 'var(--bg)',
                        color: pqScore === 'alta' ? 'var(--success)' : pqScore === 'media' ? 'var(--warning)' : 'var(--ink-400)',
                        fontWeight: 700, border: '1px solid currentColor', padding: '1px 8px',
                      }}>
                        <Dot color="currentColor" /> {pqScore === 'alta' ? 'Alta' : pqScore === 'media' ? 'Media' : 'Baja'}
                      </span>
                      <span className="sm" style={{ color: 'var(--ink-300)' }}>animal/vegetal · observacional</span>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </motion.section>

        {/* ── Ventana de ayuno ── */}
        {showFasting && (
          <motion.section variants={staggerItem} className="card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Glyph name="reloj" size={18} color="currentColor" />
            <span className="sm" style={{ color: 'var(--ink-700)' }}>
              {fastingLabel(fastMins!)} — observacional, sin interpretación clínica
            </span>
            {fastMins! >= 240 && (
              <span className="chip sm" style={{ marginLeft: 'auto', background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--ink-400)', fontWeight: 600 }}>Ayuno prolongado</span>
            )}
          </motion.section>
        )}

        {/* ── Predicciones por franja + barra inteligente ── */}
        <motion.section variants={staggerItem} className="card">
          {/* Estado + acceso a ajustar hora/porción (colapsado por defecto) */}
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
            <span
              className="sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--ink-700)', fontWeight: 600, minWidth: 0 }}
            >
              Ajustar hora/porción <span className="mono" style={{ color: 'var(--ink-400)', fontWeight: 600 }}>· {horaLabel} · {porLabel(portion)}</span>
            </span>
            <span className="sm" aria-live="polite" style={{ color: 'var(--brand-700)', fontWeight: 600, marginLeft: 'auto', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Para tu {whenSlot}</span>
          </div>
          {(
            <>
              {/* Hora del registro (rueda con scroll → backfill; la franja se deriva sola) */}
              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                <span className="sm" style={{ color: 'var(--ink-400)' }}>Hora</span>
                <button className="chip mono" onClick={() => setShowWheel((v) => !v)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 700 }}>{horaLabel} <Caret open={showWheel} color="currentColor" /></button>
                {horaLabel !== 'Ahora' && <button className="chip" style={{ minHeight: 44, height: 44 }} onClick={() => { setHoraLabel('Ahora'); setShowWheel(false) }}>Ahora</button>}
              </div>
              {showWheel && <div style={{ marginBottom: 10 }}><TimeWheel initial={new Date(whenTs)} onChange={setHoraLabel} /></div>}
              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
                <span className="sm" style={{ color: 'var(--ink-400)', marginRight: 'auto' }}>Porción</span>
                {PORTIONS.map((p) => (
                  <button key={String(p)} onClick={() => setPortion(p)} className="sm mono" style={{ border: 0, borderRadius: 8, padding: '2px 7px', cursor: 'pointer', fontWeight: 700, background: portion === p ? 'var(--brand-700)' : 'var(--ink-100)', color: portion === p ? '#fff' : 'var(--ink-400)' }}>
                    {porLabel(p)}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Tarjetas de predicción (1 toque) con confianza visible */}
          {preds.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {preds.map((f, i) => {
                const mult = multOf(f)
                const conf = predictionConfidence(state, f, whenTs)
                return (
                  <button key={f.id} onClick={() => logFav(f)} className="card" style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', cursor: 'pointer', border: '1px solid var(--border)', opacity: i === 0 ? 1 : i === 1 ? 0.92 : 0.84 }}>
                    <span style={{ color: 'var(--brand-700)', flexShrink: 0, display: 'inline-flex' }}>
                      {conf === 'habitual'
                        ? <Glyph name="estrella" size={13} color="var(--brand-700)" />
                        : conf === 'frecuente'
                          ? <Glyph name="cat-crecimiento" size={13} color="var(--brand-700)" />
                          : <Dot color="var(--brand-700)" size={6} />}
                    </span>
                    <span className="body" style={{ fontWeight: 600, color: 'var(--ink-900)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {f.label}
                    </span>
                    {mult !== 1 && (
                      <span className="mono sm" style={{ color: 'var(--ink-400)', flexShrink: 0, fontWeight: 700 }}>{porLabel(mult)}</span>
                    )}
                    {conf && (
                      <span className="sm" style={{ color: 'var(--ink-300)', fontSize: 11, flexShrink: 0 }}>
                        {conf === 'habitual' ? 'habitual' : 'frecuente'}
                      </span>
                    )}
                    <span className="mono sm" style={{ fontWeight: 700, marginLeft: 'auto', flexShrink: 0, whiteSpace: 'nowrap' }}>{Math.round(f.kcal * mult)}<span style={{ color: 'var(--ink-400)' }}> kcal</span></span>
                  </button>
                )
              })}
            </div>
          ) : (
            <EmptyState
              glyph="apetito"
              title={`Tu ${whenSlot}`}
              subtitle={SLOT_PROMPT[whenSlot] ?? 'Registra tu comida abajo y la recordaré.'}
              cta={{ label: 'Registrar comida', onClick: () => { const el = document.querySelector<HTMLInputElement>('.field[placeholder*="Qué comiste"]'); el?.focus() } }}
            />
          )}

          {/* Acción primaria única: Recetario (brand). Crear platillo pasa a secundaria. */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
            <button className="btn btn-brand" style={{ height: 46, fontWeight: 700, gap: 6 }} onClick={() => dispatch({ t: 'sheet', sheet: 'recetario', arg: horaLabel === 'Ahora' ? null : String(whenTs) })}><Glyph name="destello" size={13} color="currentColor" style={{ verticalAlign: '-2px', marginRight: 3 }} /> Recetario</button>
            <button className="sm" style={{ alignSelf: 'flex-start', background: 'none', border: 0, color: 'var(--brand-700)', fontWeight: 600, cursor: 'pointer', padding: 0 }} onClick={() => dispatch({ t: 'sheet', sheet: 'crear-platillo', arg: horaLabel === 'Ahora' ? null : String(whenTs) })}>＋ Crear platillo</button>
          </div>
          {/* Acciones rápidas (chips pequeños, menos prominentes) */}
          {(hasYesterday || lastMeal) && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
              {hasYesterday && <button className="chip" style={{ maxWidth: '100%' }} onClick={copyYesterday}>Copiar de ayer</button>}
              {lastMeal && <button className="chip" style={{ maxWidth: '100%' }} onClick={() => { tapHaptic(); dispatch({ t: 'addMeal', kcal: lastMeal.kcal, protein: lastMeal.protein, carbs: lastMeal.carbs, fat: lastMeal.fat, label: (lastMeal.label ?? undefined), ts: whenTs }); showToast(`${lastMeal.label ?? 'Última comida'} — ${lastMeal.kcal} kcal agregado`) }}>Repetir última</button>}
            </div>
          )}

          {/* Barra inteligente: busca en tu biblioteca o crea (#476 barcode scanner) */}
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input className="field" placeholder="¿Qué comiste? Busca o crea…" value={query} onChange={(e) => { setQuery(e.target.value); setCreating(false); setScanResult(null) }} style={{ flex: 1 }} />
              <button
                className="iconbtn"
                aria-label="Escanear código de barras"
                title="Escanear código de barras"
                onClick={openBarcodeScanner}
                disabled={scannerActive}
                style={{ minWidth: 44, minHeight: 44, width: 44, height: 44, flexShrink: 0, background: scannerActive ? 'var(--ink-100)' : 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: scannerActive ? 'wait' : 'pointer' }}
              >{scannerActive ? <Glyph name="cat-antiaging" size={16} color="currentColor" /> : <Glyph name="camara" size={16} color="currentColor" />}</button>
            </div>
            {scanError && (
              <div style={{ marginTop: 6, padding: '6px 10px', background: 'color-mix(in srgb, var(--error) 8%, transparent)', border: '1px solid var(--error)', borderRadius: 'var(--r-sm)' }}>
                <span className="xs" style={{ color: 'var(--ink-700)' }}>{scanError}</span>
              </div>
            )}
            {scanResult && (
              <div style={{ marginTop: 6, padding: '10px 12px', background: 'color-mix(in srgb, var(--brand-500) 8%, transparent)', border: '1px solid var(--brand-500)', borderRadius: 'var(--r-sm)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span className="sm" style={{ fontWeight: 700, color: 'var(--ink-900)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{scanResult.name}</span>
                  <button aria-label="Cerrar resultado del escáner" onClick={() => setScanResult(null)} style={{ background: 'none', border: 0, color: 'var(--ink-300)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, minWidth: 44, minHeight: 44 }}><IcClose size={16} /></button>
                </div>
                <span className="sm mono" style={{ color: 'var(--brand-700)', fontWeight: 700 }}>{scanResult.kcal} kcal por porción</span>
                {(scanResult.protein != null || scanResult.carbs != null || scanResult.fat != null) && (
                  <span className="xs" style={{ color: 'var(--ink-400)' }}>
                    {[scanResult.protein != null && `P: ${scanResult.protein}g`, scanResult.carbs != null && `C: ${scanResult.carbs}g`, scanResult.fat != null && `G: ${scanResult.fat}g`].filter(Boolean).join(' · ')}
                  </span>
                )}
                <button
                  className="btn btn-brand"
                  style={{ marginTop: 4, height: 44 }}
                  onClick={() => {
                    setQuery(scanResult.name)
                    setKcalStr(String(scanResult.kcal))
                    if (scanResult.protein != null) setPStr(String(scanResult.protein))
                    if (scanResult.carbs != null) setCStr(String(scanResult.carbs))
                    if (scanResult.fat != null) setFStr(String(scanResult.fat))
                    setCreating(true)
                    setShowMacros(scanResult.protein != null || scanResult.carbs != null || scanResult.fat != null)
                    setScanResult(null)
                  }}
                >Usar estos datos</button>
              </div>
            )}
            {query.trim() && (
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {results.map((f) => (
                  <button key={f.id} className="card" onClick={() => logFav(f)} style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', cursor: 'pointer', border: '1px solid var(--border)' }}>
                    <span className="body" style={{ fontWeight: 600, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.label}</span>
                    <span className="mono sm" style={{ marginLeft: 'auto', color: 'var(--ink-400)' }}>{Math.round(f.kcal * multOf(f))} kcal</span>
                  </button>
                ))}
                {!results.some((f) => f.label.toLowerCase() === query.trim().toLowerCase()) && !creating && (
                  <button className="chip" style={{ alignSelf: 'flex-start' }} onClick={() => setCreating(true)}>+ Crear "{query.trim()}"</button>
                )}
                {creating && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <label className="sm" style={{ color: 'var(--ink-400)' }} htmlFor="kcal-input">Calorías</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <input id="kcal-input" className="field mono" type="number" inputMode="numeric" autoFocus placeholder="0" value={kcalStr} aria-label="Calorías (kcal)" onChange={(e) => { setKcalStr(e.target.value); setKcalWarning(null) }} onKeyDown={(e) => { if (e.key === 'Enter') createAndLog() }} style={{ flex: 1, fontSize: 24, fontWeight: 700, textAlign: 'center' }} />
                        <span className="sm" style={{ color: 'var(--ink-400)' }}>kcal</span>
                      </div>
                      {/* §81 macro-kcal mismatch warning */}
                      {macroWarning && <span className="sm" style={{ color: 'var(--warning-ink)', marginTop: 2 }}>{macroWarning}</span>}
                      {/* §85 kcal guardrail */}
                      {kcalWarning && <span className="sm" style={{ color: 'var(--warning-ink)', marginTop: 2 }}>{kcalWarning}</span>}
                    </div>
                    {showMacros ? (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <label className="sm" style={{ color: 'var(--ink-400)' }} htmlFor="p-input">Proteína (g)</label>
                          <input id="p-input" className="field" type="number" inputMode="numeric" placeholder="Proteína (g)" aria-label="Proteína (g)" value={pStr} onChange={(e) => setPStr(e.target.value)} style={{ flex: 1 }} />
                        </div>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <label className="sm" style={{ color: 'var(--ink-400)' }} htmlFor="c-input">Carbos (g)</label>
                          <input id="c-input" className="field" type="number" inputMode="numeric" placeholder="Carbos (g)" aria-label="Carbos (g)" value={cStr} onChange={(e) => setCStr(e.target.value)} style={{ flex: 1 }} />
                        </div>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <label className="sm" style={{ color: 'var(--ink-400)' }} htmlFor="g-input">Grasa (g)</label>
                          <input id="g-input" className="field" type="number" inputMode="numeric" placeholder="Grasa (g)" aria-label="Grasa (g)" value={fStr} onChange={(e) => setFStr(e.target.value)} style={{ flex: 1 }} />
                        </div>
                      </div>
                    ) : (
                      <button className="sm" style={{ background: 'none', border: 0, color: 'var(--brand-700)', fontWeight: 600, cursor: 'pointer', padding: 0, textAlign: 'left' }} onClick={() => setShowMacros(true)}>+ Macros (opcional)</button>
                    )}
                    <button className="btn btn-brand" disabled={!(parseFloat(kcalStr) > 0)} onClick={createAndLog}>Guardar y agregar</button>
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.section>

        {/* ── Sección 'Recientes' (últimos 7 días, registro 1-toque) ── */}
        {recientes.length > 0 && (
          <motion.section variants={staggerItem} className="card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
              <span className="sm" style={{ color: 'var(--ink-700)', fontWeight: 700 }}>Recientes (7 días)</span>
              <span className="sm" style={{ color: 'var(--ink-400)' }}>{recientes.length} alimentos</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
              {recientes.map((f) => {
                const mult = multOf(f)
                return (
                  <button key={f.id} onClick={() => logReciente(f)} className="card" style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', cursor: 'pointer', border: '1px solid var(--border)' }}>
                    <Glyph name="editar" size={13} color="var(--ink-400)" />
                    <span className="body" style={{ fontWeight: 600, color: 'var(--ink-900)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.label}</span>
                    <span className="mono sm" style={{ marginLeft: 'auto', color: 'var(--ink-400)', flexShrink: 0 }}>{Math.round(f.kcal * mult)} kcal</span>
                  </button>
                )
              })}
            </div>
          </motion.section>
        )}

        {/* ── Toast no-bloqueante ── */}
        {toastMsg && (
          <motion.div
            key={toastMsg}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={{ position: 'fixed', bottom: 'calc(80px + env(safe-area-inset-bottom, 0px))', left: '50%', transform: 'translateX(-50%)', background: 'var(--ink-900)', color: '#fff', borderRadius: 12, padding: '10px 18px', zIndex: 999, display: 'flex', alignItems: 'center', gap: 12, maxWidth: 'min(340px, calc(100vw - 32px))', boxShadow: '0 4px 20px rgba(0,0,0,0.18)' }}
          >
            <span className="sm" style={{ fontWeight: 600 }}>{toastMsg}</span>
            {undoPending && (
              <button onClick={undoCopy} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.4)', borderRadius: 6, color: '#fff', fontWeight: 700, cursor: 'pointer', padding: '2px 8px', fontSize: 12 }}>Deshacer</button>
            )}
            {delUndoPending && (
              <button onClick={undoDelMeal} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.4)', borderRadius: 6, color: '#fff', fontWeight: 700, cursor: 'pointer', padding: '2px 8px', fontSize: 12 }}>Deshacer</button>
            )}
          </motion.div>
        )}

        {/* ── Comidas de hoy ── */}
        {day.meals.length > 0 && (
          <motion.section variants={staggerItem} className="card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span className="sm" style={{ color: 'var(--ink-400)' }}>Hoy — {day.meals.length} {day.meals.length === 1 ? 'comida' : 'comidas'}</span>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {state.foodLibrary.length > 0 && (
                  <button className="sm" style={{ background: 'none', border: 0, color: 'var(--brand-700)', fontWeight: 600, cursor: 'pointer', padding: 0 }} onClick={() => setManageFav((v) => !v)}>{manageFav ? 'Listo' : 'Editar favoritos'}</button>
                )}
              </div>
            </div>
            {manageFav ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {state.foodLibrary.map((f) => (
                  <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input className="field" defaultValue={f.label} onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== f.label) dispatch({ t: 'editFav', id: f.id, patch: { label: v } }) }} style={{ flex: 1 }} />
                    <input className="field mono" type="number" inputMode="numeric" defaultValue={f.kcal} onBlur={(e) => { const v = parseFloat(e.target.value); if (v > 0 && v !== f.kcal) dispatch({ t: 'editFav', id: f.id, patch: { kcal: Math.round(v) } }) }} style={{ width: 78, textAlign: 'center' }} />
                    <button aria-label="Eliminar favorito" onClick={() => { tapHaptic(); dispatch({ t: 'delFav', id: f.id }) }} style={{ background: 'none', border: 0, color: 'var(--error)', cursor: 'pointer', display: 'flex' }}><IcClose size={18} /></button>
                  </div>
                ))}
              </div>
            ) : (() => {
              // §86 — Agrupar por mealSlot
              const slots = Object.keys(SLOT_PROMPT)
              const grouped: Record<string, typeof day.meals> = {}
              for (const m of day.meals) {
                const s = mealSlot(m.ts)
                if (!grouped[s]) grouped[s] = []
                grouped[s].push(m)
              }
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {slots.filter((s) => grouped[s]?.length).map((s) => (
                    <div key={s}>
                      <div className="agenda__day-label sm" style={{ color: 'var(--ink-400)', textTransform: 'capitalize', fontWeight: 700, padding: '4px 0 2px', letterSpacing: '0.01em' }}>{s}</div>
                      {grouped[s].map((m) => {
                        // ocultar la fila si está en soft-delete (esperando confirmación de borrado)
                        if (pendingDelMeal?.id === m.id) return null
                        const isEditing = editingMealId === m.id
                        return (
                          <div key={m.id} style={{ borderRadius: 'var(--r-sm)', border: isEditing ? '1px solid var(--brand-300)' : '1px solid transparent', marginBottom: isEditing ? 6 : 0, overflow: 'hidden', transition: 'border-color 0.15s ease' }}>
                            {/* Fila principal — tap en kcal/label abre edición */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: isEditing ? '6px 8px' : '4px 0' }}>
                              <button
                                aria-label="Editar kcal"
                                onClick={() => isEditing ? commitEditMeal(m.id) : openEditMeal(m)}
                                style={{ background: 'none', border: 0, cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'baseline', gap: 3 }}
                              >
                                <span className="body mono" style={{ fontWeight: 700, color: isEditing ? 'var(--brand-700)' : 'var(--ink-900)' }}>{m.kcal}</span>
                                <span className="xs" style={{ color: 'var(--ink-300)', fontSize: 11 }}>kcal</span>
                              </button>
                              <button
                                aria-label={`Editar comida: ${m.label ?? 'sin nombre'}`}
                                onClick={() => isEditing ? commitEditMeal(m.id) : openEditMeal(m)}
                                style={{ background: 'none', border: 0, cursor: 'pointer', padding: 0, flex: 1, textAlign: 'left', minWidth: 0 }}
                              >
                                <div className="sm" style={{ color: 'var(--ink-700)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>
                                  {m.label || 'sin nombre'}
                                </div>
                                {(m.protein || m.carbs || m.fat) && (
                                  <div className="xs mono" style={{ color: 'var(--ink-400)', marginTop: 1, whiteSpace: 'normal', wordBreak: 'break-word' }}>
                                    {[m.protein ? `P: ${m.protein}g` : null, m.carbs ? `C: ${m.carbs}g` : null, m.fat ? `G: ${m.fat}g` : null].filter(Boolean).join(' · ')}
                                  </div>
                                )}
                                {m.note && !isEditing && (
                                  <div className="xs" style={{ color: 'var(--ink-400)', fontStyle: 'italic', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {m.note}
                                  </div>
                                )}
                              </button>
                              <span className="sm" style={{ color: 'var(--ink-400)', flexShrink: 0, fontSize: 11 }}>{fmtTime(m.ts)}</span>
                              {isEditing ? (
                                <button
                                  aria-label="Cancelar edición"
                                  onClick={closeEditMeal}
                                  style={{ background: 'none', border: 0, color: 'var(--ink-300)', cursor: 'pointer', display: 'flex', flexShrink: 0 }}
                                ><IcClose size={16} /></button>
                              ) : (
                                <button
                                  aria-label="Eliminar"
                                  onClick={() => handleDelMeal(m)}
                                  style={{ background: 'none', border: 0, color: 'var(--ink-300)', cursor: 'pointer', display: 'flex', flexShrink: 0 }}
                                ><IcClose size={16} /></button>
                              )}
                            </div>
                            {/* Acordeón de edición inline */}
                            <AnimatePresence>
                              {isEditing && (
                                <motion.div
                                  key={`edit-${m.id}`}
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.18 }}
                                  style={{ overflow: 'hidden' }}
                                >
                                  <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid var(--border)' }}>
                                    {/* Nombre */}
                                    <div>
                                      <label className="xs" style={{ color: 'var(--ink-400)', display: 'block', marginBottom: 3 }}>Nombre</label>
                                      <input
                                        className="field sm"
                                        value={editMealDraft.label}
                                        onChange={(e) => setEditMealDraft((d) => ({ ...d, label: e.target.value }))}
                                        placeholder="Sin nombre"
                                        style={{ width: '100%' }}
                                      />
                                    </div>
                                    {/* kcal + macros en fila */}
                                    <div style={{ display: 'flex', gap: 6 }}>
                                      <div style={{ flex: 1 }}>
                                        <label className="xs" style={{ color: 'var(--ink-400)', display: 'block', marginBottom: 3 }}>kcal</label>
                                        <input
                                          className="field sm mono"
                                          type="number"
                                          inputMode="numeric"
                                          value={editMealDraft.kcalStr}
                                          onChange={(e) => setEditMealDraft((d) => ({ ...d, kcalStr: e.target.value }))}
                                          style={{ textAlign: 'center' }}
                                          onKeyDown={(e) => { if (e.key === 'Enter') commitEditMeal(m.id) }}
                                        />
                                      </div>
                                      <div style={{ flex: 1 }}>
                                        <label className="xs" style={{ color: 'var(--ink-400)', display: 'block', marginBottom: 3 }}>P (g)</label>
                                        <input className="field sm" type="number" inputMode="numeric" value={editMealDraft.pStr} onChange={(e) => setEditMealDraft((d) => ({ ...d, pStr: e.target.value }))} style={{ textAlign: 'center' }} />
                                      </div>
                                      <div style={{ flex: 1 }}>
                                        <label className="xs" style={{ color: 'var(--ink-400)', display: 'block', marginBottom: 3 }}>C (g)</label>
                                        <input className="field sm" type="number" inputMode="numeric" value={editMealDraft.cStr} onChange={(e) => setEditMealDraft((d) => ({ ...d, cStr: e.target.value }))} style={{ textAlign: 'center' }} />
                                      </div>
                                      <div style={{ flex: 1 }}>
                                        <label className="xs" style={{ color: 'var(--ink-400)', display: 'block', marginBottom: 3 }}>G (g)</label>
                                        <input className="field sm" type="number" inputMode="numeric" value={editMealDraft.fStr} onChange={(e) => setEditMealDraft((d) => ({ ...d, fStr: e.target.value }))} style={{ textAlign: 'center' }} />
                                      </div>
                                    </div>
                                    {/* Nota opcional ≤100 chars */}
                                    <div>
                                      <label className="xs" style={{ color: 'var(--ink-400)', display: 'block', marginBottom: 3 }}>
                                        Nota (opcional · observacional)
                                        <span style={{ color: editMealDraft.noteStr.length > 80 ? 'var(--warning)' : 'var(--ink-300)', marginLeft: 6 }}>{editMealDraft.noteStr.length}/100</span>
                                      </label>
                                      <input
                                        className="field sm"
                                        value={editMealDraft.noteStr}
                                        onChange={(e) => setEditMealDraft((d) => ({ ...d, noteStr: e.target.value.slice(0, 100) }))}
                                        placeholder="Ej: con poco aceite, antes del gym…"
                                        style={{ width: '100%' }}
                                        onKeyDown={(e) => { if (e.key === 'Enter') commitEditMeal(m.id) }}
                                      />
                                    </div>
                                    {/* Guardar */}
                                    <button
                                      className="btn btn-brand"
                                      style={{ height: 44 }}
                                      disabled={!(parseFloat(editMealDraft.kcalStr) > 0)}
                                      onClick={() => commitEditMeal(m.id)}
                                    >Guardar cambios</button>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        )
                      })}
                    </div>
                  ))}
                  {/* §83 — Footer del día: solo desglose de macros (kcal ya domina arriba) */}
                  {dayTotals && (
                    <div className="sm mono" style={{ color: 'var(--ink-400)', borderTop: '1px solid var(--border)', paddingTop: 8, marginTop: 4, fontWeight: 600, overflowWrap: 'anywhere' }}>{dayTotals}</div>
                  )}
                </div>
              )
            })()}
          </motion.section>
        )}

        {/* ── Análisis y tendencias — siempre visible ── */}
        <motion.section variants={staggerItem} className="card" style={{ padding: '12px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, width: '100%' }}>
            <span className="sm" style={{ color: 'var(--ink-700)', fontWeight: 700, minWidth: 0 }}>Análisis y tendencias</span>
          </div>
        </motion.section>
        {(<>
        {/* ── Distribución calórica por franja horaria (chrono-nutrición) ── */}
        {slotDist.length >= 2 && (
          <motion.section variants={staggerItem} className="card">
            <span className="sm" style={{ color: 'var(--ink-700)', fontWeight: 700, display: 'block', marginBottom: 10 }}>Distribución por franja</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {slotDist.map(({ slot, kcal: sk, pct }) => (
                <div key={slot}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span className="sm" style={{ color: 'var(--ink-700)', textTransform: 'capitalize' }}>{slot}</span>
                    <span className="sm mono" style={{ color: 'var(--ink-400)' }}>{sk} kcal · {pct}%</span>
                  </div>
                  <div style={{ height: 5, background: 'var(--ink-100)', borderRadius: 999, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: pct >= 40 ? 'var(--warning)' : 'var(--brand-500)', borderRadius: 999, transition: 'width 0.3s ease' }} />
                  </div>
                </div>
              ))}
              <span className="sm" style={{ color: 'var(--ink-300)', marginTop: 2 }}>Distribución calórica del día — referencia observacional, sin prescripción</span>
            </div>
          </motion.section>
        )}

        {/* ── Señales de calidad + diversidad ── */}
        {(pStreak >= 3 || diversity.unique >= 5) && (
          <motion.section variants={staggerItem} className="card">
            <span className="sm" style={{ color: 'var(--ink-700)', fontWeight: 700, display: 'block', marginBottom: 8 }}>Señales de calidad</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {pStreak >= 3 && (
                <span className="sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, maxWidth: '100%', padding: '5px 11px', borderRadius: 14, whiteSpace: 'normal', lineHeight: 1.3, background: 'color-mix(in srgb, var(--success) 12%, transparent)', color: 'var(--success-ink)', border: '1px solid var(--success)', fontWeight: 700 }}>
                  <Glyph name="musculo" size={13} color="currentColor" style={{ verticalAlign: '-2px', marginRight: 3 }} /> {pStreak} días en meta de proteína
                </span>
              )}
              {diversity.unique >= 5 && (
                <span className="sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, maxWidth: '100%', padding: '5px 11px', borderRadius: 14, whiteSpace: 'normal', lineHeight: 1.3, background: 'var(--brand-100)', color: 'var(--brand-700)', border: '1px solid var(--brand-300)', fontWeight: 700 }}>
                  <Glyph name="hoja" size={13} color="currentColor" style={{ verticalAlign: '-2px', marginRight: 3 }} /> {diversity.unique} alimentos distintos · {diversity.level} variedad
                </span>
              )}
            </div>
          </motion.section>
        )}

        {/* ── Mini heatmap semanal de kcal ── */}
        <motion.section variants={staggerItem} className="card">
          <span className="sm" style={{ color: 'var(--ink-700)', fontWeight: 700, display: 'block', marginBottom: 10 }}>Semana en kcal</span>
          <WeekHeatmap s={state} />
          <span className="sm" style={{ color: 'var(--ink-300)', marginTop: 6, display: 'block' }}>
            Últimos 7 días · {goalKcal ? `meta ${goalKcal} kcal` : 'define una meta para ver la línea'}
          </span>
        </motion.section>

        {/* ── Tu protocolo en números (mini · Plus) ── */}
        <AnchorMini />
        </>)}

        {/* ── Acciones de exportación ── */}
        {day.meals.length > 0 && (
          <motion.section variants={staggerItem} className="card" style={{ padding: '12px 16px' }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="chip sm" style={{ cursor: 'pointer', background: 'var(--bg)', border: '1px solid var(--border)' }} onClick={handleShare}>
                Compartir día
              </button>
              <button className="chip sm" style={{ cursor: 'pointer', background: 'var(--bg)', border: '1px solid var(--border)' }} onClick={handleExportCsv}>
                Exportar CSV (7 días)
              </button>
            </div>
          </motion.section>
        )}

        {/* ── Metas de macros (Plus) ── */}
        <motion.section variants={staggerItem}>
          <PremiumGate label="Metas de macros — Plus">
            <MacroGoals />
          </PremiumGate>
        </motion.section>

        <motion.p variants={staggerItem} className="sm" style={{ color: 'var(--ink-300)', lineHeight: 1.4, borderLeft: '2px solid var(--border)', paddingLeft: 10 }}>
          Registro personal de hidratación y nutrición. No es consejo nutricional ni médico.
        </motion.p>
      </motion.div>
    </div>
  )
}

// editor de meta calórica (inline)
function GoalEditor() {
  const { state, dispatch } = useApp()
  const [edit, setEdit] = useState(false)
  const [unusualToast, setUnusualToast] = useState(false)
  const goal = state.kcalGoal
  if (edit) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
        <input
          className="field" type="number" inputMode="numeric" autoFocus placeholder="kcal/día"
          defaultValue={goal ?? ''} min={500} max={9999}
          aria-label="Meta calórica diaria"
          onBlur={(e) => {
            const v = parseFloat(e.target.value) || null
            if (v != null && (v < 500 || v > 9999)) setUnusualToast(true)
            dispatch({ t: 'setKcalGoal', value: v }); setEdit(false)
          }}
          style={{ width: 110, maxWidth: '100%' }}
        />
        {unusualToast && <span className="sm" style={{ color: 'var(--warning-ink)' }}>Meta inusual</span>}
      </div>
    )
  }
  return (
    <button className="sm" style={{ background: 'none', border: 0, color: 'var(--brand-700)', fontWeight: 600, cursor: 'pointer', padding: 0 }} onClick={() => setEdit(true)}>
      {goal ? 'Editar meta' : 'Definir meta'}
    </button>
  )
}

// metas de macros (Plus) — el usuario define; barras del día vs meta
function MacroGoals() {
  const { state, dispatch } = useApp()
  const [edit, setEdit] = useState(false)
  const goals = state.macroGoals
  const day = state.nutrition[isoKey(state.todayTs)] ?? { water: 0, meals: [] }
  const m = dayMacros(day.meals)
  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span className="body" style={{ fontWeight: 600, color: 'var(--ink-900)' }}>Macros vs tus metas</span>
        <button className="sm" style={{ background: 'none', border: 0, color: 'var(--brand-700)', fontWeight: 600, cursor: 'pointer', padding: 0 }} onClick={() => setEdit((v) => !v)}>{edit ? 'Listo' : goals ? 'Editar metas' : 'Definir metas'}</button>
      </div>
      {edit || !goals ? (
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          {([['protein', 'Proteína'], ['carbs', 'Carbos'], ['fat', 'Grasa']] as const).map(([k, lbl]) => (
            <div key={k} style={{ flex: 1 }}>
              <label className="sm" style={{ color: 'var(--ink-400)' }}>{lbl} (g)</label>
              <input className="field" type="number" inputMode="numeric" placeholder="0" defaultValue={goals?.[k] ?? ''}
                onBlur={(e) => { const v = Math.max(0, parseFloat(e.target.value) || 0); const next = { protein: goals?.protein ?? 0, carbs: goals?.carbs ?? 0, fat: goals?.fat ?? 0, [k]: v }; dispatch({ t: 'setMacroGoals', goals: next.protein || next.carbs || next.fat ? next : null }) }} />
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
          {([['protein', 'Proteína', 'var(--brand-700)'], ['carbs', 'Carbos', 'var(--warning)'], ['fat', 'Grasa', 'var(--brand-300)']] as const).map(([k, lbl, color]) => {
            const cur = m[k]; const goal = goals[k] || 0; const pct = goal > 0 ? Math.min(100, (cur / goal) * 100) : 0
            return (
              <div key={k}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span className="sm" style={{ color: 'var(--ink-700)' }}>{lbl}</span>
                  <span className="sm mono" style={{ color: 'var(--ink-900)' }}>{cur} / {goal} g</span>
                </div>
                <div
                  role="progressbar"
                  aria-valuenow={cur}
                  aria-valuemin={0}
                  aria-valuemax={goal}
                  aria-label={`Meta de ${lbl}`}
                  style={{ height: 7, background: 'var(--ink-100)', borderRadius: 999, overflow: 'hidden' }}
                >
                  <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 999, transition: 'width 0.28s ease, background 0.28s ease' }} />
                </div>
              </div>
            )
          })}
          <div className="sm" style={{ color: 'var(--ink-300)' }}>Tú defines tus metas. La app no prescribe cuánto comer.</div>
        </div>
      )}
    </div>
  )
}

// mini ancla "Tu protocolo en números" (Plus)
function AnchorMini() {
  const { state } = useApp()
  const pn = protocolNumbers(state)
  const ap = anchorProduct(state)
  if (!pn || (pn.deltaKcal == null && pn.weightDelta == null)) return null
  const sub = Object.keys(state.protocols).length > 1 ? 'Desde el inicio de tu seguimiento' : ap ? `Desde que iniciaste ${ap}` : 'Desde tu fecha de inicio'
  return (
    <motion.section variants={staggerItem}>
      <PremiumGate label="Tu protocolo en números — Plus">
        <div className="card">
          <span className="body" style={{ fontWeight: 600, color: 'var(--ink-900)' }}>Tu protocolo en números</span>
          <span className="sm" style={{ color: 'var(--ink-400)', display: 'block', marginTop: 2, marginBottom: 10 }}>{sub}</span>
          <div style={{ display: 'flex', gap: 20, marginBottom: 8 }}>
            {pn.deltaKcal != null && <div><div className="mono" style={{ fontSize: 24, fontWeight: 800, color: pn.deltaKcal <= 0 ? 'var(--success)' : 'var(--ink-900)' }}>{pn.deltaKcal > 0 ? '+' : ''}{pn.deltaKcal}</div><div className="sm" style={{ color: 'var(--ink-400)' }}>kcal/día prom.</div></div>}
            {pn.weightDelta != null && <div><div className="mono" style={{ fontSize: 24, fontWeight: 800, color: pn.weightDelta <= 0 ? 'var(--success)' : 'var(--ink-900)' }}>{pn.weightDelta > 0 ? '+' : ''}{pn.weightDelta}</div><div className="sm" style={{ color: 'var(--ink-400)' }}>kg</div></div>}
          </div>
          {pn.weightPoints.length >= 2 ? (() => {
            const wp = pn.weightPoints
            const net = wp[wp.length - 1] - wp[0]
            const goal = state.profile.metaPesoKg
            const towardGoal = goal != null ? (goal < wp[0] ? net <= 0 : net >= 0) : net <= 0
            return (
              <div style={{ marginTop: 4 }}>
                <TrendChart data={wp} w={280} h={52} trendColor={towardGoal ? 'var(--success)' : 'var(--warning)'} labels={[`${wp[0]} kg`, `${wp[wp.length - 1]} kg`]} />
                <div className="sm" style={{ color: 'var(--ink-400)', marginTop: 2 }}>Peso · línea de tendencia</div>
              </div>
            )
          })() : pn.kcalPoints.length >= 2 ? (
            <div style={{ marginTop: 4 }}>
              <Sparkline data={pn.kcalPoints.map((x) => x.kcal)} color="var(--brand-500)" w={280} h={32} />
              <div className="sm" style={{ color: 'var(--ink-400)', marginTop: 2 }}>kcal/día</div>
            </div>
          ) : null}
        </div>
      </PremiumGate>
    </motion.section>
  )
}
