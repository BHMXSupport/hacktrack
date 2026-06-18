// Recetario (Plus) — recetas listas con macros, organizadas por comida y subcategoría.
// Items implementados: 244 (stepper porciones), 245 (prepMin badge+filtro), 246 (tags multi-select AND),
// 247 (sort + filtros proteína), 248 (proteinSource chip), 249 (kcal/g P ratio),
// 250 (tag alto en fibra), 252 (tag colación saciante), 253 (filtro sin gluten/lácteos en Recetario),
// 254 (comparador lado a lado), 260 (banner péptido activo), 262 (donut SVG macros),
// 263 (MACRO_COLOR semántico), 264 (badge proteína principal), 272 (haptic diferenciado),
// 273 (skeleton loader).
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Glyph } from '../components/glyphs'
import { Sheet } from '../components/Sheet'
import { PremiumGate } from '../components/PremiumGate'
import { Segmented } from '../components/controls'
import { EmptyState } from '../components/EmptyState'
import { useApp } from '../lib/store'
import { RECIPES_ENRICHED, INGREDIENTS, MACRO_COLOR, PEPTIDE_NUTRITION_HINT } from '../lib/catalog'
import type { RecipeMeal, RecipeTag, Recipe } from '../lib/catalog'
import { tapHaptic } from '../lib/haptics'
import { staggerParent, staggerItem } from '../lib/motion'

// ── haptic inline (item 272) — diferencia expand vs acción sin tocar haptics.ts ──
function lightHaptic(): void {
  try { navigator.vibrate?.(4) } catch { /* sin soporte */ }
}

const MEALS: { value: RecipeMeal; label: string }[] = [
  { value: 'desayuno', label: 'Desayuno' },
  { value: 'comida', label: 'Comida' },
  { value: 'cena', label: 'Cena' },
  { value: 'colacion', label: 'Colaciones' },
]

// Todos los tags posibles (item 246 + nuevos tags de item 250/252)
const ALL_TAGS: RecipeTag[] = [
  'keto-friendly', 'fácil y rápido', 'bajo en calorías', 'alto en proteína',
  'vegetariano', 'vegano', 'post-entreno', 'alto en fibra', 'colación saciante',
]

// Opciones de sort (item 247)
type SortOption = 'none' | 'protein-desc' | 'kcal-asc' | 'ratio-desc'
const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'none',         label: 'Ordenar: relevancia' },
  { value: 'protein-desc', label: 'Más proteína primero' },
  { value: 'kcal-asc',     label: 'Menos calorías primero' },
  { value: 'ratio-desc',   label: 'Mayor densidad proteica' },
]

// Opciones de filtro rápido de proteína (item 247)
type ProteinFilter = 'none' | 'p30' | 'p40'
const PROTEIN_FILTER_OPTIONS: { value: ProteinFilter; label: string }[] = [
  { value: 'none', label: 'Todas' },
  { value: 'p30',  label: '+30 g P' },
  { value: 'p40',  label: '+40 g P' },
]

// Opciones de filtro por tiempo de prep (item 245)
type PrepFilter = 'none' | '10' | '20' | '30'
const PREP_FILTER_OPTIONS: { value: PrepFilter; label: string }[] = [
  { value: 'none', label: 'Sin límite' },
  { value: '10',   label: '≤ 10 min' },
  { value: '20',   label: '≤ 20 min' },
  { value: '30',   label: '≤ 30 min' },
]

