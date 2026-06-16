// Hacktrack — Vista Agenda (#4): próximas tomas agrupadas por día, cronológica.
// Loop 172: segmented "Por día / Por producto" con sessionStorage
// Loop 174: auto-scroll a hoy + slide-in escalonado + AnimatePresence modo sharedAxisX
import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { upcomingDoses } from '../lib/calendar'
import { fmtDate, fmtTime } from '../lib/cadence'
import { PEPTIDES, CATEGORY_COLOR } from '../lib/catalog'
import { useApp, isoKey } from '../lib/store'
import { sharedAxisX, dur, ease } from '../lib/motion'

// ── Persistencia del toggle (sessionStorage) ──────────────────────────────────
type AgendaMode = 'day' | 'product'

function readMode(): AgendaMode {
  try {
    return (sessionStorage.getItem('agenda-mode') as AgendaMode) ?? 'day'
  } catch {
    return 'day'
  }
}

function saveMode(m: AgendaMode) {
  try { sessionStorage.setItem('agenda-mode', m) } catch { /* noop */ }
}

// ── Hook para el modo de agenda con estado local ──────────────────────────────
function useAgendaMode(): [AgendaMode, (m: AgendaMode) => void] {
  const [mode, setModeState] = useState<AgendaMode>(readMode)
  const setMode = (m: AgendaMode) => { saveMode(m); setModeState(m) }
  return [mode, setMode]
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function productColor(product: string): string {
  const cat = PEPTIDES[product]?.cat
  return cat ? (CATEGORY_COLOR[cat] ?? 'var(--ink-400)') : 'var(--ink-400)'
}

// variante slide-in escalonado para filas (Loop 174)
const rowVariants = {
  initial: { opacity: 0, x: 16 },
  animate: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: { duration: dur.base, ease: ease.decelerate, delay: i * 0.025 },
  }),
}

