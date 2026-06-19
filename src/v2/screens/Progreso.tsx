import { useState, useMemo } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { ChevronLeft, ChevronRight, Circle, CheckCircle2, XCircle, Calendar, TrendingUp } from 'lucide-react'
import { useApp } from '../../lib/store'
import { startOfDay } from '../../lib/cadence'
import {
  dayProducts,
  dayStatusEx,
  doseTakenOnProduct,
  doseSkippedOnProduct,
  protocolStreak,
  weekAdherencePctLast8,
  type DayStateEx,
} from '../../lib/calendar'
import { Glass } from '../ui/Glass'
import { Ring } from '../ui/Ring'
import { SegmentedTabs } from '../ui/SegmentedTabs'
import { SectionHero } from '../ui/SectionHero'
import { HEROES } from '../lib/heroes'

// ── Helpers ──────────────────────────────────────────────────────────────────

const DIAS_CORTOS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do']
const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

/** Genera la cuadrícula del mes: semanas de L→D con nulls para días fuera del mes. */
function buildMonthGrid(year: number, month: number): (Date | null)[][] {
  const firstDay = new Date(year, month, 1)
  // getDay(): 0=dom … 6=sáb → queremos L=0 … D=6
  const startOffset = (firstDay.getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (Date | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1)),
  ]
  // Rellenar al final hasta completar semanas de 7
  while (cells.length % 7 !== 0) cells.push(null)
  const weeks: (Date | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  return weeks
}

// ── Animaciones ───────────────────────────────────────────────────────────────

const fade = {
  hidden: { opacity: 0, y: 10 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: [0, 0, 0, 1] as [number, number, number, number] },
  },
}

const staggerContainer = {
  show: { transition: { staggerChildren: 0.06 } },
}

// ── DayCell ──────────────────────────────────────────────────────────────────

function DayCell({
  date,
  status,
  isToday,
}: {
  date: Date | null
  status: DayStateEx | null
  isToday: boolean
}) {
  if (!date) return <div role="gridcell" className="h-11" aria-hidden />

  const label = date.getDate()

  // Normalizar estado: HOY pendiente nunca es "omitida" (es "Hoy"); el FUTURO nunca es "omitida".
  const startToday = new Date()
  startToday.setHours(0, 0, 0, 0)
  const isFuture = !isToday && date.getTime() > startToday.getTime()
  let eff: DayStateEx | null = status
  if (isToday && status !== 'taken') eff = null            // hoy pendiente → trato "Hoy"
  if (isFuture && eff === 'missed') eff = 'scheduled'       // futuro programado, no omitido

  // Color/style logic
  let bg = ''
  let textCls = 'text-muted-foreground'
  let dotColor = ''

  if (isToday) {
    bg = 'ring-1 ring-[var(--teal)] bg-[var(--teal)]/15'
    textCls = 'text-teal font-semibold'
  }

  if (eff === 'taken') {
    bg = 'bg-teal/20'
    textCls = 'text-teal font-semibold'
    dotColor = 'bg-teal'
  } else if (eff === 'missed') {
    bg = 'bg-alert/15'
    textCls = 'text-alert font-medium'
    dotColor = 'bg-alert'
  } else if (eff === 'scheduled') {
    bg = isToday ? bg : 'bg-warn/10'
    textCls = isToday ? textCls : 'text-warn font-medium'
    dotColor = 'bg-warn'
  } else if (eff === 'rest') {
    textCls = 'text-muted-foreground'
  }

  // Hoy: punto teal si no hay dosis tomada
  if (isToday && eff !== 'taken') {
    dotColor = 'bg-teal'
  }

  return (
    <div
      role="gridcell"
      className={`relative flex h-11 flex-col items-center justify-center rounded-lg ${bg}`}
      aria-label={`${date.toLocaleDateString('es-MX', { day: 'numeric', month: 'long' })}${isToday ? ', hoy' : ''}${eff === 'taken' ? ', dosis tomada' : eff === 'missed' ? ', dosis omitida' : eff === 'scheduled' ? ', dosis programada' : ''}`}
    >
      <span className={`text-[13px] leading-none ${textCls}`}>{label}</span>
      {dotColor && (
        <span className={`mt-0.5 h-1.5 w-1.5 rounded-full ${dotColor}`} aria-hidden />
      )}
    </div>
  )
}

// ── Calendario tab ────────────────────────────────────────────────────────────

