import { useState, useMemo, useEffect, useDeferredValue } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import {
  Droplet,
  Activity,
  SkipForward,
  AlertTriangle,
  Check,
  Clock,
  Search,
  X,
  Download,
  Shield,
  Minus,
  TrendingUp,
  TrendingDown,
  Flame,
} from 'lucide-react'
import { useApp, isoKey, siteLabel } from '../../lib/store'
import { startOfDay, dayLabel, cyclePhaseInfo } from '../../lib/cadence'
import {
  productStreak,
  weekAdherencePctLast8,
  phaseForDate,
} from '../../lib/calendar'
import { presenceNow } from '../../lib/pharma'
import { PEPTIDES, CATEGORY_COLOR, MON, WD, MEASURE_META } from '../../lib/catalog'
import type { LogItem, RangeFilter } from '../../lib/types'
import { Glass } from '../ui/Glass'
import { Chip } from '../ui/Chip'
import { Button } from '../ui/Button'
import { SectionHero } from '../ui/SectionHero'
import { HEROES } from '../lib/heroes'

// ── helpers de fecha ─────────────────────────────────────────────────────────

function groupLabel(dateKey: string, todayTs: number): string {
  return dayLabel(new Date(dateKey + 'T00:00:00'), new Date(todayTs))
}

function todayLabel(ts: number): string {
  const d = new Date(ts)
  return `${WD[d.getDay()]}, ${d.getDate()} de ${MON[d.getMonth()]}`
}

function getISOWeekKey(dateKey: string): string {
  const d = new Date(dateKey + 'T00:00:00')
  const day = d.getDay()
  const diffToMon = day === 0 ? -6 : 1 - day
  const mon = new Date(d)
  mon.setDate(d.getDate() + diffToMon)
  const sun = new Date(mon)
  sun.setDate(mon.getDate() + 6)
  const fmt = (x: Date) => `${x.getDate()} ${MON[x.getMonth()]}`
  return `Semana del ${fmt(mon)} al ${fmt(sun)}`
}

// ── CSV export ───────────────────────────────────────────────────────────────

