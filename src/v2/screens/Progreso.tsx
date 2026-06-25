import { useState, useMemo, useCallback, useEffect, useId } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Ban,
  Clock,
  Calendar,
  TrendingUp,
  FileText,
  X,
} from 'lucide-react'
import { useApp, adherenceMonth } from '../../lib/store'
import { startOfDay } from '../../lib/cadence'
import {
  dayProducts,
  dayStatusEx,
  doseTakenOnProduct,
  doseSkippedOnProduct,
  loggedDoseTs,
  loggedItemsForDay,
  dueTime,
  protocolStreak,
  weekAdherencePctLast8,
  type DayStateEx,
} from '../../lib/calendar'
import { buildIcs, downloadIcs } from '../../lib/calendar'
import { dayModel } from '../../lib/dayModel'
import { MEASURE_META } from '../../lib/catalog'
import type { MeasureSample } from '../../lib/types'
import { Glass } from '../ui/Glass'
import { DataPlate } from '../ui/DataPlate'
import { Ring } from '../ui/Ring'
import { Button } from '../ui/Button'
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
  const startOffset = (firstDay.getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (Date | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1)),
  ]
  while (cells.length % 7 !== 0) cells.push(null)
  const weeks: (Date | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  return weeks
}

function fmtDate(ts: number, short = false): string {
  const d = new Date(ts)
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: short ? 'short' : 'long' })
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
  isSelected,
  standalone,
  onSelect,
}: {
  date: Date | null
  status: DayStateEx | null
  isToday: boolean
  isSelected?: boolean
  standalone?: boolean
  onSelect?: (d: Date) => void
}) {
  if (!date) return <div role="gridcell" className="h-11" aria-hidden />

  const label = date.getDate()

  const startToday = new Date()
  startToday.setHours(0, 0, 0, 0)
  const isFuture = !isToday && date.getTime() > startToday.getTime()
  let eff: DayStateEx | null = status
  if (isToday && status !== 'taken') eff = null
  if (isFuture && eff === 'missed') eff = 'scheduled'

  let bg = ''
  let textCls = 'text-muted-foreground'
  // Marcador del día = MISMO ícono (y color) que la leyenda → forma + color, accesible. Antes era un punto de
  // color liso que NO coincidía con los íconos de la leyenda (reporte de Jan).
  let MarkIcon: typeof CheckCircle2 | null = null
  let markCls = ''

  if (isToday) {
    bg = 'ring-1 ring-[var(--teal)] bg-[var(--teal)]/15'
    textCls = 'text-teal font-semibold'
  }

  if (eff === 'taken') {
    bg = 'bg-teal/20'
    textCls = 'text-teal font-semibold'
    MarkIcon = CheckCircle2; markCls = 'text-teal'
  } else if (eff === 'missed') {
    bg = 'bg-alert/15'
    textCls = 'text-alert font-medium'
    MarkIcon = XCircle; markCls = 'text-alert'
  } else if (eff === 'scheduled') {
    bg = isToday ? bg : 'bg-warn/10'
    textCls = isToday ? textCls : 'text-warn font-medium'
    MarkIcon = Clock; markCls = 'text-warn'
  } else if (eff === 'skipped') {
    bg = 'bg-purple-500/10'
    textCls = 'text-purple-300 font-medium'
    MarkIcon = Ban; markCls = 'text-purple-300'
  } else if (eff === 'rest') {
    textCls = 'text-muted-foreground'
  }

  // Dosis registrada off-cadencia / uso único en un día sin estado de protocolo → "Con dosis" (mismo ícono).
  if (!MarkIcon && standalone) {
    if (!isToday) bg = bg || 'bg-teal/10'
    MarkIcon = CheckCircle2; markCls = 'text-teal'
  }

  return (
    <div role="gridcell" className="flex">
      <button
        type="button"
        onClick={() => onSelect?.(date)}
        aria-pressed={isSelected}
        className={`relative flex h-11 w-full flex-col items-center justify-center rounded-lg transition-colors ${bg} ${isSelected ? 'ring-2 ring-[var(--teal-bright)]' : ''} ${onSelect ? 'cursor-pointer hover:brightness-125 active:scale-95' : ''}`}
        aria-label={`${date.toLocaleDateString('es-MX', { day: 'numeric', month: 'long' })}${isToday ? ', hoy' : ''}${eff === 'taken' ? ', dosis tomada' : eff === 'missed' ? ', dosis omitida' : eff === 'scheduled' ? ', dosis programada' : eff === 'skipped' ? ', dosis saltada' : ''}. Toca para ver el detalle del día.`}
      >
        <span className={`text-[13px] leading-none ${textCls}`}>{label}</span>
        {MarkIcon && (
          <MarkIcon size={11} strokeWidth={2.5} className={`mt-0.5 ${markCls}`} aria-hidden />
        )}
      </button>
    </div>
  )
}

