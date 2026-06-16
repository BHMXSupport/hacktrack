import { useState, useMemo, useEffect, useDeferredValue, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useApp, isoKey } from '../lib/store'
import { Chip, Segmented, Disclaimer } from '../components/controls'
import { dayLabel, startOfDay, fmtTime } from '../lib/cadence'
import { MON, WD, MEASURE_ICON, CATEGORY_COLOR, PEPTIDES, MEASURE_META } from '../lib/catalog'
import { Glyph } from '../components/glyphs'
import { EmptyState } from '../components/EmptyState'
import { tapHaptic } from '../lib/haptics'
import type { LogItem, InjectionSite, RangeFilter } from '../lib/types'

// loop 140: etiquetas legibles para cada sitio de inyección
const SITE_LABEL: Record<InjectionSite, string> = {
  'abdomen-izq': 'Abdomen izq.',
  'abdomen-der': 'Abdomen der.',
  'muslo-izq':   'Muslo izq.',
  'muslo-der':   'Muslo der.',
  'gluteo-izq':  'Glúteo izq.',
  'gluteo-der':  'Glúteo der.',
}

// etiqueta humana del grupo a partir de su clave de fecha estable
function groupLabel(dateKey: string, todayTs: number): string {
  return dayLabel(new Date(dateKey + 'T00:00:00'), new Date(todayTs))
}

// ── animación stagger ────────────────────────────────────────────────────────
const stagger = { animate: { transition: { staggerChildren: 0.06 } } }
const itemAnim = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 } }

// ── tipos de filtro ──────────────────────────────────────────────────────────
type TypeFilter = 'todo' | 'dose' | 'medida'

const TYPE_OPTIONS: { value: TypeFilter; label: string }[] = [
  { value: 'todo',   label: 'Todo' },
  { value: 'dose',   label: 'Dosis' },
  { value: 'medida', label: 'Medidas' },
]

const RANGE_OPTIONS: { value: RangeFilter; label: string }[] = [
  { value: 7,     label: '7 días' },
  { value: 30,    label: '30 días' },
  { value: 90,    label: '90 días' },
  { value: 'all', label: 'Todo' },
]

// ── clave de localStorage ────────────────────────────────────────────────────
const FILTER_KEY = 'hk_diario_filters'

