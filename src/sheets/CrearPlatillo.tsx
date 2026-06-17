// Crear platillo — arma un platillo desde ingredientes comunes con gramos/ml; guarda como favorito. (Gratis)
// Items implementados: 249 (ratio kcal/g P en totales), 253 (glutenFree/dairyFree indicator),
// 258 (partir de una receta), 265 (macros inline en dropdown), 266 (fuzzy-match),
// 267 (steppers ±5g), 268 (por 100g), 269 (nombre auto-fallback), 270 (reorder ▲▼), 271 (EmptyState con chips).
import { useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Glyph } from '../components/glyphs'
import { Sheet } from '../components/Sheet'
import { EmptyState } from '../components/EmptyState'
import { useApp } from '../lib/store'
import { INGREDIENTS, RECIPES_ENRICHED } from '../lib/catalog'
import type { Ingredient, Recipe } from '../lib/catalog'
import { IcClose } from '../components/icons'
import { tapHaptic } from '../lib/haptics'
import { staggerParent, staggerItem } from '../lib/motion'
import { fuzzyFilter } from '../lib/search'

interface Row { ing: Ingredient; grams: number }

// Ingredientes frecuentes para EmptyState (item 271)
const QUICK_ADD_NAMES = ['Pechuga de pollo', 'Arroz blanco cocido', 'Huevo entero', 'Brócoli', 'Avena en hojuelas cruda', 'Aguacate']
const QUICK_ADD = INGREDIENTS.filter((i) => QUICK_ADD_NAMES.includes(i.name))

// Genera un nombre de fallback para el platillo (item 269)
function autoName(rows: Row[]): string {
  if (rows.length === 0) return 'Mi platillo'
  const first = rows[0].ing.name.split(' ').slice(0, 2).join(' ')
  if (rows.length >= 3) return `Bowl de ${first}`
  if (rows.length === 2) return `${first} con ${rows[1].ing.name.split(' ')[0]}`
  return first
}

// Build a Map for quick ingredient lookup by name
const INGREDIENT_MAP = new Map(INGREDIENTS.map((i) => [i.name, i]))

