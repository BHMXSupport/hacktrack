// RecetasHacktrack — recetario curado (RAW DATA del catálogo: RECIPES_ENRICHED), vestido "Bitácora":
// fichas editoriales sobre papel cálido, kickers mono con tick ámbar, azul = interactivo/destacado.
// Freemium: 2 recetas visibles por categoría; el teaser abre el sheet de Plus, que durante la beta
// desbloquea todo gratis (sin venta fingida — ver PaywallSheet).
import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Plus, ChevronDown, ChevronUp, Clock, Lock, Sparkles } from 'lucide-react'
import { useApp } from '../../lib/store'
import { RECIPES_ENRICHED, PEPTIDE_NUTRITION_HINT } from '../../lib/catalog'
import type { Recipe, RecipeMeal, RecipeTag } from '../../lib/catalog'
import { Chip } from '../ui/Chip'

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
    <div className="overflow-hidden rounded-sm border border-hairline bg-raised">
      <div className="flex items-start gap-3 px-4 pb-2 pt-3">
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold text-ink">{r.name}</p>
          {/* Readout editorial: valores en tinta mono, sin arcoíris de macros */}
          <p className="mt-0.5 font-mono text-[13px] font-medium tabular-nums text-ink">
            {r.kcal} <span className="font-normal text-ink-3">kcal</span>
            <span className="ml-2 font-normal text-[12px] text-ink-2">
              P {Math.round(r.protein)}g{' · '}C {Math.round(r.carbs)}g{' · '}G {Math.round(r.fat)}g
            </span>
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {r.prepMin != null && (
              <span className="inline-flex items-center gap-1 rounded-full border border-hairline bg-surface px-2 py-0.5 font-mono text-[11px] font-medium text-ink-2">
                <Clock size={10} /> {r.prepMin} min
              </span>
            )}
            {r.tags.slice(0, 2).map((t) => (
              <span key={t} className="rounded-full border border-hairline px-2 py-0.5 font-mono text-[11px] font-medium text-ink-2">
                {t}
              </span>
            ))}
          </div>
        </div>
        <button
          type="button"
          aria-label={`Agregar ${r.name} a hoy`}
          onClick={() => onAdd(r)}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground shadow-[0_1px_2px_rgba(26,23,18,.20)] transition-transform active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
        >
          <Plus size={18} />
        </button>
      </div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex h-11 w-full items-center justify-center gap-1 border-t border-hairline text-[13px] text-ink-2 transition-colors hover:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
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
            <div className="flex flex-col gap-2 border-t border-hairline px-4 py-3">
              <p className="font-mono text-[12px] font-medium uppercase tracking-[0.12em] text-ink-2">
                Ingredientes ({r.servings} {r.servings === 1 ? 'porción' : 'porciones'})
              </p>
              <ul className="flex flex-col gap-0.5">
                {r.ingredients.map((ing, i) => (
                  <li key={i} className="flex justify-between text-[14px] text-ink-2">
                    <span>{ing.name}</span>
                    <span className="font-mono tabular-nums text-ink-3">{ing.grams} g</span>
                  </li>
                ))}
              </ul>
              <p className="mt-1 font-mono text-[12px] font-medium uppercase tracking-[0.12em] text-ink-2">Preparación</p>
              <p className="text-[14px] leading-relaxed text-ink-2">{r.prep}</p>
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
  const peptideHint = state.activeProduct ? PEPTIDE_NUTRITION_HINT[state.activeProduct] : null

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
    // #13: los macros del catálogo son del LOTE completo; registrar 1 porción (kcal/servings).
    const per = r.servings > 1 ? r.servings : 1
    const r1 = (n: number) => Math.round((n / per) * 10) / 10
    dispatch({ t: 'addMeal', kcal: Math.round(r.kcal / per), protein: r1(r.protein), carbs: r1(r.carbs), fat: r1(r.fat), label: per > 1 ? `${r.name} (1 porción)` : r.name, ts: Date.now() })
    dispatch({ t: 'toast', msg: per > 1 ? `${r.name} — 1 porción agregada a hoy` : `${r.name} agregada a hoy` })
    // #92: no cerrar el sheet; el usuario puede seguir agregando recetas.
  }
  const openPaywall = () => dispatch({ t: 'sheet', sheet: 'paywall' })

  return (
    <div className="flex flex-col gap-5">
      {/* #110: banner péptido activo — nota editorial al margen (hairline, sin claims) */}
      {peptideHint && (
        <div className="rounded-sm border border-hairline bg-raised px-3.5 py-3">
          <p className="text-[13px] leading-relaxed text-ink-2">
            <span className="font-semibold text-ink">{state.activeProduct}:</span>{' '}
            {peptideHint}{' '}
            <span className="text-ink-3">Observacional. No es consejo médico.</span>
          </p>
        </div>
      )}

      {!premium && (
        <div className="flex items-start gap-2.5 rounded-sm border border-hairline bg-amber-soft px-3.5 py-3">
          <Sparkles size={15} className="mt-0.5 shrink-0 text-amber" aria-hidden />
          <p className="text-[13px] leading-relaxed text-ink-2">
            Te mostramos <span className="font-semibold text-ink">2 recetas por categoría</span>. El recetario
            completo <span className="font-semibold text-blue">está desbloqueado gratis durante la beta</span> — toca
            cualquier sección bloqueada para abrirlo.
          </p>
        </div>
      )}

      {/* Filtros: categoría + subcategoría (chips mono píldora, tap ≥44px) */}
      <div className="flex flex-col gap-2">
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1" role="group" aria-label="Filtrar por categoría">
          {([null, ...MEAL_ORDER] as (RecipeMeal | null)[]).map((m) => {
            const on = mealFilter === m
            return (
              <Chip
                key={m ?? '__all__'}
                active={on}
                onClick={() => setMealFilter(m)}
                className="shrink-0"
              >
                {m ? MEAL_LABEL[m] : 'Todas'}
              </Chip>
            )
          })}
        </div>
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1" role="group" aria-label="Filtrar por subcategoría">
          {([null, ...allTags] as (RecipeTag | null)[]).map((t) => {
            const on = tagFilter === t
            return (
              <Chip
                key={t ?? '__alltags__'}
                active={on}
                onClick={() => setTagFilter(t)}
                className="shrink-0 px-3 text-[12px]"
              >
                {t ?? 'Todas las etiquetas'}
              </Chip>
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
            {/* Kicker de sección con tick ámbar + regla (la firma editorial) */}
            <div className="flex items-baseline gap-2.5">
              <h3 className="flex items-center gap-2.5 font-mono text-[12px] font-medium uppercase tracking-[0.16em] text-ink-2">
                <span aria-hidden className="h-1.5 w-1.5 shrink-0 bg-amber" />
                {MEAL_LABEL[meal]}
              </h3>
              <span aria-hidden className="h-px min-w-4 flex-1 self-center bg-[color-mix(in_srgb,var(--ink-3)_45%,transparent)]" />
              <span className="font-mono text-[12px] tabular-nums text-ink-3">{all.length} recetas</span>
            </div>
            {visible.map((r) => (
              <RecipeCard key={r.name} r={r} onAdd={addRecipe} />
            ))}
            {locked > 0 && (
              <button
                type="button"
                onClick={openPaywall}
                className="flex min-h-[44px] items-center gap-3 rounded-sm border border-dashed border-[color-mix(in_srgb,var(--blue)_45%,transparent)] bg-[color-mix(in_srgb,var(--blue)_6%,transparent)] px-4 py-3 text-left transition-colors hover:bg-[color-mix(in_srgb,var(--blue)_10%,transparent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[color-mix(in_srgb,var(--blue)_12%,transparent)] text-blue">
                  <Lock size={16} />
                </span>
                <span className="flex flex-1 flex-col">
                  <span className="text-[14px] font-semibold text-ink">
                    +{locked} recetas de {MEAL_LABEL[meal].toLowerCase()}
                  </span>
                  <span className="text-[13px] font-medium text-blue">Gratis durante la beta — toca para desbloquear</span>
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
          <p className="text-[15px] text-ink-2">Sin recetas con ese filtro.</p>
          <button
            type="button"
            onClick={() => { setMealFilter(null); setTagFilter(null) }}
            className="h-11 rounded-full border border-blue bg-[color-mix(in_srgb,var(--blue)_8%,transparent)] px-4 text-[13px] font-semibold text-blue transition-colors hover:bg-[color-mix(in_srgb,var(--blue)_14%,transparent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
          >
            Limpiar filtros
          </button>
        </div>
      )}
    </div>
  )
}