// ── Calendario tab ────────────────────────────────────────────────────────────

function CalendarioTab() {
  const { state } = useApp()
  const reduce = useReducedMotion()
  // Reloj vivo (tick 30 s) — IGUAL que Inicio/Diario/Vida. Antes era un `useMemo(()=>new Date(),[])` capturado
  // al montar → el color de las celdas (vía dayStatusEx) quedaba rancio cruzando medianoche/la hora de una toma,
  // discrepando del detalle del día que usa Date.now() fresco. Ahora ambos derivan del mismo instante vivo.
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(id)
  }, [])
  const today = useMemo(() => startOfDay(now), [now])

  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [exporting, setExporting] = useState(false)
  const [selectedDay, setSelectedDay] = useState<Date | null>(null) // día tocado en el calendario
  // limpiar la selección al cambiar de mes (si no, el panel mostraría un día de otro mes)
  useEffect(() => { setSelectedDay(null) }, [viewMonth, viewYear])

  const grid = useMemo(() => buildMonthGrid(viewYear, viewMonth), [viewYear, viewMonth])

  // FUENTE ÚNICA: color (scheduleStatus, cadencia-only → racha/adherencia intactas) y el punto de "evento
  // registrado" (hasVisibleEvent) salen del MISMO dayModel por día → calendario y detalle no se contradicen.
  // `standaloneDays` ahora marca CUALQUIER día con dosis registrada (también off-cadencia de producto
  // trackeado), no solo productos sin protocolo. El punto solo se pinta si el día no tiene ya color de estado.
  const { dayStates, standaloneDays } = useMemo(() => {
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
    const states: Record<string, DayStateEx> = {}
    const eventDays = new Set<string>()
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(viewYear, viewMonth, d)
      const key = `${viewYear}-${viewMonth}-${d}`
      const dm = dayModel(state, date, now)
      states[key] = dm.scheduleStatus
      if (dm.hasVisibleEvent) eventDays.add(key)
    }
    return { dayStates: states, standaloneDays: eventDays }
  }, [state, viewYear, viewMonth, now])

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }

  // R29: exportar .ics usando las funciones ya existentes en lib/calendar
  const handleExportIcs = useCallback(() => {
    if (exporting) return
    setExporting(true)
    try {
      const ics = buildIcs(state, now)
      downloadIcs(ics)
    } finally {
      // breve feedback visual antes de restaurar
      setTimeout(() => setExporting(false), 1200)
    }
  }, [state, now, exporting])

  const hasProtocol = Object.keys(state.protocols).length > 0

  return (
    <motion.div
      key="calendario"
      variants={reduce ? {} : { hidden: { opacity: 0 }, show: { opacity: 1 } }}
      initial={reduce ? false : 'hidden'}
      animate="show"
      className="flex flex-col gap-4"
    >
      {/* R29: botón exportar .ics */}
      {hasProtocol && (
        <motion.div variants={reduce ? {} : fade}>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportIcs}
            disabled={exporting}
            aria-label="Exportar calendario de dosis como archivo .ics"
            className="w-full gap-2"
          >
            <Calendar size={15} aria-hidden />
            {exporting ? 'Generando…' : 'Exportar calendario (.ics)'}
          </Button>
        </motion.div>
      )}

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
                  const isSelected = !!(date && selectedDay &&
                    date.getFullYear() === selectedDay.getFullYear() &&
                    date.getMonth() === selectedDay.getMonth() &&
                    date.getDate() === selectedDay.getDate())
                  return (
                    <DayCell
                      key={di}
                      date={date}
                      status={status}
                      isToday={isToday}
                      isSelected={isSelected}
                      standalone={stateKey ? standaloneDays.has(stateKey) : false}
                      onSelect={setSelectedDay}
                    />
                  )
                })}
              </div>
            ))}
          </motion.div>
        </AnimatePresence>
      </Glass>

      {/* Detalle del día tocado: qué toca inyectar ese día y a qué hora (por producto) */}
      {selectedDay && (() => {
        // FUENTE ÚNICA: el detalle deriva del MISMO dayModel que el color del calendario → programados ∪ dosis
        // registradas ese día (incluida off-cadencia de producto trackeado). Imposible que color y detalle se
        // contradigan: comparten el objeto. dm.visibleProducts/dm.events ya traen el orden y los flags.
        const dm = dayModel(state, selectedDay, now)
        const nowMs = now.getTime() // mismo instante vivo que el color del calendario (coherencia color↔detalle)
        const fecha = selectedDay.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })
        return (
          <motion.div variants={reduce ? {} : fade}>
            <Glass className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <p className="text-[13px] font-semibold capitalize text-foreground">{fecha}</p>
                <button
                  type="button"
                  onClick={() => setSelectedDay(null)}
                  aria-label="Cerrar detalle del día"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-white/8 hover:text-foreground"
                >
                  <X size={16} />
                </button>
              </div>
              {dm.visibleProducts.length === 0 ? (
                <p className="text-[13px] text-muted-foreground">Sin dosis programadas este día.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {dm.events.map((e) => {
                    const p = e.product
                    const dueT = e.due
                    const taken = e.taken
                    const skipped = e.skipped
                    // Para una dosis TOMADA, mostrar la hora REAL a la que se registró (ts del log),
                    // no la hora programada del protocolo. Solo las pendientes muestran "Inyectar a las {programada}".
                    const realTs = e.takenTs
                    const hora = (realTs != null ? new Date(realTs) : dueT)
                      .toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' })
                    const isStandalone = !state.protocols[p] // dosis de uso único (sin protocolo)
                    const st = isStandalone
                      ? { label: 'Registro único', cls: 'text-secondary-foreground bg-white/8', dot: 'bg-teal' }
                      : taken
                      ? { label: 'Tomada', cls: 'text-teal bg-teal/12', dot: 'bg-teal' }
                      : skipped
                        ? { label: 'Saltada', cls: 'text-purple-300 bg-purple-500/12', dot: 'bg-purple-400' }
                        : dueT.getTime() < nowMs
                          ? { label: 'Omitida', cls: 'text-alert bg-alert/12', dot: 'bg-alert' }
                          : { label: 'Programada', cls: 'text-warn bg-warn/12', dot: 'bg-warn' }
                    return (
                      <div key={p} className="flex items-center gap-3 rounded-lg border border-white/[0.07] bg-raised/40 px-3 py-2.5">
                        <span className={`h-2 w-2 shrink-0 rounded-full ${st.dot}`} aria-hidden />
                        <div className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate text-[13px] font-medium text-foreground">{p}</span>
                          <span className="font-mono text-[11px] text-muted-foreground">{realTs != null ? `Registrada a las ${hora}` : `Inyectar a las ${hora}`}</span>
                        </div>
                        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${st.cls}`}>{st.label}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </Glass>
          </motion.div>
        )
      })()}

      {/* Leyenda — color + ÍCONO (forma) para no depender solo del color (#24, accesibilidad) */}
      <Glass className="flex flex-col gap-2 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Leyenda</p>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <LegendItem color="bg-teal" icon={<CheckCircle2 size={15} strokeWidth={2.5} className="text-teal" />} label="Con dosis" />
          <LegendItem color="bg-warn" icon={<Clock size={15} strokeWidth={2.5} className="text-warn" />} label="Programada" />
          <LegendItem color="bg-alert" icon={<XCircle size={15} strokeWidth={2.5} className="text-alert" />} label="Omitida" />
          <LegendItem color="bg-purple-400" icon={<Ban size={15} strokeWidth={2.5} className="text-purple-300" />} label="Saltada" />
          <LegendItem
            color="bg-teal/60"
            icon={<span className="inline-block h-3.5 w-3.5 rounded-full ring-2 ring-[var(--teal)]" />}
            label="Hoy"
          />
        </div>
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

// ── R31: Gráfica de línea SVG v2 ─────────────────────────────────────────────

type RangeKey = '7d' | '30d' | 'Todo'
const RANGE_OPTIONS: { value: RangeKey; label: string }[] = [
  { value: '7d', label: '7 d' },
  { value: '30d', label: '30 d' },
  { value: 'Todo', label: 'Todo' },
]

function filterByRange(samples: MeasureSample[], range: RangeKey): MeasureSample[] {
  if (range === 'Todo') return samples
  const ms = range === '7d' ? 7 * 86400000 : 30 * 86400000
  const cutoff = Date.now() - ms
  return samples.filter(s => s.ts >= cutoff)
}

interface LineGraphProps {
  samples: MeasureSample[]
  color?: string
  /** Whether lower values are better (reverses fill gradient direction) */
  down?: boolean
  height?: number
  /** Show dot markers on each data point */
  showDots?: boolean
}

function LineGraph({ samples, color = 'var(--teal)', down: _down = false, height = 100, showDots = true }: LineGraphProps) {
  // #66: cada instancia obtiene un id único para el linearGradient, evitando colisiones entre múltiples KpiChartCards
  const gradId = useId()

  if (samples.length < 2) {
    return (
      <div className="flex items-center justify-center py-4 text-[12px] text-muted-foreground" style={{ height }}>
        Mínimo 2 registros para mostrar gráfica
      </div>
    )
  }

  const W = 320
  const H = height
  const PAD_X = 8
  const PAD_Y = 10

  const sorted = [...samples].sort((a, b) => a.ts - b.ts)
  const minTs = sorted[0].ts
  const maxTs = sorted[sorted.length - 1].ts
  const tsRange = maxTs - minTs || 1

  const values = sorted.map(s => s.value)
  const minV = Math.min(...values)
  const maxV = Math.max(...values)
  const vRange = maxV - minV || 1

  function toX(ts: number) {
    return PAD_X + ((ts - minTs) / tsRange) * (W - PAD_X * 2)
  }
  function toY(v: number) {
    return H - PAD_Y - ((v - minV) / vRange) * (H - PAD_Y * 2)
  }

  const pts = sorted.map(s => ({ x: toX(s.ts), y: toY(s.value), v: s.value, ts: s.ts }))
  const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
  const areaD = `${pathD} L ${pts[pts.length - 1].x.toFixed(1)} ${H} L ${pts[0].x.toFixed(1)} ${H} Z`

  // Grid lines (3 horizontal)
  const gridVals = [minV, minV + vRange / 2, maxV]

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: '100%', height: H, display: 'block' }}
      role="img"
      aria-label="Gráfica de progreso"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.22} />
          <stop offset="100%" stopColor={color} stopOpacity={0.02} />
        </linearGradient>
      </defs>

      {/* Grid lines */}
      {gridVals.map((v, i) => {
        const y = toY(v)
        return (
          <g key={i}>
            <line
              x1={PAD_X}
              y1={y}
              x2={W - PAD_X}
              y2={y}
              stroke="rgba(255,255,255,0.06)"
              strokeWidth={1}
            />
            <text
              x={PAD_X}
              y={y - 3}
              fontSize={9}
              fill="var(--ink-400)"
              fontFamily="var(--font-mono, monospace)"
            >
              {Number.isInteger(v) ? v : v.toFixed(1)}
            </text>
          </g>
        )
      })}

      {/* Area fill */}
      <path d={areaD} fill={`url(#${gradId})`} />

      {/* Line */}
      <path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* Dots */}
      {showDots && pts.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={pts.length > 20 ? 0 : 3}
          fill={color}
          opacity={0.85}
        />
      ))}

      {/* Time axis labels */}
      {sorted.length >= 2 && (
        <>
          <text x={PAD_X} y={H - 1} fontSize={9} fill="var(--ink-400)" fontFamily="var(--font-mono, monospace)">
            {fmtDate(sorted[0].ts, true)}
          </text>
          <text
            x={W - PAD_X}
            y={H - 1}
            fontSize={9}
            fill="var(--ink-400)"
            textAnchor="end"
            fontFamily="var(--font-mono, monospace)"
          >
            {fmtDate(sorted[sorted.length - 1].ts, true)}
          </text>
        </>
      )}
    </svg>
  )
}

// ── R31: Correlación KPI↔Dosis (chart overlay dual normalizado) ──────────────

interface KpiDoseCorrelationProps {
  /** KPI samples */
  kpiSamples: MeasureSample[]
  /** Dosis tomadas por día (ts de inicio del día → cantidad) */
  doseSeries: { ts: number; value: number }[]
  kpiName: string
  color: string
}

function KpiDoseCorrelation({ kpiSamples, doseSeries, kpiName, color }: KpiDoseCorrelationProps) {
  if (kpiSamples.length < 2 || doseSeries.length < 2) return null

  const W = 320
  const H = 80
  const PAD = 8

  // Normalizar una serie a [0, H] para overlay
  function normalizeSeries(arr: { ts: number; value: number }[], allTs: number[], tsRange: number) {
    const vals = arr.map(s => s.value)
    const minV = Math.min(...vals)
    const maxV = Math.max(...vals)
    const vRange = maxV - minV || 1
    const minTs = allTs[0]
    return arr.map(s => ({
      x: PAD + ((s.ts - minTs) / tsRange) * (W - PAD * 2),
      y: H - PAD - ((s.value - minV) / vRange) * (H - PAD * 2),
    }))
  }

  const allTs = [
    ...kpiSamples.map(s => s.ts),
    ...doseSeries.map(s => s.ts),
  ].sort((a, b) => a - b)
  const tsRange = allTs[allTs.length - 1] - allTs[0] || 1

  const kpiPts = normalizeSeries(kpiSamples, allTs, tsRange)
  const dosePts = normalizeSeries(doseSeries, allTs, tsRange)

  function toPath(pts: { x: number; y: number }[]) {
    if (pts.length < 2) return ''
    return pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
  }

  return (
    <div className="mt-3">
      <p className="mb-1.5 text-[11px] text-muted-foreground">
        Correlación {kpiName} <span className="text-[var(--teal)]">—</span> vs dosis <span className="opacity-60">- -</span>
      </p>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H, display: 'block' }}>
        {/* KPI line */}
        <path d={toPath(kpiPts)} fill="none" stroke={color} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" />
        {/* Dose line (dashed) */}
        <path d={toPath(dosePts)} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth={1.5} strokeDasharray="4 2" strokeLinejoin="round" />
      </svg>
      <div className="mt-1.5 flex gap-4 text-[10px] text-muted-foreground">
        <span style={{ color }}><span className="mr-1">—</span>{kpiName}</span>
        <span><span className="mr-1 opacity-50">- -</span>Dosis/día</span>
      </div>
    </div>
  )
}

// ── R31: Export CSV (medidas históricas) ──────────────────────────────────────

function exportCsv(history: Record<string, MeasureSample[]>) {
  const BOM = '﻿'
  const rows: string[] = ['medida,fecha,valor']
  const allKeys = Object.keys(history).filter(k => k !== 'Altura' && history[k]?.length > 0)
  for (const name of [...allKeys].sort()) {
    const samples = [...history[name]].sort((a, b) => a.ts - b.ts)
    for (const s of samples) {
      const fecha = new Date(s.ts).toISOString().slice(0, 10)
      const medida = `"${name.replace(/"/g, '""')}"`
      rows.push(`${medida},${fecha},${s.value}`)
    }
  }
  const csv = BOM + rows.join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'hacktrack-medidas.csv'
  a.click()
  URL.revokeObjectURL(url)
}

// ── R31: KpiChart card ───────────────────────────────────────────────────────

interface KpiChartCardProps {
  name: string
  samples: MeasureSample[]
  /** Dosis tomadas acumuladas por día (para correlación) */
  doseSeries: { ts: number; value: number }[]
}

function KpiChartCard({ name, samples, doseSeries }: KpiChartCardProps) {
  const [range, setRange] = useState<RangeKey>('30d')
  const [showCorr, setShowCorr] = useState(false)

  const meta = MEASURE_META[name]
  const color = 'var(--teal)'

  const sorted = useMemo(() => [...samples].sort((a, b) => a.ts - b.ts), [samples])
  const filtered = useMemo(() => filterByRange(sorted, range), [sorted, range])
  const display = filtered.length >= 2 ? filtered : sorted

  if (sorted.length === 0) return null

  const last = sorted[sorted.length - 1]
  const prev = sorted.length >= 2 ? sorted[sorted.length - 2] : null
  const delta = prev != null ? last.value - prev.value : null
  const unit = meta?.kind === 'num' && meta.unit ? ` ${meta.unit}` : ''
  const down = meta?.down ?? false

  const deltaColor =
    delta == null || delta === 0
      ? 'text-muted-foreground'
      : (down ? delta < 0 : delta > 0)
        ? 'text-ok'
        : 'text-alert'
  const deltaSign = delta != null && delta > 0 ? '+' : ''

  return (
    <Glass className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[12px] uppercase tracking-wider text-muted-foreground">{name}</p>
          <DataPlate className="mt-1 inline-block px-2 py-0.5">
            <span className="font-mono text-[22px] font-semibold tabular-nums text-foreground">
              {last.value}{unit}
            </span>
            {delta != null && (
              <span className={`ml-2 text-[12px] font-medium ${deltaColor}`}>
                {deltaSign}{typeof delta === 'number' ? delta.toFixed(1) : delta}
              </span>
            )}
          </DataPlate>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Último: {fmtDate(last.ts, true)} · {sorted.length} registros
          </p>
        </div>
        {/* Correlación toggle (solo si hay dosis suficientes) */}
        {doseSeries.length >= 3 && (
          <button
            onClick={() => setShowCorr(v => !v)}
            className="shrink-0 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:border-teal/30 hover:text-teal active:scale-95"
            aria-pressed={showCorr}
            aria-label={showCorr ? 'Ocultar correlación con dosis' : 'Mostrar correlación con dosis'}
          >
            {showCorr ? 'Ocultar corr.' : 'Ver vs dosis'}
          </button>
        )}
      </div>

      {/* Selector de rango */}
      {sorted.length >= 2 && (
        <div className="flex gap-1.5" role="group" aria-label="Rango de tiempo">
          {RANGE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setRange(opt.value)}
              aria-pressed={range === opt.value}
              className={`h-7 rounded-full px-3 text-[12px] font-medium transition-colors ${
                range === opt.value
                  ? 'bg-teal/20 text-teal'
                  : 'bg-white/5 text-muted-foreground hover:bg-white/8'
              }`}
            >
              {opt.label}
            </button>
          ))}
          <span className="ml-auto self-center text-[11px] text-muted-foreground">
            {display.length} pts
          </span>
        </div>
      )}

      {/* Gráfica */}
      {sorted.length >= 2 && (
        <LineGraph
          samples={display}
          color={color}
          down={down}
          height={96}
        />
      )}

      {/* Correlación KPI↔Dosis */}
      {showCorr && (
        <KpiDoseCorrelation
          kpiSamples={display}
          doseSeries={doseSeries}
          kpiName={name}
          color={color}
        />
      )}
    </Glass>
  )
}