// ── Subcomponente: vista Por Día ──────────────────────────────────────────────
function AgendaByDay({
  groups,
  todayKey,
  dispatch,
}: {
  groups: { label: string; dayKey: string; entries: { date: Date; product: string }[] }[]
  todayKey: string
  dispatch: (a: import('../lib/store').Action) => void
}) {
  // Loop 174: ref al grupo de hoy para auto-scroll
  const todayRef = useRef<HTMLElement | null>(null)
  useEffect(() => {
    todayRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  let rowIdx = 0
  return (
    <motion.div
      key="by-day"
      initial="initial"
      animate="animate"
      className="agenda"
    >
      {groups.map((group) => {
        const isToday = group.dayKey === todayKey
        return (
          <motion.section
            key={group.dayKey}
            className="agenda__group"
            ref={isToday ? (el) => { todayRef.current = el } : undefined}
          >
            <h3 className="agenda__day-label">{group.label}</h3>
            <ul className="agenda__list">
              {group.entries.map((item, i) => {
                const color = productColor(item.product)
                const idx = rowIdx++
                return (
                  <motion.li
                    key={`${item.product}-${item.date.getTime()}-${i}`}
                    className="agenda__row"
                    custom={idx}
                    variants={rowVariants}
                    initial="initial"
                    animate="animate"
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
                    <span className="agenda__dot" style={{ background: color }} aria-hidden="true" />
                    <span className="agenda__product">{item.product}</span>
                  </motion.li>
                )
              })}
            </ul>
          </motion.section>
        )
      })}
    </motion.div>
  )
}

// ── Subcomponente: vista Por Producto (Loop 172) ──────────────────────────────
function AgendaByProduct({
  items,
}: {
  items: { date: Date; product: string }[]
}) {
  // Agrupar por producto, preservar orden de primera aparición
  const order: string[] = []
  const byProduct: Record<string, { date: Date; product: string }[]> = {}
  for (const item of items) {
    if (!byProduct[item.product]) {
      order.push(item.product)
      byProduct[item.product] = []
    }
    byProduct[item.product].push(item)
  }

  let rowIdx = 0
  return (
    <motion.div
      key="by-product"
      className="agenda"
      initial="initial"
      animate="animate"
    >
      {order.map((product) => {
        const entries = byProduct[product]
        const color = productColor(product)
        const cat = PEPTIDES[product]?.cat
        const total = entries.length
        return (
          <motion.section
            key={product}
            className="agenda__group"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: [0, 0, 0, 1] as [number,number,number,number] }}
          >
            {/* Cabecera del producto */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 0 4px',
                borderBottom: `2px solid ${color}`,
                marginBottom: 4,
              }}
            >
              <span
                style={{ width: 10, height: 10, borderRadius: 999, background: color, flexShrink: 0 }}
                aria-hidden="true"
              />
              <span className="sm" style={{ fontWeight: 700, color: 'var(--ink-700)', flex: 1 }}>
                {product}
              </span>
              {cat && (
                <span className="sm" style={{ color: 'var(--ink-400)', fontWeight: 400 }}>{cat}</span>
              )}
              <span
                className="sm mono"
                style={{ color: 'var(--ink-400)', fontWeight: 600 }}
                aria-label={`${total} dosis en el periodo`}
              >
                {total} dosis
              </span>
            </div>
            <ul className="agenda__list">
              {entries.map((item, i) => {
                const idx = rowIdx++
                return (
                  <motion.li
                    key={`${item.product}-${item.date.getTime()}-${i}`}
                    className="agenda__row"
                    custom={idx}
                    variants={rowVariants}
                    initial="initial"
                    animate="animate"
                  >
                    <span className="agenda__time mono">{fmtTime(item.date)}</span>
                    <span className="agenda__dot" style={{ background: color }} aria-hidden="true" />
                    <span className="agenda__product">
                      {item.date.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' })}
                    </span>
                  </motion.li>
                )
              })}
            </ul>
          </motion.section>
        )
      })}
    </motion.div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────
export function CalendarAgenda() {
  const { state, dispatch } = useApp()
  const [mode, setMode] = useAgendaMode()
  const now = new Date()
  const todayKey = isoKey(now.getTime())
  const items = upcomingDoses(state, now, 30)

  // Agrupar por día para la vista "Por día"
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

  if (items.length === 0) {
    return (
      <div className="agenda-empty">
        <p className="agenda-empty__text">No tienes próximas tomas programadas</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Loop 172: Segmented toggle Por día / Por producto */}
      <div
        role="group"
        aria-label="Modo de vista de agenda"
        style={{
          display: 'flex',
          gap: 2,
          background: 'var(--ink-100)',
          borderRadius: 'var(--r-sm)',
          padding: 3,
          marginBottom: 12,
          alignSelf: 'flex-start',
        }}
      >
        {(['day', 'product'] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={mode === m}
            onClick={() => setMode(m)}
            className="sm"
            style={{
              background: mode === m ? 'var(--ink-0, #fff)' : 'none',
              border: 0,
              borderRadius: 'calc(var(--r-sm) - 2px)',
              color: mode === m ? 'var(--ink-900)' : 'var(--ink-400)',
              fontWeight: mode === m ? 600 : 400,
              padding: '4px 12px',
              cursor: 'pointer',
              boxShadow: mode === m ? 'var(--e1)' : 'none',
              transition: 'background 0.15s, color 0.15s, box-shadow 0.15s',
            }}
          >
            {m === 'day' ? 'Por día' : 'Por producto'}
          </button>
        ))}
      </div>

      {/* Loop 174: AnimatePresence mode='wait' + sharedAxisX entre vistas */}
      <AnimatePresence mode="wait" initial={false}>
        {mode === 'day' ? (
          <motion.div key="day" {...sharedAxisX}>
            <AgendaByDay groups={groups} todayKey={todayKey} dispatch={dispatch} />
          </motion.div>
        ) : (
          <motion.div key="product" {...sharedAxisX}>
            <AgendaByProduct items={items} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
