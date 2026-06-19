// Comida v2 — resumen nutricional del día con diseño "Precision × Accessible".
// R35: tap-to-edit + borrar con undo via toast.
// R38: electrolitos Na/K/Mg con ± y barras + ventana de ayuno.
// R39: editores de meta kcal/macros + selector de tamaño de vaso.
// Superficies: Glass para contenido/analítica, bg-raised para médicas/operativas.
// Motion: fade+y stagger solo en opacity/transform; respeta useReducedMotion().
import { useState, useMemo, useCallback, useRef } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import {
  Droplet, Utensils, Star, Activity, ChevronRight, Plus, Minus,
  Pencil, Trash2, Check, X, Timer, Flame, ChevronDown, ChevronUp,
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
} from '../../lib/nutrition'
import type { FoodFav, Meal } from '../../lib/types'
import { Glass } from '../ui/Glass'
import { Chip } from '../ui/Chip'
import { Button } from '../ui/Button'
import { SectionHero } from '../ui/SectionHero'
import { HEROES } from '../lib/heroes'

// ── Variante de animación compartida ─────────────────────────────────────────
const fade = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: [0, 0, 0, 1] as [number, number, number, number] },
  },
}

// ── Barra de progreso genérica ────────────────────────────────────────────────
function ProgressBar({
  value,
  max,
  color = 'bg-teal',
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
      className="h-1.5 overflow-hidden rounded-full bg-white/10"
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
        <span className="text-[12px] text-muted-foreground">{label}</span>
        <span className="font-mono text-[13px] tabular-nums text-foreground">
          {value}
          {goal != null && (
            <span className="text-muted-foreground"> / {goal} {unit}</span>
          )}
          {goal == null && <span className="text-muted-foreground"> {unit}</span>}
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
      className="flex min-h-[44px] flex-col items-start justify-center gap-0.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-left transition-colors active:bg-white/10"
    >
      <span className="text-[13px] font-semibold text-foreground leading-tight">{fav.label}</span>
      <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
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
      className="h-9 w-full rounded-md border border-white/10 bg-void px-2 font-mono text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-teal/50"
    />
  )

  return (
    <div className="flex flex-col gap-2 px-4 py-3 bg-white/4">
      <input
        type="text"
        placeholder="Nombre"
        aria-label="Nombre de la comida"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        maxLength={80}
        autoFocus
        className="h-9 w-full rounded-md border border-white/10 bg-void px-2 text-[14px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-teal/50"
      />
      <div className="grid grid-cols-4 gap-2">
        {numInput(kcalStr, setKcalStr, 'kcal *', 'Calorías kcal')}
        {numInput(proteinStr, setProteinStr, 'P (g)', 'Proteína g')}
        {numInput(carbsStr, setCarbsStr, 'C (g)', 'Carbos g')}
        {numInput(fatStr, setFatStr, 'G (g)', 'Grasa g')}
      </div>
      <div className="flex gap-2 justify-end">
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
    <div className="flex min-h-[52px] items-center gap-3 px-4 py-3 group">
      <div className="flex-1 min-w-0">
        <p className="truncate text-[14px] font-medium text-foreground">
          {meal.label ?? 'Comida'}
        </p>
        <p className="text-[12px] text-muted-foreground">
          {fmtTime(meal.ts)}
          {meal.protein != null && ` · P: ${meal.protein} g`}
        </p>
      </div>
      <span className="font-mono text-[14px] font-semibold tabular-nums text-foreground shrink-0">
        {meal.kcal}
        <span className="text-[11px] font-normal text-muted-foreground"> kcal</span>
      </span>
      {/* Acciones — siempre visibles para accesibilidad AA */}
      <div className="flex shrink-0 gap-1">
        <button
          type="button"
          aria-label={`Editar ${meal.label ?? 'comida'}`}
          onClick={() => onEdit(meal.id)}
          className="flex h-[44px] w-[44px] items-center justify-center rounded-full text-muted-foreground transition-colors active:bg-white/10 hover:text-teal"
        >
          <Pencil size={15} />
        </button>
        <button
          type="button"
          aria-label={`Borrar ${meal.label ?? 'comida'}`}
          onClick={() => onDelete(meal.id)}
          className="flex h-[44px] w-[44px] items-center justify-center rounded-full text-muted-foreground transition-colors active:bg-white/10 hover:text-red-400"
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
  const status = pct >= 100 ? 'ok' : pct >= 60 ? 'teal' : 'warn'
  const statusColor = status === 'ok' ? 'bg-ok' : status === 'teal' ? 'bg-teal' : 'bg-warn'

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
            status === 'ok' ? 'bg-ok/20 text-ok' : status === 'teal' ? 'bg-teal/20 text-teal' : 'bg-warn/20 text-warn'
          }`}
        >
          {symbol}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-1">
            <span className="text-[13px] font-medium text-foreground">{label}</span>
            <span className="font-mono text-[13px] tabular-nums text-muted-foreground shrink-0">
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
            className="flex h-[44px] w-[44px] items-center justify-center rounded-full border border-white/15 bg-white/5 text-foreground transition-colors active:bg-white/10 disabled:opacity-40"
          >
            <Minus size={14} />
          </button>
          <button
            type="button"
            aria-label={`Agregar ${step} ${unit} de ${label}`}
            onClick={onIncrement}
            className="flex h-[44px] w-[44px] items-center justify-center rounded-full bg-teal/20 text-teal transition-opacity active:opacity-70"
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
    if (p != null && c != null && f != null) {
      onSaveMacros({ protein: p, carbs: c, fat: f })
    } else if (!protStr && !carbStr && !fatStr) {
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
      <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
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
          className="h-11 flex-1 rounded-lg border border-white/10 bg-void px-3 font-mono text-[14px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-teal/50"
        />
        <span className="text-[12px] text-muted-foreground shrink-0">{unit}</span>
      </div>
    </div>
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-semibold text-foreground">Editar metas</p>
        <button
          type="button"
          aria-label="Cerrar editor de metas"
          onClick={onClose}
          className="flex h-[44px] w-[44px] items-center justify-center text-muted-foreground"
        >
          <X size={16} />
        </button>
      </div>
      <div className="flex flex-col gap-3">
        {numField('Meta calórica', kcalStr, setKcalStr, 'Ej. 2000', 'Meta calórica en kcal', 'kcal')}
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mt-1">
          Macros (opcional — deja vacío para desactivar)
        </p>
        {numField('Proteína', protStr, setProtStr, 'Ej. 150', 'Meta proteína en g', 'g')}
        {numField('Carbohidratos', carbStr, setCarbStr, 'Ej. 200', 'Meta carbos en g', 'g')}
        {numField('Grasa', fatStr, setFatStr, 'Ej. 65', 'Meta grasa en g', 'g')}
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
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
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
              'h-11 min-w-[56px] rounded-lg px-3 text-[13px] font-semibold transition-colors',
              current === ml
                ? 'bg-teal/20 text-teal border border-teal/30'
                : 'bg-white/6 text-muted-foreground border border-white/10',
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
          'h-11 min-w-[56px] rounded-lg border px-3 text-[13px] font-semibold transition-colors',
          isCustom
            ? 'bg-teal/20 text-teal border-teal/30'
            : 'bg-white/6 text-muted-foreground border-white/10',
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
        className="h-11 w-[72px] rounded-lg border border-teal/40 bg-void px-2 font-mono text-[13px] text-foreground focus:outline-none"
      />
      <button
        type="button"
        aria-label="Confirmar tamaño"
        onClick={() => {
          const n = parseInt(val, 10)
          if (n >= 50 && n <= 2000) onChange(n)
          setEditing(false)
        }}
        className="flex h-11 w-11 items-center justify-center rounded-lg bg-teal/20 text-teal"
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
  const key = isoKey(state.todayTs)
  const day = state.nutrition[key] ?? { water: 0, meals: [] }

  // ── Datos de calorías y macros ─────────────────────────────────────────────
  const kcal = useMemo(() => day.meals.reduce((s, m) => s + m.kcal, 0), [day.meals])
  const macros = useMemo(() => dayMacros(day.meals), [day.meals])
  const tdeeVal = useMemo(() => tdee(state), [state])
  const goalKcal = state.kcalGoal ?? tdeeVal
  const goalProtein = state.macroGoals?.protein ?? null
  const goalCarbs = state.macroGoals?.carbs ?? null
  const goalFat = state.macroGoals?.fat ?? null

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
  const glucosaHoy = useMemo(() => {
    const series = state.history['Glucosa ayunas']
    if (!series || series.length === 0) return null
    const sorted = [...series].sort((a, b) => b.ts - a.ts)
    const dG = new Date(sorted[0].ts)
    const tG = new Date(state.todayTs)
    return dG.toDateString() === tG.toDateString() ? sorted[0].value : null
  }, [state.history, state.todayTs])

  const saveGlucosa = () => {
    const v = parseFloat(glucosaInput)
    if (!isNaN(v) && v > 0) {
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
    if (f.id.startsWith('_raw_')) {
      dispatch({ t: 'addMeal', kcal: f.kcal, protein: f.protein, carbs: f.carbs, fat: f.fat, label: f.label, fav: true, ts: now })
    } else {
      dispatch({ t: 'addFavMeal', id: f.id, ts: now })
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

      // Mostrar toast con undo 5 s
      dispatch({ t: 'toast', msg: `"${meal.label ?? 'Comida'}" eliminada` })

      // Toast store no tiene undo para meals — manejamos con buffer local.
      // Auto-limpiamos el buffer después de 5 s.
      undoTimerRef.current = setTimeout(() => {
        setDeletedMealBuffer(null)
      }, 5000)
    },
    [day.meals, dispatch],
  )

  const handleUndoDelete = useCallback(() => {
    if (!deletedMealBuffer) return
    const m = deletedMealBuffer
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
    setDeletedMealBuffer(null)
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
  }, [deletedMealBuffer, dispatch])

  // ── R38: Electrolitos ─────────────────────────────────────────────────────
  // Almacenados como medidas en state.history con clave fija; o en dayNotes como fallback.
  // Usamos una forma simple: estado local persistido via medidas del día (saveMeasure).
  // Como alternativa directa sin action nueva: guardamos en localStorage (estado efímero del día).
  // Los mantenemos en state local sincronizado con state.history para evitar nuevas store actions.
  const getElectro = (name: string) => {
    const series = state.history[name]
    if (!series) return 0
    const todayTs = new Date(state.todayTs)
    const entry = [...series]
      .sort((a, b) => b.ts - a.ts)
      .find((s) => {
        const d = new Date(s.ts)
        return d.toDateString() === todayTs.toDateString()
      })
    return entry?.value ?? 0
  }

  const naMg = getElectro('Sodio diario')
  const kMg = getElectro('Potasio diario')
  const mgMg = getElectro('Magnesio diario')

  const addElectro = (name: string, current: number, delta: number, step: number) => {
    const next = Math.max(0, current + delta * step)
    dispatch({ t: 'saveMeasure', name, value: next })
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
  const FASTING_THRESHOLD_H = 4  // mostrar banner a partir de 4 h
  const showFastBanner =
    fastMins != null &&
    fastMins >= FASTING_THRESHOLD_H * 60 &&
    state.fastStartTs == null  // no mostrar si el ayuno ya está activo

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
            <div className="glass pointer-events-auto flex max-w-full items-center gap-3 rounded-full px-4 py-2.5 text-[14px] text-foreground shadow-glass">
              <span className="truncate">
                "{deletedMealBuffer.label ?? 'Comida'}" eliminada
              </span>
              <button
                type="button"
                className="shrink-0 font-semibold text-teal"
                onClick={handleUndoDelete}
              >
                Deshacer
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Encabezado ──────────────────────────────────────────────────────── */}
      <motion.div variants={fade}>
        <SectionHero
          {...HEROES.comida}
          title="Alimentación"
          action={
            <span className="inline-flex items-center gap-1.5 rounded-full border border-teal/25 bg-teal/10 px-3 py-1.5 text-[12px] font-medium text-teal">
              <Activity size={13} /> Hoy
            </span>
          }
        />
      </motion.div>

      {/* ── R38: Banner de ventana de ayuno ────────────────────────────────── */}
      <AnimatePresence>
        {showFastBanner && fastMins != null && (
          <motion.div
            key="fast-banner"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="flex items-center gap-3 rounded-lg border border-teal/25 bg-teal/8 px-4 py-3">
              <Timer size={18} className="shrink-0 text-teal" />
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-foreground">
                  {fastingLabel(fastMins)}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Ventana de ayuno activa — solo referencial.
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="shrink-0 text-teal"
                onClick={() => dispatch({ t: 'startFast' })}
              >
                Iniciar ayuno
              </Button>
            </div>
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

      {/* ── A. Resumen del día (kcal + macros) ──────────────────────────────── */}
      <motion.div variants={fade}>
        <Glass>
          <div className="mb-3 flex items-baseline justify-between gap-2">
            <div>
              <p className="mb-0.5 text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
                Calorías hoy
              </p>
              <p className="font-mono text-[32px] font-bold tabular-nums text-foreground leading-none">
                {kcal}
                {goalKcal != null && (
                  <span className="text-[18px] font-normal text-muted-foreground"> / {goalKcal}</span>
                )}
                <span className="ml-1 text-[14px] font-normal text-muted-foreground">kcal</span>
              </p>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              {goalKcal != null && kcal > 0 && (
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    kcal > goalKcal * 1.05
                      ? 'bg-warn/15 text-warn'
                      : kcal >= goalKcal * 0.95
                      ? 'bg-ok/15 text-ok'
                      : 'bg-teal/10 text-teal'
                  }`}
                >
                  {kcal > goalKcal * 1.05
                    ? `+${kcal - goalKcal} kcal`
                    : kcal >= goalKcal * 0.95
                    ? 'En meta'
                    : `−${goalKcal - kcal} kcal`}
                </span>
              )}
              {/* R39: botón editar metas */}
              <button
                type="button"
                aria-label="Editar metas de calorías y macros"
                onClick={() => setShowGoalsEditor((v) => !v)}
                className="flex items-center gap-1 text-[12px] text-muted-foreground underline-offset-2 hover:text-foreground transition-colors"
              >
                <Pencil size={11} /> Editar metas
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
                <div className="border-t border-white/8 pt-4 pb-1">
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

          {/* Barra de progreso calórico */}
          {!showGoalsEditor && goalKcal != null && (
            <div className="mb-4">
              <ProgressBar
                value={kcal}
                max={goalKcal}
                color={kcal > goalKcal ? 'bg-warn' : 'bg-teal'}
              />
            </div>
          )}

          {/* Macros */}
          {!showGoalsEditor && (macros.hasMacros || goalProtein != null || goalCarbs != null || goalFat != null) && (
            <div className="flex flex-col gap-3 border-t border-white/8 pt-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Macros
              </p>
              <MacroRow label="Proteína" value={macros.protein} goal={goalProtein} color="bg-teal" />
              <MacroRow label="Carbohidratos" value={macros.carbs} goal={goalCarbs} color="bg-warn" />
              <MacroRow label="Grasa" value={macros.fat} goal={goalFat} color="bg-secondary-foreground/40" />
            </div>
          )}
        </Glass>
      </motion.div>

      {/* ── B. R35: Comidas del día con tap-to-edit y borrar ─────────────────── */}
      <motion.div variants={fade}>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
            Comidas de hoy
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 text-teal"
            onClick={() => dispatch({ t: 'sheet', sheet: 'recetario' })}
          >
            <Plus size={15} /> Agregar
          </Button>
        </div>
        <Glass className="p-0 overflow-hidden">
          {mealsDesc.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 px-4 text-center">
              <Utensils size={28} className="text-muted-foreground opacity-40" />
              <p className="text-[14px] font-medium text-muted-foreground">Sin comidas registradas</p>
              <p className="text-[12px] text-muted-foreground/70">
                Usa el recetario o los alimentos frecuentes para registrar rápido.
              </p>
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-white/6">
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
        <p className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
          Recetario y frecuentes
        </p>
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
              <p className="py-2 text-[13px] text-muted-foreground">
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
                <p className="text-[13px] text-muted-foreground">
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

          {/* CTA recetario completo */}
          <button
            type="button"
            onClick={() => dispatch({ t: 'sheet', sheet: 'recetario' })}
            className="flex min-h-[44px] items-center justify-between gap-2 rounded-md border border-teal/25 bg-teal/5 px-4 py-3 text-[14px] font-semibold text-teal transition-colors active:bg-teal/10"
          >
            Abrir recetario completo
            <ChevronRight size={16} />
          </button>
        </Glass>
      </motion.div>

      {/* ── D. Hidratación (superficie sólida — médica/operativa) ────────────── */}
      <motion.div variants={fade}>
        <p className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
          Hidratación
        </p>
        <div className="rounded-lg border border-white/8 bg-raised p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 font-medium text-foreground">
              <Droplet size={16} className="text-teal" />
              Agua hoy
            </span>
            <span className="font-mono tabular-nums text-foreground">
              {totalL}
              <span className="text-muted-foreground"> / {waterGoalL} L</span>
            </span>
          </div>

          <ProgressBar
            value={totalMl}
            max={waterGoalL * 1000}
            color={totalMl >= waterGoalL * 1000 ? 'bg-ok' : 'bg-teal'}
          />

          <p className="text-[11px] text-muted-foreground">
            ≈ {Math.round(totalMl / glassMl)} vasos de {glassMl} ml
          </p>

          {/* Controles de agua */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Quitar un vaso"
              disabled={totalMl <= 0}
              onClick={() => addWater(-1)}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/5 text-foreground transition-colors active:bg-white/10 disabled:opacity-40"
            >
              <Minus size={16} />
            </button>
            <div className="flex-1 text-center">
              <p className="text-[13px] font-medium text-foreground">
                {totalMl >= waterGoalL * 1000 ? '¡Meta alcanzada!' : `Faltan ${(waterGoalL - totalL).toFixed(1)} L`}
              </p>
            </div>
            <button
              type="button"
              aria-label="Agregar un vaso"
              onClick={() => addWater(1)}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-teal text-primary-foreground transition-opacity active:opacity-80"
            >
              <Plus size={16} />
            </button>
          </div>

          {/* R39: Selector de tamaño de vaso (colapsable) */}
          <div className="border-t border-white/8 pt-3">
            <button
              type="button"
              onClick={() => setShowGlassEditor((v) => !v)}
              className="flex w-full items-center justify-between gap-2 text-[12px] text-muted-foreground"
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

      {/* ── R38: Electrolitos (superficie sólida — médica/operativa) ─────────── */}
      <motion.div variants={fade}>
        <p className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
          Electrolitos
        </p>
        <div className="rounded-lg border border-white/8 bg-raised p-4 flex flex-col gap-4">
          <ElectrolyteRow
            label="Sodio"
            symbol="Na"
            unit="mg"
            value={naMg}
            goal={NA_GOAL}
            color="bg-teal"
            step={200}
            onIncrement={() => addElectro('Sodio diario', naMg, 1, 200)}
            onDecrement={() => addElectro('Sodio diario', naMg, -1, 200)}
          />
          <ElectrolyteRow
            label="Potasio"
            symbol="K"
            unit="mg"
            value={kMg}
            goal={K_GOAL}
            color="bg-ok"
            step={300}
            onIncrement={() => addElectro('Potasio diario', kMg, 1, 300)}
            onDecrement={() => addElectro('Potasio diario', kMg, -1, 300)}
          />
          <ElectrolyteRow
            label="Magnesio"
            symbol="Mg"
            unit="mg"
            value={mgMg}
            goal={MG_GOAL}
            color="bg-warn"
            step={50}
            onIncrement={() => addElectro('Magnesio diario', mgMg, 1, 50)}
            onDecrement={() => addElectro('Magnesio diario', mgMg, -1, 50)}
          />
          <p className="text-[11px] leading-snug text-muted-foreground">
            Referencias orientativas (OMS). Solo informativo — no diagnóstico médico. Datos guardados solo en tu dispositivo.
          </p>
        </div>
      </motion.div>

      {/* ── E. Glucosa (superficie sólida — médica/operativa) ───────────────── */}
      <motion.div variants={fade}>
        <p className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
          Glucosa en ayunas
        </p>
        <div className="rounded-lg border border-white/8 bg-raised p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="font-medium text-foreground">Registro de hoy</span>
            {glucosaHoy != null && (
              <span className="font-mono text-[15px] font-semibold tabular-nums text-teal">
                {glucosaHoy} <span className="text-[12px] font-normal text-muted-foreground">mg/dL</span>
              </span>
            )}
          </div>

          <div className="flex gap-2">
            <input
              type="number"
              inputMode="decimal"
              placeholder={glucosaHoy != null ? String(glucosaHoy) : 'mg/dL'}
              value={glucosaInput}
              onChange={(e) => setGlucosaInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') saveGlucosa() }}
              aria-label="Glucosa en ayunas en mg/dL"
              className="h-11 flex-1 min-w-0 rounded-md border border-white/15 bg-void px-3 font-mono text-[15px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-teal/50"
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

          <p className="mt-3 text-[11px] leading-snug text-muted-foreground">
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

  // Actualizar contador cada minuto
  useState(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(id)
  })

  const mins = fastingMinutes(fastStartTs, now) ?? 0
  const label = fastingLabel(mins)

  return (
    <div className="flex items-center gap-3 rounded-lg border border-ok/25 bg-ok/8 px-4 py-3">
      <Flame size={18} className="shrink-0 text-ok" />
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-foreground">
          Ayuno activo — {label}
        </p>
        <p className="text-[11px] text-muted-foreground">
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
