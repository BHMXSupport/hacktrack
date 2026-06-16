// Alimentación — tracker de hidratación (vasos) y calorías (kcal) del día. Datos en state.nutrition.
import { useState } from 'react'
import { motion } from 'framer-motion'
import { useApp, isoKey } from '../lib/store'
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
  const [kcalStr, setKcalStr] = useState('')

  const water = (delta: number) => { tapHaptic(); dispatch({ t: 'water', delta }) }
  const addMeal = (n: number) => { if (n > 0) { tapHaptic(); dispatch({ t: 'addMeal', kcal: n }) } }
  const addCustom = () => {
    const n = parseFloat(kcalStr)
    if (n > 0) { addMeal(n); setKcalStr('') }
  }

  return (
    <div className="scroll has-nav">
      <motion.div variants={staggerParent} initial="initial" animate="animate" style={{ padding: '24px 20px 40px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <motion.h1 variants={staggerItem} className="h1" style={{ margin: 0 }}>Alimentación</motion.h1>

        {/* ── Hidratación ── */}
        <motion.section variants={staggerItem} className="card">
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
            <span className="body" style={{ fontWeight: 600, color: 'var(--ink-900)' }}>Hidratación</span>
            <span className="sm mono" style={{ color: day.water >= WATER_GOAL ? 'var(--success)' : 'var(--ink-400)' }}>
              {day.water} / {WATER_GOAL} vasos
            </span>
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

        {/* ── Calorías ── */}
        <motion.section variants={staggerItem} className="card">
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
            <span className="body" style={{ fontWeight: 600, color: 'var(--ink-900)' }}>Calorías de hoy</span>
          </div>
          <div className="mono" style={{ fontSize: 40, fontWeight: 800, color: 'var(--brand-700)', lineHeight: 1.1, marginBottom: 14 }}>
            {kcal} <span className="sm" style={{ color: 'var(--ink-400)', fontWeight: 600 }}>kcal</span>
          </div>

          {/* quick add */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
            {KCAL_QUICK.map((n) => (
              <button key={n} className="chip" onClick={() => addMeal(n)}>+{n}</button>
            ))}
          </div>

          {/* custom */}
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className="field" type="number" inputMode="numeric" min="0" placeholder="kcal personalizadas"
              value={kcalStr} onChange={(e) => setKcalStr(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addCustom() }}
              style={{ flex: 1 }}
            />
            <button className="btn btn-brand" style={{ width: 'auto', padding: '0 18px' }} disabled={!(parseFloat(kcalStr) > 0)} onClick={addCustom}>
              Agregar
            </button>
          </div>

          {/* lista de comidas de hoy */}
          {day.meals.length > 0 && (
            <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {day.meals.map((m) => (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: '1px solid var(--border)' }}>
                  <span className="body mono" style={{ fontWeight: 600 }}>{m.kcal} kcal</span>
                  <span className="sm" style={{ color: 'var(--ink-400)' }}>{fmtTime(m.ts)}</span>
                  <button
                    aria-label="Eliminar comida"
                    onClick={() => { tapHaptic(); dispatch({ t: 'delMeal', id: m.id }) }}
                    style={{ marginLeft: 'auto', background: 'none', border: 0, color: 'var(--ink-300)', cursor: 'pointer', display: 'flex' }}
                  >
                    <IcClose size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </motion.section>

        <motion.p variants={staggerItem} className="sm" style={{ color: 'var(--ink-300)', lineHeight: 1.4, borderLeft: '2px solid var(--border)', paddingLeft: 10 }}>
          Registro personal de hidratación y calorías. No es consejo nutricional ni médico.
        </motion.p>
      </motion.div>
    </div>
  )
}
