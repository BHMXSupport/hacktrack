import { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useApp } from '../lib/store'
import { Chip, Segmented, Disclaimer } from '../components/controls'
import { dayLabel } from '../lib/cadence'
import { MON, WD, MEASURE_ICON, CATEGORY_COLOR, PEPTIDES } from '../lib/catalog'
import { Glyph } from '../components/glyphs'
import { EmptyState } from '../components/EmptyState'
import { tapHaptic } from '../lib/haptics'
import type { LogItem } from '../lib/types'

// etiqueta humana del grupo a partir de su clave de fecha estable
function groupLabel(dateKey: string, todayTs: number): string {
  return dayLabel(new Date(dateKey + 'T00:00:00'), new Date(todayTs))
}

// ── animación stagger ────────────────────────────────────────────────────────
const stagger = { animate: { transition: { staggerChildren: 0.06 } } }
const itemAnim = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 } }

// ── tipos de filtro ──────────────────────────────────────────────────────────
type TypeFilter = 'todo' | 'dose' | 'medida'
type RangeFilter = 7 | 30

const TYPE_OPTIONS: { value: TypeFilter; label: string }[] = [
  { value: 'todo',   label: 'Todo' },
  { value: 'dose',   label: 'Dosis' },
  { value: 'medida', label: 'Medidas' },
]

const RANGE_OPTIONS: { value: RangeFilter; label: string }[] = [
  { value: 7,  label: '7 días' },
  { value: 30, label: '30 días' },
]

// ── clave de localStorage ────────────────────────────────────────────────────
const FILTER_KEY = 'hk_diario_filters'