// ── Avances tab (R31) ─────────────────────────────────────────────────────────

function AvancesTab() {
  const { state } = useApp()
  const reduce = useReducedMotion()
  const now = useMemo(() => new Date(), [])
  const today = useMemo(() => startOfDay(now), [now])

  const streak = useMemo(() => protocolStreak(state, today, now), [state, today, now])

  // reloj propio de 30 s — IGUAL que Inicio/Diario — para que la adherencia coincida entre pantallas.
  const [adhNow, setAdhNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setAdhNow(Date.now()), 30_000)
    return () => window.clearInterval(id)
  }, [])
  // Adherencia: MISMA fuente de verdad que Inicio/Diario (adherenceMonth → mes en curso). Antes esta
  // pantalla calculaba un rolling de 30 días que contaba los skips como falta y con `now` estático →
  // divergía del resto. (Conserva el nombre adh30 para no tocar los renders de abajo.)
  const adh30 = useMemo(() => {
    const a = adherenceMonth(state, new Date(adhNow))
    return { due: a?.due ?? 0, taken: a?.taken ?? 0, pct: a?.pct ?? 0 }
  }, [state, adhNow])

  // Adherencia semanal (últimas 8 semanas, más reciente primero)
  const weekly8 = useMemo(() => weekAdherencePctLast8(state, today), [state, today])

  // R31: Serie de dosis por día (para correlación)
  // Cuenta cuántas dosis totales se tomaron cada día (últimos 90 días)
  const doseSeries = useMemo(() => {
    const result: { ts: number; value: number }[] = []
    for (let i = 89; i >= 0; i--) {
      const d = new Date(today.getTime() - i * 86400000)
      let count = 0
      for (const p of dayProducts(state, d)) {
        if (doseTakenOnProduct(state, d, p)) count++
      }
      if (count > 0) {
        result.push({ ts: startOfDay(d).getTime(), value: count })
      }
    }
    return result
  }, [state, today])

  // R31: medidas con historial (excluir Altura que no cambia)
  const historyKeys = useMemo(() => {
    return Object.keys(state.history).filter(
      k => k !== 'Altura' && (state.history[k]?.length ?? 0) > 0,
    )
  }, [state.history])

  // Selector de medida activa para la gráfica principal
  const [activeMeasure, setActiveMeasure] = useState<string | null>(null)
  const measureForChart = activeMeasure ?? historyKeys[0] ?? null

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
              sub="este mes"
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
              sub={streak < 7 ? `Meta: 7 días` : `${streak} días`}
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
            <p className="text-[12px] uppercase tracking-wider text-muted-foreground">Dosis (este mes)</p>
            <p className="mt-0.5 font-mono text-[26px] font-semibold tabular-nums text-foreground">
              {adh30.taken}
              <span className="text-[16px] text-muted-foreground"> / {adh30.due}</span>
            </p>
            <p className="text-[12px] text-secondary-foreground">tomadas de las programadas</p>
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
                    aria-label={pct !== null ? `Semana ${weekly8.length - i}${isCurrentWeek ? ' (actual)' : ''}: ${pct}%` : `Semana ${weekly8.length - i}${isCurrentWeek ? ' (actual)' : ''}: sin datos`}
                  >
                    <div className="flex w-full flex-col items-center justify-end" style={{ height: 72 }}>
                      {pct === null ? (
                        <div
                          className="w-full rounded-t opacity-40"
                          style={{
                            height: 4,
                            background: 'repeating-linear-gradient(45deg, rgba(255,255,255,0.35) 0px, rgba(255,255,255,0.35) 3px, transparent 3px, transparent 7px)',
                          }}
                          aria-hidden
                        />
                      ) : (
                        <div
                          className={`w-full rounded-t transition-all ${
                            pct >= 75
                            ? isCurrentWeek ? 'bg-teal' : 'bg-teal/60'
                            : pct >= 50
                            ? isCurrentWeek ? 'bg-warn' : 'bg-warn/60'
                            : isCurrentWeek ? 'bg-alert' : 'bg-alert/60'
                          }`}
                          style={{ height: h }}
                        />
                      )}
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
            <p className="mt-2 text-[11px] text-muted-foreground/70">
              Los días de descanso no cuentan contra tu adherencia.
            </p>
          </Glass>
        </motion.div>
      )}

      {/* R31: Dashboard de medidas con gráfica seleccionable */}
      {historyKeys.length > 0 && (
        <motion.div variants={reduce ? {} : fade} className="flex flex-col gap-3">
          {/* Sección header + export CSV */}
          <div className="flex items-center justify-between">
            <p className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
              Tus medidas
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => exportCsv(state.history)}
              aria-label="Exportar medidas como CSV"
              className="h-8 gap-1.5 px-2 text-[12px]"
            >
              <FileText size={13} aria-hidden />
              Exportar CSV
            </Button>
          </div>

          {/* Selector de medida activa */}
          {historyKeys.length > 1 && (
            <div
              className="flex flex-wrap gap-1.5"
              role="group"
              aria-label="Seleccionar medida para ver gráfica"
            >
              {historyKeys.map(k => (
                <button
                  key={k}
                  onClick={() => setActiveMeasure(k)}
                  aria-pressed={measureForChart === k}
                  className={`h-8 rounded-full px-3 text-[12px] font-medium transition-colors ${
                    measureForChart === k
                      ? 'bg-teal/20 text-teal ring-1 ring-teal/40'
                      : 'bg-white/5 text-muted-foreground hover:bg-white/8'
                  }`}
                >
                  {k}
                </button>
              ))}
            </div>
          )}

          {/* Gráfica principal de la medida seleccionada */}
          {measureForChart && state.history[measureForChart] && (
            <KpiChartCard
              name={measureForChart}
              samples={state.history[measureForChart]}
              doseSeries={doseSeries}
            />
          )}

          {/* Grilla de resumen de KPIs (últimos valores de las otras medidas) */}
          {historyKeys.length > 1 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {historyKeys
                .filter(k => k !== measureForChart)
                .map(k => {
                  const samples = state.history[k] ?? []
                  if (samples.length === 0) return null
                  const sorted = [...samples].sort((a, b) => a.ts - b.ts)
                  const last = sorted[sorted.length - 1]
                  const prev = sorted.length >= 2 ? sorted[sorted.length - 2] : null
                  const delta = prev != null ? last.value - prev.value : null
                  const meta = MEASURE_META[k]
                  const unit = meta?.kind === 'num' && meta.unit ? ` ${meta.unit}` : ''
                  const down = meta?.down ?? false
                  const deltaColor =
                    delta == null || delta === 0
                      ? 'text-muted-foreground'
                      : (down ? delta < 0 : delta > 0) ? 'text-ok' : 'text-alert'
                  const goal = state.measureGoals?.[k]
                  const goalPct = goal != null && goal > 0
                    ? Math.min(100, Math.round((last.value / goal) * 100))
                    : null
                  return (
                    <button
                      key={k}
                      onClick={() => setActiveMeasure(k)}
                      className="group relative flex flex-col rounded-xl border border-white/8 bg-white/4 p-4 text-left transition-colors hover:border-teal/20 hover:bg-white/6 active:scale-[.98]"
                      aria-label={`Ver gráfica de ${k}`}
                    >
                      <p className="text-[12px] text-muted-foreground">{k}</p>
                      <p className="mt-1 font-mono text-[20px] font-semibold tabular-nums text-foreground">
                        {last.value}{unit}
                      </p>
                      {delta != null && (
                        <p className={`mt-0.5 text-[11px] font-medium ${deltaColor}`}>
                          {delta > 0 ? '+' : ''}{delta.toFixed(1)} vs anterior
                        </p>
                      )}
                      {goal != null && (
                        <div className="mt-2 flex flex-col gap-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-muted-foreground">meta: {goal}{unit}</span>
                            {goalPct != null && (
                              <span className="text-[10px] font-medium text-[#5FC9B8]">{goalPct}%</span>
                            )}
                          </div>
                          {goalPct != null && (
                            <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
                              <div
                                className="h-full rounded-full bg-[#5FC9B8]/70"
                                style={{ width: `${goalPct}%` }}
                                aria-hidden
                              />
                            </div>
                          )}
                        </div>
                      )}
                      <span className="absolute right-3 top-3 opacity-0 transition-opacity group-hover:opacity-100">
                        <TrendingUp size={12} className="text-teal" aria-hidden />
                      </span>
                    </button>
                  )
                })}
            </div>
          )}
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
