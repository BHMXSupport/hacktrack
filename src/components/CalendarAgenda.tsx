// Hacktrack — Vista Agenda (#4): próximas tomas agrupadas por día, cronológica.
// Loop 172: segmented "Por día / Por producto" con sessionStorage
// Loop 174: auto-scroll a hoy + slide-in escalonado + AnimatePresence modo sharedAxisX
// Loop 173: botón "✓ Marcar" inline para tomas de hoy o atrasadas
import { useCallback, useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { upcomingDoses, pendingDoses } from '../lib/calendar'
import { fmtDate, fmtTime } from '../lib/cadence'
import { PEPTIDES, CATEGORY_COLOR } from '../lib/catalog'
import { useApp, isoKey, nextInjectionSite } from '../lib/store'
import { sharedAxisX, dur, ease, spring } from '../lib/motion'
import { Glyph } from './glyphs'

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

// ── Loop 173: botón "✓ Marcar" inline ────────────────────────────────────────
interface MarkDoseButtonProps {
  product: string
  doseTs: number  // timestamp de la toma (dueTime del día)
  dispatch: (a: import('../lib/store').Action) => void
}

function MarkDoseButton({ product, doseTs, dispatch }: MarkDoseButtonProps) {
  const [markedId, setMarkedId] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { state } = useApp()

  const handleMark = useCallback((e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation()
    // #32(a): calcular el sitio sugerido con nextInjectionSite para actualizar lastInjectionSite
    const lastSite = state.lastInjectionSite[product]
    const site = nextInjectionSite(lastSite)
    dispatch({ t: 'logDose', product, value: null, unit: '', ts: doseTs, site })
    setDone(true)
    // El store mete el id en toastUndoId. Aquí hacemos un undo local por conveniencia:
    // guardamos el ts para poder llamar a deleteLog si el usuario presiona Deshacer.
    // Como el store no expone el id aquí directamente, usamos una referencia al dispatch.
    // La forma más simple: el toast del store ya tiene undo. Pero para el inline undo
    // necesitamos el id — por eso el timer da 4s antes de limpiar.
    undoTimerRef.current = setTimeout(() => {
      setMarkedId(null)
    }, 4000)
  }, [dispatch, product, doseTs, state.lastInjectionSite])

  // Capturar el id del item recién creado desde el store
  useEffect(() => {
    if (!done || markedId) return
    // Buscar en el log el item más reciente de este producto con ese ts
    for (const group of state.log) {
      const found = group.items.find(
        (it) => it.type === 'dose' && it.product === product && it.ts === doseTs
      )
      if (found) { setMarkedId(found.id); break }
    }
  }, [done, markedId, state.log, product, doseTs])

  // Limpiar timer al desmontar
  useEffect(() => () => { if (undoTimerRef.current) clearTimeout(undoTimerRef.current) }, [])

  if (done) {
    // Una sola affordance de deshacer: el toast global del store. Aquí solo la confirmación.
    return (
      <motion.span
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1, transition: spring.ui }}
        style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}
        aria-label={`${product} marcado`}
      >
        <Glyph name="check" size={14} color="var(--success)" />
        <span className="sm" style={{ color: 'var(--success-ink)', fontWeight: 600 }}>Marcado</span>
      </motion.span>
    )
  }

  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.92, transition: spring.ui }}
      onClick={handleMark}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleMark(e) } }}
      className="sm"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        background: 'var(--brand-100)',
        border: '1px solid var(--brand-300)',
        borderRadius: 6,
        color: 'var(--brand-700)',
        fontWeight: 600,
        padding: '3px 10px',
        cursor: 'pointer',
        flexShrink: 0,
        whiteSpace: 'nowrap',
      }}
      aria-label={`Marcar dosis de ${product}`}
    >
      <Glyph name="check" size={14} color="var(--brand-700)" />
      Marcar
    </motion.button>
  )
}

