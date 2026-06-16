// Hacktrack — orquestador del calendario de dosis (sin props, usa useApp)
import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { PanInfo } from 'framer-motion'
import { useApp, isoKey, trackedProtocols } from '../lib/store'
import { fmtDate, fmtTime, cadenceLabel } from '../lib/cadence'
import { CATEGORY_COLOR, PEPTIDES } from '../lib/catalog'
import { buildIcs, downloadIcs, upcomingDoses } from '../lib/calendar'
import { Segmented } from './controls'
import { IcBack, IcBell, IcChevron, IcCalendarExport } from './icons'
import { CalendarMonth } from './CalendarMonth'
import { CalendarAgenda } from './CalendarAgenda'

type View = 'mes' | 'agenda'

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

export function DoseCalendar() {
  const { state } = useApp()
  const now = new Date(state.todayTs)   // identidad del día (hoy)
  const realNow = new Date()            // hora real (próxima toma / export)
  const todayYear = now.getFullYear()
  const todayMonth = now.getMonth()

  const [year, setYear] = useState(todayYear)
  const [month, setMonth] = useState(todayMonth)
  const [view, setView] = useState<View>('mes')
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const [toast, setToast] = useState(false)

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
          ]}
          value={view}
          onChange={setView}
        />
      </div>

      {/* ── (#10) NAV RÁPIDA (solo en vista Mes) ───────────────────── */}
      {view === 'mes' && (
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
      )}

      {/* ── GRILLA (con swipe) / AGENDA ─────────────────────────── */}
      {view === 'mes' ? (
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
              <CalendarMonth year={year} month={month} hidden={hidden} />
            </motion.div>
          </AnimatePresence>
        </motion.div>
      ) : (
        <CalendarAgenda />
      )}

      {/* ── (#6) LEYENDA INTERACTIVA ─────────────────────────────── */}
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
            Calendario exportado
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