// ── Donut SVG de macros (item 262) ────────────────────────────────────────
function MacroDonut({ protein, carbs, fat, size = 36 }: { protein: number; carbs: number; fat: number; size?: number }) {
  const pKcal = protein * 4
  const cKcal = carbs * 4
  const gKcal = fat * 9
  const total = pKcal + cKcal + gKcal || 1
  const r = size / 2 - 3
  const circ = 2 * Math.PI * r
  const pArc = (pKcal / total) * circ
  const cArc = (cKcal / total) * circ
  const gArc = (gKcal / total) * circ
  const gap = 1

  // Los tres arcos se dibujan con stroke-dasharray offset calculado secuencialmente
  const cx = size / 2
  const cy = size / 2
  const gOff = 0
  const cOff = pArc + gap
  const pOffSet = cArc + cOff + gap

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
      {/* fondo */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--border)" strokeWidth={4} />
      {/* proteína */}
      <circle cx={cx} cy={cy} r={r} fill="none"
        stroke={MACRO_COLOR.protein} strokeWidth={4}
        strokeDasharray={`${Math.max(0, pArc - gap)} ${circ}`}
        strokeDashoffset={circ / 4} /* rotate -90° */
        strokeLinecap="round"
      />
      {/* carbohidratos */}
      <circle cx={cx} cy={cy} r={r} fill="none"
        stroke={MACRO_COLOR.carbs} strokeWidth={4}
        strokeDasharray={`${Math.max(0, cArc - gap)} ${circ}`}
        strokeDashoffset={circ / 4 - pArc}
        strokeLinecap="round"
      />
      {/* grasa */}
      <circle cx={cx} cy={cy} r={r} fill="none"
        stroke={MACRO_COLOR.fat} strokeWidth={4}
        strokeDasharray={`${Math.max(0, gArc - gap)} ${circ}`}
        strokeDashoffset={circ / 4 - pArc - cArc}
        strokeLinecap="round"
      />
    </svg>
  )
}

// ── Cuadrito de color de leyenda (reemplaza el glifo '■' por un SVG/CSS controlado) ──
function MacroDot({ color }: { color: string }) {
  return <span aria-hidden style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: color, flexShrink: 0 }} />
}

// ── Skeleton card (item 273) ──────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ height: 14, borderRadius: 'var(--r-sm)', background: 'var(--border)', width: '60%' }} />
      <div style={{ height: 10, borderRadius: 'var(--r-sm)', background: 'var(--border)', width: '40%' }} />
      <div style={{ height: 36, borderRadius: 'var(--r-sm)', background: 'var(--border)', width: '100%' }} />
    </div>
  )
}

// ── Ingredient flags lookup (item 253) — built at module load time (O(n)) ──
const ING_GLUTEN_FREE = new Map(INGREDIENTS.map((i) => [i.name, i.glutenFree]))
const ING_DAIRY_FREE  = new Map(INGREDIENTS.map((i) => [i.name, i.dairyFree]))

/** Returns true if all recipe ingredients with a known flag pass the check. */
function recipePassesFlag(r: Recipe, map: Map<string, boolean | undefined>): boolean {
  for (const ri of r.ingredients) {
    const v = map.get(ri.name)
    if (v === false) return false   // explicitly flagged as NOT free
  }
  return true   // either all true or annotation missing (conservative allow)
}

// Protein source badge color (item 248)
const PROTEIN_SOURCE_COLOR: Record<string, string> = {
  completa:   'var(--success)',
  mixta:      'var(--warning)',
  incompleta: 'var(--ink-300)',
}
const PROTEIN_SOURCE_LABEL: Record<string, string> = {
  completa:   'Proteína completa',
  mixta:      'Proteína mixta',
  incompleta: 'Proteína incompleta',
}