function buildCsv(items: LogItem[]): string {
  const rows: string[][] = [['Fecha', 'Hora', 'Tipo', 'Nombre', 'Valor', 'Producto', 'Nota', 'Efecto']]
  for (const it of items) {
    const d = new Date(it.ts)
    rows.push([
      d.toLocaleDateString('es-MX'),
      it.t,
      it.type,
      it.n,
      it.u,
      it.product ?? '',
      it.note ?? '',
      it.effect ?? '',
    ])
  }
  return rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ── filtros ──────────────────────────────────────────────────────────────────

type TypeFilter = 'todo' | 'dose' | 'medida'

const TYPE_OPTIONS: { value: TypeFilter; label: string }[] = [
  { value: 'todo', label: 'Todo' },
  { value: 'dose', label: 'Dosis' },
  { value: 'medida', label: 'Medidas' },
]

const RANGE_OPTIONS: { value: RangeFilter; label: string }[] = [
  { value: 7, label: '7d' },
  { value: 30, label: '30d' },
  { value: 90, label: '90d' },
  { value: 'all', label: 'Todo' },
]

const FILTER_KEY = 'hk_diario_filters'

function readFilters(): { typeFilter: TypeFilter; rangeFilter: RangeFilter; productFilter?: string } | null {
  try {
    const raw = localStorage.getItem(FILTER_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (![7, 30, 90, 'all'].includes(parsed.rangeFilter)) parsed.rangeFilter = 7
    if (!['todo', 'dose', 'medida'].includes(parsed.typeFilter)) parsed.typeFilter = 'todo'
    return parsed
  } catch {
    return null
  }
}

// ── iconos por tipo de registro ──────────────────────────────────────────────

function ItemIcon({ item }: { item: LogItem }) {
  const base = 'grid place-items-center rounded-full shrink-0'
  const size = 'w-9 h-9'

  if (item.type === 'dose') {
    return (
      <span className={`${base} ${size} bg-teal/12 border border-teal/25`}>
        <Droplet size={16} className="text-teal" />
      </span>
    )
  }
  if (item.type === 'skip') {
    return (
      <span className={`${base} ${size} bg-warn/12 border border-warn/25`}>
        <SkipForward size={16} className="text-warn" />
      </span>
    )
  }
  if (item.type === 'efecto-adverso') {
    return (
      <span className={`${base} ${size} bg-alert/12 border border-alert/25`}>
        <AlertTriangle size={16} className="text-alert" />
      </span>
    )
  }
  // medida, ayuno, otros
  return (
    <span className={`${base} ${size} bg-white/8 border border-white/15`}>
      <Activity size={16} className="text-secondary-foreground" />
    </span>
  )
}

// ── badge de estado (ícono + texto + color) ──────────────────────────────────

function StatusBadge({ item }: { item: LogItem }) {
  if (item.type === 'dose') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-teal/12 px-2.5 py-0.5 text-[11px] font-semibold text-teal border border-teal/20">
        <Check size={10} strokeWidth={3} /> Dosis
      </span>
    )
  }
  if (item.type === 'skip') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-warn/12 px-2.5 py-0.5 text-[11px] font-semibold text-warn border border-warn/20">
        <SkipForward size={10} /> Saltada
      </span>
    )
  }
  if (item.type === 'efecto-adverso') {
    const sev = item.severity
    const color = sev === 'severo' ? 'text-alert bg-alert/12 border-alert/20' : sev === 'moderado' ? 'text-warn bg-warn/12 border-warn/20' : 'text-muted-foreground bg-white/8 border-white/12'
    const label = sev === 'severo' ? 'Severo' : sev === 'moderado' ? 'Moderado' : 'Leve'
    return (
      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold border ${color}`}>
        <AlertTriangle size={10} /> {label}
      </span>
    )
  }
  if (item.type === 'medida') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-white/8 px-2.5 py-0.5 text-[11px] font-semibold text-secondary-foreground border border-white/12">
        <Activity size={10} /> Medida
      </span>
    )
  }
  return null
}

// ── animaciones ──────────────────────────────────────────────────────────────

const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0, 0, 0.2, 1] as [number, number, number, number] } },
}

// ── row de un registro ───────────────────────────────────────────────────────

function TimelineRow({
  item,
  presencePct,
  phaseIndex,
  onDelete,
}: {
  item: LogItem
  presencePct?: number
  phaseIndex?: number | null
  onDelete: (id: string) => void
}) {
  const isSkip = item.type === 'skip'

  return (
    <motion.div
      variants={itemVariants}
      className={`flex items-start gap-3 rounded-lg px-3 py-3 min-h-[44px] transition-opacity ${isSkip ? 'opacity-60' : ''}`}
    >
      <ItemIcon item={item} />

      <div className="flex-1 min-w-0">
        {/* nombre */}
        <p className={`text-[14px] font-semibold leading-snug ${isSkip ? 'text-muted-foreground' : 'text-foreground'}`}>
          {isSkip ? 'Dosis saltada (intencional)' : item.n}
        </p>

        {/* valor — sin vía de administración */}
        <p className="text-[12px] text-muted-foreground font-mono tabular-nums mt-0.5">
          {item.u}
        </p>

        {/* nota */}
        {item.note && (
          <p className="text-[11px] text-muted-foreground italic mt-1 leading-snug">"{item.note}"</p>
        )}

        {/* efecto observado (dose) */}
        {item.type === 'dose' && item.effect && (
          <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-teal/8 border border-teal/18 px-2 py-0.5 text-[10px] font-medium text-teal">
            {item.effect}
          </span>
        )}

        {/* barra de presencia farmacológica */}
        {item.type === 'dose' && typeof presencePct === 'number' && presencePct > 0 && (
          <div className="mt-1.5">
            <p className="text-[9px] text-muted-foreground mb-1 uppercase tracking-wide">Presencia estimada</p>
            <div className="h-1 bg-white/10 rounded-full overflow-hidden w-24">
              <div className="h-full rounded-full bg-teal" style={{ width: `${presencePct}%` }} />
            </div>
          </div>
        )}

        {/* fase de titulación */}
        {item.type === 'dose' && phaseIndex != null && (
          <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-teal/8 border border-teal/18 px-2 py-0.5 text-[10px] font-medium text-teal">
            Fase {phaseIndex + 1}
          </span>
        )}
      </div>

      {/* hora + estado — columna derecha */}
      <div className="flex flex-col items-end gap-1.5 shrink-0">
        <span className="font-mono text-[11px] text-muted-foreground tabular-nums">{item.t}</span>
        <StatusBadge item={item} />
      </div>

      {/* botón eliminar (accesible, mínimo 44px con padding) */}
      <button
        type="button"
        aria-label={`Eliminar ${item.type === 'skip' ? 'dosis saltada de ' + item.u : item.n}`}
        onClick={() => onDelete(item.id)}
        className="shrink-0 h-11 w-11 -mr-2 flex items-center justify-center rounded-md text-muted-foreground hover:text-alert transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
      >
        <X size={14} />
      </button>
    </motion.div>
  )
}

// ── estado vacío ─────────────────────────────────────────────────────────────

function EmptyDiario({
  typeFilter,
  productFilter,
  rangeFilter,
  onExpandRange,
  onClearProduct,
  dispatch,
}: {
  typeFilter: TypeFilter
  productFilter: string
  rangeFilter: RangeFilter
  onExpandRange: () => void
  onClearProduct: () => void
  dispatch: ReturnType<typeof useApp>['dispatch']
}) {
  let icon = <Droplet size={32} className="text-teal/50" />
  let title = 'Tu diario está vacío'
  let sub = 'Cada dosis y medida que registres aparecerá aquí.'
  let ctaLabel = 'Registrar dosis'
  let ctaAction = () => dispatch({ t: 'sheet', sheet: 'registrar' })

  if (productFilter !== 'todos') {
    title = `Sin registros de ${productFilter}`
    sub = 'Cambia el rango o limpia el filtro de producto.'
    ctaLabel = 'Ver todos los productos'
    ctaAction = onClearProduct
  } else if (typeFilter === 'dose') {
    title = 'Sin dosis en este rango'
    sub = 'Cambia el período o registra algo nuevo.'
  } else if (typeFilter === 'medida') {
    icon = <Activity size={32} className="text-secondary-foreground/40" />
    title = 'Sin medidas en este rango'
    sub = 'Cambia el período o registra una medida nueva.'
    ctaLabel = 'Registrar medida'
    ctaAction = () => dispatch({ t: 'sheet', sheet: 'medida' })
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center gap-4 py-12 text-center"
    >
      <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 grid place-items-center">
        {icon}
      </div>
      <div>
        <p className="text-[16px] font-semibold text-foreground">{title}</p>
        <p className="text-[13px] text-muted-foreground mt-1">{sub}</p>
      </div>
      <Button variant="outline" size="sm" onClick={ctaAction}>{ctaLabel}</Button>
      {rangeFilter === 7 && productFilter === 'todos' && (
        <button
          type="button"
          onClick={onExpandRange}
          className="text-[13px] text-muted-foreground underline underline-offset-2 min-h-[44px] flex items-center"
        >
          Ampliar a 30 días
        </button>
      )}
    </motion.div>
  )
}

// ── resumen de medidas ───────────────────────────────────────────────────────

function MeasureSummary({
  filtered,
}: {
  filtered: { dateKey: string; items: LogItem[] }[]
}) {
  const stats = useMemo(() => {
    const byName: Record<string, { first: number; last: number; firstTs: number; lastTs: number }> = {}
    for (const g of filtered) {
      for (const it of g.items) {
        if (it.type !== 'medida') continue
        const numMatch = it.u.match(/^([\d.]+)/)
        if (!numMatch) continue
        const val = parseFloat(numMatch[1])
        if (isNaN(val)) continue
        if (!byName[it.n]) {
          byName[it.n] = { first: val, last: val, firstTs: it.ts, lastTs: it.ts }
        } else {
          if (it.ts < byName[it.n].firstTs) { byName[it.n].first = val; byName[it.n].firstTs = it.ts }
          if (it.ts > byName[it.n].lastTs) { byName[it.n].last = val; byName[it.n].lastTs = it.ts }
        }
      }
    }
    return Object.entries(byName).map(([name, { first, last }]) => {
      const delta = last - first
      const meta = MEASURE_META[name]
      const positive = meta?.down ? delta < 0 : delta > 0
      const neutral = Math.abs(delta) < 0.01
      return { name, first, last, delta, positive, neutral }
    })
  }, [filtered])

  if (stats.length === 0) return null

  return (
    <Glass className="p-4 mb-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">Resumen del período</p>
      <div className="flex flex-col gap-2">
        {stats.map((s) => (
          <div key={s.name} className="flex items-center gap-2">
            <span className="flex-1 min-w-0 text-[13px] font-medium text-secondary-foreground truncate">{s.name}</span>
            <span className="font-mono text-[12px] text-muted-foreground tabular-nums shrink-0">
              {s.first} → {s.last}
            </span>
            <span className={`font-mono text-[12px] font-bold tabular-nums shrink-0 inline-flex items-center gap-0.5 ${s.neutral ? 'text-muted-foreground' : s.positive ? 'text-ok' : 'text-alert'}`}>
              {s.delta > 0 ? '+' : ''}{s.delta.toFixed(1)}
              {!s.neutral && (s.positive
                ? <TrendingUp size={11} />
                : <TrendingDown size={11} />
              )}
            </span>
          </div>
        ))}
      </div>
    </Glass>
  )
}

// ── componente principal ─────────────────────────────────────────────────────

export function Diario() {
  const { state, dispatch } = useApp()
  const reduce = useReducedMotion()

  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  // filtros (persistidos en localStorage)
  const [typeFilter, setTypeFilter] = useState<TypeFilter>(() => readFilters()?.typeFilter ?? 'todo')
  const [rangeFilter, setRangeFilter] = useState<RangeFilter>(() => readFilters()?.rangeFilter ?? 7)
  const [productFilter, setProductFilter] = useState<string>(() => readFilters()?.productFilter ?? 'todos')
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [groupBy, setGroupBy] = useState<'dia' | 'semana'>('dia')

  useEffect(() => {
    try { localStorage.setItem(FILTER_KEY, JSON.stringify({ typeFilter, rangeFilter, productFilter })) } catch { /* storage no disponible */ }
  }, [typeFilter, rangeFilter, productFilter])

  // al cambiar a medidas limpiar filtro de producto
  useEffect(() => { if (typeFilter === 'medida') setProductFilter('todos') }, [typeFilter])

  // productos con registros
  const products = useMemo(() =>
    [...new Set(state.log.flatMap((g) => g.items.filter((it) => (it.type === 'dose' || it.type === 'skip') && it.product).map((it) => it.product!)))],
    [state.log],
  )

  const showProductFilter = products.length >= 2 && typeFilter !== 'medida'
  const pf = showProductFilter && products.includes(productFilter) ? productFilter : 'todos'

  // cutoff para rango
  const cutoff = useMemo(() => {
    if (rangeFilter === 'all') return 0
    const today = new Date(state.todayTs)
    const from = new Date(today.getFullYear(), today.getMonth(), today.getDate() - rangeFilter)
    return from.getTime()
  }, [rangeFilter, state.todayTs])

  // grupos filtrados
  const filtered = useMemo(() =>
    state.log.map((g) => ({
      ...g,
      items: g.items.filter((it) => {
        if (it.ts < cutoff) return false
        if (typeFilter !== 'todo' && it.type !== typeFilter) return false
        if (pf !== 'todos' && ((it.type !== 'dose' && it.type !== 'skip') || it.product !== pf)) return false
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase()
          if (!it.n.toLowerCase().includes(q) && !it.u.toLowerCase().includes(q) && !(it.note?.toLowerCase().includes(q) ?? false)) return false
        }
        return true
      }),
    })).filter((g) => g.items.length > 0),
    [state.log, cutoff, typeFilter, pf, searchQuery],
  )

  const deferredFiltered = useDeferredValue(filtered)
  const isEmpty = deferredFiltered.length === 0
  const totalRecords = deferredFiltered.reduce((acc, g) => acc + g.items.length, 0)

  // conteos por tipo (para badges en el header)
  const doseCount = useMemo(() => deferredFiltered.reduce((a, g) => a + g.items.filter((it) => it.type === 'dose').length, 0), [deferredFiltered])
  const medCount = useMemo(() => deferredFiltered.reduce((a, g) => a + g.items.filter((it) => it.type === 'medida').length, 0), [deferredFiltered])

  // racha global (días con ≥1 dosis)
  const currentStreak = useMemo(() => {
    if (pf !== 'todos') return productStreak(state, pf, new Date(state.todayTs))
    let streak = 0
    const today = startOfDay(new Date(state.todayTs))
    for (let i = 0; i < 365; i++) {
      const d = new Date(today.getTime() - i * 86400000)
      const key = isoKey(d.getTime())
      const group = state.log.find((g) => g.dateKey === key)
      if (!group || !group.items.some((it) => it.type === 'dose')) break
      streak++
    }
    return streak
  }, [pf, state])

  // adherencia del período
  const periodAdherence = useMemo(() => {
    const weeks = weekAdherencePctLast8(state, new Date(state.todayTs))
    const valid = weeks.filter((w): w is number => w !== null)
    if (valid.length === 0) return null
    return Math.round(valid.reduce((a, b) => a + b, 0) / valid.length)
  }, [state])

  // fase ciclo off para producto filtrado
  const productCycleOff = useMemo(() => {
    if (pf === 'todos') return null
    const proto = state.protocols[pf]
    if (!proto || proto.cadence.mode !== 'ciclo') return null
    const info = cyclePhaseInfo(proto.cadence, new Date(proto.startDate), new Date(state.todayTs))
    if (!info || info.phase !== 'off') return null
    return info
  }, [pf, state.protocols, state.todayTs])

  // presencia farmacológica
  const presenceData = useMemo(() => presenceNow(state, state.todayTs), [state])

  // timeline con gaps
  const timelineEntries = useMemo(() => {
    type Entry = { type: 'group'; group: typeof deferredFiltered[0] } | { type: 'gap'; days: number }
    const entries: Entry[] = []
    for (let i = 0; i < deferredFiltered.length; i++) {
      entries.push({ type: 'group', group: deferredFiltered[i] })
      if (i < deferredFiltered.length - 1) {
        const curr = new Date(deferredFiltered[i].dateKey + 'T00:00:00').getTime()
        const next = new Date(deferredFiltered[i + 1].dateKey + 'T00:00:00').getTime()
        const daysDiff = Math.round((curr - next) / 86400000)
        if (daysDiff > 1) entries.push({ type: 'gap', days: daysDiff - 1 })
      }
    }
    return entries
  }, [deferredFiltered])

  // agrupación por semana
  const groupedBySemana = useMemo(() => {
    if (groupBy === 'dia') return null
    const weeks: { weekKey: string; items: LogItem[] }[] = []
    for (const g of deferredFiltered) {
      const wk = getISOWeekKey(g.dateKey)
      const existing = weeks.find((w) => w.weekKey === wk)
      if (existing) {
        existing.items = [...existing.items, ...g.items].sort((a, b) => b.ts - a.ts)
      } else {
        weeks.push({ weekKey: wk, items: [...g.items] })
      }
    }
    return weeks
  }, [groupBy, deferredFiltered])

  function handleDelete(id: string) {
    dispatch({ t: 'sheet', sheet: 'confirm-delete', arg: id })
  }

  function handleExport() {
    const allItems = deferredFiltered.flatMap((g) => g.items)
    const csv = buildCsv(allItems)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const rangeLabel = rangeFilter === 'all' ? 'todo' : `${rangeFilter}d`
    const filename = `diario-hacktrack-${rangeLabel}.csv`
    if (typeof navigator.share === 'function') {
      const file = new File([blob], filename, { type: 'text/csv' })
      navigator.share({ files: [file], title: 'Diario Hacktrack' }).catch(() => downloadBlob(blob, filename))
    } else {
      downloadBlob(blob, filename)
    }
  }

  return (
    <motion.div
      className="flex flex-col gap-4 px-4 pb-32 pt-[max(20px,env(safe-area-inset-top))]"
      initial={reduce ? false : 'hidden'}
      animate="show"
      variants={containerVariants}
    >
      {/* ── hero ── */}
      <motion.div variants={itemVariants}>
        <SectionHero
          {...HEROES.diario}
          title="Tu diario"
          subtitle={totalRecords > 0 ? `${totalRecords} registro${totalRecords !== 1 ? 's' : ''}` : undefined}
        />
      </motion.div>

      {/* ── cabecera ── */}
      <motion.div variants={itemVariants}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[13px] text-muted-foreground">{todayLabel(state.todayTs)}</p>
            {/* badges de conteo */}
            {typeFilter === 'todo' && !isEmpty && (
              <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold">
                {doseCount > 0 && (
                  <span className="rounded-full bg-teal/10 border border-teal/20 text-teal px-2 py-0.5">{doseCount} dosis</span>
                )}
                {medCount > 0 && (
                  <span className="rounded-full bg-white/8 border border-white/12 text-secondary-foreground px-2 py-0.5">{medCount} medidas</span>
                )}
              </div>
            )}
          </div>

          {/* acciones: buscar + exportar */}
          <div className="flex items-center gap-2 mt-1">
            {!isEmpty && (
              <button
                type="button"
                aria-label="Exportar diario como CSV"
                onClick={handleExport}
                className="h-11 w-11 flex items-center justify-center rounded-md border border-white/10 text-muted-foreground hover:text-foreground transition-colors"
              >
                <Download size={16} />
              </button>
            )}
            <button
              type="button"
              aria-label={showSearch ? 'Cerrar búsqueda' : 'Buscar en el diario'}
              onClick={() => { setShowSearch((v) => !v); if (showSearch) setSearchQuery('') }}
              className={`h-11 w-11 flex items-center justify-center rounded-md border transition-colors ${showSearch ? 'border-teal/40 bg-teal/10 text-teal' : 'border-white/10 text-muted-foreground hover:text-foreground'}`}
            >
              {showSearch ? <X size={16} /> : <Search size={16} />}
            </button>
          </div>
        </div>

        {/* campo de búsqueda */}
        <AnimatePresence>
          {showSearch && (
            <motion.div
              key="search"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden mt-3"
            >
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <input
                  autoFocus
                  type="search"
                  placeholder="Buscar en el diario…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-11 pl-9 pr-10 rounded-lg bg-white/6 border border-white/10 text-foreground text-[14px] placeholder:text-muted-foreground focus:outline-none focus:border-teal/40"
                />
                {searchQuery && (
                  <button
                    type="button"
                    aria-label="Limpiar búsqueda"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground h-8 w-8 flex items-center justify-center"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ── filtros de tipo ── */}
      <motion.div variants={itemVariants} className="flex gap-2 flex-wrap">
        {TYPE_OPTIONS.map((o) => (
          <Chip key={o.value} active={typeFilter === o.value} onClick={() => setTypeFilter(o.value)}>
            {o.label}
          </Chip>
        ))}
      </motion.div>

      {/* ── filtro de producto ── */}
      {showProductFilter && (
        <motion.div variants={itemVariants} className="flex gap-2 flex-wrap">
          <Chip active={productFilter === 'todos'} onClick={() => setProductFilter('todos')}>Todos</Chip>
          {products.map((p) => (
            <Chip
              key={p}
              active={productFilter === p}
              onClick={() => setProductFilter(p)}
              style={productFilter === p ? {} : { '--chip-bg': `${CATEGORY_COLOR[PEPTIDES[p]?.cat ?? 'Explorar']}18` } as React.CSSProperties}
            >
              {p}
            </Chip>
          ))}
        </motion.div>
      )}

      {/* ── rango de tiempo ── */}
      <motion.div variants={itemVariants} className="flex flex-col gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          {RANGE_OPTIONS.map((o) => (
            <Chip key={String(o.value)} active={rangeFilter === o.value} onClick={() => setRangeFilter(o.value)}>
              {o.label}
            </Chip>
          ))}
          {!isEmpty && (
            <span className="text-[12px] text-muted-foreground shrink-0 ml-1">
              {totalRecords} registro{totalRecords !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* toggle día/semana en rangos amplios */}
        {(rangeFilter === 30 || rangeFilter === 90 || rangeFilter === 'all') && !isEmpty && (
          <div className="flex gap-2">
            {(['dia', 'semana'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setGroupBy(v)}
                className={`h-9 px-3 rounded-md text-[12px] font-semibold border transition-colors ${groupBy === v ? 'border-white/20 bg-raised text-foreground' : 'border-white/8 text-muted-foreground'}`}
              >
                {v === 'dia' ? 'Día' : 'Semana'}
              </button>
            ))}
          </div>
        )}
      </motion.div>

      {/* ── racha + adherencia ── */}
      {!isEmpty && (currentStreak > 0 || periodAdherence !== null) && (
        <motion.div variants={itemVariants} className="flex gap-2 flex-wrap">
          {currentStreak > 0 && (
            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-semibold border ${currentStreak >= 7 ? 'text-ok bg-ok/10 border-ok/20' : 'text-warn bg-warn/10 border-warn/20'}`}>
              <Flame size={12} />
              Racha {currentStreak} día{currentStreak !== 1 ? 's' : ''}
            </span>
          )}
          {periodAdherence !== null && (
            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-semibold border ${periodAdherence >= 70 ? 'text-ok bg-ok/10 border-ok/20' : 'text-warn bg-warn/10 border-warn/20'}`}>
              <Check size={12} />
              {periodAdherence}% adherencia
            </span>
          )}
        </motion.div>
      )}

      {/* ── banner ciclo off ── */}
      {productCycleOff && (
        <motion.div variants={itemVariants}>
          <div className="rounded-lg border border-white/10 bg-raised px-4 py-3 text-[13px] text-muted-foreground flex items-center gap-2">
            <Clock size={14} className="text-muted-foreground shrink-0" />
            Día de descanso ({productCycleOff.day}/{productCycleOff.total}) — período off activo
          </div>
        </motion.div>
      )}

      {/* ── resumen de medidas ── */}
      {typeFilter === 'medida' && !isEmpty && (
        <motion.div variants={itemVariants}>
          <MeasureSummary filtered={deferredFiltered} />
        </motion.div>
      )}

      {/* ── aria-live para anunciar cambios de filtro ── */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {isEmpty ? 'Sin registros con el filtro actual' : `${totalRecords} registro${totalRecords !== 1 ? 's' : ''} mostrado${totalRecords !== 1 ? 's' : ''}`}
      </div>

      {/* ── vacío / timeline ── */}
      <AnimatePresence mode="wait">
        {!mounted ? null : isEmpty ? (
          <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <EmptyDiario
              typeFilter={typeFilter}
              productFilter={pf}
              rangeFilter={rangeFilter}
              onExpandRange={() => setRangeFilter(30)}
              onClearProduct={() => setProductFilter('todos')}
              dispatch={dispatch}
            />
          </motion.div>
        ) : (
          <motion.div
            key="timeline"
            initial={reduce ? false : 'hidden'}
            animate="show"
            variants={containerVariants}
            role="list"
            aria-label={rangeFilter === 'all' ? 'Todos los registros' : `Registros de los últimos ${rangeFilter} días`}
          >
            {groupBy === 'semana' && groupedBySemana ? (
              groupedBySemana.map((week) => (
                <motion.div key={week.weekKey} variants={itemVariants} className="mb-6">
                  {/* encabezado de semana */}
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-1">
                    {week.weekKey}
                    <span className="font-normal ml-1">· {week.items.length} registros</span>
                  </p>
                  <Glass className="p-0 overflow-hidden">
                    <div className="divide-y divide-white/5">
                      {week.items.map((it) => (
                        <TimelineRow
                          key={it.id}
                          item={it}
                          onDelete={handleDelete}
                        />
                      ))}
                    </div>
                  </Glass>
                </motion.div>
              ))
            ) : (
              timelineEntries.map((entry, idx) => {
                if (entry.type === 'gap') {
                  return (
                    <div key={`gap-${idx}`} className="flex items-center gap-3 my-2 mb-4 px-1">
                      <div className="flex-1 h-px bg-white/6" />
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {entry.days} día{entry.days !== 1 ? 's' : ''} sin registros
                      </span>
                      <div className="flex-1 h-px bg-white/6" />
                    </div>
                  )
                }

                const { group } = entry
                const label = groupLabel(group.dateKey, state.todayTs)

                return (
                  <motion.div key={group.dateKey} variants={itemVariants} className="mb-6">
                    {/* encabezado de día */}
                    <div className="flex items-center justify-between mb-2 px-1">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {label}
                        <span className="font-normal ml-1">· {group.items.length}</span>
                      </p>
                      <button
                        type="button"
                        aria-label={`Agregar dosis al día ${label}`}
                        onClick={() => dispatch({ t: 'sheet', sheet: 'registrar' })}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-teal rounded-full bg-teal/8 border border-teal/18 px-2.5 py-1 min-h-11"
                      >
                        + Dosis
                      </button>
                    </div>

                    <Glass className="p-0 overflow-hidden" role="listitem">
                      <div className="divide-y divide-white/5">
                        {group.items.map((it) => {
                          const phaseIdx = it.type === 'dose' && it.product
                            ? phaseForDate(state, new Date(it.ts), it.product)
                            : null
                          const pct = it.type === 'dose' && it.product
                            ? (presenceData.find((p) => p.product === it.product)?.pct ?? 0)
                            : 0
                          return (
                            <TimelineRow
                              key={it.id}
                              item={it}
                              onDelete={handleDelete}
                              phaseIndex={phaseIdx}
                              presencePct={pct > 0 ? pct : undefined}
                            />
                          )
                        })}
                      </div>
                    </Glass>
                  </motion.div>
                )
              })
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── microcopy de privacidad ── */}
      <motion.div variants={itemVariants} className="flex items-center justify-center gap-1.5 py-4">
        <Shield size={12} className="text-muted-foreground" />
        <p className="text-[11px] text-muted-foreground text-center">
          Tu historial se guarda solo en tu dispositivo
        </p>
      </motion.div>
    </motion.div>
  )
}
