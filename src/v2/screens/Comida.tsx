// Comida v2 — resumen nutricional del día, restyled al Design System "Bitácora" (LOCKED 2026-07-17).
// R35: tap-to-edit + borrar con undo via toast. R38: electrolitos Na/K/Mg con ± y barras + ventana
// de ayuno. R39: editores de meta kcal/macros + selector de tamaño de vaso.
// Bitácora: kcal = gauge ÁMBAR (Ring) + numeral serif; hidratación = azul (ref inicio: kcal ámbar /
// agua azul); superficies = columna impresa (Glass) para contenido y pozo cálido (raised) para lo
// médico/operativo. Motion: fade+y stagger solo opacity/transform; respeta useReducedMotion().
// Overhaul ESTÉTICO: dispatches, semántica y validaciones intactos.
import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import {
  Droplet, Utensils, Star, ChevronRight, Plus, Minus,
  Pencil, Trash2, Check, X, Timer, Flame, ChevronDown, ChevronUp, Download,
} from 'lucide-react'
import { useApp, isoKey } from '../../lib/store'
import {
  dayMacros,
  tdee,
  waterGoalLiters,
  litersFromMl,
  recentFoods,
  fastingMinutes,
  fastingLabel,
  exportNutritionCsv,
} from '../../lib/nutrition'
import type { FoodFav, Meal } from '../../lib/types'
import { Glass } from '../ui/Glass'
import { Chip } from '../ui/Chip'
import { Button } from '../ui/Button'
import { Ring } from '../ui/Ring'
import { StatNumber } from '../ui/StatNumber'
import { FolioLabel } from '../ui/FolioLabel'
import { TermInfo } from '../ui/TermInfo'
import { SectionHero } from '../ui/SectionHero'
import { EASE } from '../lib/motion'
import { HEROES } from '../lib/heroes'

// ── Variante de animación compartida (easing firma Bitácora) ─────────────────
const fade = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: EASE },
  },
}

