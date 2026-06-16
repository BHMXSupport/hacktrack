// "Tus dosis de hoy" — checklist 1-tap: cada producto programado hoy con su dosis + botón "hecho".
// Sin escribir: la dosis viene de la fase activa o de la última registrada (doseForProduct).
import { motion, AnimatePresence } from 'framer-motion'
import { useApp, doseForProduct } from '../lib/store'
import { dayProducts, doseTakenOnProduct, loggedItemsForDay, upcomingDoses } from '../lib/calendar'
import { startOfDay, fmtTime } from '../lib/cadence'
import { doseToMg } from '../lib/calc'
import { tapHaptic } from '../lib/haptics'
import { PEPTIDES, CATEGORY_COLOR } from '../lib/catalog'
import { IcCheck } from './icons'
import { staggerParent, staggerItem, spring } from '../lib/motion'

export function TodayDoses() {
  const { state, dispatch } = useApp()
  const today = startOfDay(new Date(state.todayTs))
  const prods = dayProducts(state, today)
  // item 36: estado vacío diferenciado
  if (prods.length === 0) {
    const hasProtocols = Object.keys(state.protocols).length > 0
    if (!hasProtocols) return null
    // hay protocolos activos pero hoy no toca ninguna dosis
    const next = upcomingDoses(state, new Date(), 1)[0]
    return (
      <div className="card" style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, textAlign: 'center' }}>
        <span style={{ fontSize: 28 }}>💤</span>
        <span className="body" style={{ fontWeight: 600, color: 'var(--ink-900)' }}>Hoy no toca ninguna dosis</span>
        {next && (
          <span className="sm" style={{ color: 'var(--ink-400)' }}>
            Próxima: <strong>{next.product}</strong> el {next.date.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' })}
          </span>
        )}
      </div>
    )
  }

  // ts de la toma a la hora reminderTime DE ESE producto (cada uno puede tener la suya)
  function tsFor(product: string): number {
    const rt = state.protocols[product]?.reminderTime || state.protocol?.reminderTime || '08:00'
    const [hh, mm] = rt.split(':').map(Number)
    const at = new Date(today)
    at.setHours(hh || 0, mm || 0, 0, 0)
    return at.getTime()
  }

  function markDone(product: string) {
    tapHaptic()
    const dose = doseForProduct(state, product)
    if (!dose) { dispatch({ t: 'sheet', sheet: 'registrar', arg: product }); return } // sin dosis aún → abre en ESE producto
    // mg canónicos: directo si mg/mcg, o con la reconstitución recordada si la dosis es en UI/mL
    const rec = state.productRecon[product]
    const doseMg = doseToMg(dose.value, dose.unit, rec?.vialMg, rec?.aguaMl) ?? undefined
    const scheduledTs = tsFor(product)
    const nowTs = Date.now()
    // si la hora actual difiere ≥1h de la programada, pregunta a qué hora se aplicó; si no, registra a la hora programada
    if (Math.abs(nowTs - scheduledTs) >= 60 * 60 * 1000) {
      dispatch({ t: 'sheet', sheet: 'dose-confirm', arg: JSON.stringify({ product, value: dose.value, unit: dose.unit, doseMg, scheduledTs, nowTs }) })
    } else {
      dispatch({ t: 'logDose', product, value: dose.value, unit: dose.unit, ts: scheduledTs, doseMg })
    }
  }
  function undo(product: string) {
    tapHaptic()
    const item = loggedItemsForDay(state, today).find((it) => it.type === 'dose' && it.product === product)
    if (item) dispatch({ t: 'deleteLog', id: item.id })
  }

  const doneCount = prods.filter((p) => doseTakenOnProduct(state, today, p)).length
  const allDone = doneCount === prods.length

  // color de la primera categoría activa para la barra de progreso
  const firstCat = PEPTIDES[prods[0]]?.cat ?? 'Explorar'
  const progressColor = allDone ? 'var(--success)' : (CATEGORY_COLOR[firstCat] ?? 'var(--brand-700)')

  return (
    <motion.section
      variants={staggerParent}
      initial="initial"
      animate="animate"
      className="card"
      style={{ padding: 0, overflow: 'hidden' }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '14px 16px 8px' }}>
        <span className="sm" style={{ textTransform: 'uppercase', letterSpacing: 0.6, color: 'var(--ink-400)', fontWeight: 700 }}>Tus dosis de hoy</span>
        <span className="sm mono" style={{ color: allDone ? 'var(--success)' : 'var(--ink-400)' }}>
          {doneCount}/{prods.length}
        </span>
      </div>

      {/* Barra de progreso — item 33 */}
      <div
        role="progressbar"
        aria-valuenow={doneCount}
        aria-valuemax={prods.length}
        style={{ height: 3, background: 'var(--border)', margin: '0 0 2px' }}
      >
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${(doneCount / prods.length) * 100}%` }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          style={{ height: '100%', background: progressColor, borderRadius: 999 }}
        />
      </div>

      {prods.map((product) => {
        const taken = doseTakenOnProduct(state, today, product)
        const dose = doseForProduct(state, product)
        const cat = PEPTIDES[product]?.cat ?? 'Explorar'
        const color = CATEGORY_COLOR[cat] ?? 'var(--brand-700)'

        // item 32: hora de recordatorio
        const hasReminder = !!(state.protocols[product]?.reminderTime || state.protocol?.reminderTime)
        const reminderLabel = hasReminder ? fmtTime(new Date(tsFor(product))) : null

        return (
          <motion.div
            key={product}
            variants={staggerItem}
            style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
              borderTop: '1px solid var(--border)',
              // item 34: atenuar fila completa si tomada
              opacity: taken ? 0.65 : 1,
              transition: 'opacity 0.25s ease',
            }}
          >
            {/* item 31: pill de categoría */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, flexShrink: 0 }}>
              <span style={{ width: 6, height: 6, borderRadius: 999, background: color }} />
              <span style={{ fontSize: 9, color: 'var(--ink-400)', lineHeight: 1, textAlign: 'center', maxWidth: 36, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cat}</span>
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              {/* item 34: line-through cuando taken */}
              <div className="body" style={{ fontWeight: 600, color: 'var(--ink-900)', textDecoration: taken ? 'line-through' : 'none' }}>{product}</div>
              <div className="sm mono" style={{ color: 'var(--ink-400)' }}>
                {dose ? `${dose.value} ${dose.unit}` : 'Establece tu dosis'}
                {/* item 32: hora del recordatorio */}
                {reminderLabel && (
                  <span style={{ marginLeft: 4 }}>· {reminderLabel}</span>
                )}
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
              {/* item 34: check entra con scale 0.6→1 (spring.ui) */}
              <AnimatePresence>
                {taken && (
                  <motion.span
                    initial={{ scale: 0.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.6, opacity: 0 }}
                    transition={spring.ui}
                    style={{ display: 'flex', alignItems: 'center' }}
                  >
                    <IcCheck size={15} />
                  </motion.span>
                )}
              </AnimatePresence>
              {taken ? 'Hecho' : 'Marcar'}
            </button>
          </motion.div>
        )
      })}
    </motion.section>
  )
}
