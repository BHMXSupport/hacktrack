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
  // Loop 142: cuando ya hay horas, omitir los minutos — evita 'hace 23 h 45 min' (la cadena más larga
  // que aplastaba la unidad). El minuto exacto es ruido a esa escala.
  if (h < 24) return `hace ${h} h`
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
  const pastDoses: { u: string; ts: number; id: string; note?: string; effect?: string }[] = []
  for (const g of state.log) {
    for (const it of g.items) {
      if (it.type === 'dose' && it.ts <= now) {
        pastDoses.push({ u: it.u, ts: it.ts, id: it.id, note: it.note, effect: it.effect })
      }
    }
  }
  pastDoses.sort((a, b) => b.ts - a.ts)

  const last = pastDoses[0] ?? null
  if (!last) return null

  const ago = fmtAgo(last.ts, now)
  // ventana de deshacer: 15 min
  const canUndo = now - last.ts < 15 * 60_000
  // loop 138/139: nota y efecto disponibles solo si la dosis es reciente (≤24h)
  // Ahora viven detrás del MISMO chevron que el historial (un solo punto de expansión, sin auto-abrir).
  const isRecent = now - last.ts < 24 * 60 * 60_000
  const hasNote = isRecent && !!last.note
  const hasEffect = isRecent && !!last.effect
  const showNote = expanded && hasNote
  const showEffect = expanded && hasEffect

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
  // hay algo que expandir si hay historial o nota/efecto recientes
  const hasExpandable = history.length > 0 || hasNote || hasEffect

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
      {/* Fila principal — div role=button para no anidar el chevron (botón dentro de botón = HTML inválido) */}
      <div
        role="button"
        tabIndex={0}
        onClick={handleTap}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleTap() } }}
        aria-expanded={expanded}
        aria-label={`Última toma: ${last.u}, ${ago}. ${expanded ? 'Contraer' : 'Expandir'} historial`}
        style={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          rowGap: 4,
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
        <span className="sm" style={{ color: 'var(--ink-400)', flexShrink: 0 }} aria-hidden="true">Última toma:</span>
        {/* anti-bleed: la unidad/dosis se encoge con ellipsis en vez de empujar el tiempo/Deshacer/chevron fuera */}
        <span
          className="sm"
          style={{ color: 'var(--ink-700)', fontWeight: 600, minWidth: 0, flex: '0 1 auto', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          aria-hidden="true"
        >
          {last.u}
        </span>

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

        {/* Indicador expandir (historial y/o nota/efecto) — botón real, ya no anidado */}
        {hasExpandable && (
          <motion.button
            type="button"
            onClick={handleToggleExpand}
            animate={{ rotate: expanded ? 180 : 0, transition: spring.ui }}
            aria-label={expanded ? 'Contraer historial' : 'Expandir historial'}
            style={{
              display: 'flex',
              alignItems: 'center',
              background: 'none',
              border: 0,
              padding: 0,
              color: 'var(--ink-400)',
              cursor: 'pointer',
              flexShrink: 0,
              marginLeft: canUndo ? 4 : 6,
            }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </motion.button>
        )}
      </div>

      {/* Loop 138/139: nota y efecto de la última dosis (si es reciente ≤24h) */}
      <AnimatePresence initial={false}>
        {(showNote || showEffect) && (
          <motion.div
            key="dose-meta"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ padding: '2px 14px 8px', display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
              {showNote && (
                <span
                  className="sm"
                  style={{ color: 'var(--ink-400)', fontStyle: 'italic', lineHeight: 1.4, maxWidth: '100%', overflowWrap: 'anywhere' }}
                  aria-label={`Nota: ${last.note}`}
                >
                  {last.note}
                </span>
              )}
              {showEffect && (
                <span
                  className="sm"
                  style={{
                    display: 'inline-flex', alignItems: 'center',
                    padding: '2px 8px', borderRadius: 999,
                    background: 'color-mix(in srgb, var(--brand-500) 10%, transparent)',
                    color: 'var(--brand-700)',
                    fontWeight: 500, fontSize: 11,
                    border: '1px solid color-mix(in srgb, var(--brand-500) 22%, transparent)',
                  }}
                  aria-label={`Efecto observado: ${last.effect}`}
                >
                  {last.effect}
                </span>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