// ── Barra de progreso genérica (pista = pozo cálido, nunca blanco/alpha) ─────
function ProgressBar({
  value,
  max,
  color = 'bg-blue',
}: {
  value: number
  max: number
  color?: string
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      className="h-1.5 overflow-hidden rounded-full bg-raised"
    >
      <div
        className={`h-full rounded-full transition-[width] duration-300 ${color}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

// ── Fila de macro (etiqueta + valor + barra) ──────────────────────────────────
function MacroRow({
  label,
  value,
  goal,
  unit = 'g',
  color,
}: {
  label: string
  value: number
  goal: number | null
  unit?: string
  color: string
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[13px] text-ink-2">{label}</span>
        <span className="font-mono text-[13px] tabular-nums text-ink">
          {value}
          {goal != null && (
            <span className="text-ink-3"> / {goal} {unit}</span>
          )}
          {goal == null && <span className="text-ink-3"> {unit}</span>}
        </span>
      </div>
      {goal != null && <ProgressBar value={value} max={goal} color={color} />}
    </div>
  )
}

// ── Chip de comida frecuente (1 toque) ────────────────────────────────────────
function FoodChip({
  fav,
  onTap,
}: {
  fav: FoodFav
  onTap: (f: FoodFav) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onTap(fav)}
      className="flex min-h-[44px] flex-col items-start justify-center gap-0.5 rounded-[8px] border border-hairline bg-surface px-3 py-2 text-left transition-colors active:bg-raised"
    >
      <span className="text-[13px] font-semibold leading-tight text-ink">{fav.label}</span>
      <span className="font-mono text-[12px] tabular-nums text-ink-3">
        {fav.kcal} kcal
        {fav.protein != null && ` · P: ${fav.protein} g`}
      </span>
    </button>
  )
}

// ── R35: Editor inline de comida ──────────────────────────────────────────────
function MealEditRow({
  meal,
  onSave,
  onCancel,
}: {
  meal: Meal
  onSave: (patch: { label: string; kcal: number; protein: number | null; carbs: number | null; fat: number | null }) => void
  onCancel: () => void
}) {
  const [label, setLabel] = useState(meal.label ?? '')
  const [kcalStr, setKcalStr] = useState(String(meal.kcal))
  const [proteinStr, setProteinStr] = useState(meal.protein != null ? String(meal.protein) : '')
  const [carbsStr, setCarbsStr] = useState(meal.carbs != null ? String(meal.carbs) : '')
  const [fatStr, setFatStr] = useState(meal.fat != null ? String(meal.fat) : '')

  const parseNum = (s: string) => {
    const v = parseFloat(s.replace(',', '.'))
    return isNaN(v) || v < 0 ? null : v
  }

  const kcalVal = parseFloat(kcalStr.replace(',', '.'))
  const valid = label.trim().length > 0 && !isNaN(kcalVal) && kcalVal > 0

  const numInput = (
    val: string,
    setter: (v: string) => void,
    placeholder: string,
    ariaLabel: string,
  ) => (
    <input
      type="text"
      inputMode="decimal"
      placeholder={placeholder}
      aria-label={ariaLabel}
      value={val}
      onChange={(e) => {
        const v = e.target.value.replace(',', '.')
        if (/^\d*\.?\d*$/.test(v)) setter(v)
      }}
      className="h-11 w-full rounded-[8px] border border-hairline bg-surface px-2 font-mono text-[13px] text-ink placeholder:text-ink-3 focus:border-blue focus:outline-none"
    />
  )

  return (
    <div className="flex flex-col gap-2 bg-raised px-4 py-3">
      <input
        type="text"
        placeholder="Nombre"
        aria-label="Nombre de la comida"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        maxLength={80}
        autoFocus
        className="h-11 w-full rounded-[8px] border border-hairline bg-surface px-2 text-[15px] text-ink placeholder:text-ink-3 focus:border-blue focus:outline-none"
      />
      <div className="grid grid-cols-4 gap-2">
        {numInput(kcalStr, setKcalStr, 'kcal *', 'Calorías kcal')}
        {numInput(proteinStr, setProteinStr, 'P (g)', 'Proteína g')}
        {numInput(carbsStr, setCarbsStr, 'C (g)', 'Carbos g')}
        {numInput(fatStr, setFatStr, 'G (g)', 'Grasa g')}
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          <X size={14} /> Cancelar
        </Button>
        <Button
          variant="primary"
          size="sm"
          disabled={!valid}
          onClick={() =>
            onSave({
              label: label.trim() || 'Comida',
              kcal: Math.round(kcalVal),
              protein: parseNum(proteinStr),
              carbs: parseNum(carbsStr),
              fat: parseNum(fatStr),
            })
          }
        >
          <Check size={14} /> Guardar
        </Button>
      </div>
    </div>
  )
}

// ── R35: Fila de comida con tap-to-edit y borrar ──────────────────────────────
function MealRow({
  meal,
  onEdit,
  onDelete,
  isEditing,
  onSave,
  onCancelEdit,
}: {
  meal: Meal
  onEdit: (id: string) => void
  onDelete: (id: string) => void
  isEditing: boolean
  onSave: (patch: { label: string; kcal: number; protein: number | null; carbs: number | null; fat: number | null }) => void
  onCancelEdit: () => void
}) {
  const fmtTime = (ts: number) =>
    new Date(ts).toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' })

  if (isEditing) {
    return <MealEditRow meal={meal} onSave={onSave} onCancel={onCancelEdit} />
  }

  return (
    <div className="group flex min-h-[52px] items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-medium text-ink">
          {meal.label ?? 'Comida'}
        </p>
        <p className="font-mono text-[12px] text-ink-3">
          {fmtTime(meal.ts)}
          {meal.protein != null && ` · P: ${meal.protein} g`}
        </p>
      </div>
      {/* kcal en serif — el numeral es la voz */}
      <span className="shrink-0 font-serif text-[17px] font-normal tabular-nums text-ink">
        {meal.kcal}
        <span className="font-mono text-[11px] font-normal text-ink-3"> kcal</span>
      </span>
      {/* Acciones — siempre visibles para accesibilidad AA */}
      <div className="flex shrink-0 gap-1">
        <button
          type="button"
          aria-label={`Editar ${meal.label ?? 'comida'}`}
          onClick={() => onEdit(meal.id)}
          className="flex h-[44px] w-[44px] items-center justify-center rounded-full text-ink-3 transition-colors hover:text-blue active:bg-raised"
        >
          <Pencil size={15} />
        </button>
        <button
          type="button"
          aria-label={`Borrar ${meal.label ?? 'comida'}`}
          onClick={() => onDelete(meal.id)}
          className="flex h-[44px] w-[44px] items-center justify-center rounded-full text-ink-3 transition-colors hover:text-alert active:bg-raised"
        >
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  )
}

// ── R38: Fila de electrolito con ± y barra ────────────────────────────────────
function ElectrolyteRow({
  label,
  symbol,
  unit,
  value,
  goal,
  color,
  onIncrement,
  onDecrement,
  step,
}: {
  label: string
  symbol: string
  unit: string
  value: number
  goal: number
  color: string
  onIncrement: () => void
  onDecrement: () => void
  step: number
}) {
  const pct = goal > 0 ? Math.min(100, (value / goal) * 100) : 0
  // Misma semántica de umbrales que el legado (>=100 ok, >=60 medio, si no warn);
  // el color medio pasa de teal→azul (datos). El estado nunca va solo: valor/meta al lado.
  const status = pct >= 100 ? 'ok' : pct >= 60 ? 'mid' : 'warn'
  const statusColor = status === 'ok' ? 'bg-ok' : status === 'mid' ? 'bg-blue' : 'bg-warn'

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        {/* Símbolo químico como insignia mono neutra (instrumento, no semáforo) */}
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-hairline bg-raised font-mono text-[11px] font-semibold text-ink-2">
          {symbol}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-1">
            <span className="text-[13px] font-medium text-ink">{label}</span>
            <span className="shrink-0 font-mono text-[13px] tabular-nums text-ink-2">
              {value} / {goal} {unit}
            </span>
          </div>
          <div className="mt-1">
            <ProgressBar value={value} max={goal} color={statusColor} />
          </div>
        </div>
        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            aria-label={`Restar ${step} ${unit} de ${label}`}
            disabled={value <= 0}
            onClick={onDecrement}
            className="flex h-[44px] w-[44px] items-center justify-center rounded-full border border-hairline bg-surface text-ink transition-colors active:bg-raised disabled:opacity-40"
          >
            <Minus size={14} />
          </button>
          <button
            type="button"
            aria-label={`Agregar ${step} ${unit} de ${label}`}
            onClick={onIncrement}
            className="flex h-[44px] w-[44px] items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--blue)_12%,transparent)] text-blue transition-opacity active:opacity-70"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}

// ── R39: Editor de meta kcal/macros ──────────────────────────────────────────
function GoalsEditor({
  onClose,
  kcalGoal,
  macroGoals,
  onSaveKcal,
  onSaveMacros,
}: {
  onClose: () => void
  kcalGoal: number | null
  macroGoals: { protein: number; carbs: number; fat: number } | null
  onSaveKcal: (v: number | null) => void
  onSaveMacros: (g: { protein: number; carbs: number; fat: number } | null) => void
}) {
  const [kcalStr, setKcalStr] = useState(kcalGoal != null ? String(kcalGoal) : '')
  const [protStr, setProtStr] = useState(macroGoals?.protein != null ? String(macroGoals.protein) : '')
  const [carbStr, setCarbStr] = useState(macroGoals?.carbs != null ? String(macroGoals.carbs) : '')
  const [fatStr, setFatStr] = useState(macroGoals?.fat != null ? String(macroGoals.fat) : '')
  // #54: error visible cuando el usuario llena algunos pero no todos los macros
  const [macroError, setMacroError] = useState('')

  const parsePos = (s: string) => {
    const v = parseFloat(s.replace(',', '.'))
    return isNaN(v) || v <= 0 ? null : Math.round(v)
  }

  const handleSave = () => {
    const k = parsePos(kcalStr)
    onSaveKcal(k)
    const p = parsePos(protStr)
    const c = parsePos(carbStr)
    const f = parsePos(fatStr)
    const anyFilled = protStr !== '' || carbStr !== '' || fatStr !== ''
    const allFilled = p != null && c != null && f != null
    // #54: si hay valores parciales (1-2 de 3) mostrar error y NO cerrar ni guardar
    if (anyFilled && !allFilled) {
      setMacroError('Completa los 3 macros o déjalos todos vacíos')
      return
    }
    setMacroError('')
    if (allFilled) {
      onSaveMacros({ protein: p, carbs: c, fat: f })
    } else {
      onSaveMacros(null)
    }
    onClose()
  }

  const numField = (
    label: string,
    val: string,
    setter: (v: string) => void,
    placeholder: string,
    ariaLabel: string,
    unit: string,
  ) => (
    <div className="flex flex-col gap-1.5">
      <label className="font-mono text-[12px] font-medium uppercase tracking-[0.08em] text-ink-2">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          type="text"
          inputMode="decimal"
          placeholder={placeholder}
          aria-label={ariaLabel}
          value={val}
          onChange={(e) => {
            const v = e.target.value.replace(',', '.')
            if (/^\d*\.?\d*$/.test(v)) setter(v)
          }}
          className="h-11 flex-1 rounded-[8px] border border-hairline bg-surface px-3 font-mono text-[15px] text-ink placeholder:text-ink-3 focus:border-blue focus:outline-none"
        />
        <span className="shrink-0 font-mono text-[12px] text-ink-3">{unit}</span>
      </div>
    </div>
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="font-serif text-[17px] font-normal text-ink">Editar metas</p>
        <button
          type="button"
          aria-label="Cerrar editor de metas"
          onClick={onClose}
          className="flex h-[44px] w-[44px] items-center justify-center rounded-full text-ink-3 transition-colors hover:bg-raised hover:text-ink"
        >
          <X size={16} />
        </button>
      </div>
      <div className="flex flex-col gap-3">
        {numField('Meta calórica', kcalStr, setKcalStr, 'Ej. 2000', 'Meta calórica en kcal', 'kcal')}
        <p className="mt-1 font-mono text-[12px] font-medium uppercase tracking-[0.08em] text-ink-3">
          Macros (opcional — deja vacío para desactivar)
        </p>
        {numField('Proteína', protStr, (v) => { setProtStr(v); setMacroError('') }, 'Ej. 150', 'Meta proteína en g', 'g')}
        {numField('Carbohidratos', carbStr, (v) => { setCarbStr(v); setMacroError('') }, 'Ej. 200', 'Meta carbos en g', 'g')}
        {numField('Grasa', fatStr, (v) => { setFatStr(v); setMacroError('') }, 'Ej. 65', 'Meta grasa en g', 'g')}
        {/* #54: error de macros parciales */}
        {macroError && (
          <p className="text-[12px] text-alert" role="alert">{macroError}</p>
        )}
      </div>
      <Button variant="primary" size="full" onClick={handleSave}>
        <Check size={15} /> Guardar metas
      </Button>
    </div>
  )
}

// ── R39: Selector de tamaño de vaso ──────────────────────────────────────────
function GlassSizeSelector({
  current,
  onChange,
}: {
  current: number
  onChange: (ml: number) => void
}) {
  const SIZES = [150, 200, 250, 300, 350, 500]
  return (
    <div className="flex flex-col gap-2">
      <p className="font-mono text-[12px] font-medium uppercase tracking-[0.08em] text-ink-3">
        Tamaño de vaso
      </p>
      <div className="flex flex-wrap gap-2">
        {SIZES.map((ml) => (
          <button
            key={ml}
            type="button"
            aria-pressed={current === ml}
            onClick={() => onChange(ml)}
            className={[
              'h-11 min-w-[56px] rounded-full px-3 font-mono text-[13px] font-medium transition-colors',
              current === ml
                ? 'bg-blue text-primary-foreground'
                : 'border border-hairline bg-surface text-ink-2 hover:bg-raised',
            ].join(' ')}
          >
            {ml} ml
          </button>
        ))}
        {/* Custom size input */}
        <CustomGlassInput current={current} onChange={onChange} presets={SIZES} />
      </div>
    </div>
  )
}

function CustomGlassInput({
  current,
  onChange,
  presets,
}: {
  current: number
  onChange: (ml: number) => void
  presets: number[]
}) {
  const isCustom = !presets.includes(current)
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(isCustom ? String(current) : '')
  const inputRef = useRef<HTMLInputElement>(null)

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setVal(isCustom ? String(current) : '')
          setEditing(true)
          setTimeout(() => inputRef.current?.focus(), 0)
        }}
        className={[
          'h-11 min-w-[56px] rounded-full px-3 font-mono text-[13px] font-medium transition-colors',
          isCustom
            ? 'bg-blue text-primary-foreground'
            : 'border border-hairline bg-surface text-ink-2 hover:bg-raised',
        ].join(' ')}
      >
        {isCustom ? `${current} ml` : 'Otro…'}
      </button>
    )
  }

  return (
    <div className="flex items-center gap-1">
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        placeholder="ml"
        aria-label="Tamaño personalizado del vaso en ml"
        value={val}
        onChange={(e) => {
          if (/^\d*$/.test(e.target.value)) setVal(e.target.value)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            const n = parseInt(val, 10)
            if (n >= 50 && n <= 2000) { onChange(n); setEditing(false) }
          }
          if (e.key === 'Escape') setEditing(false)
        }}
        className="h-11 w-[72px] rounded-[8px] border border-blue bg-surface px-2 font-mono text-[13px] text-ink focus:outline-none"
      />
      <button
        type="button"
        aria-label="Confirmar tamaño"
        onClick={() => {
          const n = parseInt(val, 10)
          if (n >= 50 && n <= 2000) onChange(n)
          setEditing(false)
        }}
        className="flex h-11 w-11 items-center justify-center rounded-[8px] bg-[color-mix(in_srgb,var(--blue)_12%,transparent)] text-blue"
      >
        <Check size={14} />
      </button>
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────
export function Comida() {
  const { state, dispatch } = useApp()
  const reduce = useReducedMotion()
  const now = Date.now()
  // Día mostrado = día del RELOJ (no todayTs, que puede rezagarse ~60 s tras medianoche): es el
  // MISMO reloj con el que escriben 'water'/'addMeal'/'addFavMeal', así un tap post-medianoche se
  // lee en el bucket donde cayó. Se recalcula en cada render (cada dispatch y el tick de 60 s).
  const key = isoKey(now)
  const day = state.nutrition[key] ?? { water: 0, meals: [] }

  // ── Datos de calorías y macros ─────────────────────────────────────────────
  const kcal = useMemo(() => day.meals.reduce((s, m) => s + m.kcal, 0), [day.meals])
  const macros = useMemo(() => dayMacros(day.meals), [day.meals])
  const tdeeVal = useMemo(() => tdee(state), [state])
  const goalKcal = state.kcalGoal ?? tdeeVal
  // #10: solo los objetivos metabólicos/composición encuadran el conteo como meta/déficit.
  const metabolic =
    state.curGoal === 'Metabolismo' || state.curGoal === 'Crecimiento' ||
    (state.secondaryGoals ?? []).some((g) => g === 'Metabolismo' || g === 'Crecimiento')
  const goalProtein = state.macroGoals?.protein ?? null
  const goalCarbs = state.macroGoals?.carbs ?? null
  const goalFat = state.macroGoals?.fat ?? null

  // % de la meta para el gauge ámbar (solo presentación; el arco clampa a 100, el numeral es honesto)
  const kcalPct = goalKcal != null && goalKcal > 0 ? Math.round((kcal / goalKcal) * 100) : null

  // ── Hidratación ────────────────────────────────────────────────────────────
  const totalMl = day.water
  const totalL = litersFromMl(totalMl)
  const waterGoalL = waterGoalLiters(state.profile.peso)

  // R39: glassMl persistido en localStorage con setter
  const [glassMl, setGlassMlState] = useState<number>(() => {
    try { return Number(localStorage.getItem('hacktrack-glass-ml') ?? '250') || 250 } catch { return 250 }
  })
  const setGlassMl = useCallback((ml: number) => {
    setGlassMlState(ml)
    try { localStorage.setItem('hacktrack-glass-ml', String(ml)) } catch { /* noop */ }
  }, [])

  const addWater = (delta: number) => {
    dispatch({ t: 'water', delta: delta * glassMl })
  }

  // ── R39: Editor de metas ───────────────────────────────────────────────────
  const [showGoalsEditor, setShowGoalsEditor] = useState(false)
  const [showGlassEditor, setShowGlassEditor] = useState(false)

  // ── Glucosa en ayunas ──────────────────────────────────────────────────────
  const [glucosaInput, setGlucosaInput] = useState('')
  const [glucosaError, setGlucosaError] = useState('')
  const glucosaHoy = useMemo(() => {
    const series = state.history['Glucosa ayunas']
    if (!series || series.length === 0) return null
    const sorted = [...series].sort((a, b) => b.ts - a.ts)
    // isoKey del día del RELOJ: mismo día en el que saveMeasure estampa (todayTs puede rezagarse)
    return isoKey(sorted[0].ts) === isoKey(Date.now()) ? sorted[0].value : null
  }, [state.history, state.todayTs])

  const saveGlucosa = () => {
    const v = parseFloat(glucosaInput)
    if (!isNaN(v) && v > 0) {
      if (v < 40 || v > 400) {
        setGlucosaError('Verifica el valor (rango típico 40-400 mg/dL)')
        return
      }
      setGlucosaError('')
      dispatch({ t: 'saveMeasure', name: 'Glucosa ayunas', value: v })
      setGlucosaInput('')
    }
  }

  // ── Comidas recientes / FoodFav ────────────────────────────────────────────
  const recientes = useMemo(() => recentFoods(state, 6), [state])
  const [favTab, setFavTab] = useState<'recientes' | 'biblioteca'>('recientes')
  const biblioteca = useMemo(
    () => [...state.foodLibrary].sort((a, b) => b.usoCount - a.usoCount).slice(0, 12),
    [state.foodLibrary],
  )

  const logFav = (f: FoodFav) => {
    const tapTs = Date.now()
    if (f.id.startsWith('_raw_')) {
      dispatch({ t: 'addMeal', kcal: f.kcal, protein: f.protein, carbs: f.carbs, fat: f.fat, label: f.label, fav: true, ts: tapTs })
    } else {
      dispatch({ t: 'addFavMeal', id: f.id, ts: tapTs })
    }
  }

  // ── Comidas del día agrupadas desc ────────────────────────────────────────
  const mealsDesc = useMemo(
    () => [...day.meals].sort((a, b) => b.ts - a.ts),
    [day.meals],
  )

  // ── R35: estado de edición ─────────────────────────────────────────────────
  const [editingMealId, setEditingMealId] = useState<string | null>(null)

  // Guardar cambios inline
  const handleSaveMeal = useCallback(
    (
      id: string,
      patch: { label: string; kcal: number; protein: number | null; carbs: number | null; fat: number | null },
    ) => {
      dispatch({ t: 'editMeal', id, patch })
      dispatch({ t: 'toast', msg: 'Comida actualizada' })
      setEditingMealId(null)
    },
    [dispatch],
  )

  // Borrar comida con undo via toast
  // Nota: el store no tiene undoMeal nativamente; mostramos toast confirmatorio.
  // La acción real de undo requiere guardarse el meal en un buffer local o una nueva store action.
  const [deletedMealBuffer, setDeletedMealBuffer] = useState<Meal | null>(null)
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleDeleteMeal = useCallback(
    (id: string) => {
      const meal = day.meals.find((m) => m.id === id)
      if (!meal) return

      // Buffer para undo local
      setDeletedMealBuffer(meal)
      dispatch({ t: 'delMeal', id })

      // Limpiar timer previo
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current)

      // Solo mostramos el overlay local con el botón Deshacer (sin toast del store).
      // Auto-limpiamos el buffer después de 5 s.
      undoTimerRef.current = setTimeout(() => {
        setDeletedMealBuffer(null)
      }, 5000)
    },
    [day.meals, dispatch],
  )

  const handleUndoDelete = useCallback(() => {
    if (!deletedMealBuffer) return
    // #55: limpiar buffer ANTES del dispatch para hacer undo idempotente —
    // múltiples taps del botón "Deshacer" no crean duplicados porque el buffer
    // ya está vacío en el segundo tap (el botón desaparece con AnimatePresence).
    // Nota: addMeal no acepta id/favId en su firma → el reducer genera un nuevo id;
    // la restauración preserva todos los macros y la hora original pero no el id original.
    const m = deletedMealBuffer
    setDeletedMealBuffer(null)
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
    dispatch({
      t: 'addMeal',
      kcal: m.kcal,
      protein: m.protein,
      carbs: m.carbs,
      fat: m.fat,
      label: m.label ?? undefined,
      ts: m.ts,
    })
    dispatch({ t: 'toast', msg: null })
  }, [deletedMealBuffer, dispatch])

  // ── R38: Electrolitos ─────────────────────────────────────────────────────
  // Almacenados como medidas en state.history con clave fija; o en dayNotes como fallback.
  // Usamos una forma simple: estado local persistido via medidas del día (saveMeasure).
  // Como alternativa directa sin action nueva: guardamos en localStorage (estado efímero del día).
  // Los mantenemos en state local sincronizado con state.history para evitar nuevas store actions.
  // Lee la última muestra del día del RELOJ vía isoKey — el mismo día en el que saveMeasure estampa
  // sus ts, así un tap post-medianoche se lee donde se escribió (todayTs puede rezagarse tras el tick).
  const getElectro = (name: string) => {
    const series = state.history[name]
    if (!series) return 0
    const todayKey = isoKey(Date.now())
    const entry = [...series]
      .sort((a, b) => b.ts - a.ts)
      .find((s) => isoKey(s.ts) === todayKey)
    return entry?.value ?? 0
  }

  const naMg = getElectro('Sodio diario')
  const kMg = getElectro('Potasio diario')
  const mgMg = getElectro('Magnesio diario')

  // Solo el DELTA viaja al store: la base la lee el reducer (última muestra del día) — taps rápidos
  // acumulan aunque React no haya re-renderizado entre ellos.
  const addElectro = (name: string, delta: number, step: number) => {
    dispatch({ t: 'saveMeasure', name, delta: delta * step })
  }

  // Metas de electrolitos (OMS orientativas — solo informativo, sin claims médicos)
  const NA_GOAL = 2300  // mg/día
  const K_GOAL = 4700   // mg/día
  const MG_GOAL = 400   // mg/día

  // ── R38: Ventana de ayuno ─────────────────────────────────────────────────
  const fastMins = useMemo(
    () => fastingMinutes(state.lastMealTs, now),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.lastMealTs],
  )
  const FASTING_THRESHOLD_H = 4  // a partir de aquí el nudge es proactivo ("ya llevas X sin comer")
  const noFastActive = state.fastStartTs == null
  // El ayuno se inicia JUSTO al terminar de comer, así que la opción debe estar SIEMPRE disponible (no solo
  // tras 4 h sin comer). A las ≥4 h subimos a un nudge prominente; antes, una entrada discreta pero presente.
  const fastNudge = noFastActive && fastMins != null && fastMins >= FASTING_THRESHOLD_H * 60

  // Kicker-fecha del masthead (coherencia de reloj con la ref) — solo presentación.
  const metaFecha = new Date(now)
    .toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' })
    .replace(/\./g, '')
    .toUpperCase()

  // ── Toast undo inline (para meal) ─────────────────────────────────────────
  // Inyectamos el botón de undo en el toast del store temporalmente.
  // Para mantener compatibilidad sin modificar store, usamos un overlay local.
  // El toast real viene del componente Toast global; aquí solo mostramos el overlay si hay buffer.

  return (
    <motion.div
      className="flex flex-col gap-4 px-4 pb-32 pt-[max(20px,env(safe-area-inset-top))]"
      initial={reduce ? false : 'hidden'}
      animate="show"
      variants={{ show: { transition: { staggerChildren: 0.07 } } }}
    >
      {/* ── Undo overlay para meal borrada ─────────────────────────────────── */}
      <AnimatePresence>
        {deletedMealBuffer && (
          <motion.div
            className="pointer-events-none fixed inset-x-0 z-[60] flex justify-center px-4"
            style={{ bottom: 'calc(env(safe-area-inset-bottom) + 88px)' }}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 14 }}
            transition={reduce ? { duration: 0.15 } : { type: 'spring', stiffness: 320, damping: 30 }}
            role="status"
            aria-live="polite"
          >
            <div className="glass pointer-events-auto flex max-w-full items-center gap-3 rounded-full px-4 py-2.5 text-[14px] text-ink shadow-soft">
              <span className="truncate">
                "{deletedMealBuffer.label ?? 'Comida'}" eliminada
              </span>
              <button
                type="button"
                className="shrink-0 font-semibold text-blue"
                onClick={handleUndoDelete}
              >
                Deshacer
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Encabezado — masthead editorial ─────────────────────────────────── */}
      <motion.div variants={fade}>
        <SectionHero
          {...HEROES.comida}
          eyebrow="Tu bitácora · nutrición"
          meta={`HOY · ${metaFecha}`}
          title="Alimentación"
        />
      </motion.div>

      {/* ── R38: Iniciar ayuno — SIEMPRE disponible si no hay ayuno activo ───── */}
      <AnimatePresence>
        {noFastActive && (
          <motion.div
            key="fast-start"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {fastNudge && fastMins != null ? (
              // Nudge prominente: ya llevas un rato sin comer
              <div className="flex items-center gap-3 rounded-[8px] border border-[color-mix(in_srgb,var(--blue)_35%,transparent)] bg-[color-mix(in_srgb,var(--blue)_8%,transparent)] px-4 py-3">
                <Timer size={18} className="shrink-0 text-blue" />
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-semibold text-ink">
                    {fastingLabel(fastMins)}
                  </p>
                  <p className="text-[12px] text-ink-2">
                    ¿Marcar el inicio de tu ventana de ayuno?
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="shrink-0 text-blue"
                  onClick={() => dispatch({ t: 'startFast' })}
                >
                  Iniciar ayuno
                </Button>
              </div>
            ) : (
              // Entrada discreta: disponible siempre (p. ej. justo después de comer)
              <button
                type="button"
                onClick={() => dispatch({ t: 'startFast' })}
                className="flex w-full items-center gap-3 rounded-[8px] border border-hairline bg-surface px-4 py-2.5 text-left transition active:scale-[0.99]"
              >
                <Timer size={16} className="shrink-0 text-blue" />
                <span className="flex-1 text-[14px] font-medium text-ink">
                  Iniciar ventana de ayuno
                </span>
                <span className="shrink-0 text-[13px] font-semibold text-blue">Iniciar</span>
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Banner de ayuno activo */}
      <AnimatePresence>
        {state.fastStartTs != null && (
          <motion.div
            key="active-fast-banner"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <FastActiveBanner fastStartTs={state.fastStartTs} dispatch={dispatch} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── A. Resumen del día (kcal + macros) — gauge ÁMBAR + numeral serif ── */}
      <motion.div variants={fade}>
        <FolioLabel n={1} className="mb-2">Energía · hoy</FolioLabel>
        <Glass>
          <div className="mb-3 flex items-center gap-5">
            {/* Dial ámbar (la firma) — % de tu meta; el arco clampa, el numeral no miente */}
            {kcalPct != null && (
              <div className="shrink-0">
                <Ring value={kcalPct} goal={100} unit="%" label="Meta" size={116} stroke={10} />
              </div>
            )}
            <div className="flex min-w-0 flex-1 flex-col items-start gap-1.5">
              <StatNumber
                label="Calorías hoy"
                value={kcal}
                unit={goalKcal != null ? `/ ${goalKcal} kcal` : 'kcal'}
                size={34}
              />
              {goalKcal != null && kcal > 0 && (
                <span
                  className={`inline-flex items-center rounded-full border border-hairline px-2.5 py-1 font-mono text-[12px] font-medium text-ink ${
                    kcal > goalKcal * 1.05
                      ? 'bg-[color-mix(in_srgb,var(--warn)_16%,transparent)]'
                      : kcal >= goalKcal * 0.95
                      ? 'bg-[color-mix(in_srgb,var(--ok)_14%,transparent)]'
                      : 'bg-[color-mix(in_srgb,var(--blue)_10%,transparent)]'
                  }`}
                >
                  {kcal > goalKcal * 1.05
                    ? `+${kcal - goalKcal} kcal sobre meta`
                    : kcal >= goalKcal * 0.95
                    ? 'En meta'
                    : `Restan ${goalKcal - kcal} kcal`}
                </span>
              )}
              {/* R39: botón editar metas (interactivo = azul) */}
              <button
                type="button"
                aria-label="Editar metas de calorías y macros"
                onClick={() => setShowGoalsEditor((v) => !v)}
                className="flex min-h-[44px] items-center gap-1 text-[13px] font-medium text-blue transition-colors hover:text-blue-press"
              >
                <Pencil size={12} /> Editar metas
              </button>
            </div>
          </div>

          {/* R39: Editor de metas (inline colapsable) */}
          <AnimatePresence>
            {showGoalsEditor && (
              <motion.div
                key="goals-editor"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="border-t border-hairline pb-1 pt-4">
                  <GoalsEditor
                    onClose={() => setShowGoalsEditor(false)}
                    kcalGoal={state.kcalGoal}
                    macroGoals={state.macroGoals}
                    onSaveKcal={(v) => dispatch({ t: 'setKcalGoal', value: v })}
                    onSaveMacros={(g) => dispatch({ t: 'setMacroGoals', goals: g })}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Barra de progreso calórico — ÁMBAR (energía), warn al pasarse */}
          {!showGoalsEditor && goalKcal != null && (
            <div className="mb-4">
              <ProgressBar
                value={kcal}
                max={goalKcal}
                color={kcal > goalKcal ? 'bg-warn' : 'bg-amber'}
              />
            </div>
          )}

          {/* Macros — series de datos: P azul · C ámbar · G tinta muda */}
          {!showGoalsEditor && (macros.hasMacros || goalProtein != null || goalCarbs != null || goalFat != null) && (
            <div className="flex flex-col gap-3 border-t border-hairline pt-3">
              <p className="font-mono text-[12px] font-medium uppercase tracking-[0.08em] text-ink-3">
                Macros
              </p>
              <MacroRow label="Proteína" value={macros.protein} goal={goalProtein} color="bg-blue" />
              <MacroRow label="Carbohidratos" value={macros.carbs} goal={goalCarbs} color="bg-amber" />
              <MacroRow label="Grasa" value={macros.fat} goal={goalFat} color="bg-ink-3" />
            </div>
          )}

          {/* #115: Exportar CSV de los últimos 30 días */}
          {!showGoalsEditor && (
            <div className="flex justify-end border-t border-hairline pt-3">
              <button
                type="button"
                aria-label="Exportar historial nutricional como CSV"
                onClick={() => {
                  const csv = exportNutritionCsv(state, 30)
                  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = 'hacktrack-nutricion-30d.csv'
                  a.click()
                  URL.revokeObjectURL(url)
                }}
                className="flex min-h-[44px] items-center gap-1.5 text-[13px] font-medium text-blue transition-colors hover:text-blue-press"
              >
                <Download size={13} /> Exportar 30 días CSV
              </button>
            </div>
          )}
        </Glass>
      </motion.div>

      {/* ── B. R35: Comidas del día con tap-to-edit y borrar ─────────────────── */}
      <motion.div variants={fade}>
        <div className="mb-2 flex items-center gap-2">
          <FolioLabel n={2} className="min-w-0 flex-1">Comidas de hoy</FolioLabel>
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0 gap-1 text-blue"
            onClick={() => dispatch({ t: 'sheet', sheet: 'recetario' })}
          >
            <Plus size={15} /> Agregar
          </Button>
        </div>
        <Glass className="overflow-hidden p-0">
          {mealsDesc.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
              <Utensils size={28} className="text-ink-3 opacity-50" />
              <p className="text-[15px] font-medium text-ink-2">Sin comidas registradas</p>
              <p className="text-[13px] text-ink-3">
                Usa el recetario o los alimentos frecuentes para registrar rápido.
              </p>
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-hairline">
              {mealsDesc.map((meal) => (
                <MealRow
                  key={meal.id}
                  meal={meal}
                  isEditing={editingMealId === meal.id}
                  onEdit={(id) => setEditingMealId(id)}
                  onDelete={handleDeleteMeal}
                  onSave={(patch) => handleSaveMeal(meal.id, patch)}
                  onCancelEdit={() => setEditingMealId(null)}
                />
              ))}
            </div>
          )}
        </Glass>
      </motion.div>

      {/* ── C. Recetario / Alimentos frecuentes ─────────────────────────────── */}
      <motion.div variants={fade}>
        <FolioLabel n={3} className="mb-2">Recetario y frecuentes</FolioLabel>
        <Glass className="flex flex-col gap-3">
          {/* Tabs: recientes vs biblioteca */}
          <div className="flex gap-2">
            <Chip
              active={favTab === 'recientes'}
              onClick={() => setFavTab('recientes')}
            >
              <Star size={12} className="inline-block" /> Recientes
            </Chip>
            <Chip
              active={favTab === 'biblioteca'}
              onClick={() => setFavTab('biblioteca')}
            >
              Biblioteca
            </Chip>
          </div>

          {/* Lista de comidas */}
          {favTab === 'recientes' ? (
            recientes.length === 0 ? (
              <p className="py-2 text-[13px] text-ink-2">
                Aún no hay registros recientes.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {recientes.map((f) => (
                  <FoodChip key={f.id} fav={f} onTap={logFav} />
                ))}
              </div>
            )
          ) : (
            biblioteca.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-4 text-center">
                <p className="text-[13px] text-ink-2">
                  Tu biblioteca está vacía.
                </p>
                {/* R37: abre RecetarioSheet directo en 'create' */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => dispatch({ t: 'sheet', sheet: 'crear-platillo' })}
                >
                  Crear platillo
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {biblioteca.map((f) => (
                  <FoodChip key={f.id} fav={f} onTap={logFav} />
                ))}
              </div>
            )
          )}

          {/* CTA recetario completo — contorno azul (interactivo) */}
          <button
            type="button"
            onClick={() => dispatch({ t: 'sheet', sheet: 'recetario' })}
            className="flex min-h-[48px] items-center justify-between gap-2 rounded-[8px] border border-blue bg-[color-mix(in_srgb,var(--blue)_8%,transparent)] px-4 py-3 text-[15px] font-semibold text-blue transition-colors active:bg-[color-mix(in_srgb,var(--blue)_14%,transparent)]"
          >
            Abrir recetario completo
            <ChevronRight size={16} />
          </button>
        </Glass>
      </motion.div>

      {/* ── D. Hidratación (pozo cálido — médica/operativa; agua = AZUL) ─────── */}
      <motion.div variants={fade}>
        <FolioLabel n={4} className="mb-2">Hidratación</FolioLabel>
        <div className="flex flex-col gap-3 rounded-sm border border-hairline bg-raised p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-[15px] font-medium text-ink">
              <Droplet size={16} className="text-blue" />
              Agua hoy
            </span>
            {/* Readout serif + unidad mono (numeral = la voz) */}
            <span className="font-serif text-[22px] font-normal tabular-nums leading-none text-ink">
              {totalL}
              <span className="font-mono text-[12px] font-medium text-ink-2"> / {waterGoalL} L</span>
            </span>
          </div>

          <ProgressBar
            value={totalMl}
            max={waterGoalL * 1000}
            color={totalMl >= waterGoalL * 1000 ? 'bg-ok' : 'bg-blue'}
          />

          <p className="font-mono text-[12px] text-ink-3">
            ≈ {Math.round(totalMl / glassMl)} vasos de {glassMl} ml
          </p>

          {/* Controles de agua */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Quitar un vaso"
              disabled={totalMl <= 0}
              onClick={() => addWater(-1)}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-hairline bg-surface text-ink transition-colors active:bg-raised disabled:opacity-40"
            >
              <Minus size={16} />
            </button>
            <div className="flex-1 text-center">
              <p className="text-[14px] font-medium text-ink">
                {totalMl >= waterGoalL * 1000 ? '¡Meta alcanzada!' : `Faltan ${(waterGoalL - totalL).toFixed(1)} L`}
              </p>
            </div>
            <button
              type="button"
              aria-label="Agregar un vaso"
              onClick={() => addWater(1)}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity active:opacity-80"
            >
              <Plus size={16} />
            </button>
          </div>

          {/* R39: Selector de tamaño de vaso (colapsable) */}
          <div className="border-t border-hairline pt-3">
            <button
              type="button"
              onClick={() => setShowGlassEditor((v) => !v)}
              className="flex min-h-[44px] w-full items-center justify-between gap-2 font-mono text-[12px] text-ink-2"
              aria-expanded={showGlassEditor}
            >
              <span>Vaso actual: {glassMl} ml</span>
              {showGlassEditor ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            <AnimatePresence>
              {showGlassEditor && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="mt-3">
                    <GlassSizeSelector current={glassMl} onChange={setGlassMl} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>

      {/* ── R38: Electrolitos (pozo cálido — médica/operativa) ─────────────── */}
      <motion.div variants={fade}>
        <div className="mb-2 flex items-center gap-2">
          <FolioLabel n={5} className="min-w-0 flex-1">Electrolitos</FolioLabel>
          <TermInfo term="electrolitos">
            Minerales (sodio, potasio, magnesio) que ayudan al balance de líquidos de tu cuerpo.
          </TermInfo>
        </div>
        <div className="flex flex-col gap-4 rounded-sm border border-hairline bg-raised p-4">
          <ElectrolyteRow
            label="Sodio"
            symbol="Na"
            unit="mg"
            value={naMg}
            goal={NA_GOAL}
            color="bg-blue"
            step={200}
            onIncrement={() => addElectro('Sodio diario', 1, 200)}
            onDecrement={() => addElectro('Sodio diario', -1, 200)}
          />
          <ElectrolyteRow
            label="Potasio"
            symbol="K"
            unit="mg"
            value={kMg}
            goal={K_GOAL}
            color="bg-ok"
            step={300}
            onIncrement={() => addElectro('Potasio diario', 1, 300)}
            onDecrement={() => addElectro('Potasio diario', -1, 300)}
          />
          <ElectrolyteRow
            label="Magnesio"
            symbol="Mg"
            unit="mg"
            value={mgMg}
            goal={MG_GOAL}
            color="bg-warn"
            step={50}
            onIncrement={() => addElectro('Magnesio diario', 1, 50)}
            onDecrement={() => addElectro('Magnesio diario', -1, 50)}
          />
          <p className="text-[12px] leading-snug text-ink-3">
            Referencias orientativas (OMS). Solo informativo — no diagnóstico médico. Datos guardados solo en tu dispositivo.
          </p>
        </div>
      </motion.div>

      {/* ── E. Glucosa (pozo cálido — médica/operativa) ─────────────────────── */}
      <motion.div variants={fade}>
        <FolioLabel n={6} className="mb-2">Glucosa en ayunas</FolioLabel>
        <div className="rounded-sm border border-hairline bg-raised p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="text-[15px] font-medium text-ink">Registro de hoy</span>
            {glucosaHoy != null && (
              <span className="font-serif text-[20px] font-normal tabular-nums leading-none text-ink">
                {glucosaHoy} <span className="font-mono text-[12px] font-normal text-ink-3">mg/dL</span>
              </span>
            )}
          </div>

          <div className="flex gap-2">
            <input
              type="number"
              inputMode="decimal"
              placeholder={glucosaHoy != null ? String(glucosaHoy) : 'mg/dL'}
              value={glucosaInput}
              onChange={(e) => { setGlucosaInput(e.target.value); setGlucosaError('') }}
              onKeyDown={(e) => { if (e.key === 'Enter') saveGlucosa() }}
              aria-label="Glucosa en ayunas en mg/dL"
              className="h-11 min-w-0 flex-1 rounded-[8px] border border-hairline bg-surface px-3 font-mono text-[15px] text-ink placeholder:text-ink-3 focus:border-blue focus:outline-none"
            />
            <Button
              variant="outline"
              size="sm"
              disabled={!glucosaInput || isNaN(parseFloat(glucosaInput))}
              onClick={saveGlucosa}
              aria-label="Guardar glucosa en ayunas"
            >
              Guardar
            </Button>
          </div>

          {glucosaError && (
            <p className="mt-1 text-[12px] text-alert" role="alert">{glucosaError}</p>
          )}

          <p className="mt-3 text-[12px] leading-snug text-ink-3">
            Solo referencial, no diagnóstico médico. Tu historial se guarda solo en tu dispositivo.
          </p>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ── Banner de ayuno activo (externo para no re-renderizar todo) ───────────────
function FastActiveBanner({
  fastStartTs,
  dispatch,
}: {
  fastStartTs: number
  dispatch: ReturnType<typeof useApp>['dispatch']
}) {
  const [now, setNow] = useState(Date.now())

  // Actualizar contador cada minuto (#12: useEffect, no useState — el cleanup de useState nunca
  // se invoca, dejaba el intervalo vivo tras desmontar disparando setState en componente muerto).
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [])

  const mins = fastingMinutes(fastStartTs, now) ?? 0
  const label = fastingLabel(mins)

  return (
    <div className="flex items-center gap-3 rounded-[8px] border border-[color-mix(in_srgb,var(--ok)_35%,transparent)] bg-[color-mix(in_srgb,var(--ok)_8%,transparent)] px-4 py-3">
      <Flame size={18} className="shrink-0 text-ok" />
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-semibold text-ink">
          Ayuno activo — {label}
        </p>
        <p className="text-[12px] text-ink-2">
          Solo referencial — no sustituye consejo médico.
        </p>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="shrink-0 text-ok"
        onClick={() => dispatch({ t: 'endFast' })}
      >
        Terminar
      </Button>
    </div>
  )
}