function CalendarioTab() {
  const { state } = useApp()
  const reduce = useReducedMotion()
  const now = useMemo(() => new Date(), [])
  const today = useMemo(() => startOfDay(now), [now])

  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())

  const grid = useMemo(() => buildMonthGrid(viewYear, viewMonth), [viewYear, viewMonth])

  // Pre-calcular estado de cada día del mes
  const dayStates = useMemo(() => {
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
    const result: Record<string, DayStateEx> = {}
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(viewYear, viewMonth, d)
      const key = `${viewYear}-${viewMonth}-${d}`
      result[key] = dayStatusEx(state, date, now)
    }
    return result
  }, [state, viewYear, viewMonth, now])

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }

  const hasProtocol = Object.keys(state.protocols).length > 0

  return (
    <motion.div
      key="calendario"
      variants={reduce ? {} : { hidden: { opacity: 0 }, show: { opacity: 1 } }}
      initial={reduce ? false : 'hidden'}
      animate="show"
      className="flex flex-col gap-4"
    >
      {/* Navegación de mes */}
      <Glass>
        <div className="mb-3 flex items-center justify-between">
          <button
            onClick={prevMonth}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/6 text-secondary-foreground transition-colors hover:bg-white/10 active:scale-95"
            aria-label="Mes anterior"
          >
            <ChevronLeft size={18} />
          </button>
          <h2 className="font-semibold text-foreground">
            {MESES[viewMonth]} {viewYear}
          </h2>
          <button
            onClick={nextMonth}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/6 text-secondary-foreground transition-colors hover:bg-white/10 active:scale-95"
            aria-label="Mes siguiente"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Cabecera días de semana */}
        <div role="row" className="mb-1 grid grid-cols-7 gap-1">
          {DIAS_CORTOS.map((d) => (
            <div key={d} role="columnheader" aria-label={d} className="text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {d}
            </div>
          ))}
        </div>

        {/* Grilla de días */}
        <AnimatePresence mode="wait">
          <motion.div
            key={`${viewYear}-${viewMonth}`}
            role="grid"
            aria-label={`${MESES[viewMonth]} ${viewYear}`}
            initial={reduce ? false : { opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduce ? {} : { opacity: 0, x: -8 }}
            transition={{ duration: 0.2, ease: [0, 0, 0, 1] }}
            className="flex flex-col gap-1"
          >
            {grid.map((week, wi) => (
              <div key={wi} role="row" className="grid grid-cols-7 gap-1">
                {week.map((date, di) => {
                  const isToday = date !== null &&
                    date.getFullYear() === today.getFullYear() &&
                    date.getMonth() === today.getMonth() &&
                    date.getDate() === today.getDate()
                  const stateKey = date ? `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}` : null
                  const status = stateKey ? (dayStates[stateKey] ?? null) : null
                  return (
                    <DayCell
                      key={di}
                      date={date}
                      status={status}
                      isToday={isToday}
                    />
                  )
                })}
              </div>
            ))}
          </motion.div>
        </AnimatePresence>
      </Glass>

      {/* Leyenda */}
      <Glass className="flex flex-wrap items-center gap-x-5 gap-y-2 py-3">
        <LegendItem color="bg-teal" icon={<CheckCircle2 size={13} className="text-teal" />} label="Con dosis" />
        <LegendItem color="bg-alert" icon={<XCircle size={13} className="text-alert" />} label="Omitida" />
        <LegendItem color="bg-muted-foreground" icon={<Circle size={13} className="text-muted-foreground/50" />} label="Sin dosis" />
        <LegendItem
          color="bg-teal/60"
          icon={<span className="inline-block h-3 w-3 rounded-full ring-1 ring-[var(--teal)]" />}
          label="Hoy"
        />
      </Glass>

      {/* Empty state */}
      {!hasProtocol && (
        <motion.div variants={fade} className="flex flex-col items-center gap-2 py-6 text-center">
          <Calendar size={32} className="text-muted-foreground/40" />
          <p className="text-[14px] font-medium text-secondary-foreground">Sin protocolo activo</p>
          <p className="text-[13px] text-muted-foreground">Agrega un producto en Protocolo para ver tu historial de dosis aquí.</p>
        </motion.div>
      )}
    </motion.div>
  )
}

function LegendItem({ color: _color, icon, label }: { color: string; icon: React.ReactNode; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-[12px] text-secondary-foreground">
      {icon}
      {label}
    </span>
  )
}

// ── Avances tab ───────────────────────────────────────────────────────────────

