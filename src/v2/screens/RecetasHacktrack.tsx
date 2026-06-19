// RecetasHacktrack — recetario curado (RAW DATA del catálogo: RECIPES_ENRICHED), diseño v2.
// Freemium: 2 recetas GRATIS por categoría; el resto detrás del paywall con un teaser que muestra
// cuántas faltan ("Ver el recetario completo con Hacktrack Plus") para que el cliente potencial lo vea.
import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Plus, ChevronDown, ChevronUp, Clock, Lock, Sparkles } from 'lucide-react'
import { useApp } from '../../lib/store'
import { RECIPES_ENRICHED } from '../../lib/catalog'
import type { Recipe, RecipeMeal, RecipeTag } from '../../lib/catalog'

const MEAL_LABEL: Record<RecipeMeal, string> = {
  desayuno: 'Desayuno',
  comida: 'Comida',
  cena: 'Cena',
  colacion: 'Colación',
}
const MEAL_ORDER: RecipeMeal[] = ['desayuno', 'comida', 'cena', 'colacion']
const FREE_PER_MEAL = 2

function RecipeCard({ r, onAdd }: { r: Recipe; onAdd: (r: Recipe) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="overflow-hidden rounded-xl border border-white/8 bg-raised">
      <div className="flex items-start gap-3 px-4 pt-3 pb-2">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-foreground">{r.name}</p>
          <p className="mt-0.5 font-mono text-[13px] tabular-nums text-[var(--teal-bright)]">
            {r.kcal} kcal
            <span className="ml-2 text-[11px] text-muted-foreground">
              <span style={{ color: 'var(--teal-bright)' }}>P {r.protein}</span>{' · '}
              <span style={{ color: '#D97706' }}>C {r.carbs}</span>{' · '}
              <span style={{ color: '#6B7BE8' }}>G {r.fat}</span>
            </span>
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {r.prepMin != null && (
              <span className="inline-flex items-center gap-1 rounded-full bg-white/6 px-2 py-0.5 text-[10px] font-semibold text-secondary-foreground">
                <Clock size={10} /> {r.prepMin} min
              </span>
            )}
            {r.tags.slice(0, 2).map((t) => (
              <span key={t} className="rounded-full border border-teal/25 bg-teal/8 px-2 py-0.5 text-[10px] font-semibold text-teal">
                {t}
              </span>
            ))}
          </div>
        </div>
        <button
          type="button"
          aria-label={`Agregar ${r.name} a hoy`}
          onClick={() => onAdd(r)}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground active:scale-95 transition-transform"
        >
          <Plus size={18} />
        </button>
      </div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex h-9 w-full items-center justify-center gap-1 border-t border-white/6 text-[12px] text-muted-foreground hover:bg-white/4"
      >
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        {open ? 'Ocultar' : 'Ver receta'}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-2 border-t border-white/6 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Ingredientes ({r.servings} {r.servings === 1 ? 'porción' : 'porciones'})
              </p>
              <ul className="flex flex-col gap-0.5">
                {r.ingredients.map((ing, i) => (
                  <li key={i} className="flex justify-between text-[13px] text-secondary-foreground">
                    <span>{ing.name}</span>
                    <span className="font-mono text-muted-foreground">{ing.grams} g</span>
                  </li>
                ))}
              </ul>
              <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Preparación</p>
              <p className="text-[13px] leading-relaxed text-secondary-foreground">{r.prep}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function RecetasHacktrack({ onClose }: { onClose: () => void }) {
  const { state, dispatch } = useApp()
  const premium = !!state.settings.premium

  // Filtros: categoría (meal) + subcategoría (tag)
  const [mealFilter, setMealFilter] = useState<RecipeMeal | null>(null)
  const [tagFilter, setTagFilter] = useState<RecipeTag | null>(null)

  const byMeal = useMemo(() => {
    const m: Record<RecipeMeal, Recipe[]> = { desayuno: [], comida: [], cena: [], colacion: [] }
    for (const r of RECIPES_ENRICHED) m[r.meal]?.push(r)
    return m
  }, [])

  // Subcategorías disponibles (solo las que existen en los datos)
  const allTags = useMemo(() => {
    const set = new Set<RecipeTag>()
    for (const r of RECIPES_ENRICHED) for (const t of r.tags) set.add(t)
    return [...set]
  }, [])

  const addRecipe = (r: Recipe) => {
    dispatch({ t: 'addMeal', kcal: r.kcal, protein: r.protein, carbs: r.carbs, fat: r.fat, label: r.name, ts: Date.now() })
    dispatch({ t: 'toast', msg: `${r.name} agregada a hoy` })
    onClose()
  }
  const openPaywall = () => dispatch({ t: 'sheet', sheet: 'paywall' })

  return (
    <div className="flex flex-col gap-5">
      {!premium && (
        <div className="flex items-start gap-2.5 rounded-xl border border-teal/25 bg-teal/8 px-3 py-2.5">
          <Sparkles size={15} className="mt-0.5 shrink-0 text-teal" aria-hidden />
          <p className="text-[12px] leading-relaxed text-secondary-foreground">
            Te mostramos <span className="font-semibold text-foreground">2 recetas gratis</span> por categoría. El recetario
            completo se desbloquea con <span className="font-semibold text-teal">Hacktrack Plus</span>.
          </p>
        </div>
      )}

      {/* Filtros: categoría + subcategoría */}
      <div className="flex flex-col gap-2">
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1" role="group" aria-label="Filtrar por categoría">
          {([null, ...MEAL_ORDER] as (RecipeMeal | null)[]).map((m) => {
            const on = mealFilter === m
            return (
              <button
                key={m ?? '__all__'}
                type="button"
                onClick={() => setMealFilter(m)}
                aria-pressed={on}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                  on ? 'border-teal bg-teal/15 text-teal' : 'border-white/12 bg-transparent text-secondary-foreground hover:bg-white/6'
                }`}
              >
                {m ? MEAL_LABEL[m] : 'Todas'}
              </button>
            )
          })}
        </div>
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1" role="group" aria-label="Filtrar por subcategoría">
          {([null, ...allTags] as (RecipeTag | null)[]).map((t) => {
            const on = tagFilter === t
            return (
              <button
                key={t ?? '__alltags__'}
                type="button"
                onClick={() => setTagFilter(t)}
                aria-pressed={on}
                className={`shrink-0 rounded-full border px-3 py-1 text-[11px] font-medium transition-colors ${
                  on ? 'border-teal bg-teal/15 text-teal' : 'border-white/10 bg-transparent text-muted-foreground hover:bg-white/6'
                }`}
              >
                {t ?? 'Todas las etiquetas'}
              </button>
            )
          })}
        </div>
      </div>

      {(mealFilter ? [mealFilter] : MEAL_ORDER).map((meal) => {
        const all = byMeal[meal].filter((r) => !tagFilter || r.tags.includes(tagFilter))
        if (!all.length) return null
        const visible = premium ? all : all.slice(0, FREE_PER_MEAL)
        const locked = all.length - visible.length
        return (
          <section key={meal} className="flex flex-col gap-2.5">
            <div className="flex items-baseline justify-between">
              <h3 className="text-[13px] font-bold uppercase tracking-wider text-foreground">{MEAL_LABEL[meal]}</h3>
              <span className="text-[11px] text-muted-foreground">{all.length} recetas</span>
            </div>
            {visible.map((r) => (
              <RecipeCard key={r.name} r={r} onAdd={addRecipe} />
            ))}
            {locked > 0 && (
              <button
                type="button"
                onClick={openPaywall}
                className="flex items-center gap-3 rounded-xl border border-dashed border-teal/40 bg-teal/[0.06] px-4 py-3 text-left transition-colors hover:bg-teal/10"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-teal/15 text-teal">
                  <Lock size={16} />
                </span>
                <span className="flex flex-1 flex-col">
                  <span className="text-[13px] font-semibold text-foreground">
                    +{locked} recetas de {MEAL_LABEL[meal].toLowerCase()}
                  </span>
                  <span className="text-[12px] text-teal">Ver el recetario completo con Hacktrack Plus</span>
                </span>
              </button>
            )}
          </section>
        )
      })}

      {/* Empty state cuando los filtros no devuelven nada */}
      {!(mealFilter ? [mealFilter] : MEAL_ORDER).some((m) =>
        byMeal[m].some((r) => !tagFilter || r.tags.includes(tagFilter)),
      ) && (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <p className="text-[14px] text-muted-foreground">Sin recetas con ese filtro.</p>
          <button
            type="button"
            onClick={() => { setMealFilter(null); setTagFilter(null) }}
            className="rounded-full border border-teal/40 px-4 py-2 text-[13px] font-semibold text-teal hover:bg-teal/10"
          >
            Limpiar filtros
          </button>
        </div>
      )}
    </div>
  )
}
