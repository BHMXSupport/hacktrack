// Alimentación — hidratación (vasos) + calorías y macros (kcal/P/C/G) del día, con favoritos 1-tap.
import { useState } from 'react'
import { motion } from 'framer-motion'
import { useApp, isoKey } from '../lib/store'
import { dayMacros } from '../lib/nutrition'
import { IcDrop, IcClose } from '../components/icons'
import { tapHaptic } from '../lib/haptics'
import { staggerParent, staggerItem } from '../lib/motion'

const WATER_GOAL = 8
const KCAL_QUICK = [100, 250, 500, 700]

function fmtTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' })
}

export function Alimentacion() {
  const { state, dispatch } = useApp()
  const key = isoKey(state.todayTs)
  const day = state.nutrition[key] ?? { water: 0, meals: [] }
  const kcal = day.meals.reduce((sum, m) => sum + m.kcal, 0)
  const macros = dayMacros(day.meals)

  const [open, setOpen] = useState(false)
  const [kcalStr, setKcalStr] = useState('')
  const [pStr, setPStr] = useState('')
  const [cStr, setCStr] = useState('')
  const [fStr, setFStr] = useState('')
  const [label, setLabel] = useState('')
  const [fav, setFav] = useState(false)

  const water = (delta: number) => { tapHaptic(); dispatch({ t: 'water', delta }) }
  const quickKcal = (n: number) => { tapHaptic(); dispatch({ t: 'addMeal', kcal: n }) }
  const top5 = [...state.foodLibrary].sort((a, b) => b.usoCount - a.usoCount).slice(0, 5)

  const submitMeal = () => {
    const k = parseFloat(kcalStr)
    if (!(k > 0)) return
    tapHaptic()
    dispatch({
      t: 'addMeal', kcal: k,
      protein: parseFloat(pStr) || null, carbs: parseFloat(cStr) || null, fat: parseFloat(fStr) || null,
      label: label.trim() || undefined, fav: fav && !!label.trim(),
    })
    setKcalStr(''); setPStr(''); setCStr(''); setFStr(''); setLabel(''); setFav(false); setOpen(false)
  }

  return (
    <div className="scroll has-nav">
      <motion.div variants={staggerParent} initial="initial" animate="animate" style={{ padding: '24px 20px 40px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <motion.h1 variants={staggerItem} className="h1" style={{ margin: 0 }}>Alimentación</motion.h1>

        {/* ── Hidratación ── */}
        <motion.section variants={staggerItem} className="card">
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
            <span className="body" style={{ fontWeight: 600, color: 'var(--ink-900)' }}>Hidratación</span>
            <span className="sm mono" style={{ color: day.water >= WATER_GOAL ? 'var(--success)' : 'var(--ink-400)' }}>{day.water} / {WATER_GOAL} vasos</span>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
            {Array.from({ length: Math.max(WATER_GOAL, day.water) }, (_, i) => (
              <IcDrop key={i} size={22} style={{ color: i < day.water ? 'var(--brand-700)' : 'var(--ink-100)' }} />
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => water(-1)} disabled={day.water === 0}>− vaso</button>
            <button className="btn btn-brand" style={{ flex: 1 }} onClick={() => water(1)}>+ vaso</button>
          </div>
        </motion.section>

        {/* ── Calorías + macros ── */}
        <motion.section variants={staggerItem} className="card">
          <span className="body" style={{ fontWeight: 600, color: 'var(--ink-900)' }}>Calorías de hoy</span>
          <div className="mono" style={{ fontSize: 40, fontWeight: 800, color: 'var(--brand-700)', lineHeight: 1.1, margin: '4px 0 4px' }}>
            {kcal} <span className="sm" style={{ color: 'var(--ink-400)', fontWeight: 600 }}>kcal</span>
          </div>
          {macros.hasMacros && (
            <div style={{ display: 'flex', gap: 14, marginBottom: 12 }}>
              <span className="sm mono" style={{ color: 'var(--ink-700)' }}>P {macros.protein}g</span>
              <span className="sm mono" style={{ color: 'var(--ink-700)' }}>C {macros.carbs}g</span>
              <span className="sm mono" style={{ color: 'var(--ink-700)' }}>G {macros.fat}g</span>
            </div>
          )}

          {/* Favoritos 1-tap */}
          {top5.length > 0 && (
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', marginBottom: 12, paddingBottom: 2 }}>
              {top5.map((f) => (
                <button key={f.id} className="chip" style={{ flexShrink: 0 }} onClick={() => { tapHaptic(); dispatch({ t: 'addFavMeal', id: f.id }) }}>
                  {f.label} · {f.kcal}
                </button>
              ))}
            </div>
          )}

          {/* Quick add */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
            {KCAL_QUICK.map((n) => (<button key={n} className="chip" onClick={() => quickKcal(n)}>+{n}</button>))}
            <button className="chip" onClick={() => setOpen((v) => !v)}>{open ? 'Cerrar' : '+ comida…'}</button>
          </div>

          {/* Formulario detallado */}
          {open && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
              <input className="field" placeholder="Nombre (opcional, p. ej. Pollo + arroz)" value={label} onChange={(e) => setLabel(e.target.value)} />
              <div style={{ display: 'flex', gap: 8 }}>
                <input className="field" type="number" inputMode="numeric" placeholder="kcal" value={kcalStr} onChange={(e) => setKcalStr(e.target.value)} style={{ flex: 1.4 }} />
                <input className="field" type="number" inputMode="numeric" placeholder="P (g)" value={pStr} onChange={(e) => setPStr(e.target.value)} style={{ flex: 1 }} />
                <input className="field" type="number" inputMode="numeric" placeholder="C (g)" value={cStr} onChange={(e) => setCStr(e.target.value)} style={{ flex: 1 }} />
                <input className="field" type="number" inputMode="numeric" placeholder="G (g)" value={fStr} onChange={(e) => setFStr(e.target.value)} style={{ flex: 1 }} />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={fav} onChange={(e) => setFav(e.target.checked)} disabled={!label.trim()} />
                <span className="sm" style={{ color: label.trim() ? 'var(--ink-700)' : 'var(--ink-300)' }}>Guardar como favorito (1-tap)</span>
              </label>
              <button className="btn btn-brand" disabled={!(parseFloat(kcalStr) > 0)} onClick={submitMeal}>Agregar comida</button>
            </div>
          )}

          {/* Lista de comidas */}
          {day.meals.length > 0 && (
            <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {day.meals.map((m) => (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: '1px solid var(--border)' }}>
                  <span className="body mono" style={{ fontWeight: 600 }}>{m.kcal}</span>
                  <span className="sm" style={{ color: 'var(--ink-700)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {m.label || 'kcal'}{m.protein ? ` · P${m.protein}` : ''}
                  </span>
                  <span className="sm" style={{ color: 'var(--ink-400)', marginLeft: 'auto', flexShrink: 0 }}>{fmtTime(m.ts)}</span>
                  <button aria-label="Eliminar" onClick={() => { tapHaptic(); dispatch({ t: 'delMeal', id: m.id }) }} style={{ background: 'none', border: 0, color: 'var(--ink-300)', cursor: 'pointer', display: 'flex', flexShrink: 0 }}>
                    <IcClose size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </motion.section>

        <motion.p variants={staggerItem} className="sm" style={{ color: 'var(--ink-300)', lineHeight: 1.4, borderLeft: '2px solid var(--border)', paddingLeft: 10 }}>
          Registro personal de hidratación y nutrición. No es consejo nutricional ni médico.
        </motion.p>
      </motion.div>
    </div>
  )
}