// ── Comparador (item 254) ─────────────────────────────────────────────────
function RecipeComparator({ a, b, onClose }: { a: Recipe; b: Recipe; onClose: () => void }) {
  const cols: { label: string; get: (r: Recipe) => string | number }[] = [
    { label: 'kcal',     get: (r) => r.kcal },
    { label: 'P (g)',    get: (r) => r.protein },
    { label: 'C (g)',    get: (r) => r.carbs },
    { label: 'G (g)',    get: (r) => r.fat },
    { label: 'P %',      get: (r) => Math.round((r.protein * 4) / (r.kcal || 1) * 100) },
    { label: 'Fibra (g)', get: (r) => r.fiber ?? '—' },
    { label: 'kcal/g prot', get: (r) => r.protein > 0 ? (r.kcal / r.protein).toFixed(1) : '—' },
  ]
  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
        zIndex: 9999, display: 'flex', alignItems: 'flex-end',
      }}
      onClick={onClose}
    >
      <div
        style={{ background: 'var(--card)', borderRadius: 'var(--r-lg) var(--r-lg) 0 0', width: '100%', padding: '24px 20px 40px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span className="body" style={{ fontWeight: 700 }}>Comparar recetas</span>
          <button aria-label="Cerrar" onClick={onClose} style={{ background: 'none', border: 0, color: 'var(--ink-400)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 0 }}>
            <Glyph name="cross" size={18} color="currentColor" />
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '70px 1fr 1fr', gap: 8 }}>
          <div />
          <div className="sm" style={{ fontWeight: 700, color: 'var(--brand-700)', textAlign: 'center', lineHeight: 1.2, minWidth: 0, overflowWrap: 'break-word' }}>{a.name}</div>
          <div className="sm" style={{ fontWeight: 700, color: 'var(--ink-700)', textAlign: 'center', lineHeight: 1.2, minWidth: 0, overflowWrap: 'break-word' }}>{b.name}</div>
          {cols.map(({ label, get }) => {
            const va = get(a)
            const vb = get(b)
            const aWins = typeof va === 'number' && typeof vb === 'number' && va > vb
            const bWins = typeof va === 'number' && typeof vb === 'number' && vb > va
            return [
              <div key={`l-${label}`} className="sm" style={{ color: 'var(--ink-400)', display: 'flex', alignItems: 'center' }}>{label}</div>,
              <div key={`a-${label}`} className="mono sm" style={{ textAlign: 'center', fontWeight: aWins ? 700 : 400, color: aWins ? 'var(--brand-700)' : 'var(--ink-700)' }}>{va}</div>,
              <div key={`b-${label}`} className="mono sm" style={{ textAlign: 'center', fontWeight: bWins ? 700 : 400, color: bWins ? 'var(--brand-700)' : 'var(--ink-700)' }}>{vb}</div>,
            ]
          })}
        </div>
      </div>
    </div>
  )
}

