import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useApp } from '../lib/store'
import { Chip, Segmented, Disclaimer } from '../components/controls'
import { dayLabel } from '../lib/cadence'
import { MON, WD, MEASURE_ICON } from '../lib/catalog'
import { Glyph } from '../components/glyphs'
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
  // Deriva el id del glyph: dose → 'dose'; medida conocida → su icon; fallback a ic (glyph id o default).
  const glyphId: string =
    item.type === 'dose'
      ? 'dose'
      : (MEASURE_ICON[item.n]?.icon ?? item.ic)

  return (
    <div
      aria-hidden="true"
      style={{
        width: 36,
        height: 36,
        borderRadius: '50%',
        background: item.cat + '22',  // 13% opacidad del color de acento
        border: `1.5px solid ${item.cat}44`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <Glyph name={glyphId} color={item.cat} size={18} />
    </div>
  )
}

// ── item de timeline ─────────────────────────────────────────────────────────
function TimelineItem({ item, onDelete }: { item: LogItem; onDelete: (id: string) => void }) {
  return (
    <motion.article
      variants={itemAnim}
      style={{
        display: 'flex',
        gap: 12,
        alignItems: 'flex-start',
        position: 'relative',
        zIndex: 1,
      }}
    >
      {/* hora */}
      <div
        className="mono sm"
        style={{
          width: 52,
          flexShrink: 0,
          paddingTop: 10,
          textAlign: 'right',
          color: 'var(--ink-400)',
          fontSize: 12,
        }}
      >
        {item.t}
      </div>

      {/* nodo de la línea vertical */}
      <div
        style={{
          position: 'absolute',
          left: 46,
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

      {/* tarjeta */}
      <div
        className="card"
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 14px',
          cursor: 'pointer',
        }}
        role="button"
        tabIndex={0}
        aria-label={`Eliminar registro: ${item.n}`}
        onClick={() => onDelete(item.id)}
        onKeyDown={(e) => e.key === 'Enter' && onDelete(item.id)}
      >
        <CatCircle item={item} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="body" style={{ fontWeight: 600, color: 'var(--ink-900)', fontSize: 14 }}>
            {item.n}
          </div>
          <div className="mono sm" style={{ color: 'var(--ink-400)', marginTop: 2 }}>
            {item.u}
          </div>
        </div>
      </div>
    </motion.article>
  )
}

// ── componente principal ─────────────────────────────────────────────────────
export function Diario() {
  const { state, dispatch } = useApp()
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('todo')
  const [rangeFilter, setRangeFilter] = useState<RangeFilter>(7)

  // filtrado por FECHA real (item.ts) dentro del rango, luego por tipo
  const cutoff = state.todayTs - rangeFilter * 86400000
  const filtered = state.log
    .map((g) => ({
      ...g,
      items: g.items.filter((it) => {
        if (it.ts < cutoff) return false
        if (typeFilter === 'todo') return true
        return it.type === typeFilter
      }),
    }))
    .filter((g) => g.items.length > 0)

  const isEmpty = filtered.length === 0

  function handleDelete(id: string) {
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
        <h1 className="h1" style={{ color: 'var(--brand-700)', marginBottom: 4 }}>
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
        style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}
      >
        {TYPE_OPTIONS.map((o) => (
          <Chip
            key={o.value}
            label={o.label}
            active={typeFilter === o.value}
            onClick={() => setTypeFilter(o.value)}
          />
        ))}
      </motion.div>

      {/* segmented — rango */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.12 }}
        style={{ marginBottom: 24 }}
      >
        <Segmented<RangeFilter>
          options={RANGE_OPTIONS}
          value={rangeFilter}
          onChange={setRangeFilter}
        />
      </motion.div>

      {/* estado vacío */}
      <AnimatePresence mode="wait">
        {isEmpty ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '48px 24px',
              gap: 12,
              textAlign: 'center',
            }}
          >
            <Glyph name="medidas" color="var(--ink-300)" size={40} />
            <p className="body" style={{ color: 'var(--ink-400)', maxWidth: 240 }}>
              {typeFilter === 'todo'
                ? 'Aún no hay registros. Toca + para empezar.'
                : typeFilter === 'dose'
                ? 'Sin dosis en este rango. Toca + para registrar.'
                : 'Sin medidas en este rango. Toca + para registrar.'}
            </p>
          </motion.div>
        ) : (
          /* timeline */
          <motion.div
            key="timeline"
            variants={stagger}
            initial="initial"
            animate="animate"
            style={{ position: 'relative' }}
          >
            {/* línea vertical de fondo */}
            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                left: 50,
                top: 0,
                bottom: 0,
                width: 2,
                background: 'var(--border)',
                zIndex: 0,
              }}
            />

            {filtered.map((group) => (
              <motion.div key={group.dateKey} variants={itemAnim} style={{ marginBottom: 24 }}>
                {/* cabecera del grupo */}
                <div
                  className="sm"
                  style={{
                    fontWeight: 700,
                    color: 'var(--ink-700)',
                    marginBottom: 12,
                    paddingLeft: 68,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    fontSize: 11,
                  }}
                >
                  {groupLabel(group.dateKey, state.todayTs)}
                </div>

                {/* items del grupo */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {group.items.map((it) => (
                    <TimelineItem key={it.id} item={it} onDelete={handleDelete} />
                  ))}
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* disclaimer: tus datos, no una promesa de resultado */}
      <Disclaimer kind="measure" />
    </div>
  )
}
