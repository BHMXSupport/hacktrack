// Crear platillo — arma un platillo desde ingredientes comunes con gramos/ml; guarda como favorito. (Gratis)
import { useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Sheet } from '../components/Sheet'
import { useApp } from '../lib/store'
import { INGREDIENTS } from '../lib/catalog'
import type { Ingredient } from '../lib/catalog'
import { IcClose } from '../components/icons'
import { tapHaptic } from '../lib/haptics'
import { staggerParent, staggerItem } from '../lib/motion'

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
  const setGrams = (idx: number, g: number) => setRows((r) => r.map((row, i) => (i === idx ? { ...row, grams: Math.max(1, g) } : row)))
  const remove = (idx: number) => setRows((r) => r.filter((_, i) => i !== idx))
  const clearQuery = useCallback(() => setQuery(''), [])

  // totales = Σ ingrediente × (gramos / per)
  const total = rows.reduce((t, { ing, grams }) => {
    const f = grams / ing.per
    return { kcal: t.kcal + ing.kcal * f, protein: t.protein + ing.protein * f, carbs: t.carbs + ing.carbs * f, fat: t.fat + ing.fat * f }
  }, { kcal: 0, protein: 0, carbs: 0, fat: 0 })
  const r0 = (v: number) => Math.round(v)
  const fav = { label: name.trim(), kcal: r0(total.kcal), protein: r0(total.protein), carbs: r0(total.carbs), fat: r0(total.fat) }
  const canSave = !!name.trim() && total.kcal > 0

  const isEmpty = rows.length === 0

  return (
    <Sheet title="Crear platillo" onClose={close}>
      <div style={{ padding: '0 20px 32px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Nombre del platillo */}
        <div>
          <label className="sm" style={{ color: 'var(--ink-400)', display: 'block', marginBottom: 4, fontWeight: 600 }}>
            Nombre del platillo
          </label>
          <input
            className="field"
            placeholder="p. ej. Bowl de pollo con arroz"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        {/* Buscar ingrediente */}
        <div>
          <div style={{ position: 'relative' }}>
            {/* Lupa */}
            <svg
              width="14" height="14" viewBox="0 0 14 14" fill="none"
              style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-400)', pointerEvents: 'none' }}
            >
              <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M9.5 9.5l2.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <input
              className="field"
              placeholder="Agregar ingrediente (pollo, arroz…)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Escape') clearQuery() }}
              style={{ paddingLeft: 32, paddingRight: query ? 36 : undefined }}
            />
            {query && (
              <button
                aria-label="Limpiar búsqueda"
                onClick={clearQuery}
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 0, color: 'var(--ink-400)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 0 }}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
              </button>
            )}
          </div>
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
          <motion.div
            variants={staggerParent}
            initial="initial"
            animate="animate"
            style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
          >
            {rows.map((row, idx) => {
              // macros por fila
              const f = row.grams / row.ing.per
              const rowKcal = r0(row.ing.kcal * f)
              const rowP = r0(row.ing.protein * f)
              const rowC = r0(row.ing.carbs * f)
              const rowG = r0(row.ing.fat * f)
              return (
                <motion.div key={idx} variants={staggerItem} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="sm" style={{ flex: 1, minWidth: 0, color: 'var(--ink-700)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.ing.name}</span>
                    <input
                      className="field mono"
                      type="number"
                      inputMode="numeric"
                      min={1}
                      step={1}
                      value={row.grams}
                      onChange={(e) => setGrams(idx, Math.max(1, parseFloat(e.target.value) || 1))}
                      style={{ width: 72, textAlign: 'center' }}
                    />
                    <span className="sm" style={{ color: 'var(--ink-400)', width: 18 }}>{row.ing.unit}</span>
                    <button aria-label="Quitar" onClick={() => remove(idx)} style={{ background: 'none', border: 0, color: 'var(--ink-300)', cursor: 'pointer', display: 'flex' }}><IcClose size={16} /></button>
                  </div>
                  <div className="sm mono" style={{ color: 'var(--ink-400)', paddingLeft: 0 }}>
                    {rowKcal} kcal · P {rowP} · C {rowC} · G {rowG}
                  </div>
                </motion.div>
              )
            })}
          </motion.div>
        )}

        {/* Totales */}
        <div
          className="card"
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 14,
            background: isEmpty ? 'var(--card)' : 'var(--brand-100)',
          }}
        >
          <span
            className="mono"
            style={{
              fontSize: 24,
              fontWeight: 800,
              color: isEmpty ? 'var(--ink-300)' : 'var(--brand-700)',
            }}
          >
            {fav.kcal}<span className="sm" style={{ color: isEmpty ? 'var(--ink-300)' : 'var(--ink-400)' }}> kcal</span>
          </span>
          <span
            className="sm mono"
            style={{ color: isEmpty ? 'var(--ink-300)' : 'var(--ink-700)' }}
          >
            P {fav.protein} · C {fav.carbs} · G {fav.fat}
          </span>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            className="btn btn-outline"
            style={{ flex: 1 }}
            disabled={!canSave}
            onClick={() => {
              tapHaptic()
              dispatch({ t: 'createFav', fav })
              dispatch({ t: 'toast', msg: 'Platillo guardado' })
              close()
            }}
          >
            Solo guardar
          </button>
          <button
            className="btn btn-brand"
            style={{ flex: 1 }}
            disabled={!canSave}
            onClick={() => {
              tapHaptic()
              dispatch({ t: 'addMeal', kcal: fav.kcal, protein: fav.protein, carbs: fav.carbs, fat: fav.fat, label: fav.label, fav: true, ts })
              dispatch({ t: 'toast', msg: `✓ ${fav.label} — ${fav.kcal} kcal` })
              close()
            }}
          >
            Guardar y agregar
          </button>
        </div>
      </div>
    </Sheet>
  )
}
