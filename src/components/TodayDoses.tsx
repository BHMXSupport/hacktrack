// "Tus dosis de hoy" — checklist 1-tap: cada producto programado hoy con su dosis + botón "hecho".
// Sin escribir: la dosis viene de la fase activa o de la última registrada (doseForProduct).
import { motion } from 'framer-motion'
import { useApp, doseForProduct } from '../lib/store'
import { dayProducts, doseTakenOnProduct, loggedItemsForDay } from '../lib/calendar'
import { startOfDay } from '../lib/cadence'
import { doseToMg } from '../lib/calc'
import { PEPTIDES, CATEGORY_COLOR } from '../lib/catalog'
import { IcCheck } from './icons'
import { staggerParent, staggerItem } from '../lib/motion'

export function TodayDoses() {
  const { state, dispatch } = useApp()
  const today = startOfDay(new Date(state.todayTs))
  const prods = dayProducts(state, today)
  if (prods.length === 0) return null

  // ts de la toma a la hora reminderTime DE ESE producto (cada uno puede tener la suya)
  function tsFor(product: string): number {
    const rt = state.protocols[product]?.reminderTime || state.protocol?.reminderTime || '08:00'
    const [hh, mm] = rt.split(':').map(Number)
    const at = new Date(today)
    at.setHours(hh || 0, mm || 0, 0, 0)
    return at.getTime()
  }

  function markDone(product: string) {
    const dose = doseForProduct(state, product)
    if (dose) {
      // mg canónicos: directo si mg/mcg, o con la reconstitución recordada si la dosis es en UI/mL
      const rec = state.productRecon[product]
      const doseMg = doseToMg(dose.value, dose.unit, rec?.vialMg, rec?.aguaMl) ?? undefined
      dispatch({ t: 'logDose', product, value: dose.value, unit: dose.unit, ts: tsFor(product), doseMg })
    } else dispatch({ t: 'sheet', sheet: 'registrar', arg: product }) // sin dosis aún → abre en ESE producto
  }
  function undo(product: string) {
    const item = loggedItemsForDay(state, today).find((it) => it.type === 'dose' && it.product === product)
    if (item) dispatch({ t: 'deleteLog', id: item.id })
  }

  const doneCount = prods.filter((p) => doseTakenOnProduct(state, today, p)).length

  return (
    <motion.section
      variants={staggerParent}
      initial="initial"
      animate="animate"
      className="card"
      style={{ padding: 0, overflow: 'hidden' }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '14px 16px 8px' }}>
        <span className="sm" style={{ textTransform: 'uppercase', letterSpacing: 0.6, color: 'var(--ink-400)' }}>Tus dosis de hoy</span>
        <span className="sm mono" style={{ color: doneCount === prods.length ? 'var(--success)' : 'var(--ink-400)' }}>
          {doneCount}/{prods.length}
        </span>
      </div>

      {prods.map((product) => {
        const taken = doseTakenOnProduct(state, today, product)
        const dose = doseForProduct(state, product)
        const color = CATEGORY_COLOR[PEPTIDES[product]?.cat ?? 'Explorar'] ?? 'var(--brand-700)'
        return (
          <motion.div
            key={product}
            variants={staggerItem}
            style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderTop: '1px solid var(--border)' }}
          >
            <span style={{ width: 10, height: 10, borderRadius: 999, background: color, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="body" style={{ fontWeight: 600, color: 'var(--ink-900)' }}>{product}</div>
              <div className="sm mono" style={{ color: 'var(--ink-400)' }}>
                {dose ? `${dose.value} ${dose.unit}` : 'Establece tu dosis'}
              </div>
            </div>
            <button
              onClick={() => (taken ? undo(product) : markDone(product))}
              aria-label={taken ? `Deshacer ${product}` : `Marcar ${product} como hecho`}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, height: 34, padding: '0 14px', borderRadius: 999,
                cursor: 'pointer', flexShrink: 0, fontWeight: 600, fontSize: 13,
                border: taken ? 'none' : '1.5px solid var(--border)',
                background: taken ? 'var(--success)' : 'transparent',
                color: taken ? 'var(--ink-0)' : 'var(--ink-400)',
              }}
            >
              {taken && <IcCheck size={15} />}
              {taken ? 'Hecho' : 'Marcar'}
            </button>
          </motion.div>
        )
      })}
    </motion.section>
  )
}
