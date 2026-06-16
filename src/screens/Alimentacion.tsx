// Alimentación — "Registro Relámpago": predicciones por franja horaria (1 toque), barra inteligente
// con búsqueda en tu biblioteca, copiar de ayer, porciones, proteína + meta. (Torneo multiagente → audit.)
import { useState } from 'react'
import { motion } from 'framer-motion'
import { useApp, isoKey, mealSlot } from '../lib/store'
import { dayMacros, predictions, fuzzySearch, protocolNumbers, anchorProduct, tdee } from '../lib/nutrition'
import { Sparkline } from '../components/charts'
import { PremiumGate } from '../components/PremiumGate'
import { IcDrop, IcClose } from '../components/icons'
import { tapHaptic } from '../lib/haptics'
import { staggerParent, staggerItem } from '../lib/motion'
import type { FoodFav } from '../lib/types'

const WATER_GOAL = 8
const PORTIONS: (number | null)[] = [null, 0.5, 1, 1.5, 2] // null = "auto" (porción aprendida)
const hm = (ts: number) => new Date(ts).toTimeString().slice(0, 5) // 'HH:MM'
// copy del estado vacío según la franja del día
const SLOT_PROMPT: Record<string, string> = {
  'desayuno': '¿Qué desayunas? Regístralo abajo y lo recordaré.',
  'colación de la mañana': '¿Una colación? Regístrala abajo y la recordaré.',
  'comida': '¿Qué comes hoy? Regístralo abajo y lo recordaré.',
  'colación de la tarde': '¿Una colación? Regístrala abajo y la recordaré.',
  'cena': '¿Qué cenas? Regístralo abajo y lo recordaré.',
  'antojo nocturno': '¿Algún antojo nocturno? Regístralo abajo y lo recordaré.',
}
const porLabel = (p: number | null) => (p == null ? 'auto' : p === 0.5 ? '½' : p === 1.5 ? '1½' : `${p}×`)
const fmtTime = (ts: number) => new Date(ts).toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' })

