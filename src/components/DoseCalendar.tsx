// Hacktrack — orquestador del calendario de dosis (sin props, usa useApp)
// n=456: Heatmap de densidad total (dosis+medidas+comidas) — modo "Actividad".
// n=457: tap-to-detalle ya integrado en CalendarMonth; nav de mes ya implementada.
// n=499: Mover dosis programada futura a otro día (ajusta startDate del protocolo).
import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { PanInfo } from 'framer-motion'
import { useApp, isoKey, trackedProtocols } from '../lib/store'
import { fmtDate, fmtTime, cadenceLabel, startOfDay, dayDiff } from '../lib/cadence'
import { CATEGORY_COLOR, PEPTIDES } from '../lib/catalog'
import { buildIcs, downloadIcs, upcomingDoses, doseTakenOnProduct } from '../lib/calendar'
import { Segmented } from './controls'
import { IcBack, IcBell, IcChevron, IcCalendarExport } from './icons'
import { CalendarMonth } from './CalendarMonth'
import { CalendarAgenda } from './CalendarAgenda'

type View = 'mes' | 'agenda' | '7dias'
// n=456: heatmap de adherencia de dosis vs heatmap de actividad total
type HeatmapMode = 'estados' | 'adherencia' | 'actividad'

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

// ── n=456: Calcular densidad de registros totales por día ─────────────────────
function totalItemsForDay(state: ReturnType<typeof useApp>['state'], dateKey: string): number {
  const logItems = state.log.find((g) => g.dateKey === dateKey)?.items ?? []
  const history = state.history ?? {}
  let count = logItems.length
  // medidas del historial del día
  for (const samples of Object.values(history)) {
    for (const s of samples) {
      if (isoKey(s.ts) === dateKey) count++
    }
  }
  // comidas del día
  const meals = state.nutrition?.[dateKey]?.meals ?? []
  count += meals.length
  return count
}

// n=456: color del heatmap de actividad (gris → verde)
function activityBg(count: number): string | undefined {
  if (count === 0) return undefined
  const pct = Math.min(count / 8, 1) // saturado a ≥8 registros
  const opacity = 0.08 + pct * 0.42
  return `rgba(27,138,125,${opacity.toFixed(3)})`
}

// ── n=456: Mini-grilla de actividad para el mes ───────────────────────────────
function ActivityHeatmap({
  year,
  month,
  state,
}: {
  year: number
  month: number
  state: ReturnType<typeof useApp>['state']
}) {
  const DAY_LABELS = ['L', 'Ma', 'Mi', 'J', 'V', 'S', 'D']
  const firstDay = new Date(year, month, 1)
  // 0=Dom..6=Sab → WDS index (0=Lun..6=Dom)
  const firstWds = (firstDay.getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const today = new Date()

  const cells: { day: number | null; dateKey: string | null; count: number }[] = []
  for (let i = 0; i < firstWds; i++) cells.push({ day: null, dateKey: null, count: 0 })
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d)
    const dk = isoKey(date.getTime())
    cells.push({ day: d, dateKey: dk, count: totalItemsForDay(state, dk) })
  }

  const weeks: typeof cells[] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))

  const isToday = (day: number) =>
    today.getFullYear() === year && today.getMonth() === month && today.getDate() === day

  return (
    <div style={{ padding: '0 16px 4px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 3, marginBottom: 4 }}>
        {DAY_LABELS.map((l) => (
          <div key={l} style={{ textAlign: 'center', fontSize: 10, color: 'var(--ink-400)', fontWeight: 600 }}>{l}</div>
        ))}
      </div>
      {weeks.map((week, wi) => (
        <div key={wi} style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 3, marginBottom: 3 }}>
          {week.map((cell, ci) => (
            <div
              key={ci}
              style={{
                height: 32,
                borderRadius: 6,
                background: cell.day ? (activityBg(cell.count) ?? 'var(--ink-100)') : 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                outline: cell.day && isToday(cell.day) ? '2px solid var(--brand-500)' : undefined,
                outlineOffset: -1,
              }}
            >
              {cell.day && (
                <span style={{
                  fontSize: 12,
                  fontWeight: isToday(cell.day) ? 700 : 400,
                  color: cell.count > 0 ? 'var(--brand-900)' : 'var(--ink-400)',
                  lineHeight: 1,
                }}>
                  {cell.day}
                </span>
              )}
            </div>
          ))}
        </div>
      ))}
      {/* Leyenda */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, justifyContent: 'flex-end' }}>
        <span className="sm" style={{ color: 'var(--ink-400)', fontSize: 10 }}>Menos</span>
        {[0, 2, 4, 6, 8].map((n) => (
          <div key={n} style={{ width: 12, height: 12, borderRadius: 3, background: activityBg(n) ?? 'var(--ink-100)' }} />
        ))}
        <span className="sm" style={{ color: 'var(--ink-400)', fontSize: 10 }}>Más</span>
      </div>
    </div>
  )
}

