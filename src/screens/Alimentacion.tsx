// Alimentación — "Registro Relámpago": predicciones por franja horaria (1 toque), barra inteligente
// con búsqueda en tu biblioteca, copiar de ayer, porciones, proteína + meta. (Torneo multiagente → audit.)
import { useState } from 'react'
import { motion } from 'framer-motion'
import { useApp, isoKey, mealSlot } from '../lib/store'
import { dayMacros, predictions, fuzzySearch, protocolNumbers, anchorProduct, tdee, kcalFromMacros, proteinSuggestion, waterGoalGlasses } from '../lib/nutrition'
import { Sparkline, TrendChart } from '../components/charts'
import { PremiumGate } from '../components/PremiumGate'
import { TimeWheel } from '../components/TimeWheel'
import { EmptyState } from '../components/EmptyState'
import { IcDrop, IcClose } from '../components/icons'
import { tapHaptic } from '../lib/haptics'
import { staggerParent, staggerItem } from '../lib/motion'
import type { FoodFav } from '../lib/types'

// WATER_GOAL is now dynamic (waterGoalGlasses), kept for backwards-compat w/ compositeStreak
const WATER_GOAL = 8
const PORTIONS: (number | null)[] = [null, 0.5, 1, 1.5, 2] // null = "auto" (porción aprendida)
// "9:05 AM" → ts de hoy; 'Ahora' → null
function parseHoraLabel(label: string, todayTs: number): number | null {
  if (label === 'Ahora') return null
  const m = label.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (!m) return null
  let h = parseInt(m[1], 10) % 12
  if (/pm/i.test(m[3])) h += 12
  const d = new Date(todayTs); d.setHours(h, parseInt(m[2], 10), 0, 0)
  return d.getTime()
}
// copy del estado vacío según la franja del día
const SLOT_PROMPT: Record<string, string> = {
  'desayuno': '¿Qué desayunas? Regístralo abajo y lo recordaré.',
  'colación de la mañana': '¿Una colación? Regístrala abajo y la recordaré.',
  'comida': '¿Qué comes hoy? Regístralo abajo y lo recordaré.',
  'colación de la tarde': '¿Una colación? Regístrala abajo y la recordaré.',
  'cena': '¿Qué cenas? Regístralo abajo y lo recordaré.',
  'antojo nocturno': '¿Algún antojo nocturno? Regístralo abajo y lo recordaré.',
}
// toastId for undo operations
let _toastUndoId: ReturnType<typeof setTimeout> | null = null
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
  const [horaLabel, setHoraLabel] = useState('Ahora') // 'Ahora' o '9:05 AM'
  const [showWheel, setShowWheel] = useState(false)
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)
  const [kcalStr, setKcalStr] = useState('')
  const [showMacros, setShowMacros] = useState(false)
  const [pStr, setPStr] = useState('')
  const [cStr, setCStr] = useState('')
  const [fStr, setFStr] = useState('')
  const [manageFav, setManageFav] = useState(false)
  const [macroWarning, setMacroWarning] = useState<string | null>(null)
  const [kcalWarning, setKcalWarning] = useState<string | null>(null)
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const [undoPending, setUndoPending] = useState<boolean>(false)

  const goalKcal = state.kcalGoal ?? tdee(state)
  const goalP = state.macroGoals?.protein ?? null
  const peso = state.profile?.peso ?? null
  // hora de registro elegida (ahora, o una hora de HOY para backfill); la franja se DERIVA de la hora
  const whenTs = parseHoraLabel(horaLabel, state.todayTs) ?? now
  const whenSlot = mealSlot(whenTs)
  const preds = predictions(state, whenTs, 3)
  const results = fuzzySearch(state.foodLibrary, query)
  const yd = new Date(state.todayTs); yd.setDate(yd.getDate() - 1)
  const hasYesterday = (state.nutrition[isoKey(yd.getTime())]?.meals.length ?? 0) > 0

  // Derived water goal from weight (§82)
  const waterGoal = peso ? waterGoalGlasses(peso) : WATER_GOAL
  // Suggested protein from weight (§82)
  const suggestedProtein = (!goalP && peso) ? proteinSuggestion(peso) : null

  // Caloric balance label (§83)
  const deficitLabel = goalKcal
    ? kcal >= goalKcal * 0.97 && kcal <= goalKcal * 1.03
      ? { text: 'En meta', color: 'var(--success)' }
      : kcal > goalKcal
        ? { text: `Superávit +${kcal - goalKcal} kcal`, color: 'var(--warning)' }
        : { text: `Déficit −${goalKcal - kcal} kcal`, color: 'var(--brand-700)' }
    : null

  // Totals footer for meals list (§83)
  const hasDayMacros = macros.hasMacros
  const dayTotals = hasDayMacros ? `${kcal} kcal · P: ${macros.protein} g · C: ${macros.carbs} g · G: ${macros.fat} g` : null

  const showToast = (msg: string) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 3000)
  }

  const addWater = (d: number) => { tapHaptic(); dispatch({ t: 'water', delta: d }) }
  const logFav = (f: FoodFav) => {
    tapHaptic()
    dispatch({ t: 'addFavMeal', id: f.id, portion: portion ?? undefined, ts: whenTs })
    showToast(`✓ ${f.label} — ${Math.round(f.kcal * (portion ?? (f.defaultMultiplier && f.defaultMultiplier > 0 ? f.defaultMultiplier : 1)))} kcal`)
    setQuery('')
  }
  const multOf = (f: FoodFav) => portion ?? (f.defaultMultiplier && f.defaultMultiplier > 0 ? f.defaultMultiplier : 1)

  const createAndLog = () => {
    const k = parseFloat(kcalStr)
    if (!(k > 0)) return
    // Guardrails §85 — non-blocking
    if (k < 20) { setKcalWarning('¿unidad o porción pequeña?'); return }
    if (k > 2000) { setKcalWarning('¿una comida o todo el día?') } else { setKcalWarning(null) }
    // Macro-kcal coherence check §81
    const p = parseFloat(pStr) || 0
    const c = parseFloat(cStr) || 0
    const f = parseFloat(fStr) || 0
    if (p || c || f) {
      const computed = kcalFromMacros(p, c, f)
      const diff = Math.abs(computed - k) / k
      setMacroWarning(diff > 0.15 ? 'Las kcal no cuadran con los macros' : null)
    } else {
      setMacroWarning(null)
    }
    tapHaptic()
    const label = query.trim() || undefined
    dispatch({ t: 'addMeal', kcal: k, protein: parseFloat(pStr) || null, carbs: parseFloat(cStr) || null, fat: parseFloat(fStr) || null, label, fav: !!query.trim(), ts: whenTs })
    showToast(`✓ ${label ?? 'Comida'} — ${k} kcal`)
    setQuery(''); setKcalStr(''); setPStr(''); setCStr(''); setFStr(''); setShowMacros(false); setCreating(false); setMacroWarning(null); setKcalWarning(null)
  }

  // §84 — Repetir última: meal with highest ts
  const lastMeal = day.meals.length > 0 ? day.meals.reduce((a, b) => (a.ts > b.ts ? a : b)) : null

  // §89 — Copiar de ayer with undo
  const copyYesterday = () => {
    if (day.meals.length > 0) {
      setUndoPending(true)
      showToast('Comidas de ayer copiadas — Deshacer')
      if (_toastUndoId) clearTimeout(_toastUndoId)
      _toastUndoId = setTimeout(() => {
        dispatch({ t: 'copyYesterday' })
        setUndoPending(false)
      }, 3500)
    } else {
      tapHaptic()
      dispatch({ t: 'copyYesterday' })
    }
  }
  const undoCopy = () => {
    if (_toastUndoId) clearTimeout(_toastUndoId)
    setUndoPending(false)
    setToastMsg(null)
  }

  return (
    <div className="scroll has-nav">
      <motion.div variants={staggerParent} initial="initial" animate="animate" style={{ padding: '20px 20px 40px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <motion.h1 variants={staggerItem} className="h1" style={{ margin: 0 }}>Alimentación</motion.h1>

        {/* ── Strip de hidratación ── */}
        <motion.section variants={staggerItem} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px' }}>
          <IcDrop size={20} style={{ color: 'var(--brand-700)', flexShrink: 0 }} />
          <span className="sm mono" style={{ color: day.water >= waterGoal ? 'var(--success)' : 'var(--ink-700)', fontWeight: 700 }}>{day.water}/{waterGoal} vasos</span>
          <div
            role="progressbar"
            aria-valuenow={day.water}
            aria-valuemin={0}
            aria-valuemax={waterGoal}
            aria-label="Meta de hidratación"
            style={{ flex: 1, height: 6, background: 'var(--ink-100)', borderRadius: 999, overflow: 'hidden' }}
          >
            <div style={{ width: `${Math.min(100, (day.water / waterGoal) * 100)}%`, height: '100%', background: 'var(--brand-500)', borderRadius: 999, transition: 'width 0.25s ease, background 0.25s ease' }} />
          </div>
          <button className="iconbtn" aria-label="Quitar vaso" onClick={() => addWater(-1)} disabled={day.water === 0} style={{ width: 34, height: 34, opacity: day.water === 0 ? 0.4 : 1, cursor: day.water === 0 ? 'not-allowed' : 'pointer' }}>−</button>
          <button className="iconbtn" aria-label="Agregar vaso" onClick={() => addWater(1)} disabled={day.water >= waterGoal * 2} style={{ width: 34, height: 34, background: 'var(--brand-700)', color: '#fff', opacity: day.water >= waterGoal * 2 ? 0.4 : 1, cursor: day.water >= waterGoal * 2 ? 'not-allowed' : 'pointer' }}>+</button>
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
            <>
              <div
                role="progressbar"
                aria-valuenow={kcal}
                aria-valuemin={0}
                aria-valuemax={goalKcal}
                aria-label="Meta calórica del día"
                style={{ height: 7, background: 'var(--ink-100)', borderRadius: 999, overflow: 'hidden', margin: '10px 0' }}
              >
                <div style={{ width: `${Math.min(100, (kcal / goalKcal) * 100)}%`, height: '100%', background: kcal > goalKcal ? 'var(--warning)' : 'var(--brand-700)', borderRadius: 999, transition: 'width 0.3s ease, background 0.3s ease' }} />
              </div>
              {deficitLabel && (
                <span className="sm" style={{ color: deficitLabel.color, fontWeight: 600 }}>{deficitLabel.text}</span>
              )}
            </>
          )}
          {(macros.hasMacros || goalP) && (
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
              <span className="sm mono" style={{ color: 'var(--ink-900)', fontWeight: 700, background: 'var(--brand-100)', padding: '3px 10px', borderRadius: 999 }}>
                P: {macros.protein}{goalP ? ` / ${goalP}` : ''} g
              </span>
              {goalP != null && macros.protein < goalP && <span className="sm" style={{ color: 'var(--ink-400)' }}>faltan {goalP - macros.protein} g</span>}
              {macros.hasMacros && <span className="sm mono" style={{ color: 'var(--ink-400)', marginLeft: 'auto' }}>C: {macros.carbs} g · G: {macros.fat} g</span>}
            </div>
          )}
          {/* §82 — Chip sugerencia de proteína si no hay meta y hay peso */}
          {suggestedProtein != null && (
            <button
              className="chip"
              style={{ marginTop: 8, background: 'var(--brand-100)', color: 'var(--brand-700)', fontWeight: 600, border: '1px dashed var(--brand-300)', cursor: 'pointer' }}
              onClick={() => dispatch({ t: 'setMacroGoals', goals: { protein: suggestedProtein, carbs: (state.macroGoals?.carbs ?? 0), fat: (state.macroGoals?.fat ?? 0) } })}
            >
              Meta sugerida: {suggestedProtein} g proteína →
            </button>
          )}
        </motion.section>

        {/* ── Predicciones por franja + barra inteligente ── */}
        <motion.section variants={staggerItem} className="card">
          {/* Hora del registro (rueda con scroll → backfill; la franja se deriva sola) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: showWheel ? 8 : 8 }}>
            <span className="sm" style={{ color: 'var(--ink-400)' }}>Hora</span>
            <button className="chip mono" onClick={() => setShowWheel((v) => !v)} style={{ fontWeight: 700 }}>{horaLabel} ▾</button>
            {horaLabel !== 'Ahora' && <button className="chip" style={{ height: 30 }} onClick={() => { setHoraLabel('Ahora'); setShowWheel(false) }}>Ahora</button>}
            <span className="sm" aria-live="polite" style={{ color: 'var(--brand-700)', fontWeight: 600, marginLeft: 'auto', textAlign: 'right' }}>Para tu {whenSlot}</span>
          </div>
          {showWheel && <div style={{ marginBottom: 10 }}><TimeWheel initial={new Date(whenTs)} onChange={setHoraLabel} /></div>}
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
            <EmptyState
              glyph="apetito"
              title={`Tu ${whenSlot}`}
              subtitle={SLOT_PROMPT[whenSlot] ?? 'Registra tu comida abajo y la recordaré.'}
              cta={{ label: 'Registrar comida', onClick: () => { const el = document.querySelector<HTMLInputElement>('.field[placeholder*="Qué comiste"]'); el?.focus() } }}
            />
          )}

          {/* Crear platillo + Recetario — destacados */}
          <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
            <button className="btn btn-outline" style={{ flex: 1, height: 46, fontWeight: 700, gap: 6 }} onClick={() => dispatch({ t: 'sheet', sheet: 'crear-platillo', arg: horaLabel === 'Ahora' ? null : String(whenTs) })}>＋ Crear platillo</button>
            <button className="btn btn-brand" style={{ flex: 1, height: 46, fontWeight: 700, gap: 6 }} onClick={() => dispatch({ t: 'sheet', sheet: 'recetario', arg: horaLabel === 'Ahora' ? null : String(whenTs) })}>✦ Recetario</button>
          </div>
          {/* Acciones rápidas (chips pequeños) */}
          {(hasYesterday || lastMeal) && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
              {hasYesterday && <button className="chip" onClick={copyYesterday}>Copiar de ayer</button>}
              {lastMeal && <button className="chip" onClick={() => { tapHaptic(); dispatch({ t: 'addMeal', kcal: lastMeal.kcal, protein: lastMeal.protein, carbs: lastMeal.carbs, fat: lastMeal.fat, label: (lastMeal.label ?? undefined), ts: whenTs }); showToast(`✓ ${lastMeal.label ?? 'Última comida'} — ${lastMeal.kcal} kcal`) }}>Repetir última</button>}
            </div>
          )}

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
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <label className="sm" style={{ color: 'var(--ink-400)' }} htmlFor="kcal-input">Calorías</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <input id="kcal-input" className="field mono" type="number" inputMode="numeric" autoFocus placeholder="0" value={kcalStr} aria-label="Calorías (kcal)" onChange={(e) => { setKcalStr(e.target.value); setKcalWarning(null) }} onKeyDown={(e) => { if (e.key === 'Enter') createAndLog() }} style={{ flex: 1, fontSize: 24, fontWeight: 700, textAlign: 'center' }} />
                        <span className="sm" style={{ color: 'var(--ink-400)' }}>kcal</span>
                      </div>
                      {/* §81 macro-kcal mismatch warning */}
                      {macroWarning && <span className="sm" style={{ color: 'var(--warning)', marginTop: 2 }}>{macroWarning}</span>}
                      {/* §85 kcal guardrail */}
                      {kcalWarning && <span className="sm" style={{ color: 'var(--warning)', marginTop: 2 }}>{kcalWarning}</span>}
                    </div>
                    {showMacros ? (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <label className="sm" style={{ color: 'var(--ink-400)' }} htmlFor="p-input">Proteína (g)</label>
                          <input id="p-input" className="field" type="number" inputMode="numeric" placeholder="Proteína (g)" aria-label="Proteína (g)" value={pStr} onChange={(e) => setPStr(e.target.value)} style={{ flex: 1 }} />
                        </div>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <label className="sm" style={{ color: 'var(--ink-400)' }} htmlFor="c-input">Carbos (g)</label>
                          <input id="c-input" className="field" type="number" inputMode="numeric" placeholder="Carbos (g)" aria-label="Carbos (g)" value={cStr} onChange={(e) => setCStr(e.target.value)} style={{ flex: 1 }} />
                        </div>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <label className="sm" style={{ color: 'var(--ink-400)' }} htmlFor="g-input">Grasa (g)</label>
                          <input id="g-input" className="field" type="number" inputMode="numeric" placeholder="Grasa (g)" aria-label="Grasa (g)" value={fStr} onChange={(e) => setFStr(e.target.value)} style={{ flex: 1 }} />
                        </div>
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

        {/* ── Toast no-bloqueante ── */}
        {toastMsg && (
          <motion.div
            key={toastMsg}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={{ position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)', background: 'var(--ink-900)', color: '#fff', borderRadius: 12, padding: '10px 18px', zIndex: 999, display: 'flex', alignItems: 'center', gap: 12, maxWidth: 340, boxShadow: '0 4px 20px rgba(0,0,0,0.18)' }}
          >
            <span className="sm" style={{ fontWeight: 600 }}>{toastMsg}</span>
            {undoPending && (
              <button onClick={undoCopy} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.4)', borderRadius: 6, color: '#fff', fontWeight: 700, cursor: 'pointer', padding: '2px 8px', fontSize: 12 }}>Deshacer</button>
            )}
          </motion.div>
        )}

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
            ) : (() => {
              // §86 — Agrupar por mealSlot
              const slots = Object.keys(SLOT_PROMPT)
              const grouped: Record<string, typeof day.meals> = {}
              for (const m of day.meals) {
                const s = mealSlot(m.ts)
                if (!grouped[s]) grouped[s] = []
                grouped[s].push(m)
              }
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {slots.filter((s) => grouped[s]?.length).map((s) => (
                    <div key={s}>
                      <div className="agenda__day-label sm" style={{ color: 'var(--ink-400)', textTransform: 'capitalize', fontWeight: 700, padding: '4px 0 2px', letterSpacing: '0.01em' }}>{s}</div>
                      {grouped[s].map((m) => (
                        <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0' }}>
                          <span className="body mono" style={{ fontWeight: 600 }}>{m.kcal}</span>
                          <span className="sm" style={{ color: 'var(--ink-700)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {m.label || 'kcal'}
                            {m.protein ? ` · P: ${m.protein} g` : ''}
                            {m.carbs ? ` · C: ${m.carbs} g` : ''}
                            {m.fat ? ` · G: ${m.fat} g` : ''}
                          </span>
                          <span className="sm" style={{ color: 'var(--ink-400)', marginLeft: 'auto', flexShrink: 0 }}>{fmtTime(m.ts)}</span>
                          <button aria-label="Eliminar" onClick={() => { tapHaptic(); dispatch({ t: 'delMeal', id: m.id }) }} style={{ background: 'none', border: 0, color: 'var(--ink-300)', cursor: 'pointer', display: 'flex', flexShrink: 0 }}><IcClose size={16} /></button>
                        </div>
                      ))}
                    </div>
                  ))}
                  {/* §83 — Footer totales del día cuando hay macros */}
                  {dayTotals && (
                    <div className="sm mono" style={{ color: 'var(--ink-400)', borderTop: '1px solid var(--border)', paddingTop: 8, marginTop: 4, fontWeight: 600 }}>{dayTotals}</div>
                  )}
                </div>
              )
            })()}
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
  const [unusualToast, setUnusualToast] = useState(false)
  const goal = state.kcalGoal
  if (edit) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
        <input
          className="field" type="number" inputMode="numeric" autoFocus placeholder="kcal/día"
          defaultValue={goal ?? ''} min={500} max={9999}
          aria-label="Meta calórica diaria"
          onBlur={(e) => {
            const v = parseFloat(e.target.value) || null
            if (v != null && (v < 500 || v > 9999)) setUnusualToast(true)
            dispatch({ t: 'setKcalGoal', value: v }); setEdit(false)
          }}
          style={{ width: 110 }}
        />
        {unusualToast && <span className="sm" style={{ color: 'var(--warning)' }}>Meta inusual</span>}
      </div>
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
                <div
                  role="progressbar"
                  aria-valuenow={cur}
                  aria-valuemin={0}
                  aria-valuemax={goal}
                  aria-label={`Meta de ${lbl}`}
                  style={{ height: 7, background: 'var(--ink-100)', borderRadius: 999, overflow: 'hidden' }}
                >
                  <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 999, transition: 'width 0.28s ease, background 0.28s ease' }} />
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
          {pn.weightPoints.length >= 2 ? (() => {
            const wp = pn.weightPoints
            const net = wp[wp.length - 1] - wp[0]
            const goal = state.profile.metaPesoKg
            const towardGoal = goal != null ? (goal < wp[0] ? net <= 0 : net >= 0) : net <= 0
            return (
              <div style={{ marginTop: 4 }}>
                <TrendChart data={wp} w={280} h={52} trendColor={towardGoal ? 'var(--success)' : 'var(--warning)'} labels={[`${wp[0]} kg`, `${wp[wp.length - 1]} kg`]} />
                <div className="sm" style={{ color: 'var(--ink-400)', marginTop: 2 }}>Peso · línea de tendencia</div>
              </div>
            )
          })() : pn.kcalPoints.length >= 2 ? (
            <div style={{ marginTop: 4 }}>
              <Sparkline data={pn.kcalPoints.map((x) => x.kcal)} color="var(--brand-500)" w={280} h={32} />
              <div className="sm" style={{ color: 'var(--ink-400)', marginTop: 2 }}>kcal/día</div>
            </div>
          ) : null}
        </div>
      </PremiumGate>
    </motion.section>
  )
}