function AvancesTab() {
  const { state } = useApp()
  const reduce = useReducedMotion()
  const now = useMemo(() => new Date(), [])
  const today = useMemo(() => startOfDay(now), [now])

  const streak = useMemo(() => protocolStreak(state, today, now), [state, today, now])

  // Adherencia de los últimos 30 días
  const adh30 = useMemo(() => {
    let due = 0
    let taken = 0
    for (let i = 0; i < 30; i++) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      for (const p of dayProducts(state, d)) {
        due++
        if (doseTakenOnProduct(state, d, p)) taken++
      }
    }
    return { due, taken, pct: due > 0 ? Math.round((taken / due) * 100) : 0 }
  }, [state, today])

  // Adherencia semanal (últimas 8 semanas, más reciente primero)
  const weekly8 = useMemo(() => weekAdherencePctLast8(state, today), [state, today])

  // KPIs con historial
  const kpiEntries = useMemo(() => {
    const order = state.kpiOrder ?? state.selectedMeasures
    return order
      .filter((m) => (state.history[m]?.length ?? 0) > 0)
      .slice(0, 4)
      .map((m) => {
        const samples = state.history[m] ?? []
        const last = samples[samples.length - 1]
        const prev = samples.length >= 2 ? samples[samples.length - 2] : null
        const delta = last && prev ? last.value - prev.value : null
        return { name: m, value: last?.value ?? null, delta }
      })
  }, [state])

  const hasProtocol = Object.keys(state.protocols).length > 0

  if (!hasProtocol) {
    return (
      <motion.div
        key="avances"
        initial={reduce ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col items-center gap-2 py-10 text-center"
      >
        <TrendingUp size={32} className="text-muted-foreground/40" />
        <p className="text-[14px] font-medium text-secondary-foreground">Sin datos de avance aún</p>
        <p className="text-[13px] text-muted-foreground">Registra dosis para ver tu adherencia y racha aquí.</p>
      </motion.div>
    )
  }

  return (
    <motion.div
      key="avances"
      variants={reduce ? {} : { ...staggerContainer }}
      initial={reduce ? false : 'hidden'}
      animate="show"
      className="flex flex-col gap-4"
    >
      {/* Anillos: adherencia + racha */}
      <motion.div variants={reduce ? {} : fade}>
        <Glass className="flex items-center justify-around py-5">
          <div className="flex flex-col items-center gap-2">
            <Ring
              value={adh30.pct}
              goal={100}
              unit="%"
              label="Adherencia"
              sub="30 días"
              size={120}
              stroke={10}
            />
          </div>
          <div className="h-16 w-px bg-white/8" />
          <div className="flex flex-col items-center gap-2">
            <Ring
              value={streak}
              goal={Math.max(streak, 7)}
              unit=""
              label="Racha"
              sub={streak === 1 ? '1 día' : `${streak} días`}
              size={120}
              stroke={10}
            />
          </div>
        </Glass>
      </motion.div>

      {/* Conteo 30 días */}
      <motion.div variants={reduce ? {} : fade}>
        <Glass className="flex items-center justify-between">
          <div>
            <p className="text-[12px] uppercase tracking-wider text-muted-foreground">Dosis este mes</p>
            <p className="mt-0.5 font-mono text-[26px] font-semibold tabular-nums text-foreground">
              {adh30.taken}
              <span className="text-[16px] text-muted-foreground"> / {adh30.due}</span>
            </p>
            <p className="text-[12px] text-secondary-foreground">registradas</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span
              className={`rounded-full px-3 py-1 text-[13px] font-semibold ${
                adh30.pct >= 75 ? 'bg-ok/15 text-ok' : adh30.pct >= 50 ? 'bg-warn/15 text-warn' : 'bg-alert/15 text-alert'
              }`}
            >
              {adh30.pct}%
            </span>
            <span className="text-[11px] text-muted-foreground">
              {adh30.pct >= 75 ? 'Objetivo alcanzado' : adh30.pct >= 50 ? 'En progreso' : 'Por debajo del objetivo'}
            </span>
          </div>
        </Glass>
      </motion.div>

      {/* Barras semanales (últimas 8 semanas) */}
      {weekly8.some((v) => v !== null) && (
        <motion.div variants={reduce ? {} : fade}>
          <Glass>
            <p className="mb-3 text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
              Adherencia semanal (8 semanas)
            </p>
            <div className="flex items-end gap-1.5">
              {[...weekly8].reverse().map((pct, i) => {
                const h = pct !== null ? Math.max(4, (pct / 100) * 72) : 4
                const isCurrentWeek = i === weekly8.length - 1
                return (
                  <div
                    key={i}
                    className="flex flex-1 flex-col items-center gap-1"
                    aria-label={pct !== null ? `Semana ${i + 1}: ${pct}%` : `Semana ${i + 1}: sin datos`}
                  >
                    <div className="flex w-full flex-col items-center justify-end" style={{ height: 72 }}>
                      <div
                        className={`w-full rounded-t transition-all ${
                          pct === null
                            ? 'bg-white/8'
                            : pct >= 75
                            ? isCurrentWeek ? 'bg-teal' : 'bg-teal/60'
                            : pct >= 50
                            ? isCurrentWeek ? 'bg-warn' : 'bg-warn/60'
                            : isCurrentWeek ? 'bg-alert' : 'bg-alert/60'
                        }`}
                        style={{ height: h }}
                      />
                    </div>
                    <span className="text-[9px] text-muted-foreground">
                      {pct !== null ? `${pct}%` : '—'}
                    </span>
                  </div>
                )
              })}
            </div>
            <div className="mt-2 flex items-center gap-3">
              <span className="text-[11px] text-muted-foreground">← Hace 8 sem</span>
              <span className="ml-auto text-[11px] text-muted-foreground">Esta sem →</span>
            </div>
          </Glass>
        </motion.div>
      )}

      {/* KPIs */}
      {kpiEntries.length > 0 && (
        <motion.div variants={reduce ? {} : fade}>
          <p className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
            Tus medidas
          </p>
          <div className="grid grid-cols-2 gap-3">
            {kpiEntries.map(({ name, value, delta }) => (
              <Glass key={name} className="p-4">
                <p className="text-[12px] text-muted-foreground">{name}</p>
                <p className="mt-1 font-mono text-[22px] font-semibold tabular-nums text-foreground">
                  {value != null ? value : '—'}
                </p>
                {delta !== null && (
                  <p
                    className={`mt-0.5 text-[11px] font-medium ${
                      delta > 0 ? 'text-ok' : delta < 0 ? 'text-alert' : 'text-muted-foreground'
                    }`}
                  >
                    {delta > 0 ? `+${delta.toFixed(1)}` : delta.toFixed(1)} vs anterior
                  </p>
                )}
              </Glass>
            ))}
          </div>
        </motion.div>
      )}

      {/* Aviso de privacidad */}
      <motion.div variants={reduce ? {} : fade}>
        <p className="text-center text-[11px] text-muted-foreground">
          Tu historial se guarda solo en tu dispositivo.
        </p>
      </motion.div>
    </motion.div>
  )
}

