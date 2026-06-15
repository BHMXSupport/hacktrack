// Hacktrack — Vista Agenda (#4): próximas tomas agrupadas por día, cronológica.
import { motion } from 'framer-motion'
import { upcomingDoses } from '../lib/calendar'
import { fmtDate, fmtTime } from '../lib/cadence'
import { PEPTIDES, CATEGORY_COLOR } from '../lib/catalog'
import { useApp, isoKey } from '../lib/store'
import { staggerParent, staggerItem } from '../lib/motion'

export function CalendarAgenda() {
  const { state, dispatch } = useApp()
  const now = new Date()
  const items = upcomingDoses(state, now, 30)

  // Agrupar por día (isoKey del día, no de la hora)
  const groups: { label: string; dayKey: string; entries: typeof items }[] = []
  for (const item of items) {
    const label = fmtDate(item.date, now)
    const last = groups[groups.length - 1]
    if (last && last.label === label) {
      last.entries.push(item)
    } else {
      groups.push({ label, dayKey: isoKey(item.date.getTime()), entries: [item] })
    }
  }

  if (groups.length === 0) {
    return (
      <div className="agenda-empty">
        <p className="agenda-empty__text">No tienes próximas tomas programadas</p>
      </div>
    )
  }

  return (
    <motion.div
      className="agenda"
      variants={staggerParent}
      initial="initial"
      animate="animate"
    >
      {groups.map((group) => (
        <motion.section key={group.dayKey} className="agenda__group" variants={staggerItem}>
          <h3 className="agenda__day-label">{group.label}</h3>
          <ul className="agenda__list">
            {group.entries.map((item, i) => {
              const cat = PEPTIDES[item.product]?.cat
              const color = cat ? CATEGORY_COLOR[cat] : 'var(--ink-400)'
              return (
                <motion.li
                  key={`${item.product}-${item.date.getTime()}-${i}`}
                  className="agenda__row"
                  variants={staggerItem}
                  role="button"
                  tabIndex={0}
                  onClick={() =>
                    dispatch({ t: 'sheet', sheet: 'day-detail', arg: isoKey(item.date.getTime()) })
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      dispatch({ t: 'sheet', sheet: 'day-detail', arg: isoKey(item.date.getTime()) })
                    }
                  }}
                >
                  <span className="agenda__time mono">{fmtTime(item.date)}</span>
                  <span
                    className="agenda__dot"
                    style={{ background: color }}
                    aria-hidden="true"
                  />
                  <span className="agenda__product">{item.product}</span>
                </motion.li>
              )
            })}
          </ul>
        </motion.section>
      ))}
    </motion.div>
  )
}