export function Recetario() {
  const { state, dispatch } = useApp()
  const ts = state.sheetArg ? Number(state.sheetArg) : undefined
  const close = () => dispatch({ t: 'sheet', sheet: null })

  // ── Filtros ──
  const [meal, setMeal] = useState<RecipeMeal>('desayuno')
  // item 246: multi-select tags con AND
  const [activeTags, setActiveTags] = useState<Set<RecipeTag>>(new Set())
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<SortOption>('none')
  const [proteinFilter, setProteinFilter] = useState<ProteinFilter>('none')
  const [prepFilter, setPrepFilter] = useState<PrepFilter>('none')
  // item 253: filtros gluten/dairy en Recetario
  const [filterGlutenFree, setFilterGlutenFree] = useState(false)
  const [filterDairyFree, setFilterDairyFree] = useState(false)

  // ── Filtros avanzados colapsables (sort + proteína + prep + dieta detrás de un botón) ──
  const [showFilters, setShowFilters] = useState(false)

  // ── Estado de cards ──
  const [open, setOpen] = useState<string | null>(null)
  // item 244: stepper de porciones por receta
  const [portionMap, setPortionMap] = useState<Record<string, number>>({})
  // item 254: comparador
  const [compareSet, setCompareSet] = useState<Set<string>>(new Set())
  const [showCompare, setShowCompare] = useState(false)

  // ── Banner péptido activo (item 260) ──
  const activeProduct = state.activeProduct
  const peptideHint = activeProduct ? PEPTIDE_NUTRITION_HINT[activeProduct] : null

  // ── Pipeline de filtrado + sort ──
  let list = RECIPES_ENRICHED.filter((r) => r.meal === meal)

  // filtro por tags (AND) — item 246
  if (activeTags.size > 0) {
    list = list.filter((r) => [...activeTags].every((t) => r.tags.includes(t)))
  }

  // filtro por texto
  if (q.trim()) {
    const lq = q.trim().toLowerCase()
    list = list.filter((r) => r.name.toLowerCase().includes(lq))
  }

  // filtro por proteína mínima — item 247
  if (proteinFilter === 'p30') list = list.filter((r) => r.protein >= 30)
  if (proteinFilter === 'p40') list = list.filter((r) => r.protein >= 40)

  // filtro por prep time — item 245
  if (prepFilter !== 'none') {
    const max = parseInt(prepFilter, 10)
    list = list.filter((r) => r.prepMin != null && r.prepMin <= max)
  }

  // filtro sin gluten/lácteos — item 253
  if (filterGlutenFree) list = list.filter((r) => recipePassesFlag(r, ING_GLUTEN_FREE))
  if (filterDairyFree)  list = list.filter((r) => recipePassesFlag(r, ING_DAIRY_FREE))

  // sort — item 247
  if (sort === 'protein-desc') list = [...list].sort((a, b) => b.protein - a.protein)
  if (sort === 'kcal-asc')     list = [...list].sort((a, b) => a.kcal - b.kcal)
  if (sort === 'ratio-desc')   list = [...list].sort((a, b) => {
    const rA = a.protein > 0 ? a.kcal / a.protein : 9999
    const rB = b.protein > 0 ? b.kcal / b.protein : 9999
    return rA - rB  // menor ratio = más eficiente = primero
  })

  // ── Toggle tag (item 246) ──
  const toggleTag = (t: RecipeTag) => {
    tapHaptic()
    setActiveTags((prev) => {
      const next = new Set(prev)
      if (next.has(t)) next.delete(t)
      else next.add(t)
      return next
    })
  }

  // ── Stepper de porciones (item 244) ──
  const getPortionMultiplier = (recipeName: string) => portionMap[recipeName] ?? 1
  const PORTION_STEPS = [0.5, 1, 1.5, 2]

  // ── Comparador helpers (item 254) ──
  const toggleCompare = (name: string) => {
    tapHaptic()
    setCompareSet((prev) => {
      const next = new Set(prev)
      if (next.has(name)) {
        next.delete(name)
      } else if (next.size < 2) {
        next.add(name)
      }
      return next
    })
  }
  const compareRecipes = list.filter((r) => compareSet.has(r.name))

  // Nº de filtros avanzados activos (para el badge del botón "Filtros")
  const advancedFilterCount =
    (sort !== 'none' ? 1 : 0) +
    (proteinFilter !== 'none' ? 1 : 0) +
    (prepFilter !== 'none' ? 1 : 0) +
    (filterGlutenFree ? 1 : 0) +
    (filterDairyFree ? 1 : 0)

  return (
    <Sheet title="Recetario" onClose={close}>
      <div style={{ padding: '0 20px 40px' }}>
        <PremiumGate label="Recetario — Plus">

          {/* Banner péptido activo (item 260) */}
          {peptideHint && (
            <div style={{
              background: 'var(--brand-100)', borderRadius: 'var(--r-md)',
              padding: '10px 14px', marginBottom: 12, display: 'flex', gap: 8, alignItems: 'flex-start',
            }}>
              <Glyph name="idea" size={16} color="var(--brand-700)" style={{ flexShrink: 0 }} />
              <div style={{ minWidth: 0 }}>
                <span className="sm" style={{ color: 'var(--brand-700)', fontWeight: 600 }}>{activeProduct} · </span>
                <span className="sm" style={{ color: 'var(--ink-700)' }}>{peptideHint}</span>
                <span className="sm" style={{ color: 'var(--ink-400)', display: 'block', marginTop: 2 }}>
                  Observacional. No es consejo médico.
                </span>
              </div>
            </div>
          )}

          {/* Comida */}
          <div style={{ marginBottom: 12 }}>
            <Segmented
              options={MEALS}
              value={meal}
              onChange={(v) => { tapHaptic(); setMeal(v); setOpen(null); setCompareSet(new Set()) }}
            />
          </div>

          {/* Buscar */}
          <div style={{ position: 'relative', marginBottom: 10 }}>
            <input
              className="field"
              placeholder="Buscar receta…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              style={{ paddingRight: q ? 36 : undefined }}
            />
            {q && (
              <button
                aria-label="Limpiar búsqueda"
                onClick={() => setQ('')}
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 0, color: 'var(--ink-400)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 0 }}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
              </button>
            )}
          </div>

          {/* Tags multi-select (item 246) con chips removibles — carrusel con fade de scroll a la derecha */}
          <div style={{ position: 'relative', marginBottom: 6 }}>
            <div
              role="group"
              aria-label="Subcategorías"
              style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 6, paddingRight: 24, scrollbarWidth: 'none' }}
            >
              <button
                className={activeTags.size === 0 ? 'chip active' : 'chip'}
                style={{ flexShrink: 0 }}
                aria-pressed={activeTags.size === 0}
                onClick={() => { tapHaptic(); setActiveTags(new Set()) }}
              >
                Todas
              </button>
              {ALL_TAGS.map((t) => {
                const active = activeTags.has(t)
                return (
                  <button
                    key={t}
                    className={active ? 'chip active' : 'chip'}
                    style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4 }}
                    aria-pressed={active}
                    onClick={() => toggleTag(t)}
                  >
                    {t}
                    {active && (
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ opacity: 0.7 }}>
                        <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>
                    )}
                  </button>
                )
              })}
            </div>
            {/* Affordance: fade que indica que el carrusel continúa a la derecha */}
            <div aria-hidden style={{ position: 'absolute', right: 0, top: 0, bottom: 6, width: 24, pointerEvents: 'none', background: 'linear-gradient(to right, transparent, var(--surface))' }} />
          </div>

          {/* Botón de filtros avanzados (sort + proteína + prep + dieta) con contador de activos */}
          <button
            className={advancedFilterCount > 0 ? 'chip active' : 'chip'}
            style={{ marginBottom: showFilters ? 8 : 12, fontSize: 12 }}
            onClick={() => { tapHaptic(); setShowFilters((v) => !v) }}
            aria-expanded={showFilters}
          >
            <Glyph name="medidas" size={13} color="currentColor" style={{ verticalAlign: '-2px', marginRight: 4 }} />
            Filtros{advancedFilterCount > 0 ? ` (${advancedFilterCount})` : ''}
          </button>

          {/* Panel de filtros avanzados — colapsado por defecto; envuelve en vez de scroll horizontal (items 245, 247, 253) */}
          {showFilters && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
              {/* Sort en su propia fila full-width */}
              <select
                className="field"
                value={sort}
                onChange={(e) => setSort(e.target.value as SortOption)}
                style={{ fontSize: 13, width: '100%' }}
              >
                {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              {/* Chips de filtro que envuelven a varios renglones */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {/* Proteína mínima */}
                {PROTEIN_FILTER_OPTIONS.slice(1).map((o) => (
                  <button
                    key={o.value}
                    className={proteinFilter === o.value ? 'chip active' : 'chip'}
                    style={{ fontSize: 11, maxWidth: '100%' }}
                    onClick={() => { tapHaptic(); setProteinFilter(proteinFilter === o.value ? 'none' : o.value) }}
                  >
                    {o.label}
                  </button>
                ))}
                {/* Prep time */}
                {PREP_FILTER_OPTIONS.slice(1).map((o) => (
                  <button
                    key={o.value}
                    className={prepFilter === o.value ? 'chip active' : 'chip'}
                    style={{ fontSize: 11, maxWidth: '100%' }}
                    onClick={() => { tapHaptic(); setPrepFilter(prepFilter === o.value ? 'none' : o.value) }}
                  >
                    <Glyph name="reloj" size={13} color="currentColor" style={{ verticalAlign: '-2px', marginRight: 3 }} />{o.label}
                  </button>
                ))}
                {/* Sin gluten / Sin lácteos (item 253) */}
                <button
                  className={filterGlutenFree ? 'chip active' : 'chip'}
                  style={{ fontSize: 11, maxWidth: '100%' }}
                  onClick={() => { tapHaptic(); setFilterGlutenFree((v) => !v) }}
                  aria-pressed={filterGlutenFree}
                >
                  Sin gluten
                </button>
                <button
                  className={filterDairyFree ? 'chip active' : 'chip'}
                  style={{ fontSize: 11, maxWidth: '100%' }}
                  onClick={() => { tapHaptic(); setFilterDairyFree((v) => !v) }}
                  aria-pressed={filterDairyFree}
                >
                  Sin lácteos
                </button>
              </div>
            </div>
          )}

          {/* Comparador CTA — aparece cuando hay 2 seleccionadas (item 254) */}
          {compareSet.size === 2 && (
            <button
              className="btn btn-brand btn-sm"
              style={{ width: '100%', marginBottom: 12 }}
              onClick={() => setShowCompare(true)}
            >
              <Glyph name="balanza" size={13} color="currentColor" style={{ verticalAlign: '-2px', marginRight: 3 }} />Comparar las {compareSet.size} seleccionadas
            </button>
          )}
          {compareSet.size === 1 && (
            <div className="sm" style={{ color: 'var(--ink-400)', marginBottom: 8, textAlign: 'center' }}>
              Selecciona una segunda receta para comparar
            </div>
          )}

          <div className="sm" style={{ color: 'var(--ink-400)', marginBottom: 8 }}>
            {list.length} {list.length === 1 ? 'receta' : 'recetas'}
          </div>

          {/* Lista de recetas / skeleton / empty */}
          {list.length === 0 ? (
            <EmptyState
              glyph="apetito"
              title="Sin recetas con ese filtro"
              subtitle={q ? `No encontramos recetas para "${q}"` : 'Prueba otra subcategoría o cambia la comida'}
              cta={{ label: 'Ver todas', onClick: () => { setActiveTags(new Set()); setQ(''); setSort('none'); setProteinFilter('none'); setPrepFilter('none') } }}
            />
          ) : (
            <motion.div
              variants={staggerParent}
              initial="initial"
              animate="animate"
              style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
            >
              {list.map((r) => {
                const exp = open === r.name
                const alreadySaved = state.foodLibrary.some((f) => f.label === r.name)
                const multiplier = getPortionMultiplier(r.name)
                const inCompare = compareSet.has(r.name)

                // Macros escalados por porción (item 244)
                const scaledKcal    = Math.round(r.kcal    * multiplier)
                const scaledProtein = Math.round(r.protein * multiplier * 10) / 10
                const scaledCarbs   = Math.round(r.carbs   * multiplier * 10) / 10
                const scaledFat     = Math.round(r.fat     * multiplier * 10) / 10

                // Ratio kcal/g P (item 249)
                const ratio = r.protein > 0 ? (r.kcal / r.protein).toFixed(1) : null
                const ratioLabel = ratio == null ? null : Number(ratio) < 10 ? <><Glyph name="energia" size={13} color="currentColor" style={{ verticalAlign: '-2px', marginRight: 3 }} />Densidad proteica alta</> : Number(ratio) <= 14 ? 'Densidad proteica media' : 'Densidad proteica baja'
                const ratioColor = ratio == null ? 'var(--ink-400)' : Number(ratio) < 10 ? 'var(--success)' : 'var(--ink-400)'

                // Badge proteína principal (item 264)
                let topIngredient: string | null = null
                if (exp) {
                  let topContrib = 0
                  for (const ing of r.ingredients) {
                    // buscar proteína del ingrediente en catalog — no importamos INGREDIENTS aquí
                    // estimamos desde el nombre si contiene "pechuga|pollo|res|salmón|atún|huevo|clara|whey|caseína"
                    const PROTEIN_NAMES = /pechuga|pollo|atún|salmón|tilapia|camarón|res|pavo|cerdo|huevo|clara|proteína|whey|caseína|tofu|tempeh|yogur griego|requesón|queso panela|queso cottage/i
                    const isProtein = PROTEIN_NAMES.test(ing.name)
                    if (isProtein && ing.grams > topContrib) {
                      topContrib = ing.grams
                      topIngredient = ing.name
                    }
                  }
                }

                return (
                  <motion.div key={r.name} variants={staggerItem}>
                    <div
                      className="card"
                      style={{ outline: inCompare ? `2px solid var(--brand-700)` : undefined }}
                    >
                      {/* Header — título + kcal + toggle Comparar compacto */}
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <span className="body" style={{ fontWeight: 600, color: 'var(--ink-900)' }}>{r.name}</span>
                          {/* Badge informativo principal: tiempo de prep (proteinSource pasa al detalle) */}
                          {r.prepMin != null && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                              <span className="badge" style={{ background: 'var(--surface)', color: 'var(--ink-700)', fontSize: 10, maxWidth: '100%' }}>
                                <Glyph name="reloj" size={13} color="currentColor" style={{ verticalAlign: '-2px', marginRight: 3 }} />{r.prepMin} min
                              </span>
                            </div>
                          )}
                        </div>
                        <span className="mono sm" style={{ flexShrink: 0, fontWeight: 700, color: 'var(--brand-700)' }}>
                          {scaledKcal} kcal
                        </span>
                        {/* Comparar toggle (item 254) — acción avanzada, icono compacto en el header */}
                        <button
                          className="iconbtn"
                          style={{ flexShrink: 0, width: 30, height: 30, background: inCompare ? 'var(--brand-100)' : 'var(--ink-100)', color: inCompare ? 'var(--brand-700)' : 'var(--ink-400)' }}
                          title={inCompare ? 'Quitar de comparación' : compareSet.size >= 2 ? 'Máx 2 recetas' : 'Comparar'}
                          aria-label={inCompare ? 'Quitar de comparación' : 'Comparar receta'}
                          aria-pressed={inCompare}
                          onClick={() => toggleCompare(r.name)}
                          disabled={!inCompare && compareSet.size >= 2}
                        >
                          <Glyph name="balanza" size={15} color="currentColor" />
                        </button>
                      </div>

                      {/* Macros: donut + leyenda — única representación de macros en colapsado (item 262 / 263) */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
                        <MacroDonut protein={r.protein} carbs={r.carbs} fat={r.fat} size={36} />
                        <div className="sm" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', minWidth: 0 }}>
                          <span style={{ color: MACRO_COLOR.protein, display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}><MacroDot color={MACRO_COLOR.protein} />P {scaledProtein} g</span>
                          <span style={{ color: MACRO_COLOR.carbs, display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}><MacroDot color={MACRO_COLOR.carbs} />C {scaledCarbs} g</span>
                          <span style={{ color: MACRO_COLOR.fat, display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}><MacroDot color={MACRO_COLOR.fat} />G {scaledFat} g</span>
                          {r.fiber != null && (
                            <span style={{ color: 'var(--success-ink)', whiteSpace: 'nowrap' }}><Glyph name="hoja" size={13} color="currentColor" style={{ verticalAlign: '-2px', marginRight: 3 }} />{Math.round(r.fiber * multiplier)} g fibra</span>
                          )}
                          {r.servings != null && (
                            <span style={{ color: 'var(--ink-400)', whiteSpace: 'nowrap' }}>{r.servings} {r.servings === 1 ? 'porción' : 'porciones'}</span>
                          )}
                        </div>
                      </div>

                      {/* Tags */}
                      {r.tags.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                          {r.tags.map((t) => (
                            <span key={t} className="badge badge-mint" style={{ maxWidth: '100%' }}>{t}</span>
                          ))}
                        </div>
                      )}

                      {/* Acción primaria: Agregar (brand) + Guardar (secundaria, ghost) */}
                      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                        <button
                          className="btn btn-brand btn-sm"
                          style={{ flex: 1, minWidth: 120 }}
                          onClick={() => {
                            tapHaptic()
                            dispatch({ t: 'addMeal', kcal: scaledKcal, protein: scaledProtein, carbs: scaledCarbs, fat: scaledFat, label: r.name, ts })
                            close()
                          }}
                        >
                          Agregar
                        </button>
                        <button
                          className="btn-link sm"
                          style={{ flexShrink: 0, padding: '0 4px' }}
                          disabled={alreadySaved}
                          onClick={() => {
                            if (alreadySaved) return
                            tapHaptic()
                            dispatch({
                              t: 'createFav',
                              fav: { label: r.name, kcal: scaledKcal, protein: scaledProtein, carbs: scaledCarbs, fat: scaledFat },
                            })
                            dispatch({ t: 'toast', msg: 'Platillo guardado' })
                          }}
                        >
                          {alreadySaved ? 'Ya guardado' : 'Guardar'}
                        </button>
                      </div>

                      {/* Expandir detalle: ingredientes + porciones + densidad proteica (item 272: haptic diferenciado) */}
                      <button
                        className="btn-link sm"
                        style={{ padding: 0, marginTop: 10, display: 'flex', alignItems: 'center', gap: 4 }}
                        onClick={() => {
                          exp ? null : lightHaptic()
                          setOpen(exp ? null : r.name)
                        }}
                        aria-expanded={exp}
                      >
                        {exp ? 'Ocultar detalle' : `Ver detalle e ingredientes (${r.ingredients.length})`}
                      </button>

                      {/* Detalle expandido: porciones, densidad proteica, ingredientes (item 264: badge proteína principal) */}
                      <AnimatePresence>
                        {exp && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            style={{ overflow: 'hidden' }}
                          >
                            {/* proteinSource (movido al detalle) */}
                            {r.proteinSource && (
                              <div style={{ marginTop: 8 }}>
                                <span
                                  className="badge"
                                  style={{ background: 'var(--surface)', color: PROTEIN_SOURCE_COLOR[r.proteinSource] ?? 'var(--ink-400)', fontSize: 10, maxWidth: '100%' }}
                                  title={PROTEIN_SOURCE_LABEL[r.proteinSource]}
                                >
                                  {PROTEIN_SOURCE_LABEL[r.proteinSource]}
                                </span>
                              </div>
                            )}

                            {/* Stepper de porciones (item 244) */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                              <span className="sm" style={{ color: 'var(--ink-400)', flexShrink: 0 }}>Porciones:</span>
                              {PORTION_STEPS.map((step) => (
                                <button
                                  key={step}
                                  className={multiplier === step ? 'chip active' : 'chip'}
                                  style={{ padding: '3px 8px', fontSize: 11, flexShrink: 0 }}
                                  onClick={() => { tapHaptic(); setPortionMap((p) => ({ ...p, [r.name]: step })) }}
                                  aria-pressed={multiplier === step}
                                >
                                  ×{step}
                                </button>
                              ))}
                            </div>

                            {/* Densidad proteica (item 249) — métrica avanzada, ahora en el detalle */}
                            {ratio != null && (
                              <div className="sm" style={{ color: ratioColor, marginTop: 8, minWidth: 0 }}>
                                {ratioLabel}{' · '}<span style={{ whiteSpace: 'nowrap' }}>{ratio} kcal/g proteína</span>
                              </div>
                            )}

                            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                              {r.ingredients.map((ing) => (
                                <div key={ing.name} className="sm" style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--ink-700)' }}>
                                  <span style={{ flex: 1, minWidth: 0 }}>{ing.name}</span>
                                  {ing.name === topIngredient && (
                                    <span className="badge badge-mint" style={{ fontSize: 9, flexShrink: 0 }}>Proteína principal</span>
                                  )}
                                  <span className="mono" style={{ color: 'var(--ink-400)', flexShrink: 0, whiteSpace: 'nowrap' }}>{ing.grams} g</span>
                                </div>
                              ))}
                              <p className="sm" style={{ color: 'var(--ink-400)', marginTop: 6, lineHeight: 1.4 }}>{r.prep}</p>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                )
              })}
            </motion.div>
          )}

          {/* Comparador bottom-sheet (item 254) */}
          {showCompare && compareRecipes.length === 2 && (
            <RecipeComparator
              a={compareRecipes[0]}
              b={compareRecipes[1]}
              onClose={() => setShowCompare(false)}
            />
          )}
        </PremiumGate>
      </div>
    </Sheet>
  )
}