function readFilters(): { typeFilter: TypeFilter; rangeFilter: RangeFilter; productFilter?: string } | null {
  try {
    const raw = localStorage.getItem(FILTER_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    // validate rangeFilter
    if (![7, 30, 90, 'all'].includes(parsed.rangeFilter)) parsed.rangeFilter = 7
    // validate typeFilter
    if (!['todo', 'dose', 'medida'].includes(parsed.typeFilter)) parsed.typeFilter = 'todo'
    return parsed
  } catch {
    return null
  }
}

// ── fecha localizada ─────────────────────────────────────────────────────────
function todayLabel(ts: number): string {
  const d = new Date(ts)
  const dow = WD[d.getDay()]
  const day = d.getDate()
  const mon = MON[d.getMonth()]
  return `${dow}, ${day} de ${mon}`
}

// ── icono de categoría (SVG glyph, sin emojis) ───────────────────────────────
function CatCircle({ item }: { item: LogItem }) {
  const glyphId: string =
    item.type === 'dose'
      ? 'dose'
      : item.type === 'skip'
        ? 'skip'
        : (MEASURE_ICON[item.n]?.icon ?? item.ic ?? 'medidas')

  const cat = item.type === 'skip' ? '#94A3B8' : item.cat

  return (
    <div
      aria-hidden="true"
      style={{
        width: 36,
        height: 36,
        borderRadius: '50%',
        background: `color-mix(in srgb, ${cat} 13%, transparent)`,
        border: `1.5px solid color-mix(in srgb, ${cat} 28%, transparent)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        opacity: item.type === 'skip' ? 0.7 : 1,
      }}
    >
      <Glyph name={glyphId} color={cat} size={18} />
    </div>
  )
}

// ── Skeleton shimmer ─────────────────────────────────────────────────────────
const skeletonKeyframes = `
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
`

function SkeletonItem() {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 10 }}>
      <div style={{
        width: 52, height: 36, borderRadius: 'var(--r-sm)',
        background: 'linear-gradient(90deg, var(--ink-100) 25%, var(--ink-200) 50%, var(--ink-100) 75%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.4s infinite',
        flexShrink: 0,
      }} />
      <div style={{ flex: 1, display: 'flex', gap: 12, alignItems: 'center',
        padding: '12px 14px', borderRadius: 'var(--r-md)',
        background: 'var(--ink-100)',
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: '50%',
          background: 'linear-gradient(90deg, var(--ink-100) 25%, var(--ink-200) 50%, var(--ink-100) 75%)',
          backgroundSize: '200% 100%',
          animation: 'shimmer 1.4s infinite',
          flexShrink: 0,
        }} />
        <div style={{ flex: 1 }}>
          <div style={{
            height: 14, width: '60%', borderRadius: 4, marginBottom: 6,
            background: 'linear-gradient(90deg, var(--ink-200) 25%, var(--ink-300) 50%, var(--ink-200) 75%)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 1.4s infinite',
          }} />
          <div style={{
            height: 11, width: '40%', borderRadius: 4,
            background: 'linear-gradient(90deg, var(--ink-100) 25%, var(--ink-200) 50%, var(--ink-100) 75%)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 1.4s infinite',
          }} />
        </div>
      </div>
    </div>
  )
}

// ── item de timeline ─────────────────────────────────────────────────────────
function TimelineItem({
  item,
  onDelete,
  groupLabel: label,
  dispatch,
}: {
  item: LogItem
  onDelete: (id: string) => void
  groupLabel: string
  dispatch: ReturnType<typeof useApp>['dispatch']
}) {
  // n°236: swipe-to-delete
  const [dragX, setDragX] = useState(0)
  const SWIPE_THRESHOLD = -64

  // n°77: editar hora inline
  const [editingTime, setEditingTime] = useState(false)

  function handleTimeClick() {
    setEditingTime(true)
  }

  function handleTimeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value // 'HH:MM'
    if (!val) return
    const [hh, mm] = val.split(':').map(Number)
    const base = new Date(item.ts)
    base.setHours(hh, mm, 0, 0)
    dispatch({ t: 'editLogTime', id: item.id, ts: base.getTime() })
    setEditingTime(false)
  }

  // Current time value formatted for input[type=time]
  const timeInputValue = (() => {
    const d = new Date(item.ts)
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  })()

  const revealVisible = dragX < -32

  return (
    <motion.article
      variants={itemAnim}
      role="listitem"
      aria-describedby={`grp-${item.id}`}
      style={{
        display: 'flex',
        gap: 12,
        alignItems: 'flex-start',
        position: 'relative',
        zIndex: 1,
      }}
    >
      {/* id oculto para aria-describedby — anuncia el día */}
      <span id={`grp-${item.id}`} style={{ display: 'none' }}>{label}</span>

      {/* hora — tap para editar (n°77) */}
      <div
        className="mono sm"
        style={{
          width: 52,
          flexShrink: 0,
          paddingTop: 10,
          textAlign: 'right',
          color: 'var(--ink-400)',
          cursor: 'pointer',
        }}
        onClick={handleTimeClick}
        title="Tocar para editar hora"
      >
        {editingTime ? (
          <input
            type="time"
            defaultValue={timeInputValue}
            autoFocus
            onBlur={() => setEditingTime(false)}
            onChange={handleTimeChange}
            style={{
              width: 52,
              fontSize: 11,
              border: '1px solid var(--brand-500)',
              borderRadius: 4,
              background: 'var(--bg)',
              color: 'var(--ink-900)',
              padding: '2px 2px',
            }}
          />
        ) : (
          item.t
        )}
      </div>

      {/* nodo de la línea vertical */}
      <div
        style={{
          position: 'absolute',
          left: 45,
          top: 13,
          width: 10,
          height: 10,
          borderRadius: '50%',
          background: item.cat,
          border: '2px solid var(--bg)',
          zIndex: 2,
          flexShrink: 0,
        }}
      />

      {/* contenedor swipeable (n°236) */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', borderRadius: 'var(--r-md)' }}>
        {/* panel rojo reveal */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            right: 0,
            top: 0,
            bottom: 0,
            width: 72,
            background: 'var(--error)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 'var(--r-md)',
            opacity: revealVisible ? 1 : 0,
            transition: 'opacity 0.15s',
          }}
        >
          <Glyph name="trash" size={20} color="#fff" />
        </div>

        <motion.div
          drag="x"
          dragConstraints={{ left: -80, right: 0 }}
          dragElastic={0.1}
          onDrag={(_, info) => setDragX(info.offset.x)}
          onDragEnd={(_, info) => {
            if (info.offset.x < SWIPE_THRESHOLD) {
              onDelete(item.id)
            }
            setDragX(0)
          }}
          style={{ position: 'relative', zIndex: 1 }}
        >
          <div
            className="card"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '12px 14px',
              opacity: item.type === 'skip' ? 0.65 : 1,
            }}
          >
            <CatCircle item={item} />

            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="body" style={{ fontWeight: 600, color: item.type === 'skip' ? 'var(--ink-400)' : 'var(--ink-900)' }}>
                {item.type === 'skip' ? 'Dosis saltada (intencional)' : item.n}
              </div>
              <div className="mono sm" style={{ color: 'var(--ink-400)', marginTop: 2 }}>
                {item.u}
                {item.type === 'dose' && item.site && (
                  <span style={{ marginLeft: 4, color: 'var(--brand-700)', fontWeight: 500 }}>
                    · {SITE_LABEL[item.site]}
                  </span>
                )}
              </div>
              {item.type === 'dose' && item.note && (
                <div
                  className="sm"
                  style={{ color: 'var(--ink-400)', fontStyle: 'italic', marginTop: 3, lineHeight: 1.35 }}
                  aria-label={`Nota: ${item.note}`}
                >
                  {item.note}
                </div>
              )}
              {item.type === 'dose' && item.effect && (
                <div style={{ marginTop: 5 }}>
                  <span
                    style={{
                      display: 'inline-flex', alignItems: 'center',
                      padding: '2px 9px', borderRadius: 999,
                      background: 'color-mix(in srgb, var(--brand-500) 10%, transparent)',
                      color: 'var(--brand-700)',
                      fontWeight: 500, fontSize: 11,
                      border: '1px solid color-mix(in srgb, var(--brand-500) 22%, transparent)',
                      lineHeight: 1.5,
                    }}
                    aria-label={`Efecto observado: ${item.effect}`}
                  >
                    {item.effect}
                  </span>
                </div>
              )}

              {/* n°182: botón 'Registrar de nuevo' para medidas */}
              {item.type === 'medida' && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    tapHaptic()
                    dispatch({ t: 'sheet', sheet: 'medida', arg: item.n })
                  }}
                  style={{
                    marginTop: 6,
                    background: 'none',
                    border: '1px solid var(--ink-200)',
                    borderRadius: 'var(--r-sm)',
                    padding: '3px 8px',
                    fontSize: 11,
                    color: 'var(--ink-400)',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  Registrar de nuevo
                </button>
              )}
            </div>

            {/* botón papelera accesible (siempre presente para teclado/SR) */}
            <button
              type="button"
              aria-label={`Eliminar ${item.type === 'skip' ? 'dosis saltada de ' + item.u : item.n}`}
              onClick={() => onDelete(item.id)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '6px',
                color: 'var(--ink-300)',
                display: 'flex',
                alignItems: 'center',
                borderRadius: 'var(--r-sm)',
                flexShrink: 0,
              }}
            >
              <Glyph name="trash" size={16} color="var(--ink-300)" />
            </button>
          </div>
        </motion.div>
      </div>
    </motion.article>
  )
}

// ── helper EmptyState contextual ─────────────────────────────────────────────
interface EmptyProps {
  glyph: string
  color: string
  title: string
  subtitle: string
  cta: { label: string; onClick: () => void }
}

function emptyProps(
  typeFilter: TypeFilter,
  productFilter: string,
  dispatch: ReturnType<typeof useApp>['dispatch'],
  accentColor: string,
  clearProduct: () => void,
): EmptyProps {
  if (typeFilter === 'todo' && productFilter === 'todos') {
    return {
      glyph: 'dose',
      color: accentColor,
      title: 'Tu diario está vacío',
      subtitle: 'Cada dosis y medida que registres aparecerá aquí, en orden.',
      cta: { label: 'Registrar dosis', onClick: () => dispatch({ t: 'sheet', sheet: 'registrar' }) },
    }
  }
  if (productFilter !== 'todos') {
    return {
      glyph: 'dose',
      color: accentColor,
      title: `Sin dosis de ${productFilter} en este rango`,
      subtitle: 'Cambia el rango o registra algo nuevo.',
      cta: { label: 'Ver todos', onClick: clearProduct },
    }
  }
  if (typeFilter === 'dose') {
    return {
      glyph: 'dose',
      color: accentColor,
      title: 'Sin dosis en este rango',
      subtitle: 'Cambia el rango o registra algo nuevo.',
      cta: { label: 'Registrar dosis', onClick: () => dispatch({ t: 'sheet', sheet: 'registrar' }) },
    }
  }
  return {
    glyph: 'medidas',
    color: accentColor,
    title: 'Sin medidas en este rango',
    subtitle: 'Cambia el rango o registra algo nuevo.',
    cta: { label: 'Registrar medida', onClick: () => dispatch({ t: 'sheet', sheet: 'medida' }) },
  }
}

// ── ISO week helper ──────────────────────────────────────────────────────────
function getISOWeekKey(dateKey: string): string {
  const d = new Date(dateKey + 'T00:00:00')
  // Monday of this week
  const day = d.getDay() // 0=Sun
  const diffToMon = (day === 0 ? -6 : 1 - day)
  const mon = new Date(d)
  mon.setDate(d.getDate() + diffToMon)
  const sun = new Date(mon)
  sun.setDate(mon.getDate() + 6)
  const fmt = (x: Date) => `${x.getDate()} ${MON[x.getMonth()]}`
  return `Semana del ${fmt(mon)} al ${fmt(sun)}`
}

// ── componente principal ─────────────────────────────────────────────────────
export function Diario() {
  const { state, dispatch } = useApp()

  // n°265: skeleton en el primer render
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  // Inicializa filtros desde localStorage (con fallback seguro)
  const [typeFilter, setTypeFilter] = useState<TypeFilter>(() => {
    return readFilters()?.typeFilter ?? 'todo'
  })
  const [rangeFilter, setRangeFilter] = useState<RangeFilter>(() => {
    return readFilters()?.rangeFilter ?? 7
  })
  // n°210: productFilter persisted
  const [productFilter, setProductFilter] = useState<string>(() => {
    return readFilters()?.productFilter ?? 'todos'
  })

  // n°80: búsqueda de texto incremental
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // n°85: panel estadístico colapsable
  const [statsOpen, setStatsOpen] = useState(false)

  // n°238: agrupación por semana
  const [groupBy, setGroupBy] = useState<'dia' | 'semana'>('dia')

  // n°76/137: timer para limpiar deletedLogBuffer
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Persiste todos los filtros en localStorage
  useEffect(() => {
    try {
      localStorage.setItem(FILTER_KEY, JSON.stringify({ typeFilter, rangeFilter, productFilter }))
    } catch {
      // storage no disponible — silencioso
    }
  }, [typeFilter, rangeFilter, productFilter])

  // Limpia productFilter cuando se pasa a 'medida'
  useEffect(() => {
    if (typeFilter === 'medida') setProductFilter('todos')
  }, [typeFilter])

  // n°76: cuando deletedLogBuffer se llena, iniciar timer de 5s
  useEffect(() => {
    if (state.deletedLogBuffer) {
      if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current)
      deleteTimerRef.current = setTimeout(() => {
        dispatch({ t: 'clearDeletedLogBuffer' })
      }, 5000)
    }
    return () => {
      if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current)
    }
  }, [state.deletedLogBuffer, dispatch])

  // Memoiza productos con dosis registradas
  const products = useMemo(
    () => [
      ...new Set(
        state.log.flatMap((g) =>
          g.items.filter((it) => (it.type === 'dose' || it.type === 'skip') && it.product).map((it) => it.product!),
        ),
      ),
    ],
    [state.log],
  )

  const showProductFilter = products.length >= 2 && typeFilter !== 'medida'

  // filtro de producto EFECTIVO
  const pf = showProductFilter && products.includes(productFilter) ? productFilter : 'todos'

  // n°205 DST fix: cutoff usando startOfDay para N días calendario atrás
  const cutoff = useMemo(() => {
    if (rangeFilter === 'all') return 0
    const today = new Date(state.todayTs)
    const from = new Date(today.getFullYear(), today.getMonth(), today.getDate() - rangeFilter)
    return from.getTime()
  }, [rangeFilter, state.todayTs])

  // n°81: filtrado — ahora incluye rangeFilter='all'
  const filtered = useMemo(
    () =>
      state.log
        .map((g) => ({
          ...g,
          items: g.items.filter((it) => {
            if (it.ts < cutoff) return false
            if (typeFilter !== 'todo' && it.type !== typeFilter) return false
            if (pf !== 'todos' && ((it.type !== 'dose' && it.type !== 'skip') || it.product !== pf)) return false
            // n°80: búsqueda de texto
            if (searchQuery.trim()) {
              const q = searchQuery.toLowerCase()
              const match = it.n.toLowerCase().includes(q) ||
                it.u.toLowerCase().includes(q) ||
                (it.note?.toLowerCase().includes(q) ?? false)
              if (!match) return false
            }
            return true
          }),
        }))
        .filter((g) => g.items.length > 0),
    [state.log, cutoff, typeFilter, pf, state.todayTs, searchQuery],
  )

  // n°265: useDeferredValue para skeleton
  const deferredFiltered = useDeferredValue(filtered)
  const isLoading = !mounted

  const isEmpty = deferredFiltered.length === 0
  const totalRecords = deferredFiltered.reduce((acc, g) => acc + g.items.length, 0)

  const accentColor = state.curGoal ? CATEGORY_COLOR[state.curGoal] : 'var(--brand-700)'

  // n°183: última dosis para FAB "Repetir última"
  const lastDose = useMemo(() => {
    for (const g of deferredFiltered) {
      for (const it of g.items) {
        if (it.type === 'dose') return it
      }
    }
    return null
  }, [deferredFiltered])

  // n°226: hidratación del día
  const todayIsoKey = isoKey(state.todayTs)
  const waterCount = state.nutrition[todayIsoKey]?.water ?? 0
  const WATER_GOAL = 8

  // n°85: estadísticas por medida
  const measureStats = useMemo(() => {
    if (typeFilter !== 'medida') return null
    const byName: Record<string, { first: number; last: number; firstTs: number; lastTs: number }> = {}
    for (const g of deferredFiltered) {
      for (const it of g.items) {
        if (it.type !== 'medida') continue
        // parse value (e.g. "82.4 kg" → 82.4)
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
      const neutral = delta === 0
      return { name, first, last, delta, positive, neutral }
    })
  }, [typeFilter, deferredFiltered])

  // n°238: agrupación por semana
  const groupedBySemana = useMemo(() => {
    if (groupBy === 'dia') return null
    const weeks: { weekKey: string; items: typeof deferredFiltered[0]['items']; dateKeys: string[] }[] = []
    for (const g of deferredFiltered) {
      const wk = getISOWeekKey(g.dateKey)
      const existing = weeks.find((w) => w.weekKey === wk)
      if (existing) {
        existing.items = [...existing.items, ...g.items].sort((a, b) => b.ts - a.ts)
        existing.dateKeys.push(g.dateKey)
      } else {
        weeks.push({ weekKey: wk, items: [...g.items], dateKeys: [g.dateKey] })
      }
    }
    return weeks
  }, [groupBy, deferredFiltered])

  function handleDelete(id: string) {
    tapHaptic()
    // n°76: flow: confirm-delete sheet → deleteLog action (modified in store) → fills deletedLogBuffer → toast + timer
    dispatch({ t: 'sheet', sheet: 'confirm-delete', arg: id })
  }

  function handleUndoDelete() {
    if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current)
    dispatch({ t: 'undoDeleteLog' })
  }

  return (
    <div className="scroll has-nav">
      {/* inject shimmer keyframes */}
      <style>{skeletonKeyframes}</style>

      {/* n°76: toast de borrado con deshacer */}
      <AnimatePresence>
        {state.deletedLogBuffer && (
          <motion.div
            key="undo-toast"
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            style={{
              position: 'fixed',
              top: 12,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 1000,
              background: 'var(--ink-700)',
              color: '#fff',
              borderRadius: 'var(--r-md)',
              padding: '10px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              boxShadow: 'var(--e3)',
              whiteSpace: 'nowrap',
              fontSize: 14,
            }}
          >
            <span>Registro borrado</span>
            <button
              type="button"
              onClick={handleUndoDelete}
              style={{
                background: 'var(--brand-500)',
                color: '#fff',
                border: 'none',
                borderRadius: 'var(--r-sm)',
                padding: '3px 10px',
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              Deshacer
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* cabecera */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28 }}
        style={{ marginBottom: 20 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h1 className="h1" style={{ color: 'var(--ink-900)', marginBottom: 4 }}>
            Tu diario
          </h1>
          {/* n°80: icono búsqueda */}
          <button
            type="button"
            aria-label={showSearch ? 'Cerrar búsqueda' : 'Buscar en el diario'}
            onClick={() => { setShowSearch((v) => !v); if (showSearch) setSearchQuery('') }}
            style={{
              background: showSearch ? 'color-mix(in srgb, var(--brand-500) 12%, transparent)' : 'none',
              border: '1px solid var(--ink-200)',
              borderRadius: 'var(--r-sm)',
              padding: '6px 8px',
              cursor: 'pointer',
              color: showSearch ? 'var(--brand-700)' : 'var(--ink-400)',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <Glyph name="medidas" size={16} color={showSearch ? 'var(--brand-700)' : 'var(--ink-400)'} />
          </button>
        </div>
        <p className="sm" style={{ color: 'var(--ink-400)' }}>
          {todayLabel(state.todayTs)}
        </p>

        {/* n°80: campo de búsqueda */}
        <AnimatePresence>
          {showSearch && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              style={{ overflow: 'hidden', marginTop: 8 }}
            >
              <div style={{ position: 'relative' }}>
                <input
                  autoFocus
                  type="search"
                  placeholder="Buscar en el diario…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '8px 36px 8px 12px',
                    borderRadius: 'var(--r-md)',
                    border: '1.5px solid var(--brand-500)',
                    background: 'var(--bg)',
                    color: 'var(--ink-900)',
                    fontSize: 14,
                    outline: 'none',
                  }}
                />
                {searchQuery && (
                  <button
                    type="button"
                    aria-label="Limpiar búsqueda"
                    onClick={() => setSearchQuery('')}
                    style={{
                      position: 'absolute',
                      right: 8,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--ink-400)',
                      fontSize: 18,
                      lineHeight: 1,
                    }}
                  >
                    ×
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* chips de filtro — tipo */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.08 }}
        style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}
      >
        {TYPE_OPTIONS.map((o) => (
          <Chip
            key={o.value}
            label={o.label}
            active={typeFilter === o.value}
            onClick={() => { tapHaptic(); setTypeFilter(o.value) }}
          />
        ))}
      </motion.div>

      {/* chips de producto */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap',
          marginBottom: 8,
          minHeight: showProductFilter ? undefined : 0,
          overflow: 'hidden',
          visibility: showProductFilter ? 'visible' : 'hidden',
          height: showProductFilter ? 'auto' : 0,
        }}
        aria-hidden={!showProductFilter}
      >
        <Chip
          label="Todos"
          active={productFilter === 'todos'}
          onClick={() => { tapHaptic(); setProductFilter('todos') }}
        />
        {products.map((p) => (
          <Chip
            key={p}
            label={p}
            color={CATEGORY_COLOR[PEPTIDES[p]?.cat ?? 'Explorar']}
            active={productFilter === p}
            onClick={() => { tapHaptic(); setProductFilter(p) }}
          />
        ))}
      </div>

      {/* rango + conteo + toggle semana */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.12 }}
        style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}
      >
        <Segmented<RangeFilter>
          options={RANGE_OPTIONS}
          value={rangeFilter}
          onChange={setRangeFilter}
        />
        {!isEmpty && (
          <span className="sm" style={{ color: 'var(--ink-300)', whiteSpace: 'nowrap', flexShrink: 0 }}>
            {totalRecords} registro{totalRecords !== 1 ? 's' : ''}
          </span>
        )}
        {/* n°238: toggle Día/Semana cuando rango ≥30 */}
        {(rangeFilter === 30 || rangeFilter === 90 || rangeFilter === 'all') && !isEmpty && (
          <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
            {(['dia', 'semana'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setGroupBy(v)}
                style={{
                  padding: '3px 10px',
                  borderRadius: 'var(--r-sm)',
                  border: '1px solid var(--ink-200)',
                  background: groupBy === v ? 'var(--ink-900)' : 'none',
                  color: groupBy === v ? '#fff' : 'var(--ink-400)',
                  fontSize: 12,
                  cursor: 'pointer',
                  fontWeight: groupBy === v ? 700 : 400,
                }}
              >
                {v === 'dia' ? 'Día' : 'Semana'}
              </button>
            ))}
          </div>
        )}
      </motion.div>

      {/* n°226: fila de hidratación cuando typeFilter='todo' */}
      {typeFilter === 'todo' && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 16,
          padding: '10px 14px',
          borderRadius: 'var(--r-md)',
          background: 'color-mix(in srgb, var(--brand-500) 7%, transparent)',
          border: '1px solid color-mix(in srgb, var(--brand-500) 16%, transparent)',
        }}>
          <span className="sm" style={{ color: 'var(--ink-700)', fontWeight: 600, flexShrink: 0 }}>
            Hoy: {waterCount} vasos
          </span>
          <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'var(--ink-100)', overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${Math.min(100, (waterCount / WATER_GOAL) * 100)}%`,
              background: 'var(--brand-500)',
              borderRadius: 2,
              transition: 'width 0.3s',
            }} />
          </div>
          <span className="sm" style={{ color: 'var(--ink-300)', flexShrink: 0 }}>/{WATER_GOAL}</span>
          <button
            type="button"
            aria-label="Agregar un vaso de agua"
            onClick={() => { tapHaptic(); dispatch({ t: 'water', delta: 1 }) }}
            style={{
              background: 'var(--brand-500)',
              color: '#fff',
              border: 'none',
              borderRadius: 'var(--r-sm)',
              width: 28,
              height: 28,
              fontSize: 18,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            +
          </button>
        </div>
      )}

      {/* n°183: FAB 'Repetir última dosis' */}
      {lastDose && (
        <div style={{
          marginBottom: 16,
          padding: '10px 14px',
          borderRadius: 'var(--r-md)',
          background: 'color-mix(in srgb, var(--brand-700) 8%, transparent)',
          border: '1px solid color-mix(in srgb, var(--brand-700) 18%, transparent)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          <span className="sm" style={{ color: 'var(--ink-700)', flex: 1, fontWeight: 500 }}>
            Repetir: {lastDose.product ?? lastDose.n} · {lastDose.u.split(' · ')[1] ?? ''}
          </span>
          <button
            type="button"
            onClick={() => {
              tapHaptic()
              dispatch({ t: 'sheet', sheet: 'registrar', arg: lastDose.product ?? undefined })
            }}
            style={{
              background: 'var(--brand-500)',
              color: '#fff',
              border: 'none',
              borderRadius: 'var(--r-sm)',
              padding: '5px 14px',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Registrar
          </button>
        </div>
      )}

      {/* n°85: panel estadístico cuando typeFilter='medida' */}
      {typeFilter === 'medida' && measureStats && measureStats.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <button
            type="button"
            onClick={() => setStatsOpen((v) => !v)}
            style={{
              width: '100%',
              background: 'color-mix(in srgb, var(--brand-500) 8%, transparent)',
              border: '1px solid color-mix(in srgb, var(--brand-500) 18%, transparent)',
              borderRadius: 'var(--r-md)',
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              color: 'var(--ink-700)',
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            Resumen del período
            <span style={{ fontSize: 16, transition: 'transform 0.2s', display: 'inline-block', transform: statsOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>›</span>
          </button>
          <AnimatePresence>
            {statsOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                style={{ overflow: 'hidden' }}
              >
                <div style={{
                  padding: '10px 14px',
                  border: '1px solid var(--ink-100)',
                  borderTop: 'none',
                  borderRadius: '0 0 var(--r-md) var(--r-md)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}>
                  {measureStats.map((s) => (
                    <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span className="sm" style={{ flex: 1, color: 'var(--ink-700)', fontWeight: 500 }}>{s.name}</span>
                      <span className="mono sm" style={{ color: 'var(--ink-400)' }}>{s.first} → {s.last}</span>
                      <span className="mono sm" style={{
                        color: s.neutral ? 'var(--ink-300)' : s.positive ? 'var(--success)' : 'var(--error)',
                        fontWeight: 700,
                        minWidth: 40,
                        textAlign: 'right',
                      }}>
                        {s.delta > 0 ? '+' : ''}{s.delta.toFixed(1)}
                        {!s.neutral && (s.positive ? ' ↑' : ' ↓')}
                      </span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* skeleton + estado vacío + timeline */}
      <AnimatePresence mode="wait">
        {isLoading ? (
          <motion.div key="skeleton" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {[...Array(5)].map((_, i) => <SkeletonItem key={i} />)}
          </motion.div>
        ) : isEmpty ? (
          <motion.div key="empty" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <EmptyState {...emptyProps(typeFilter, pf, dispatch, accentColor, () => setProductFilter('todos'))} />
            {/* n°89: CTA secundario 'Ampliar a 30 días' cuando rangeFilter=7 */}
            {rangeFilter === 7 && (
              <div style={{ marginTop: 16, textAlign: 'center' }}>
                <button
                  type="button"
                  onClick={() => { tapHaptic(); setRangeFilter(30) }}
                  style={{
                    background: 'none',
                    border: '1px solid var(--ink-200)',
                    borderRadius: 'var(--r-sm)',
                    padding: '8px 18px',
                    color: 'var(--ink-400)',
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  Ampliar a 30 días
                </button>
              </div>
            )}
          </motion.div>
        ) : (
          /* n°238: timeline (por día o por semana) */
          <motion.div
            key="timeline"
            variants={stagger}
            initial="initial"
            animate="animate"
            role="list"
            aria-label={rangeFilter === 'all' ? 'Todos los registros' : `Registros de los últimos ${rangeFilter} días`}
            style={{ position: 'relative', overflow: 'hidden' }}
          >
            {/* línea vertical */}
            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                left: 50,
                top: 18,
                bottom: 18,
                width: 2,
                background: 'linear-gradient(to bottom, var(--border) 85%, transparent 100%)',
                zIndex: 0,
              }}
            />

            {groupBy === 'semana' && groupedBySemana ? (
              groupedBySemana.map((week) => (
                <motion.div key={week.weekKey} variants={itemAnim} style={{ marginBottom: 24 }}>
                  <div
                    className="agenda__day-label"
                    style={{ paddingLeft: 64, cursor: 'default' }}
                  >
                    {week.weekKey}
                    <span style={{ color: 'var(--ink-300)', fontWeight: 400, marginLeft: 6 }}>
                      · {week.items.length} registros
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {week.items.map((it) => (
                      <TimelineItem
                        key={it.id}
                        item={it}
                        onDelete={handleDelete}
                        groupLabel={week.weekKey}
                        dispatch={dispatch}
                      />
                    ))}
                  </div>
                </motion.div>
              ))
            ) : (
              deferredFiltered.map((group) => {
                const label = groupLabel(group.dateKey, state.todayTs)
                const headingId = `grp-head-${group.dateKey}`
                return (
                  <motion.div key={group.dateKey} variants={itemAnim} style={{ marginBottom: 24 }}>
                    {/* n°235: group header como botón para abrir DayDetail */}
                    <button
                      id={headingId}
                      type="button"
                      className="agenda__day-label"
                      onClick={() => {
                        tapHaptic()
                        dispatch({ t: 'sheet', sheet: 'day-detail', arg: group.dateKey })
                      }}
                      style={{
                        paddingLeft: 64,
                        width: '100%',
                        textAlign: 'left',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                      aria-label={`Ver detalle del día ${label}`}
                    >
                      <span>
                        {label}
                        <span style={{ color: 'var(--ink-300)', fontWeight: 400, marginLeft: 6 }}>
                          · {group.items.length}
                        </span>
                      </span>
                      {/* n°134: botón +Dosis en el header */}
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span
                          role="button"
                          tabIndex={0}
                          aria-label={`Agregar dosis al día ${label}`}
                          onClick={(e) => {
                            e.stopPropagation()
                            tapHaptic()
                            dispatch({ t: 'sheet', sheet: 'registrar', arg: group.dateKey })
                          }}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); dispatch({ t: 'sheet', sheet: 'registrar', arg: group.dateKey }) } }}
                          style={{
                            fontSize: 11,
                            color: 'var(--brand-700)',
                            fontWeight: 600,
                            padding: '2px 7px',
                            borderRadius: 'var(--r-sm)',
                            border: '1px solid color-mix(in srgb, var(--brand-500) 25%, transparent)',
                            background: 'color-mix(in srgb, var(--brand-500) 8%, transparent)',
                          }}
                        >
                          +Dosis
                        </span>
                        <span style={{ color: 'var(--ink-300)', fontSize: 16, paddingRight: 4 }}>›</span>
                      </span>
                    </button>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {group.items.map((it) => (
                        <TimelineItem
                          key={it.id}
                          item={it}
                          onDelete={handleDelete}
                          groupLabel={label}
                          dispatch={dispatch}
                        />
                      ))}
                    </div>
                  </motion.div>
                )
              })
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <Disclaimer kind="measure" />
    </div>
  )
}
