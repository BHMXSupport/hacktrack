// Comida v2 — resumen nutricional del día con diseño "Precision × Accessible".
// Superficies: Glass para contenido/analítica, bg-raised para médicas/operativas.
// Motion: fade+y stagger solo en opacity/transform; respeta useReducedMotion().
import { useState, useMemo } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Droplet, Utensils, Star, Activity, ChevronRight, Plus, Minus } from 'lucide-react'
import { useApp, isoKey } from '../../lib/store'
import {
  dayMacros,
  tdee,
  waterGoalLiters,
  litersFromMl,
  recentFoods,
} from '../../lib/nutrition'
import type { FoodFav } from '../../lib/types'
import { Glass } from '../ui/Glass'
import { Chip } from '../ui/Chip'
import { Button } from '../ui/Button'

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
  const [glassMl] = useState<number>(() => {
    try { return Number(localStorage.getItem('hacktrack-glass-ml') ?? '250') || 250 } catch { return 250 }
  })
  const addWater = (delta: number) => {
    dispatch({ t: 'water', delta: delta * glassMl })
  }

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

  // ── Formato de hora ────────────────────────────────────────────────────────
  const fmtTime = (ts: number) =>
    new Date(ts).toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' })

  // ── Comidas del día agrupadas por franja ───────────────────────────────────
  const mealsDesc = useMemo(
    () => [...day.meals].sort((a, b) => b.ts - a.ts),
    [day.meals],
  )

  return (
    <motion.div
      className="flex flex-col gap-4 px-4 pb-32 pt-[max(20px,env(safe-area-inset-top))]"
      initial={reduce ? false : 'hidden'}
      animate="show"
      variants={{ show: { transition: { staggerChildren: 0.07 } } }}
    >
      {/* ── Encabezado ──────────────────────────────────────────────────────── */}
      <motion.div variants={fade} className="flex items-center justify-between">
        <h1 className="text-[28px] font-bold leading-tight text-foreground">Alimentación</h1>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-teal/25 bg-teal/10 px-3 py-1.5 text-[12px] font-medium text-teal">
          <Activity size={13} /> Hoy
        </span>
      </motion.div>

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
          </div>

          {/* Barra de progreso calórico */}
          {goalKcal != null && (
            <div className="mb-4">
              <ProgressBar
                value={kcal}
                max={goalKcal}
                color={kcal > goalKcal ? 'bg-warn' : 'bg-teal'}
              />
            </div>
          )}

          {/* Macros */}
          {(macros.hasMacros || goalProtein != null || goalCarbs != null || goalFat != null) && (
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

      {/* ── B. Comidas del día ───────────────────────────────────────────────── */}
      <motion.div variants={fade}>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
            Comidas de hoy
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="h-9 gap-1 text-teal"
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
                <div
                  key={meal.id}
                  className="flex min-h-[52px] items-center gap-3 px-4 py-3"
                >
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
                </div>
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
        <div className="rounded-lg border border-white/8 bg-raised p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
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

          <p className="mt-1.5 text-[11px] text-muted-foreground">
            ≈ {Math.round(totalMl / glassMl)} vasos de {glassMl} ml
          </p>

          {/* Controles de agua */}
          <div className="mt-3 flex items-center gap-3">
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

          {/* Disclaimer — cumplimiento estricto: sin claims médicos */}
          <p className="mt-3 text-[11px] leading-snug text-muted-foreground">
            Solo referencial, no diagnóstico médico. Tu historial se guarda solo en tu dispositivo.
          </p>
        </div>
      </motion.div>
    </motion.div>
  )
}