// ── Pantalla principal ────────────────────────────────────────────────────────

type Tab = 'calendario' | 'avances'

const TABS: { value: Tab; label: string }[] = [
  { value: 'calendario', label: 'Calendario' },
  { value: 'avances', label: 'Avances' },
]

export function Progreso() {
  const reduce = useReducedMotion()
  const [tab, setTab] = useState<Tab>('calendario')

  return (
    <motion.div
      className="flex flex-col gap-4 px-4 pb-32 pt-[max(20px,env(safe-area-inset-top))]"
      initial={reduce ? false : 'hidden'}
      animate="show"
      variants={reduce ? {} : { show: { transition: { staggerChildren: 0.06 } } }}
    >
      {/* Hero */}
      <motion.div variants={reduce ? {} : fade}>
        <SectionHero {...HEROES.progreso} title="Progreso" />
      </motion.div>

      {/* Pestañas */}
      <motion.div variants={reduce ? {} : fade}>
        <SegmentedTabs options={TABS} value={tab} onChange={setTab} />
      </motion.div>

      {/* Contenido */}
      <AnimatePresence mode="wait">
        {tab === 'calendario' ? (
          <motion.div
            key="calendario"
            aria-label="Calendario"
            initial={reduce ? false : { opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduce ? {} : { opacity: 0, x: -12 }}
            transition={{ duration: 0.22, ease: [0, 0, 0, 1] }}
          >
            <CalendarioTab />
          </motion.div>
        ) : (
          <motion.div
            key="avances"
            aria-label="Avances"
            initial={reduce ? false : { opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduce ? {} : { opacity: 0, x: -12 }}
            transition={{ duration: 0.22, ease: [0, 0, 0, 1] }}
          >
            <AvancesTab />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