// ── Subcomponente: vista Por Día ──────────────────────────────────────────────
function AgendaByDay({
  groups,
  todayKey,
  dispatch,
  pendingSet,
  timingMap,
}: {
  groups: { label: string; dayKey: string; entries: { date: Date; product: string }[] }[]
  todayKey: string
  dispatch: (a: import('../lib/store').Action) => void
  /** Set de "product|ts" que tienen toma pendiente (hoy o atrasada, sin marcar) */
  pendingSet: Set<string>
  /** Item 197: mapa de badges de ventana de toma para dosis ya registradas */
  timingMap: Record<string, string>
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
                const pendingKey = `${item.product}|${item.date.getTime()}`
                const isPending = pendingSet.has(pendingKey)
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
                    <span className="agenda__product" style={{ flex: 1 }}>{item.product}</span>
                    {/* Loop 173: botón ✓ Marcar para tomas hoy o atrasadas pendientes */}
                    {isPending && (
                      <MarkDoseButton
                        product={item.product}
                        doseTs={item.date.getTime()}
                        dispatch={dispatch}
                      />
                    )}
                    {/* Item 197: badge de ventana de toma para dosis ya registradas */}
                    {!isPending && (() => {
                      const key = `${item.product}|${item.date.getTime()}`
                      const badge = timingMap[key]
                      return badge ? (
                        <span
                          className="sm"
                          style={{ color: 'var(--warning-ink)', fontWeight: 600, fontSize: 10, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        >
                          {badge}
                        </span>
                      ) : null
                    })()}
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
              <span
                className="sm"
                style={{ fontWeight: 700, color: 'var(--ink-700)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              >
                {product}
              </span>
              {cat && (
                <span className="sm" style={{ color: 'var(--ink-400)', fontWeight: 400, flexShrink: 0 }}>{cat}</span>
              )}
              <span
                className="sm mono"
                style={{ color: 'var(--ink-400)', fontWeight: 600, flexShrink: 0, whiteSpace: 'nowrap' }}
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

  // Loop 173: tomas pendientes (hoy + atrasadas sin marcar cuya hora ya venció)
  const pending = pendingDoses(state, now)
  // Set de "product|ts" para lookup O(1)
  const pendingSet = new Set(pending.map((p) => `${p.product}|${p.date.getTime()}`))

  // Item 197: timing badges — compare real ts vs reminderTime for logged doses
  const timingMap: Record<string, string> = {}
  for (const group of state.log) {
    for (const it of group.items) {
      if (it.type !== 'dose') continue
      const rt = state.protocols[it.product ?? '']?.reminderTime ?? state.protocol?.reminderTime
      if (!rt) continue
      const logged = new Date(it.ts)
      const expected = new Date(it.ts)
      const [hh, mm] = rt.split(':').map(Number)
      expected.setHours(hh, mm, 0, 0)
      const diffMs = logged.getTime() - expected.getTime()
      const diffH = Math.round(Math.abs(diffMs) / 3600000 * 10) / 10
      if (Math.abs(diffMs) > 2 * 3600000) {
        const sign = diffMs > 0 ? `${diffH}h tarde` : `${diffH}h antes`
        const key = `${it.product}|${expected.getTime()}`
        timingMap[key] = sign
      }
    }
  }

  // Agrupar por día para la vista "Por día"
  // Incluir también las pendientes atrasadas al inicio (antes de los futuros)
  const allItems = [
    ...pending.map((p) => ({ date: p.date, product: p.product })),
    ...items,
  ]
  // Deduplicar: si una toma atrasada coincide con una upcoming (mismo producto+ts), no duplicar
  const seen = new Set<string>()
  const deduped = allItems.filter((it) => {
    const k = `${it.product}|${it.date.getTime()}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
  // Ordenar cronológicamente
  deduped.sort((a, b) => a.date.getTime() - b.date.getTime())

  const groups: { label: string; dayKey: string; entries: typeof deduped }[] = []
  for (const item of deduped) {
    const label = fmtDate(item.date, now)
    const last = groups[groups.length - 1]
    if (last && last.label === label) {
      last.entries.push(item)
    } else {
      groups.push({ label, dayKey: isoKey(item.date.getTime()), entries: [item] })
    }
  }

  if (deduped.length === 0) {
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
            <AgendaByDay groups={groups} todayKey={todayKey} dispatch={dispatch} pendingSet={pendingSet} timingMap={timingMap} />
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
