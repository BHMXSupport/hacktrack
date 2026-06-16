// Recetario (Plus) — recetas listas con macros que se agregan a las comidas o se guardan como platillo.
import { useState } from 'react'
import { Sheet } from '../components/Sheet'
import { PremiumGate } from '../components/PremiumGate'
import { useApp } from '../lib/store'
import { RECIPES } from '../lib/catalog'
import { tapHaptic } from '../lib/haptics'

export function Recetario() {
  const { dispatch } = useApp()
  const [open, setOpen] = useState<string | null>(null)
  const close = () => dispatch({ t: 'sheet', sheet: null })

  return (
    <Sheet title="Recetario" onClose={close}>
      <div style={{ padding: '0 20px 32px' }}>
        <PremiumGate label="Recetario — Plus">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {RECIPES.map((r) => {
              const exp = open === r.name
              return (
                <div key={r.name} className="card">
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <span className="body" style={{ fontWeight: 600, color: 'var(--ink-900)' }}>{r.name}</span>
                    <span className="mono sm" style={{ marginLeft: 'auto', fontWeight: 700, color: 'var(--brand-700)' }}>{r.kcal} kcal</span>
                  </div>
                  <div className="sm mono" style={{ color: 'var(--ink-700)', marginTop: 2 }}>P {r.protein} · C {r.carbs} · G {r.fat}</div>

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
                    <button className="btn btn-brand btn-sm" style={{ flex: 1 }} onClick={() => { tapHaptic(); dispatch({ t: 'addMeal', kcal: r.kcal, protein: r.protein, carbs: r.carbs, fat: r.fat, label: r.name }); close() }}>Agregar</button>
                  </div>
                </div>
              )
            })}
          </div>
        </PremiumGate>
      </div>
    </Sheet>
  )
}
