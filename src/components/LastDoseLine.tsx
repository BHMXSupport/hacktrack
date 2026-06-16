// LastDoseLine — "Última toma" en Inicio: previene la duda "¿ya me la apliqué? ¿cuándo? ¿cuánto?".
// Solo lectura, del propio diario. (UX/UI del equipo multiagente — Loop 04.)
// Loop 141: historial últimas 3 dosis expandible con borrado inline
// Loop 142: tappable → diario + deshacer 15 min
// Loop 143: morphing transition null↔línea + fade del tiempo
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useApp } from '../lib/store'
import { staggerItem, spring, dur, ease } from '../lib/motion'

function fmtAgo(ts: number, now: number): string {
  const min = Math.floor((now - ts) / 60000)
  if (min < 1) return 'hace un momento'
  if (min < 60) return `hace ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `hace ${h} h${min % 60 ? ` ${min % 60} min` : ''}`
  const d = Math.floor(h / 24)
  if (d === 1) return 'ayer'
  if (d < 7) return `hace ${d} días`
  return new Date(ts).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
}

// Icono papelera inline (sin dep externa)
function IcTrash({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M6 2h4M2 4h12M5 4l.5 9h5l.5-9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function LastDoseLine() {
  const { state, dispatch } = useApp()
  const [now, setNow] = useState(() => Date.now())
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [])

  // Recopilar todas las dosis pasadas ordenadas desc
  const pastDoses: { u: string; ts: number; id: string }[] = []
  for (const g of state.log) {
    for (const it of g.items) {
      if (it.type === 'dose' && it.ts <= now) {
        pastDoses.push({ u: it.u, ts: it.ts, id: it.id })
      }
    }
  }
  pastDoses.sort((a, b) => b.ts - a.ts)

  const last = pastDoses[0] ?? null
  if (!last) return null

  const ago = fmtAgo(last.ts, now)
  // ventana de deshacer: 15 min
  const canUndo = now - last.ts < 15 * 60_000

  // Loop 142: navega al diario (tab diario)
  const handleTap = () => {
    if (expanded) {
      setExpanded(false)
      return
    }
    // tap directo sin expansión → navega al diario
    dispatch({ t: 'tab', tab: 'diario' as import('../lib/store').TabId })
  }

  const handleToggleExpand = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation()
    setExpanded((v) => !v)
  }

  // historial: últimas 3 (excluyendo la primera ya visible)
  const history = pastDoses.slice(1, 4)

  return (
    // Loop 143: fade+x de entrada/salida del componente completo (AnimatePresence en el padre / Home)
    <motion.div
      variants={staggerItem}
      layout
      style={{
        borderRadius: 'var(--r-sm)',
        background: 'var(--ink-100)',
        boxShadow: 'var(--e1)',
        overflow: 'hidden',
      }}
    >
      {/* Fila principal */}
      <button
        type="button"
        onClick={handleTap}
        aria-expanded={expanded}
        aria-label={`Última toma: ${last.u}, ${ago}. ${expanded ? 'Contraer' : 'Expandir'} historial`}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 14px',
          width: '100%',
          background: 'none',
          border: 0,
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <span style={{ width: 7, height: 7, borderRadius: 999, background: 'var(--ink-300)', flexShrink: 0 }} aria-hidden="true" />
        <span className="sm" style={{ color: 'var(--ink-400)' }} aria-hidden="true">Última toma:</span>
        <span className="sm" style={{ color: 'var(--ink-700)', fontWeight: 600 }} aria-hidden="true">{last.u}</span>

        {/* Loop 143: fade del tiempo con key para re-animar al cambiar */}
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={ago}
            className="sm mono"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0, transition: { duration: dur.fast, ease: ease.decelerate } }}
            exit={{ opacity: 0, y: 4, transition: { duration: dur.fast, ease: ease.accelerate } }}
            style={{ color: 'var(--ink-400)', marginLeft: 'auto', flexShrink: 0 }}
            aria-hidden="true"
          >
            {ago}
          </motion.span>
        </AnimatePresence>

        {/* Loop 142: botón deshacer si <15 min */}
        {canUndo && (
          <motion.button
            type="button"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1, transition: spring.ui }}
            onClick={(e) => {
              e.stopPropagation()
              dispatch({ t: 'deleteLog', id: last.id })
            }}
            className="sm"
            aria-label="Deshacer última toma"
            style={{
              background: 'var(--ink-200)',
              border: 0,
              borderRadius: 'var(--r-sm)',
              color: 'var(--ink-700)',
              padding: '2px 8px',
              cursor: 'pointer',
              fontWeight: 500,
              flexShrink: 0,
              marginLeft: 6,
            }}
          >
            Deshacer
          </motion.button>
        )}

        {/* Indicador expandir (solo si hay historial) */}
        {history.length > 0 && (
          <motion.span
            onClick={handleToggleExpand}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleToggleExpand(e) }}
            role="button"
            tabIndex={0}
            animate={{ rotate: expanded ? 180 : 0, transition: spring.ui }}
            aria-hidden="true"
            style={{
              display: 'flex',
              alignItems: 'center',
              color: 'var(--ink-400)',
              cursor: 'pointer',
              flexShrink: 0,
              marginLeft: canUndo ? 4 : 6,
            }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </motion.span>
        )}
      </button>

      {/* Loop 141: historial expandible — últimas 3 dosis con borrado inline */}
      <AnimatePresence initial={false}>
        {expanded && history.length > 0 && (
          <motion.div
            key="history"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1, transition: { duration: dur.base, ease: ease.decelerate } }}
            exit={{ height: 0, opacity: 0, transition: { duration: dur.fast, ease: ease.accelerate } }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ borderTop: '1px solid var(--ink-200)', padding: '4px 0 6px' }}>
              {history.map((dose) => (
                <div
                  key={dose.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 14px',
                  }}
                >
                  <span style={{ width: 5, height: 5, borderRadius: 999, background: 'var(--ink-200)', flexShrink: 0 }} aria-hidden="true" />
                  <span className="sm" style={{ color: 'var(--ink-700)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {dose.u}
                  </span>
                  <span className="sm mono" style={{ color: 'var(--ink-400)', flexShrink: 0 }}>
                    {fmtAgo(dose.ts, now)}
                  </span>
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.88 }}
                    onClick={() => dispatch({ t: 'deleteLog', id: dose.id })}
                    aria-label={`Borrar toma: ${dose.u}`}
                    style={{
                      background: 'none',
                      border: 0,
                      color: 'var(--ink-400)',
                      cursor: 'pointer',
                      padding: '2px 4px',
                      display: 'flex',
                      alignItems: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <IcTrash size={14} />
                  </motion.button>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