export function CrearPlatillo() {
  const { state, dispatch } = useApp()
  const ts = state.sheetArg ? Number(state.sheetArg) : undefined
  const close = () => dispatch({ t: 'sheet', sheet: null })

  const [name, setName] = useState('')
  const [query, setQuery] = useState('')
  const [rows, setRows] = useState<Row[]>([])
  // item 258: "partir de una receta" picker
  const [showRecipePicker, setShowRecipePicker] = useState(false)
  const [recipeQuery, setRecipeQuery] = useState('')
  // item 269: auto-name pending — muestra el input con nombre sugerido cuando se intenta guardar sin nombre
  const [namePending, setNamePending] = useState(false)

  const isEmpty = rows.length === 0

  // Búsqueda fuzzy (item 266) — reemplaza .includes() puro
  const results = query.trim()
    ? fuzzyFilter(INGREDIENTS, query, (i) => i.name)
    : []

  const add = (ing: Ingredient) => {
    tapHaptic()
    setRows((r) => {
      // evitar duplicados: si ya existe, incrementa gramos
      const idx = r.findIndex((row) => row.ing.name === ing.name)
      if (idx !== -1) {
        return r.map((row, i) => i === idx ? { ...row, grams: row.grams + 100 } : row)
      }
      return [...r, { ing, grams: 100 }]
    })
    setQuery('')
  }

  const setGrams = (idx: number, g: number) =>
    setRows((r) => r.map((row, i) => i === idx ? { ...row, grams: Math.max(1, g) } : row))

  const adjustGrams = (idx: number, delta: number) =>
    setRows((r) => r.map((row, i) => i === idx ? { ...row, grams: Math.max(1, row.grams + delta) } : row))

  const remove = (idx: number) => setRows((r) => r.filter((_, i) => i !== idx))

  // item 270: reordenar con botones ▲▼
  const moveRow = (idx: number, dir: -1 | 1) => {
    setRows((r) => {
      const next = [...r]
      const swap = idx + dir
      if (swap < 0 || swap >= next.length) return r
      ;[next[idx], next[swap]] = [next[swap], next[idx]]
      return next
    })
  }

  const clearQuery = useCallback(() => setQuery(''), [])

  // Totales
  const total = rows.reduce((t, { ing, grams }) => {
    const f = grams / ing.per
    return {
      kcal:    t.kcal    + ing.kcal    * f,
      protein: t.protein + ing.protein * f,
      carbs:   t.carbs   + ing.carbs   * f,
      fat:     t.fat     + ing.fat     * f,
    }
  }, { kcal: 0, protein: 0, carbs: 0, fat: 0 })

  const r0 = (v: number) => Math.round(v)
  const r1 = (v: number) => Math.round(v * 10) / 10

  // Por 100 g (item 268)
  const totalGrams = rows.reduce((s, row) => s + row.grams, 0)
  const per100 = totalGrams > 0
    ? {
        kcal:    r0((total.kcal    / totalGrams) * 100),
        protein: r1((total.protein / totalGrams) * 100),
        carbs:   r1((total.carbs   / totalGrams) * 100),
        fat:     r1((total.fat     / totalGrams) * 100),
      }
    : null

  // Ratio kcal/g P (item 249)
  const pRatio = total.protein > 0 ? (total.kcal / total.protein).toFixed(1) : null
  const pRatioLabel = pRatio == null ? null : Number(pRatio) < 8 ? <><Glyph name="energia" size={13} color="currentColor" style={{ verticalAlign: '-2px', marginRight: 3 }} />Densidad proteica alta</> : Number(pRatio) <= 12 ? 'Densidad proteica media' : 'Densidad proteica baja'
  const pRatioColor = pRatio == null ? 'var(--ink-400)' : Number(pRatio) < 8 ? 'var(--success)' : 'var(--ink-400)'

  // Indicadores gluten/lácteos (item 253): se considera el platillo libre si TODOS los ingredientes anotados son true
  // Si algún ingrediente no tiene anotación, se muestra "?" para no dar falsos negativos.
  const glutenStatus = rows.reduce<'libre' | 'contiene' | 'incierto'>((acc, { ing }) => {
    if (acc === 'contiene') return 'contiene'
    if (ing.glutenFree === false) return 'contiene'
    if (ing.glutenFree === true) return acc === 'incierto' ? 'incierto' : acc
    return 'incierto'  // sin anotación
  }, 'libre' as 'libre' | 'contiene' | 'incierto')

  const dairyStatus = rows.reduce<'libre' | 'contiene' | 'incierto'>((acc, { ing }) => {
    if (acc === 'contiene') return 'contiene'
    if (ing.dairyFree === false) return 'contiene'
    if (ing.dairyFree === true) return acc === 'incierto' ? 'incierto' : acc
    return 'incierto'
  }, 'libre' as 'libre' | 'contiene' | 'incierto')

  const fav = {
    label:   (name.trim() || autoName(rows)),
    kcal:    r0(total.kcal),
    protein: r0(total.protein),
    carbs:   r0(total.carbs),
    fat:     r0(total.fat),
  }

  // Guardar con validación de nombre (item 269)
  const handleSave = (andAdd: boolean) => {
    if (total.kcal <= 0) return
    if (!name.trim()) {
      // Pre-rellena el nombre con el auto-nombre sugerido
      setName(autoName(rows))
      setNamePending(true)
      return
    }
    tapHaptic()
    dispatch({ t: 'createFav', fav })
    if (andAdd) {
      dispatch({ t: 'addMeal', kcal: fav.kcal, protein: fav.protein, carbs: fav.carbs, fat: fav.fat, label: fav.label, fav: true, ts })
      dispatch({ t: 'toast', msg: `✓ ${fav.label} — ${fav.kcal} kcal` })
    } else {
      dispatch({ t: 'toast', msg: 'Platillo guardado' })
    }
    close()
  }

  // item 258: partir de una receta
  const recipeResults = recipeQuery.trim()
    ? fuzzyFilter(RECIPES_ENRICHED, recipeQuery, (r) => r.name)
    : RECIPES_ENRICHED.slice(0, 12)

  const loadFromRecipe = (recipe: Recipe) => {
    // Defensa: el contenido de recetas es Plus (igual que el Recetario). Sin Plus → paywall.
    if (!state.settings.premium) { dispatch({ t: 'sheet', sheet: 'paywall' }); return }
    tapHaptic()
    const newRows: Row[] = []
    for (const ri of recipe.ingredients) {
      const ing = INGREDIENT_MAP.get(ri.name)
      if (ing) {
        newRows.push({ ing, grams: ri.grams })
      }
      // ingredientes no encontrados en catálogo se omiten (ad-hoc requeriría types/store)
    }
    setRows(newRows)
    setName(recipe.name)
    setShowRecipePicker(false)
    setRecipeQuery('')
  }

  return (
    <Sheet title="Crear platillo" onClose={close}>
      <div style={{ padding: '0 20px 32px', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Nombre del platillo (item 269: mensaje de ayuda cuando está pendiente) */}
        <div>
          <label className="sm" style={{ color: 'var(--ink-400)', display: 'block', marginBottom: 4, fontWeight: 600 }}>
            Nombre del platillo
          </label>
          <input
            className={`field${namePending ? ' field-highlight' : ''}`}
            placeholder="p. ej. Bowl de pollo con arroz"
            value={name}
            autoFocus={namePending}
            onChange={(e) => { setName(e.target.value); setNamePending(false) }}
          />
          {namePending && (
            <p className="sm" style={{ color: 'var(--brand-700)', marginTop: 4 }}>
              Nombre sugerido — edítalo antes de guardar
            </p>
          )}
        </div>

        {/* Partir de una receta (item 258) — contenido Plus (mismo catálogo que el Recetario, que sí cobra).
            Sin Plus, el botón abre el paywall en vez de exponer las recetas (cerraba el bypass del paywall). */}
        <div>
          <button
            className="btn btn-outline btn-sm"
            style={{ width: '100%' }}
            onClick={() => {
              tapHaptic()
              if (!state.settings.premium) { dispatch({ t: 'sheet', sheet: 'paywall' }); return }
              setShowRecipePicker((v) => !v)
            }}
          >
            {!state.settings.premium
              ? <><Glyph name="candado" size={13} color="currentColor" style={{ verticalAlign: '-2px', marginRight: 3 }} />Partir de una receta (Plus)</>
              : showRecipePicker ? '✕ Cerrar selector de receta' : <><Glyph name="portapapeles" size={13} color="currentColor" style={{ verticalAlign: '-2px', marginRight: 3 }} />Partir de una receta…</>}
          </button>
          {state.settings.premium && showRecipePicker && (
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <input
                className="field"
                placeholder="Buscar receta base…"
                value={recipeQuery}
                onChange={(e) => setRecipeQuery(e.target.value)}
                autoFocus
              />
              <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {recipeResults.map((recipe) => (
                  <button
                    key={recipe.name}
                    className="card"
                    onClick={() => loadFromRecipe(recipe)}
                    style={{ padding: '8px 12px', textAlign: 'left', cursor: 'pointer', border: '1px solid var(--border)' }}
                  >
                    <div className="sm" style={{ fontWeight: 600 }}>{recipe.name}</div>
                    <div className="sm mono" style={{ color: 'var(--ink-400)' }}>
                      {recipe.kcal} kcal · P {recipe.protein} · {recipe.ingredients.length} ing.
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Buscar ingrediente (item 265: macros inline en sugerencia; item 266: fuzzy) */}
        <div>
          <div style={{ position: 'relative' }}>
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

          {/* Resultados de búsqueda (item 265: muestra kcal + P/100g) */}
          {results.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6 }}>
              {results.map((ing) => (
                <button
                  key={ing.name}
                  className="card"
                  onClick={() => add(ing)}
                  style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', cursor: 'pointer', border: '1px solid var(--border)' }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span className="body" style={{ fontWeight: 600 }}>{ing.name}</span>
                  </div>
                  <span className="sm mono" style={{ color: 'var(--ink-400)', flexShrink: 0, fontSize: 10 }}>
                    {ing.kcal} kcal · P {ing.protein} g/100{ing.unit}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* EmptyState con chips de ingredientes frecuentes (item 271) */}
          {isEmpty && !query && !showRecipePicker && (
            <div style={{ marginTop: 16, textAlign: 'center' }}>
              <EmptyState
                glyph="apetito"
                title="Empieza agregando un ingrediente"
                subtitle="Busca en el campo de arriba o elige uno frecuente"
              />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginTop: 8 }}>
                {QUICK_ADD.map((ing) => (
                  <button
                    key={ing.name}
                    className="chip"
                    onClick={() => add(ing)}
                    style={{ fontSize: 12 }}
                  >
                    {ing.name.split(' ')[0]}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Filas de ingredientes (items 267: ±5g steppers; 270: reorder ▲▼) */}
        {rows.length > 0 && (
          <motion.div
            variants={staggerParent}
            initial="initial"
            animate="animate"
            style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
          >
            {rows.map((row, idx) => {
              const f = row.grams / row.ing.per
              const rowKcal = r0(row.ing.kcal * f)
              const rowP = r0(row.ing.protein * f)
              const rowC = r0(row.ing.carbs * f)
              const rowG = r0(row.ing.fat * f)
              return (
                <motion.div key={`${row.ing.name}-${idx}`} variants={staggerItem}>
                  {/* Nombre + controles de reorder y quitar */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {/* ▲▼ reorder (item 270) */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, flexShrink: 0 }}>
                      <button
                        aria-label="Subir ingrediente"
                        onClick={() => moveRow(idx, -1)}
                        disabled={idx === 0}
                        style={{ background: 'none', border: 0, color: idx === 0 ? 'var(--ink-200)' : 'var(--ink-400)', cursor: idx === 0 ? 'default' : 'pointer', padding: '1px 2px', lineHeight: 1, fontSize: 10 }}
                      >▲</button>
                      <button
                        aria-label="Bajar ingrediente"
                        onClick={() => moveRow(idx, 1)}
                        disabled={idx === rows.length - 1}
                        style={{ background: 'none', border: 0, color: idx === rows.length - 1 ? 'var(--ink-200)' : 'var(--ink-400)', cursor: idx === rows.length - 1 ? 'default' : 'pointer', padding: '1px 2px', lineHeight: 1, fontSize: 10 }}
                      >▼</button>
                    </div>
                    <span className="sm" style={{ flex: 1, minWidth: 0, color: 'var(--ink-700)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {row.ing.name}
                    </span>
                    {/* −5g (item 267) */}
                    <button
                      aria-label="Restar 5g"
                      onClick={() => adjustGrams(idx, -5)}
                      style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--ink-700)', cursor: 'pointer', borderRadius: 'var(--r-sm)', width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 12 }}
                    >−</button>
                    <input
                      className="field mono"
                      type="number"
                      inputMode="numeric"
                      min={1}
                      step={1}
                      value={row.grams}
                      onChange={(e) => setGrams(idx, Math.max(1, parseFloat(e.target.value) || 1))}
                      style={{ width: 58, textAlign: 'center' }}
                    />
                    {/* +5g (item 267) */}
                    <button
                      aria-label="Sumar 5g"
                      onClick={() => adjustGrams(idx, 5)}
                      style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--ink-700)', cursor: 'pointer', borderRadius: 'var(--r-sm)', width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 12 }}
                    >+</button>
                    <span className="sm" style={{ color: 'var(--ink-400)', width: 16, flexShrink: 0 }}>{row.ing.unit}</span>
                    <button aria-label="Quitar" onClick={() => remove(idx)} style={{ background: 'none', border: 0, color: 'var(--ink-300)', cursor: 'pointer', display: 'flex', flexShrink: 0 }}>
                      <IcClose size={16} />
                    </button>
                  </div>
                  <div className="sm mono" style={{ color: 'var(--ink-400)', paddingLeft: 28, marginTop: 2 }}>
                    {rowKcal} kcal · P {rowP} · C {rowC} · G {rowG}
                  </div>
                </motion.div>
              )
            })}
          </motion.div>
        )}

        {/* Totales (items 249: ratio P/kcal; 268: por 100g; 253: indicadores gluten/lácteos) */}
        {rows.length > 0 && (
          <div className="card" style={{ background: 'var(--brand-100)', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
              <span className="mono" style={{ fontSize: 24, fontWeight: 800, color: 'var(--brand-700)' }}>
                {r0(total.kcal)}<span className="sm" style={{ color: 'var(--ink-400)' }}> kcal</span>
              </span>
              <span className="sm mono" style={{ color: 'var(--ink-700)' }}>
                P {r0(total.protein)} · C {r0(total.carbs)} · G {r0(total.fat)}
              </span>
            </div>

            {/* Por 100g (item 268) */}
            {per100 && (
              <div className="sm mono" style={{ color: 'var(--ink-400)' }}>
                Por 100 g: {per100.kcal} kcal · P {per100.protein} · C {per100.carbs} · G {per100.fat}
              </div>
            )}

            {/* Ratio kcal/g P (item 249) */}
            {pRatio != null && (
              <div className="sm" style={{ color: pRatioColor }}>
                {pRatioLabel} · {pRatio} kcal por g de proteína
              </div>
            )}

            {/* Indicadores sin gluten/sin lácteos (item 253) */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
              <span className="badge" style={{
                background: glutenStatus === 'libre' ? 'var(--success)' : glutenStatus === 'contiene' ? 'var(--error)' : 'var(--surface)',
                color: glutenStatus === 'incierto' ? 'var(--ink-400)' : '#fff',
                fontSize: 10,
              }}>
                {glutenStatus === 'libre' ? <><Glyph name="check" size={13} color="currentColor" style={{ verticalAlign: '-2px', marginRight: 3 }} />Sin gluten</> : glutenStatus === 'contiene' ? <><Glyph name="cross" size={13} color="currentColor" style={{ verticalAlign: '-2px', marginRight: 3 }} />Con gluten</> : '? Gluten incierto'}
              </span>
              <span className="badge" style={{
                background: dairyStatus === 'libre' ? 'var(--success)' : dairyStatus === 'contiene' ? 'var(--error)' : 'var(--surface)',
                color: dairyStatus === 'incierto' ? 'var(--ink-400)' : '#fff',
                fontSize: 10,
              }}>
                {dairyStatus === 'libre' ? <><Glyph name="check" size={13} color="currentColor" style={{ verticalAlign: '-2px', marginRight: 3 }} />Sin lácteos</> : dairyStatus === 'contiene' ? <><Glyph name="cross" size={13} color="currentColor" style={{ verticalAlign: '-2px', marginRight: 3 }} />Con lácteos</> : '? Lácteos inciertos'}
              </span>
            </div>
          </div>
        )}

        {/* Totales vacíos */}
        {isEmpty && (
          <div className="card" style={{ display: 'flex', alignItems: 'baseline', gap: 14, background: 'var(--card)' }}>
            <span className="mono" style={{ fontSize: 24, fontWeight: 800, color: 'var(--ink-300)' }}>
              0<span className="sm" style={{ color: 'var(--ink-300)' }}> kcal</span>
            </span>
            <span className="sm mono" style={{ color: 'var(--ink-300)' }}>P 0 · C 0 · G 0</span>
          </div>
        )}

        {/* Botones de acción (item 269: handleSave gestiona nombre vacío) */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            className="btn btn-outline"
            style={{ flex: 1 }}
            disabled={total.kcal <= 0}
            onClick={() => handleSave(false)}
          >
            Solo guardar
          </button>
          <button
            className="btn btn-brand"
            style={{ flex: 1 }}
            disabled={total.kcal <= 0}
            onClick={() => handleSave(true)}
          >
            Guardar y agregar
          </button>
        </div>
      </div>
    </Sheet>
  )
}
