// ResumenSemanal — recap de los últimos 7 días: adherencia, dosis, medidas, hidratación y calorías.
// Honesto sobre los datos propios; "adherencia ≠ eficacia".
import { motion } from 'framer-motion'
import { useApp, adherence, isoKey } from '../lib/store'
import { staggerParent, staggerItem } from '../lib/motion'

function StatCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <motion.div variants={staggerItem} className="card" style={{ padding: '16px 18px' }}>
      <div className="sm" style={{ color: 'var(--ink-400)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>{label}</div>
      <div className="mono" style={{ fontSize: 28, fontWeight: 800, color: accent ?? 'var(--ink-900)', lineHeight: 1 }}>{value}</div>
      {sub && <div className="sm" style={{ color: 'var(--ink-400)', marginTop: 4 }}>{sub}</div>}
    </motion.div>
  )
}

export function ResumenSemanal() {
  const { state } = useApp()
  const cutoff = state.todayTs - 7 * 86_400_000

  let doses = 0, measures = 0
  for (const g of state.log) for (const it of g.items) {
    if (it.ts < cutoff) continue
    if (it.type === 'dose') doses++
    else if (it.type === 'medida') measures++
  }

  const adh = adherence(state, 7)

  // hidratación + calorías de los últimos 7 días
  let water = 0, kcal = 0
  for (let i = 0; i < 7; i++) {
    const d = state.nutrition[isoKey(state.todayTs - i * 86_400_000)]
    if (!d) continue
    water += d.water
    kcal += d.meals.reduce((s, m) => s + m.kcal, 0)
  }

  return (
    <div className="scroll has-nav">
      <motion.div variants={staggerParent} initial="initial" animate="animate" style={{ padding: '24px 20px 40px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <motion.div variants={staggerItem}>
          <h1 className="h1" style={{ margin: 0 }}>Tu semana</h1>
          <p className="sm" style={{ color: 'var(--ink-400)', marginTop: 4 }}>Últimos 7 días</p>
        </motion.div>

        <StatCard label="Adherencia" value={adh ? `${adh.pct}%` : '—'} sub={adh ? `${adh.taken} de ${adh.due} dosis cumplidas` : 'Sin protocolo activo'} accent="var(--brand-700)" />

        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1 }}><StatCard label="Dosis" value={String(doses)} sub="registradas" /></div>
          <div style={{ flex: 1 }}><StatCard label="Medidas" value={String(measures)} sub="registradas" /></div>
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1 }}><StatCard label="Hidratación" value={String(water)} sub={`vasos · ~${Math.round(water / 7)}/día`} /></div>
          <div style={{ flex: 1 }}><StatCard label="Calorías" value={kcal >= 1000 ? `${(kcal / 1000).toFixed(1)}k` : String(kcal)} sub={`kcal · ~${Math.round(kcal / 7)}/día`} /></div>
        </div>

        <motion.p variants={staggerItem} className="sm" style={{ color: 'var(--ink-300)', lineHeight: 1.4, borderLeft: '2px solid var(--border)', paddingLeft: 10, marginTop: 4 }}>
          Resumen de tu registro personal. La adherencia mide tu consistencia, no la eficacia ni un resultado clínico.
        </motion.p>
      </motion.div>
    </div>
  )
}
