// Recetario (Plus) — recetas listas con macros, organizadas por comida y subcategoría. Se agregan a las comidas o se guardan como platillo.
import { useState } from 'react'
import { motion } from 'framer-motion'
import { Sheet } from '../components/Sheet'
import { PremiumGate } from '../components/PremiumGate'
import { Segmented } from '../components/controls'
import { EmptyState } from '../components/EmptyState'
import { useApp } from '../lib/store'
import { RECIPES } from '../lib/catalog'
import type { RecipeMeal, RecipeTag } from '../lib/catalog'
import { tapHaptic } from '../lib/haptics'
import { staggerParent, staggerItem } from '../lib/motion'

const MEALS: { value: RecipeMeal; label: string }[] = [
  { value: 'desayuno', label: 'Desayuno' },
  { value: 'comida', label: 'Comida' },
  { value: 'cena', label: 'Cena' },
  { value: 'colacion', label: 'Colaciones' },
]
const TAGS: RecipeTag[] = ['keto-friendly', 'fácil y rápido', 'bajo en calorías', 'alto en proteína', 'vegetariano', 'vegano', 'post-entreno']

export function Recetario() {
  const { state, dispatch } = useApp()
  const ts = state.sheetArg ? Number(state.sheetArg) : undefined
  const [meal, setMeal] = useState<RecipeMeal>('desayuno')
  const [tag, setTag] = useState<RecipeTag | null>(null)
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const close = () => dispatch({ t: 'sheet', sheet: null })

  const list = RECIPES
    .filter((r) => r.meal === meal)
    .filter((r) => !tag || r.tags.includes(tag))
    .filter((r) => !q.trim() || r.name.toLowerCase().includes(q.trim().toLowerCase()))

  return (
    <Sheet title="Recetario" onClose={close}>
      <div style={{ padding: '0 20px 32px' }}>
        <PremiumGate label="Recetario — Plus">
          {/* Comida */}
          <div style={{ marginBottom: 12 }}>
            <Segmented options={MEALS} value={meal} onChange={(v) => { tapHaptic(); setMeal(v); setOpen(null) }} />
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

          {/* Subcategorías */}
          <div
            role="group"
            aria-label="Subcategorías"
            style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 6, marginBottom: 10, scrollbarWidth: 'none' }}
          >
            <button
              className={tag === null ? 'chip active' : 'chip'}
              style={{ flexShrink: 0 }}
              aria-pressed={tag === null}
              onClick={() => setTag(null)}
            >
              Todas
            </button>
            {TAGS.map((t) => (
              <button
                key={t}
                className={tag === t ? 'chip active' : 'chip'}
                style={{ flexShrink: 0 }}
                aria-pressed={tag === t}
                onClick={() => { tapHaptic(); setTag(tag === t ? null : t) }}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="sm" style={{ color: 'var(--ink-400)', marginBottom: 8 }}>{list.length} {list.length === 1 ? 'receta' : 'recetas'}</div>

          {/* Recetas */}
          {list.length === 0 ? (
            <EmptyState
              glyph="apetito"
              title="Sin recetas con ese filtro"
              subtitle={q ? `No encontramos recetas para "${q}"` : 'Prueba otra subcategoría o cambia la comida'}
              cta={{ label: 'Ver todas', onClick: () => { setTag(null); setQ('') } }}
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

                // Barra macro P/C/G por kcal
                const pKcal = r.protein * 4
                const cKcal = r.carbs * 4
                const gKcal = r.fat * 9
                const totalMacroKcal = pKcal + cKcal + gKcal || 1
                const pPct = (pKcal / totalMacroKcal) * 100
                const cPct = (cKcal / totalMacroKcal) * 100
                const gPct = (gKcal / totalMacroKcal) * 100

                return (
                  <motion.div key={r.name} variants={staggerItem}>
                    <div className="card">
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                        <span className="body" style={{ fontWeight: 600, color: 'var(--ink-900)' }}>{r.name}</span>
                        <span className="mono sm" style={{ marginLeft: 'auto', fontWeight: 700, color: 'var(--brand-700)' }}>{r.kcal} kcal</span>
                      </div>
                      <div className="sm mono" style={{ color: 'var(--ink-700)', marginTop: 2 }}>
                        P {r.protein} · C {r.carbs} · G {r.fat}
                        {r.servings != null && (
                          <span style={{ color: 'var(--ink-400)', marginLeft: 8 }}>· {r.servings} {r.servings === 1 ? 'porción' : 'porciones'}</span>
                        )}
                      </div>

                      {/* Barra macro */}
                      <div style={{ display: 'flex', height: 4, borderRadius: 4, overflow: 'hidden', marginTop: 8, gap: 1 }}>
                        <div style={{ width: `${pPct}%`, background: 'var(--brand-700)' }} title={`Proteína ${Math.round(pPct)}%`} />
                        <div style={{ width: `${cPct}%`, background: 'var(--ink-300)' }} title={`Carbohidratos ${Math.round(cPct)}%`} />
                        <div style={{ width: `${gPct}%`, background: 'var(--ink-400)' }} title={`Grasa ${Math.round(gPct)}%`} />
                      </div>
                      <div className="sm" style={{ display: 'flex', gap: 10, marginTop: 4, color: 'var(--ink-400)' }}>
                        <span style={{ color: 'var(--brand-700)' }}>■ P</span>
                        <span style={{ color: 'var(--ink-300)' }}>■ C</span>
                        <span style={{ color: 'var(--ink-400)' }}>■ G</span>
                      </div>

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                        {r.tags.map((t) => (
                          <span key={t} className="badge badge-mint">{t}</span>
                        ))}
                      </div>

                      <button
                        className="btn-link sm"
                        style={{ padding: 0, marginTop: 8 }}
                        onClick={() => setOpen(exp ? null : r.name)}
                      >
                        {exp ? 'Ocultar' : `Ver ingredientes (${r.ingredients.length})`}
                      </button>
                      {exp && (
                        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {r.ingredients.map((ing) => (
                            <div key={ing.name} className="sm" style={{ display: 'flex', color: 'var(--ink-700)' }}>
                              <span>{ing.name}</span><span className="mono" style={{ marginLeft: 'auto', color: 'var(--ink-400)' }}>{ing.grams} g</span>
                            </div>
                          ))}
                          <p className="sm" style={{ color: 'var(--ink-400)', marginTop: 6, lineHeight: 1.4 }}>{r.prep}</p>
                        </div>
                      )}

                      <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                        <button
                          className="btn btn-outline btn-sm"
                          style={{ flex: 1 }}
                          disabled={alreadySaved}
                          onClick={() => {
                            if (alreadySaved) return
                            tapHaptic()
                            dispatch({ t: 'createFav', fav: { label: r.name, kcal: r.kcal, protein: r.protein, carbs: r.carbs, fat: r.fat } })
                            dispatch({ t: 'toast', msg: '✓ Platillo guardado' })
                          }}
                        >
                          {alreadySaved ? 'Ya guardado' : 'Guardar'}
                        </button>
                        <button
                          className="btn btn-brand btn-sm"
                          style={{ flex: 1 }}
                          onClick={() => { tapHaptic(); dispatch({ t: 'addMeal', kcal: r.kcal, protein: r.protein, carbs: r.carbs, fat: r.fat, label: r.name, ts }); close() }}
                        >
                          Agregar
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </motion.div>
          )}
        </PremiumGate>
      </div>
    </Sheet>
  )
}
