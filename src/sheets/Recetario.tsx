// Recetario (Plus) — recetas listas con macros, organizadas por comida y subcategoría. Se agregan a las comidas o se guardan como platillo.
import { useState } from 'react'
import { Sheet } from '../components/Sheet'
import { PremiumGate } from '../components/PremiumGate'
import { Segmented } from '../components/controls'
import { useApp } from '../lib/store'
import { RECIPES } from '../lib/catalog'
import type { RecipeMeal, RecipeTag } from '../lib/catalog'
import { tapHaptic } from '../lib/haptics'

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
          <input className="field" placeholder="Buscar receta…" value={q} onChange={(e) => setQ(e.target.value)} style={{ marginBottom: 10 }} />

          {/* Subcategorías */}
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 6, marginBottom: 10, scrollbarWidth: 'none' }}>
            <button className={tag === null ? 'chip active' : 'chip'} style={{ flexShrink: 0 }} onClick={() => setTag(null)}>Todas</button>
            {TAGS.map((t) => (
              <button key={t} className={tag === t ? 'chip active' : 'chip'} style={{ flexShrink: 0 }} onClick={() => { tapHaptic(); setTag(tag === t ? null : t) }}>{t}</button>
            ))}
          </div>

          <div className="sm" style={{ color: 'var(--ink-400)', marginBottom: 8 }}>{list.length} {list.length === 1 ? 'receta' : 'recetas'}</div>

          {/* Recetas */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {list.map((r) => {
              const exp = open === r.name
              return (
                <div key={r.name} className="card">
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <span className="body" style={{ fontWeight: 600, color: 'var(--ink-900)' }}>{r.name}</span>
                    <span className="mono sm" style={{ marginLeft: 'auto', fontWeight: 700, color: 'var(--brand-700)' }}>{r.kcal} kcal</span>
                  </div>
                  <div className="sm mono" style={{ color: 'var(--ink-700)', marginTop: 2 }}>P {r.protein} · C {r.carbs} · G {r.fat}</div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                    {r.tags.map((t) => (
                      <span key={t} className="sm" style={{ fontSize: 11, fontWeight: 600, color: 'var(--brand-700)', background: 'var(--brand-100)', borderRadius: 999, padding: '2px 8px' }}>{t}</span>
                    ))}
                  </div>

                  <button className="sm" style={{ background: 'none', border: 0, color: 'var(--brand-700)', fontWeight: 600, cursor: 'pointer', padding: 0, marginTop: 8 }} onClick={() => setOpen(exp ? null : r.name)}>
                    {exp ? 'Ocultar' : 'Ver ingredientes'}
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
                    <button className="btn btn-outline btn-sm" style={{ flex: 1 }} onClick={() => { tapHaptic(); dispatch({ t: 'createFav', fav: { label: r.name, kcal: r.kcal, protein: r.protein, carbs: r.carbs, fat: r.fat } }); dispatch({ t: 'toast', msg: 'Guardado como platillo' }) }}>Guardar</button>
                    <button className="btn btn-brand btn-sm" style={{ flex: 1 }} onClick={() => { tapHaptic(); dispatch({ t: 'addMeal', kcal: r.kcal, protein: r.protein, carbs: r.carbs, fat: r.fat, label: r.name, ts }); close() }}>Agregar</button>
                  </div>
                </div>
              )
            })}
            {list.length === 0 && <p className="sm" style={{ color: 'var(--ink-400)' }}>No hay recetas con ese filtro.</p>}
          </div>
        </PremiumGate>
      </div>
    </Sheet>
  )
}
