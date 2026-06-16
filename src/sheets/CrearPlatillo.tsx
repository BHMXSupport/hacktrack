// Crear platillo — arma un platillo desde ingredientes comunes con gramos/ml; guarda como favorito. (Gratis)
import { useState } from 'react'
import { Sheet } from '../components/Sheet'
import { useApp } from '../lib/store'
import { INGREDIENTS } from '../lib/catalog'
import type { Ingredient } from '../lib/catalog'
import { IcClose } from '../components/icons'
import { tapHaptic } from '../lib/haptics'

interface Row { ing: Ingredient; grams: number }

export function CrearPlatillo() {
  const { state, dispatch } = useApp()
  const ts = state.sheetArg ? Number(state.sheetArg) : undefined
  const [name, setName] = useState('')
  const [query, setQuery] = useState('')
  const [rows, setRows] = useState<Row[]>([])

  const close = () => dispatch({ t: 'sheet', sheet: null })
  const results = query.trim() ? INGREDIENTS.filter((i) => i.name.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 8) : []

  const add = (ing: Ingredient) => { tapHaptic(); setRows((r) => [...r, { ing, grams: 100 }]); setQuery('') }
  const setGrams = (idx: number, g: number) => setRows((r) => r.map((row, i) => (i === idx ? { ...row, grams: g } : row)))
  const remove = (idx: number) => setRows((r) => r.filter((_, i) => i !== idx))

  // totales = Σ ingrediente × (gramos / 100)
  const total = rows.reduce((t, { ing, grams }) => {
    const f = grams / ing.per
    return { kcal: t.kcal + ing.kcal * f, protein: t.protein + ing.protein * f, carbs: t.carbs + ing.carbs * f, fat: t.fat + ing.fat * f }
  }, { kcal: 0, protein: 0, carbs: 0, fat: 0 })
  const r0 = (v: number) => Math.round(v)
  const fav = { label: name.trim(), kcal: r0(total.kcal), protein: r0(total.protein), carbs: r0(total.carbs), fat: r0(total.fat) }
  const canSave = !!name.trim() && total.kcal > 0

  return (
    <Sheet title="Crear platillo" onClose={close}>
      <div style={{ padding: '0 20px 32px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <input className="field" placeholder="Nombre del platillo" value={name} onChange={(e) => setName(e.target.value)} />

        {/* Buscar ingrediente */}
        <div>
          <input className="field" placeholder="Agregar ingrediente (pollo, arroz…)" value={query} onChange={(e) => setQuery(e.target.value)} />
          {results.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
              {results.map((ing) => (
                <button key={ing.name} className="card" onClick={() => add(ing)} style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', cursor: 'pointer', border: '1px solid var(--border)' }}>
                  <span className="body" style={{ fontWeight: 600 }}>{ing.name}</span>
                  <span className="sm mono" style={{ marginLeft: 'auto', color: 'var(--ink-400)' }}>{ing.kcal} kcal/100{ing.unit}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Ingredientes del platillo */}
        {rows.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {rows.map((row, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="sm" style={{ flex: 1, minWidth: 0, color: 'var(--ink-700)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.ing.name}</span>
                <input className="field mono" type="number" inputMode="numeric" value={row.grams} onChange={(e) => setGrams(idx, Math.max(0, parseFloat(e.target.value) || 0))} style={{ width: 72, textAlign: 'center' }} />
                <span className="sm" style={{ color: 'var(--ink-400)', width: 18 }}>{row.ing.unit}</span>
                <button aria-label="Quitar" onClick={() => remove(idx)} style={{ background: 'none', border: 0, color: 'var(--ink-300)', cursor: 'pointer', display: 'flex' }}><IcClose size={16} /></button>
              </div>
            ))}
          </div>
        )}

        {/* Totales */}
        <div className="card" style={{ display: 'flex', alignItems: 'baseline', gap: 14, background: 'var(--brand-100)' }}>
          <span className="mono" style={{ fontSize: 24, fontWeight: 800, color: 'var(--brand-700)' }}>{fav.kcal}<span className="sm" style={{ color: 'var(--ink-400)' }}> kcal</span></span>
          <span className="sm mono" style={{ color: 'var(--ink-700)' }}>P {fav.protein} · C {fav.carbs} · G {fav.fat}</span>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-outline" style={{ flex: 1 }} disabled={!canSave} onClick={() => { tapHaptic(); dispatch({ t: 'createFav', fav }); dispatch({ t: 'toast', msg: 'Platillo guardado' }); close() }}>Solo guardar</button>
          <button className="btn btn-brand" style={{ flex: 1 }} disabled={!canSave} onClick={() => { tapHaptic(); dispatch({ t: 'addMeal', kcal: fav.kcal, protein: fav.protein, carbs: fav.carbs, fat: fav.fat, label: fav.label, fav: true, ts }); close() }}>Guardar y agregar</button>
        </div>
      </div>
    </Sheet>
  )
}