function readFilters(): { typeFilter: TypeFilter; rangeFilter: RangeFilter } | null {
  try {
    const raw = localStorage.getItem(FILTER_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

// ── fecha localizada ─────────────────────────────────────────────────────────
function todayLabel(ts: number): string {
  const d = new Date(ts)
  const dow = WD[d.getDay()]  // 'Dom' | 'Lun' | …
  const day = d.getDate()
  const mon = MON[d.getMonth()]
  return `${dow}, ${day} de ${mon}`
}

// ── icono de categoría (SVG glyph, sin emojis) ───────────────────────────────
function CatCircle({ item }: { item: LogItem }) {
  // Deriva el id del glyph con tipado estricto
  const glyphId: string =
    item.type === 'dose'
      ? 'dose'
      : item.type === 'skip'
        ? 'skip'
        : (MEASURE_ICON[item.n]?.icon ?? item.ic ?? 'medidas')

  // Los skips usan color neutro
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

// ── item de timeline ─────────────────────────────────────────────────────────
function TimelineItem({
  item,
  onDelete,
  groupLabel: label,
}: {
  item: LogItem
  onDelete: (id: string) => void
  groupLabel: string
}) {
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

      {/* hora */}
      <div
        className="mono sm"
        style={{
          width: 52,
          flexShrink: 0,
          paddingTop: 10,
          textAlign: 'right',
          color: 'var(--ink-400)',
        }}
      >
        {item.t}
      </div>

      {/* nodo de la línea vertical — centrado sobre left:50, dot width:10 → left:45 */}
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

      {/* tarjeta — ya NO dispara borrado al tap general */}
      <div
        className="card"
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 14px',
          opacity: item.type === 'skip' ? 0.65 : 1,
        }}
      >
        <CatCircle item={item} />

        <div style={{ flex: 1, minWidth: 0 }}>
          {/* #45: quita fontSize inline; la clase .body ya da el tamaño */}
          <div className="body" style={{ fontWeight: 600, color: item.type === 'skip' ? 'var(--ink-400)' : 'var(--ink-900)' }}>
            {item.type === 'skip' ? 'Dosis saltada (intencional)' : item.n}
          </div>
          {/* #45: quita fontSize inline; .mono .sm ya da el tamaño */}
          <div className="mono sm" style={{ color: 'var(--ink-400)', marginTop: 2 }}>
            {item.type === 'skip' ? item.u : item.u}
          </div>
        </div>

        {/* botón papelera — siempre visible, aria-label descriptivo */}
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
      cta: {
        label: 'Ver todos',
        onClick: clearProduct,
      },
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
  // medida
  return {
    glyph: 'medidas',
    color: accentColor,
    title: 'Sin medidas en este rango',
    subtitle: 'Cambia el rango o registra algo nuevo.',
    cta: { label: 'Registrar medida', onClick: () => dispatch({ t: 'sheet', sheet: 'medida' }) },
  }
}

// ── componente principal ─────────────────────────────────────────────────────
export function Diario() {
  const { state, dispatch } = useApp()

  // Inicializa filtros desde localStorage (con fallback seguro)
  const [typeFilter, setTypeFilter] = useState<TypeFilter>(() => {
    return readFilters()?.typeFilter ?? 'todo'
  })
  const [rangeFilter, setRangeFilter] = useState<RangeFilter>(() => {
    return readFilters()?.rangeFilter ?? 7
  })
  const [productFilter, setProductFilter] = useState<string>('todos')

  // Persiste typeFilter y rangeFilter en localStorage cuando cambian
  useEffect(() => {
    try {
      localStorage.setItem(FILTER_KEY, JSON.stringify({ typeFilter, rangeFilter }))
    } catch {
      // storage no disponible — silencioso
    }
  }, [typeFilter, rangeFilter])

  // Limpia productFilter cuando se pasa a 'medida'
  useEffect(() => {
    if (typeFilter === 'medida') {
      setProductFilter('todos')
    }
  }, [typeFilter])

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

  // filtro de producto EFECTIVO: no aplica si la fila está oculta o si el producto ya no existe
  const pf = showProductFilter && products.includes(productFilter) ? productFilter : 'todos'

  // filtrado por FECHA real (item.ts) dentro del rango, luego por tipo y producto
  const cutoff = state.todayTs - rangeFilter * 86400000
  const filtered = useMemo(
    () =>
      state.log
        .map((g) => ({
          ...g,
          items: g.items.filter((it) => {
            if (it.ts < cutoff) return false
            // 'skip' solo aparece en 'todo', no en 'dose' ni 'medida'
            if (typeFilter !== 'todo' && it.type !== typeFilter) return false
            // filtro de producto: dose o skip del producto seleccionado
            if (pf !== 'todos' && ((it.type !== 'dose' && it.type !== 'skip') || it.product !== pf)) return false
            return true
          }),
        }))
        .filter((g) => g.items.length > 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.log, cutoff, typeFilter, pf, state.todayTs],
  )

  const isEmpty = filtered.length === 0
  const totalRecords = filtered.reduce((acc, g) => acc + g.items.length, 0)

  const accentColor = state.curGoal ? CATEGORY_COLOR[state.curGoal] : 'var(--brand-700)'

  function handleDelete(id: string) {
    tapHaptic()
    dispatch({ t: 'sheet', sheet: 'confirm-delete', arg: id })
  }

  return (
    <div className="scroll has-nav">
      {/* cabecera */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28 }}
        style={{ marginBottom: 20 }}
      >
        {/* #46: color cambiado de var(--brand-700) a var(--ink-900) */}
        <h1 className="h1" style={{ color: 'var(--ink-900)', marginBottom: 4 }}>
          Tu diario
        </h1>
        <p className="sm" style={{ color: 'var(--ink-400)' }}>
          {todayLabel(state.todayTs)}
        </p>
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
            onClick={() => {
              tapHaptic()
              setTypeFilter(o.value)
            }}
          />
        ))}
      </motion.div>

      {/* #47: chips de producto — siempre en el DOM para evitar CLS; visibilidad por opacity/height */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap',
          marginBottom: 8,
          // Ocupa espacio siempre pero el contenido sólo se muestra si aplica
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
          onClick={() => {
            tapHaptic()
            setProductFilter('todos')
          }}
        />
        {products.map((p) => (
          <Chip
            key={p}
            label={p}
            color={CATEGORY_COLOR[PEPTIDES[p]?.cat ?? 'Explorar']}
            active={productFilter === p}
            onClick={() => {
              tapHaptic()
              setProductFilter(p)
            }}
          />
        ))}
      </div>

      {/* #48: total de resultados + Segmented — flex space-between */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.12 }}
        style={{
          marginBottom: 20,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
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
      </motion.div>

      {/* estado vacío */}
      <AnimatePresence mode="wait">
        {isEmpty ? (
          <motion.div key="empty" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <EmptyState {...emptyProps(typeFilter, pf, dispatch, accentColor, () => setProductFilter('todos'))} />
          </motion.div>
        ) : (
          /* timeline */
          <motion.div
            key="timeline"
            variants={stagger}
            initial="initial"
            animate="animate"
            role="list"
            aria-label={`Registros de los últimos ${rangeFilter} días`}
            style={{ position: 'relative', overflow: 'hidden' }}
          >
            {/* línea vertical — top/bottom:18px, fade a transparent al final */}
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

            {filtered.map((group) => {
              const label = groupLabel(group.dateKey, state.todayTs)
              const headingId = `grp-head-${group.dateKey}`
              return (
                <motion.div key={group.dateKey} variants={itemAnim} style={{ marginBottom: 24 }}>
                  {/* #48+#49: cabecera del grupo con conteo; usa clase agenda__day-label */}
                  <div
                    id={headingId}
                    className="agenda__day-label"
                    style={{ paddingLeft: 64 }}
                  >
                    {label}
                    <span style={{ color: 'var(--ink-300)', fontWeight: 400, marginLeft: 6 }}>
                      · {group.items.length}
                    </span>
                  </div>

                  {/* items del grupo */}
                  <div
                    style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
                  >
                    {group.items.map((it) => (
                      <TimelineItem
                        key={it.id}
                        item={it}
                        onDelete={handleDelete}
                        groupLabel={label}
                      />
                    ))}
                  </div>
                </motion.div>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* disclaimer: tus datos, no una promesa de resultado */}
      <Disclaimer kind="measure" />
    </div>
  )
}