export function Alimentacion() {
  const { state, dispatch } = useApp()
  const now = Date.now()
  const key = isoKey(state.todayTs)
  const day = state.nutrition[key] ?? { water: 0, meals: [] }
  const kcal = day.meals.reduce((sum, m) => sum + m.kcal, 0)
  const macros = dayMacros(day.meals)

  const [portion, setPortion] = useState<number | null>(null)
  const [timeStr, setTimeStr] = useState<string | null>(null) // null = ahora; 'HH:MM' = hora elegida hoy
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)
  const [kcalStr, setKcalStr] = useState('')
  const [showMacros, setShowMacros] = useState(false)
  const [pStr, setPStr] = useState('')
  const [cStr, setCStr] = useState('')
  const [fStr, setFStr] = useState('')
  const [manageFav, setManageFav] = useState(false)

  const goalKcal = state.kcalGoal ?? tdee(state)
  const goalP = state.macroGoals?.protein ?? null
  // hora de registro elegida (ahora, o una hora de HOY para backfill); la franja se DERIVA de la hora
  const whenTs = (() => {
    if (!timeStr) return now
    const [h, m] = timeStr.split(':').map(Number)
    const d = new Date(state.todayTs); d.setHours(h || 0, m || 0, 0, 0)
    return d.getTime()
  })()
  const whenSlot = mealSlot(whenTs)
  const preds = predictions(state, whenTs, 3)
  const results = fuzzySearch(state.foodLibrary, query)
  const yd = new Date(state.todayTs); yd.setDate(yd.getDate() - 1)
  const hasYesterday = (state.nutrition[isoKey(yd.getTime())]?.meals.length ?? 0) > 0

  const addWater = (d: number) => { tapHaptic(); dispatch({ t: 'water', delta: d }) }
  const logFav = (f: FoodFav) => { tapHaptic(); dispatch({ t: 'addFavMeal', id: f.id, portion: portion ?? undefined, ts: whenTs }); setQuery('') }
  const multOf = (f: FoodFav) => portion ?? (f.defaultMultiplier && f.defaultMultiplier > 0 ? f.defaultMultiplier : 1)

  const createAndLog = () => {
    const k = parseFloat(kcalStr)
    if (!(k > 0)) return
    tapHaptic()
    dispatch({ t: 'addMeal', kcal: k, protein: parseFloat(pStr) || null, carbs: parseFloat(cStr) || null, fat: parseFloat(fStr) || null, label: query.trim() || undefined, fav: !!query.trim(), ts: whenTs })
    setQuery(''); setKcalStr(''); setPStr(''); setCStr(''); setFStr(''); setShowMacros(false); setCreating(false)
  }

  return (
    <div className="scroll has-nav">
      <motion.div variants={staggerParent} initial="initial" animate="animate" style={{ padding: '20px 20px 40px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <motion.h1 variants={staggerItem} className="h1" style={{ margin: 0 }}>Alimentación</motion.h1>

        {/* ── Strip de hidratación ── */}
        <motion.section variants={staggerItem} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px' }}>
          <IcDrop size={20} style={{ color: 'var(--brand-700)', flexShrink: 0 }} />
          <span className="sm mono" style={{ color: day.water >= WATER_GOAL ? 'var(--success)' : 'var(--ink-700)', fontWeight: 700 }}>{day.water}/{WATER_GOAL}</span>
          <div style={{ flex: 1, height: 6, background: 'var(--ink-100)', borderRadius: 999, overflow: 'hidden' }}>
            <div style={{ width: `${Math.min(100, (day.water / WATER_GOAL) * 100)}%`, height: '100%', background: 'var(--brand-500)', borderRadius: 999 }} />
          </div>
          <button className="iconbtn" aria-label="Quitar vaso" onClick={() => addWater(-1)} disabled={day.water === 0} style={{ width: 34, height: 34 }}>−</button>
          <button className="iconbtn" aria-label="Agregar vaso" onClick={() => addWater(1)} style={{ width: 34, height: 34, background: 'var(--brand-700)', color: '#fff' }}>+</button>
        </motion.section>

        {/* ── Resumen del día ── */}
        <motion.section variants={staggerItem} className="card">
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <span className="mono" style={{ fontSize: 30, fontWeight: 800, color: 'var(--ink-900)', lineHeight: 1.1 }}>
              {kcal}<span className="sm" style={{ color: 'var(--ink-400)', fontWeight: 600 }}>{goalKcal ? ` / ${goalKcal} kcal` : ' kcal'}</span>
            </span>
            <GoalEditor />
          </div>
          {goalKcal && (
            <div style={{ height: 7, background: 'var(--ink-100)', borderRadius: 999, overflow: 'hidden', margin: '10px 0' }}>
              <div style={{ width: `${Math.min(100, (kcal / goalKcal) * 100)}%`, height: '100%', background: kcal > goalKcal ? 'var(--warning)' : 'var(--brand-700)', borderRadius: 999 }} />
            </div>
          )}
          {(macros.hasMacros || goalP) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
              <span className="sm mono" style={{ color: 'var(--ink-900)', fontWeight: 700, background: 'var(--brand-100)', padding: '3px 10px', borderRadius: 999 }}>
                P {macros.protein}{goalP ? ` / ${goalP}` : ''} g
              </span>
              {goalP != null && macros.protein < goalP && <span className="sm" style={{ color: 'var(--ink-400)' }}>te faltan {goalP - macros.protein} g</span>}
              {macros.hasMacros && <span className="sm mono" style={{ color: 'var(--ink-400)', marginLeft: 'auto' }}>C {macros.carbs} · G {macros.fat}</span>}
            </div>
          )}
        </motion.section>

        {/* ── Predicciones por franja + barra inteligente ── */}
        <motion.section variants={staggerItem} className="card">
          {/* Hora del registro (elige la hora → backfill; la franja se deriva sola) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
            <span className="sm" style={{ color: 'var(--ink-400)' }}>Hora</span>
            <input className="field mono" type="time" value={timeStr ?? hm(now)} onChange={(e) => setTimeStr(e.target.value)} style={{ width: 110, padding: '6px 10px' }} />
            {timeStr != null && <button className="chip" style={{ height: 30 }} onClick={() => setTimeStr(null)}>Ahora</button>}
            <span className="sm" style={{ color: 'var(--brand-700)', fontWeight: 600, marginLeft: 'auto', textAlign: 'right' }}>Para tu {whenSlot}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginBottom: 10 }}>
            <span className="sm" style={{ color: 'var(--ink-400)', marginRight: 'auto' }}>Porción</span>
            {PORTIONS.map((p) => (
              <button key={String(p)} onClick={() => setPortion(p)} className="sm mono" style={{ border: 0, borderRadius: 8, padding: '2px 7px', cursor: 'pointer', fontWeight: 700, background: portion === p ? 'var(--brand-700)' : 'var(--ink-100)', color: portion === p ? '#fff' : 'var(--ink-400)' }}>
                {porLabel(p)}
              </button>
            ))}
          </div>

          {/* Tarjetas de predicción (1 toque) */}
          {preds.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {preds.map((f, i) => {
                const mult = multOf(f)
                return (
                  <button key={f.id} onClick={() => logFav(f)} className="card" style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', cursor: 'pointer', border: '1px solid var(--border)', opacity: i === 0 ? 1 : i === 1 ? 0.92 : 0.84 }}>
                    <span style={{ color: 'var(--brand-700)', flexShrink: 0 }}>{i === 0 ? '★' : '•'}</span>
                    <span className="body" style={{ fontWeight: 600, color: 'var(--ink-900)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {f.label}{mult !== 1 ? ` ·${porLabel(mult)}` : ''}
                    </span>
                    <span className="mono sm" style={{ fontWeight: 700, marginLeft: 'auto', flexShrink: 0 }}>{Math.round(f.kcal * mult)}<span style={{ color: 'var(--ink-400)' }}> kcal</span></span>
                  </button>
                )
              })}
            </div>
          ) : (
            <div className="sm" style={{ color: 'var(--ink-400)', padding: '8px 0' }}>{SLOT_PROMPT[whenSlot] ?? 'Registra tu comida abajo y la recordaré.'}</div>
          )}

          {/* Acciones rápidas */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
            <button className="chip" onClick={() => dispatch({ t: 'sheet', sheet: 'crear-platillo' })}>Crear platillo</button>
            <button className="chip" onClick={() => dispatch({ t: 'sheet', sheet: 'recetario' })}>Recetario ✦</button>
            {hasYesterday && <button className="chip" onClick={() => { tapHaptic(); dispatch({ t: 'copyYesterday' }) }}>Copiar de ayer</button>}
            {day.meals[0] && <button className="chip" onClick={() => { tapHaptic(); dispatch({ t: 'addMeal', kcal: day.meals[0].kcal, protein: day.meals[0].protein, carbs: day.meals[0].carbs, fat: day.meals[0].fat, label: (day.meals[0].label ?? undefined), ts: whenTs }) }}>Repetir última</button>}
          </div>

          {/* Barra inteligente: busca en tu biblioteca o crea */}
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
            <input className="field" placeholder="¿Qué comiste? Busca o crea…" value={query} onChange={(e) => { setQuery(e.target.value); setCreating(false) }} />
            {query.trim() && (
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {results.map((f) => (
                  <button key={f.id} className="card" onClick={() => logFav(f)} style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', cursor: 'pointer', border: '1px solid var(--border)' }}>
                    <span className="body" style={{ fontWeight: 600, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.label}</span>
                    <span className="mono sm" style={{ marginLeft: 'auto', color: 'var(--ink-400)' }}>{Math.round(f.kcal * multOf(f))} kcal</span>
                  </button>
                ))}
                {!results.some((f) => f.label.toLowerCase() === query.trim().toLowerCase()) && !creating && (
                  <button className="chip" style={{ alignSelf: 'flex-start' }} onClick={() => setCreating(true)}>+ Crear "{query.trim()}"</button>
                )}
                {creating && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <input className="field mono" type="number" inputMode="numeric" autoFocus placeholder="0" value={kcalStr} onChange={(e) => setKcalStr(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') createAndLog() }} style={{ flex: 1, fontSize: 24, fontWeight: 700, textAlign: 'center' }} />
                      <span className="sm" style={{ color: 'var(--ink-400)' }}>kcal</span>
                    </div>
                    {showMacros ? (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input className="field" type="number" inputMode="numeric" placeholder="P (g)" value={pStr} onChange={(e) => setPStr(e.target.value)} style={{ flex: 1 }} />
                        <input className="field" type="number" inputMode="numeric" placeholder="C (g)" value={cStr} onChange={(e) => setCStr(e.target.value)} style={{ flex: 1 }} />
                        <input className="field" type="number" inputMode="numeric" placeholder="G (g)" value={fStr} onChange={(e) => setFStr(e.target.value)} style={{ flex: 1 }} />
                      </div>
                    ) : (
                      <button className="sm" style={{ background: 'none', border: 0, color: 'var(--brand-700)', fontWeight: 600, cursor: 'pointer', padding: 0, textAlign: 'left' }} onClick={() => setShowMacros(true)}>+ Macros (opcional)</button>
                    )}
                    <button className="btn btn-brand" disabled={!(parseFloat(kcalStr) > 0)} onClick={createAndLog}>Guardar y agregar</button>
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.section>

        {/* ── Comidas de hoy ── */}
        {day.meals.length > 0 && (
          <motion.section variants={staggerItem} className="card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span className="sm" style={{ color: 'var(--ink-400)' }}>Hoy — {day.meals.length} {day.meals.length === 1 ? 'comida' : 'comidas'}</span>
              {state.foodLibrary.length > 0 && (
                <button className="sm" style={{ background: 'none', border: 0, color: 'var(--brand-700)', fontWeight: 600, cursor: 'pointer', padding: 0 }} onClick={() => setManageFav((v) => !v)}>{manageFav ? 'Listo' : 'Editar favoritos'}</button>
              )}
            </div>
            {manageFav ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {state.foodLibrary.map((f) => (
                  <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input className="field" defaultValue={f.label} onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== f.label) dispatch({ t: 'editFav', id: f.id, patch: { label: v } }) }} style={{ flex: 1 }} />
                    <input className="field mono" type="number" inputMode="numeric" defaultValue={f.kcal} onBlur={(e) => { const v = parseFloat(e.target.value); if (v > 0 && v !== f.kcal) dispatch({ t: 'editFav', id: f.id, patch: { kcal: Math.round(v) } }) }} style={{ width: 78, textAlign: 'center' }} />
                    <button aria-label="Eliminar favorito" onClick={() => { tapHaptic(); dispatch({ t: 'delFav', id: f.id }) }} style={{ background: 'none', border: 0, color: 'var(--error)', cursor: 'pointer', display: 'flex' }}><IcClose size={18} /></button>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {day.meals.map((m) => (
                  <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className="body mono" style={{ fontWeight: 600 }}>{m.kcal}</span>
                    <span className="sm" style={{ color: 'var(--ink-700)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.label || 'kcal'}{m.protein ? ` · P${m.protein}` : ''}</span>
                    <span className="sm" style={{ color: 'var(--ink-400)', marginLeft: 'auto', flexShrink: 0 }}>{fmtTime(m.ts)}</span>
                    <button aria-label="Eliminar" onClick={() => { tapHaptic(); dispatch({ t: 'delMeal', id: m.id }) }} style={{ background: 'none', border: 0, color: 'var(--ink-300)', cursor: 'pointer', display: 'flex', flexShrink: 0 }}><IcClose size={16} /></button>
                  </div>
                ))}
              </div>
            )}
          </motion.section>
        )}

        {/* ── Metas de macros (Plus) ── */}
        <motion.section variants={staggerItem}>
          <PremiumGate label="Metas de macros — Plus">
            <MacroGoals />
          </PremiumGate>
        </motion.section>

        {/* ── Tu protocolo en números (mini · Plus) ── */}
        <AnchorMini />

        <motion.p variants={staggerItem} className="sm" style={{ color: 'var(--ink-300)', lineHeight: 1.4, borderLeft: '2px solid var(--border)', paddingLeft: 10 }}>
          Registro personal de hidratación y nutrición. No es consejo nutricional ni médico.
        </motion.p>
      </motion.div>
    </div>
  )
}

// editor de meta calórica (inline)
function GoalEditor() {
  const { state, dispatch } = useApp()
  const [edit, setEdit] = useState(false)
  const goal = state.kcalGoal
  if (edit) {
    return (
      <input className="field" type="number" inputMode="numeric" autoFocus placeholder="kcal/día" defaultValue={goal ?? ''}
        onBlur={(e) => { dispatch({ t: 'setKcalGoal', value: parseFloat(e.target.value) || null }); setEdit(false) }}
        style={{ width: 110 }} />
    )
  }
  return (
    <button className="sm" style={{ background: 'none', border: 0, color: 'var(--brand-700)', fontWeight: 600, cursor: 'pointer', padding: 0 }} onClick={() => setEdit(true)}>
      {goal ? 'Editar meta' : 'Definir meta'}
    </button>
  )
}

// metas de macros (Plus) — el usuario define; barras del día vs meta
function MacroGoals() {
  const { state, dispatch } = useApp()
  const [edit, setEdit] = useState(false)
  const goals = state.macroGoals
  const day = state.nutrition[isoKey(state.todayTs)] ?? { water: 0, meals: [] }
  const m = dayMacros(day.meals)
  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span className="body" style={{ fontWeight: 600, color: 'var(--ink-900)' }}>Macros vs tus metas</span>
        <button className="sm" style={{ background: 'none', border: 0, color: 'var(--brand-700)', fontWeight: 600, cursor: 'pointer', padding: 0 }} onClick={() => setEdit((v) => !v)}>{edit ? 'Listo' : goals ? 'Editar metas' : 'Definir metas'}</button>
      </div>
      {edit || !goals ? (
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          {([['protein', 'Proteína'], ['carbs', 'Carbos'], ['fat', 'Grasa']] as const).map(([k, lbl]) => (
            <div key={k} style={{ flex: 1 }}>
              <label className="sm" style={{ color: 'var(--ink-400)' }}>{lbl} (g)</label>
              <input className="field" type="number" inputMode="numeric" placeholder="0" defaultValue={goals?.[k] ?? ''}
                onBlur={(e) => { const v = Math.max(0, parseFloat(e.target.value) || 0); const next = { protein: goals?.protein ?? 0, carbs: goals?.carbs ?? 0, fat: goals?.fat ?? 0, [k]: v }; dispatch({ t: 'setMacroGoals', goals: next.protein || next.carbs || next.fat ? next : null }) }} />
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
          {([['protein', 'Proteína', 'var(--brand-700)'], ['carbs', 'Carbos', 'var(--warning)'], ['fat', 'Grasa', 'var(--brand-300)']] as const).map(([k, lbl, color]) => {
            const cur = m[k]; const goal = goals[k] || 0; const pct = goal > 0 ? Math.min(100, (cur / goal) * 100) : 0
            return (
              <div key={k}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span className="sm" style={{ color: 'var(--ink-700)' }}>{lbl}</span>
                  <span className="sm mono" style={{ color: 'var(--ink-900)' }}>{cur} / {goal} g</span>
                </div>
                <div style={{ height: 7, background: 'var(--ink-100)', borderRadius: 999, overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 999 }} />
                </div>
              </div>
            )
          })}
          <div className="sm" style={{ color: 'var(--ink-300)' }}>Tú defines tus metas. La app no prescribe cuánto comer.</div>
        </div>
      )}
    </div>
  )
}

// mini ancla "Tu protocolo en números" (Plus)
function AnchorMini() {
  const { state } = useApp()
  const pn = protocolNumbers(state)
  const ap = anchorProduct(state)
  if (!pn || (pn.deltaKcal == null && pn.weightDelta == null)) return null
  const sub = Object.keys(state.protocols).length > 1 ? 'Desde el inicio de tu seguimiento' : ap ? `Desde que iniciaste ${ap}` : 'Desde tu fecha de inicio'
  return (
    <motion.section variants={staggerItem}>
      <PremiumGate label="Tu protocolo en números — Plus">
        <div className="card">
          <span className="body" style={{ fontWeight: 600, color: 'var(--ink-900)' }}>Tu protocolo en números</span>
          <span className="sm" style={{ color: 'var(--ink-400)', display: 'block', marginTop: 2, marginBottom: 10 }}>{sub}</span>
          <div style={{ display: 'flex', gap: 20, marginBottom: 8 }}>
            {pn.deltaKcal != null && <div><div className="mono" style={{ fontSize: 24, fontWeight: 800, color: pn.deltaKcal <= 0 ? 'var(--success)' : 'var(--ink-900)' }}>{pn.deltaKcal > 0 ? '+' : ''}{pn.deltaKcal}</div><div className="sm" style={{ color: 'var(--ink-400)' }}>kcal/día prom.</div></div>}
            {pn.weightDelta != null && <div><div className="mono" style={{ fontSize: 24, fontWeight: 800, color: pn.weightDelta <= 0 ? 'var(--success)' : 'var(--ink-900)' }}>{pn.weightDelta > 0 ? '+' : ''}{pn.weightDelta}</div><div className="sm" style={{ color: 'var(--ink-400)' }}>kg</div></div>}
          </div>
          {pn.kcalPoints.length >= 2 && <Sparkline data={pn.kcalPoints.map((x) => x.kcal)} color="var(--brand-500)" w={280} h={32} />}
        </div>
      </PremiumGate>
    </motion.section>
  )
}