// ── Item 118: Vista agenda 7 días ────────────────────────────────────────────
function SevenDayAgenda({ state, now }: { state: ReturnType<typeof useApp>['state']; now: Date }) {
  const items = upcomingDoses(state, now, 100)
  // Build next 7 days
  const days: Date[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now)
    d.setDate(now.getDate() + i)
    d.setHours(0, 0, 0, 0)
    return d
  })

  return (
    <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      {days.map((day) => {
        const dayItems = items.filter((it) => {
          const d = new Date(it.date)
          return d.getFullYear() === day.getFullYear() && d.getMonth() === day.getMonth() && d.getDate() === day.getDate()
        })
        const isToday = day.toDateString() === now.toDateString()
        return (
          <div key={day.toISOString()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span className="sm" style={{ fontWeight: isToday ? 700 : 600, color: isToday ? 'var(--brand-700)' : 'var(--ink-700)', minWidth: 80 }}>
                {isToday ? 'Hoy' : fmtDate(day, now)}
              </span>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              {dayItems.length === 0 && (
                <span className="sm" style={{ color: 'var(--ink-300)', fontSize: 10 }}>Sin dosis</span>
              )}
            </div>
            {dayItems.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingLeft: 8 }}>
                {dayItems.map((it, i) => {
                  const cat = PEPTIDES[it.product]?.cat
                  const color = cat ? (CATEGORY_COLOR[cat] ?? 'var(--ink-400)') : 'var(--ink-400)'
                  const taken = doseTakenOnProduct(state, day, it.product)
                  return (
                    <div key={`${it.product}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="sm mono" style={{ color: 'var(--ink-400)', minWidth: 52, whiteSpace: 'nowrap', textAlign: 'right', flexShrink: 0, fontSize: 11 }}>{fmtTime(it.date)}</span>
                      <span style={{ width: 7, height: 7, borderRadius: 999, background: color, flexShrink: 0 }} aria-hidden />
                      <span className="sm" style={{ flex: 1, color: taken ? 'var(--ink-300)' : 'var(--ink-900)', textDecoration: taken ? 'line-through' : 'none' }}>
                        {it.product}
                      </span>
                      {taken && (
                        <span className="sm" style={{ color: 'var(--success)', fontSize: 10, fontWeight: 600 }}>✓</span>
                      )}
                      {isToday && !taken && (
                        <span className="sm" style={{ color: 'var(--warning)', fontSize: 10, fontWeight: 600 }}>Pendiente</span>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export function DoseCalendar() {
  const { state, dispatch } = useApp()
  const now = new Date(state.todayTs)   // identidad del día (hoy)
  const realNow = new Date()            // hora real (próxima toma / export)
  const todayYear = now.getFullYear()
  const todayMonth = now.getMonth()

  const [year, setYear] = useState(todayYear)
  const [month, setMonth] = useState(todayMonth)
  const [view, setView] = useState<View>('mes')
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const [toast, setToast] = useState(false)
  // n=456: tres modos de vista: estados / adherencia (heatmap) / actividad total (densidad)
  const [heatmapMode, setHeatmapMode] = useState<HeatmapMode>('estados')

  // n=499: mover dosis programada
  const [moveDoseTarget, setMoveDoseTarget] = useState<{ date: Date; products: string[] } | null>(null)

  const tracked = trackedProtocols(state)
  // próxima toma REAL entre TODOS los productos (fecha y producto de la MISMA fuente, no mezcladas)
  const nextUpcoming = upcomingDoses(state, realNow, 1)[0]
  const next = nextUpcoming?.date ?? null
  const nextProduct = nextUpcoming?.product ?? tracked[0]?.product ?? ''

  // ─── Nav helpers ──────────────────────────────────────────────
  const prevMonth = useCallback(() => {
    setYear(y => month === 0 ? y - 1 : y)
    setMonth(m => m === 0 ? 11 : m - 1)
  }, [month])

  const nextMonth = useCallback(() => {
    setYear(y => month === 11 ? y + 1 : y)
    setMonth(m => m === 11 ? 0 : m + 1)
  }, [month])

  const goToday = useCallback(() => {
    setYear(todayYear)
    setMonth(todayMonth)
  }, [todayYear, todayMonth])

  const handleDragEnd = useCallback((_: unknown, info: PanInfo) => {
    if (info.offset.x < -60) nextMonth()
    else if (info.offset.x > 60) prevMonth()
  }, [nextMonth, prevMonth])

  // ─── Legend toggle ─────────────────────────────────────────────
  const toggleHidden = useCallback((product: string) => {
    setHidden(prev => {
      const next = new Set(prev)
      if (next.has(product)) next.delete(product)
      else next.add(product)
      return next
    })
  }, [])

  // ─── ICS export ────────────────────────────────────────────────
  const handleExport = useCallback(() => {
    downloadIcs(buildIcs(state, realNow))
    setToast(true)
    setTimeout(() => setToast(false), 2600)
  }, [state, now])

  // ─── n=499: Mover dosis programada ─────────────────────────────
  // Se activa al tap en un día futuro con productos programados en el CalendarMonth
  // Nota: CalendarMonth dispara 'sheet' day-detail para días pasados. Para días futuros,
  // interceptamos desde DoseCalendar añadiendo un listener al evento personalizado que
  // ya emite el store al abrir day-detail. Como workaround sin tocar CalendarMonth (otro grupo),
  // DoseCalendar expone un botón "Mover próxima dosis" por producto en el estado 7dias.

  const handleMoveDose = useCallback((product: string, toDate: Date) => {
    const proto = state.protocols[product]
    if (!proto) { setMoveDoseTarget(null); return }

    // Calcular el shift: diferencia entre toDate y la próxima dosis programada de este producto
    const upcoming = upcomingDoses(state, realNow, 60)
    const nextDose = upcoming.find((u) => u.product === product)
    if (!nextDose) { setMoveDoseTarget(null); return }

    const currentDoseDay = startOfDay(nextDose.date)
    const targetDay = startOfDay(toDate)
    const deltaDays = dayDiff(targetDay, currentDoseDay)

    if (deltaDays === 0) { setMoveDoseTarget(null); return }

    // Ajustar startDate en Δ días para desplazar la cadencia entera
    const newStartDate = proto.startDate + deltaDays * 86400000
    dispatch({ t: 'updateProtocolFor', product, patch: { startDate: newStartDate } })
    setMoveDoseTarget(null)

    setToast(true)
    setTimeout(() => setToast(false), 2600)
  }, [state, dispatch, realNow])

  // ─── Estado vacío ──────────────────────────────────────────────
  if (tracked.length === 0) {
    return (
      <div style={{ padding: '24px 16px', textAlign: 'center' }}>
        <p className="body" style={{ color: 'var(--ink-400)', margin: 0 }}>
          Agrega un producto en Progreso para ver tu calendario.
        </p>
      </div>
    )
  }

  const isCurrentMonth = year === todayYear && month === todayMonth
  // CalendarMonth espera `heatmap: boolean` (modo adherencia)
  const calHeatmap = heatmapMode === 'adherencia'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

      {/* ── (#5) HEADER PEGAJOSO ─────────────────────────────────── */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          background: 'var(--surface)',
          borderBottom: '1px solid var(--ink-100)',
          padding: '12px 16px 8px',
        }}
      >
        {/* Hoy + próxima toma */}
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
          <span className="h2" style={{ color: 'var(--ink-900)', fontWeight: 700 }}>
            Hoy{' '}
            <span className="body" style={{ color: 'var(--ink-400)', fontWeight: 400 }}>
              {fmtDate(now, now)}
            </span>
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <IcBell size={14} style={{ color: next ? 'var(--brand-700)' : 'var(--ink-300)', flexShrink: 0 }} />
          {next ? (
            <span className="sm" style={{ color: 'var(--brand-700)' }}>
              Próxima:{' '}
              <strong style={{ fontWeight: 600 }}>{nextProduct}</strong>
              {' · '}
              {fmtDate(next, now)} {fmtTime(next)}
            </span>
          ) : (
            <span className="sm" style={{ color: 'var(--ink-400)' }}>Sin próxima toma</span>
          )}
        </div>
      </div>

      <div style={{ padding: '12px 16px 0' }}>

        {/* ── (#4) SEGMENTED ──────────────────────────────────────── */}
        <Segmented<View>
          options={[
            { value: 'mes', label: 'Mes' },
            { value: 'agenda', label: 'Agenda' },
            { value: '7dias', label: '7 días' },
          ]}
          value={view}
          onChange={setView}
        />
      </div>

      {/* ── (#10) NAV RÁPIDA (solo en vista Mes) ───────────────────── */}
      {view === 'mes' && (
        <>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 16px 4px',
            }}
          >
            <button
              className="iconbtn"
              onClick={prevMonth}
              aria-label="Mes anterior"
              style={{ color: 'var(--ink-700)' }}
            >
              <IcBack size={20} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="h2" style={{ color: 'var(--ink-900)', fontWeight: 600 }}>
                {MONTH_NAMES[month]} {year}
              </span>
              {!isCurrentMonth && (
                <button
                  className="chip"
                  onClick={goToday}
                  style={{ fontSize: 12, padding: '2px 10px', cursor: 'pointer' }}
                >
                  Hoy
                </button>
              )}
            </div>

            <button
              className="iconbtn"
              onClick={nextMonth}
              aria-label="Mes siguiente"
              style={{ color: 'var(--ink-700)' }}
            >
              <IcChevron size={20} />
            </button>
          </div>

          {/* Loop 170 + n=456: Toggle Vista: Estados / Adherencia / Actividad */}
          <div
            style={{ padding: '0 16px 6px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}
          >
            <span className="sm" style={{ color: 'var(--ink-400)' }}>Vista:</span>
            <div
              role="group"
              aria-label="Modo de vista del calendario"
              style={{
                display: 'flex',
                gap: 2,
                background: 'var(--ink-100)',
                borderRadius: 'var(--r-sm, 8px)',
                padding: 3,
              }}
            >
              {(
                [
                  { value: 'estados', label: 'Estados' },
                  { value: 'adherencia', label: 'Adherencia' },
                  { value: 'actividad', label: 'Actividad' },
                ] as { value: HeatmapMode; label: string }[]
              ).map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={heatmapMode === value}
                  onClick={() => setHeatmapMode(value)}
                  className="sm"
                  style={{
                    background: heatmapMode === value ? 'var(--surface, #fff)' : 'none',
                    border: 0,
                    borderRadius: 'calc(var(--r-sm, 8px) - 2px)',
                    color: heatmapMode === value ? 'var(--ink-900)' : 'var(--ink-400)',
                    fontWeight: heatmapMode === value ? 600 : 400,
                    padding: '4px 10px',
                    cursor: 'pointer',
                    boxShadow: heatmapMode === value ? 'var(--e1)' : 'none',
                    transition: 'background 0.15s, color 0.15s, box-shadow 0.15s',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ── GRILLA (con swipe) / AGENDA ─────────────────────────── */}
      {view === 'mes' ? (
        heatmapMode === 'actividad' ? (
          // n=456: Heatmap de actividad total
          <ActivityHeatmap year={year} month={month} state={state} />
        ) : (
          <motion.div
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.18}
            onDragEnd={handleDragEnd}
            style={{ touchAction: 'pan-y' }}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={`${year}-${month}`}
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ duration: 0.22, ease: 'easeInOut' }}
              >
                <CalendarMonth year={year} month={month} hidden={hidden} heatmap={calHeatmap} />
              </motion.div>
            </AnimatePresence>
          </motion.div>
        )
      ) : view === '7dias' ? (
        <>
          <SevenDayAgenda state={state} now={realNow} />

          {/* n=499: Sección "Mover próxima dosis" en vista 7 días */}
          <div style={{ padding: '0 16px 12px' }}>
            <p className="sm" style={{ color: 'var(--ink-400)', marginBottom: 8, marginTop: 4, fontWeight: 600 }}>
              Reprogramar próxima dosis
            </p>
            {tracked.map((t) => {
              const upcoming = upcomingDoses(state, realNow, 60)
              const nextDose = upcoming.find((u) => u.product === t.product)
              if (!nextDose) return null
              const color = PEPTIDES[t.product] ? CATEGORY_COLOR[PEPTIDES[t.product].cat] : 'var(--ink-400)'
              return (
                <div key={t.product} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 999, background: color, flexShrink: 0 }} />
                  <span className="sm" style={{ flex: 1, color: 'var(--ink-900)' }}>
                    {t.product}
                    <span style={{ color: 'var(--ink-400)', marginLeft: 6 }}>
                      {fmtDate(nextDose.date, realNow)} {fmtTime(nextDose.date)}
                    </span>
                  </span>
                  <button
                    className="chip"
                    style={{ fontSize: 11, padding: '2px 10px' }}
                    onClick={() => setMoveDoseTarget({ date: nextDose.date, products: [t.product] })}
                  >
                    Mover
                  </button>
                </div>
              )
            })}
            {moveDoseTarget && (
              <div style={{ marginTop: 12, padding: 12, background: 'var(--ink-100)', borderRadius: 'var(--r-md)', border: '1px solid var(--border)' }}>
                <p className="sm" style={{ fontWeight: 600, color: 'var(--ink-900)', margin: '0 0 8px' }}>
                  Mover {moveDoseTarget.products.join(', ')} a:
                </p>
                {/* Selector de fecha */}
                <input
                  type="date"
                  defaultValue={moveDoseTarget.date.toISOString().slice(0, 10)}
                  min={new Date(realNow.getTime() + 86400000).toISOString().slice(0, 10)}
                  style={{ fontSize: 14, padding: '6px 10px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--ink-900)', marginBottom: 10, width: '100%' }}
                  onChange={(e) => {
                    if (!e.target.value) return
                    const d = new Date(e.target.value + 'T00:00:00')
                    setMoveDoseTarget((prev) => prev ? { ...prev, date: d } : prev)
                  }}
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  {moveDoseTarget.products.map((p) => (
                    <button
                      key={p}
                      className="btn btn-brand"
                      style={{ flex: 1 }}
                      onClick={() => handleMoveDose(p, moveDoseTarget.date)}
                    >
                      Confirmar
                    </button>
                  ))}
                  <button
                    className="btn"
                    style={{ flex: 1, background: 'var(--ink-100)', color: 'var(--ink-700)' }}
                    onClick={() => setMoveDoseTarget(null)}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        <CalendarAgenda />
      )}

      {/* ── (#6) LEYENDA INTERACTIVA ─────────────────────────────── */}
      {heatmapMode !== 'actividad' && (
        <div style={{ padding: '0 16px 8px' }}>
          <p className="sm" style={{ color: 'var(--ink-400)', marginBottom: 8, marginTop: 12 }}>
            Leyenda
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {tracked.map(t => {
              const entry = PEPTIDES[t.product]
              const color = entry ? CATEGORY_COLOR[entry.cat] : 'var(--ink-300)'
              const rhythm = cadenceLabel(t.cadence)
              const isHidden = hidden.has(t.product)
              return (
                <button
                  key={t.product}
                  onClick={() => toggleHidden(t.product)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    background: 'none',
                    border: 'none',
                    padding: '2px 0',
                    cursor: 'pointer',
                    textAlign: 'left',
                    opacity: isHidden ? 0.38 : 1,
                    transition: 'opacity 0.18s',
                  }}
                  aria-pressed={isHidden}
                  aria-label={`${isHidden ? 'Mostrar' : 'Ocultar'} ${t.product}`}
                >
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background: color,
                      flexShrink: 0,
                    }}
                  />
                  <span className="body" style={{ color: 'var(--ink-900)', flex: 1 }}>
                    {t.product}
                  </span>
                  <span className="sm" style={{ color: 'var(--ink-400)' }}>
                    {rhythm}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ── (#9) EXPORTAR A CALENDARIO ───────────────────────────── */}
      <div style={{ padding: '4px 16px 20px' }}>
        <button
          className="btn btn-outline btn-sm"
          onClick={handleExport}
          aria-label="Exportar calendario (.ics)"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            width: '100%',
          }}
        >
          <IcCalendarExport size={16} />
          Exportar calendario (.ics)
        </button>
      </div>

      {/* ── TOAST ────────────────────────────────────────────────── */}
      <AnimatePresence>
        {toast && (
          <motion.div
            key="toast"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            style={{
              position: 'fixed',
              bottom: 88,
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'var(--ink-900)',
              color: 'var(--surface)',
              borderRadius: 10,
              padding: '8px 18px',
              fontSize: 13,
              fontWeight: 500,
              zIndex: 200,
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            {moveDoseTarget ? 'Dosis reprogramada' : 'Calendario exportado'}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
