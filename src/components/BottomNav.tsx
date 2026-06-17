// BottomNav — barra de navegación inferior.
// n=435: FAB con menú radial al long-press (Dosis / Medida / Comida).
// n=436: botón lupa de búsqueda global (despacha 'sheet' a 'search' — sheet definida en sheets/Search.tsx).
// n=458: badge de racha + mini-tira semanal en tabs Inicio/Diario.
import { motion, useReducedMotion, AnimatePresence } from 'framer-motion'
import { useEffect, useRef, useState, useCallback } from 'react'
import { useApp, computeStreak, weekStatus } from '../lib/store'
import type { TabId } from '../lib/store'
import { IcHome, IcDiary, IcProto, IcVida, IcFood, IcWeek } from './icons'
import { spring } from '../lib/motion'
import { dayProducts, doseTakenOnProduct } from '../lib/calendar'

const TABS: [TabId, string, (p: { className?: string }) => JSX.Element][] = [
  ['inicio', 'Inicio', IcHome],
  ['diario', 'Diario', IcDiary],
  ['protocolo', 'Progreso', IcProto],
  ['vida', 'Vida', IcVida],
  ['comida', 'Comida', IcFood],
  ['semana', 'Semana', IcWeek],
]

// Badge dot pulsante para dosis pendientes
function PendingBadge({ visible }: { visible: boolean }) {
  if (!visible) return null
  return (
    <motion.span
      aria-label="Dosis pendiente hoy"
      style={{
        position: 'absolute',
        top: 2,
        right: 2,
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: 'var(--brand-500)',
        display: 'block',
        pointerEvents: 'none',
      }}
      animate={{ scale: [1, 1.4, 1], opacity: [1, 0.6, 1] }}
      transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
    />
  )
}

// n=458: badge numérico de racha
function StreakBadge({ streak }: { streak: number }) {
  if (streak <= 0) return null
  return (
    <motion.span
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={spring.ui}
      style={{
        position: 'absolute',
        top: -2,
        right: -4,
        minWidth: 15,
        height: 15,
        borderRadius: 99,
        background: 'var(--brand-500)',
        color: 'white',
        fontSize: 9,
        fontWeight: 700,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 3px',
        lineHeight: 1,
        pointerEvents: 'none',
        border: '1.5px solid var(--bg)',
      }}
      aria-label={`${streak} días de racha`}
    >
      {streak > 99 ? '99+' : streak}
    </motion.span>
  )
}

// n=458: mini-tira semanal (7 puntos, 4px, verde/gris)
function WeekStrip({ days }: { days: boolean[] }) {
  return (
    <span
      style={{ display: 'flex', gap: 2, alignItems: 'center', pointerEvents: 'none' }}
      aria-hidden
    >
      {days.map((ok, i) => (
        <span
          key={i}
          style={{
            width: 4,
            height: 4,
            borderRadius: 999,
            background: ok ? 'var(--brand-500)' : 'var(--ink-200)',
            display: 'block',
          }}
        />
      ))}
    </span>
  )
}

// n=435: items del menú radial
interface RadialItem {
  label: string
  sheet: 'registrar' | 'medida' | 'agregar'
  angle: number // grados desde arriba (negativo = izquierda)
}

const RADIAL_ITEMS: RadialItem[] = [
  { label: 'Dosis', sheet: 'registrar', angle: -50 },
  { label: 'Medida', sheet: 'medida', angle: 0 },
  { label: 'Comida', sheet: 'agregar', angle: 50 },
]

const RADIUS = 72 // px de separación del FAB

function radialPos(angle: number) {
  const rad = ((angle - 90) * Math.PI) / 180
  return {
    x: Math.cos(rad) * RADIUS,
    y: Math.sin(rad) * RADIUS,
  }
}

// Bottom nav: 6 tabs (3 + FAB + 3) + FAB central que abre la hoja "Agregar".
export function BottomNav() {
  const { state, dispatch } = useApp()
  const reduce = useReducedMotion()

  // Derivar si hay dosis pendientes hoy
  const today = new Date(state.todayTs)
  const prods = dayProducts(state, today)
  const doneCount = prods.filter((p) => doseTakenOnProduct(state, today, p)).length
  const hasPending = prods.length > doneCount

  // n=458: racha y semana
  const streak = computeStreak(state.log, today)
  const week = weekStatus(state.log, today, true) // doseOnly

  // n=435: menú radial
  const [radialOpen, setRadialOpen] = useState(false)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const didLongPress = useRef(false)

  const onFabPointerDown = useCallback(() => {
    didLongPress.current = false
    longPressTimer.current = setTimeout(() => {
      didLongPress.current = true
      setRadialOpen(true)
    }, 350)
  }, [])

  const onFabPointerUp = useCallback(() => {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null }
  }, [])

  const onFabClick = useCallback(() => {
    if (didLongPress.current) { didLongPress.current = false; return }
    setRadialOpen(false)
    dispatch({ t: 'sheet', sheet: 'agregar' })
  }, [dispatch])

  // Cerrar menú radial al tap fuera
  useEffect(() => {
    if (!radialOpen) return
    const close = () => setRadialOpen(false)
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [radialOpen])

  const Tab = ([id, label, Icon]: (typeof TABS)[number]) => {
    const active = state.tab === id
    const isHome = id === 'inicio'
    const isDiario = id === 'diario'
    return (
      <button
        key={id}
        className={'navtab' + (active ? ' active' : '')}
        onClick={() => dispatch({ t: 'tab', tab: id })}
        style={{ position: 'relative' }}
        aria-current={active ? 'page' : undefined}
      >
        <motion.span
          animate={{ scale: active ? 1.1 : 1, y: active ? -1 : 0 }}
          transition={spring.ui}
          style={{ display: 'flex', position: 'relative', flexDirection: 'column', alignItems: 'center', gap: 2 }}
        >
          <span style={{ position: 'relative' }}>
            <Icon />
            {isHome && <PendingBadge visible={hasPending && !reduce} />}
            {/* n=458: badge de racha en tab Inicio */}
            {isHome && !reduce && <StreakBadge streak={streak} />}
          </span>
          {/* n=458: mini-tira semanal en tab Diario */}
          {isDiario && <WeekStrip days={week} />}
        </motion.span>
        {label}
      </button>
    )
  }

  return (
    <nav className="bottomnav">
      {/* n=435: menú radial sobre el FAB */}
      <AnimatePresence>
        {radialOpen && (
          <motion.div
            key="radial"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            style={{
              position: 'absolute',
              bottom: '100%',
              left: '50%',
              transform: 'translateX(-50%)',
              pointerEvents: 'none',
              zIndex: 100,
            }}
          >
            {RADIAL_ITEMS.map((item, i) => {
              const { x, y } = radialPos(item.angle)
              return (
                <motion.button
                  key={item.label}
                  initial={{ opacity: 0, x: 0, y: 0, scale: 0.6 }}
                  animate={{ opacity: 1, x, y: -Math.abs(y) - 32, scale: 1 }}
                  exit={{ opacity: 0, x: 0, y: 0, scale: 0.6 }}
                  transition={{ ...spring.celebrate, delay: i * 0.04 }}
                  style={{
                    position: 'absolute',
                    left: 0,
                    bottom: 0,
                    pointerEvents: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 4,
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--r-md)',
                    padding: '8px 12px',
                    boxShadow: 'var(--e2)',
                    cursor: 'pointer',
                    color: 'var(--ink-900)',
                    fontSize: 11,
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    minWidth: 58,
                  }}
                  onClick={(e) => {
                    e.stopPropagation()
                    setRadialOpen(false)
                    dispatch({ t: 'sheet', sheet: item.sheet })
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  aria-label={item.label}
                >
                  {item.label}
                </motion.button>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        className="navfab"
        aria-label="Agregar registro"
        aria-haspopup={radialOpen ? 'menu' : undefined}
        aria-expanded={radialOpen}
        onPointerDown={onFabPointerDown}
        onPointerUp={onFabPointerUp}
        onPointerLeave={onFabPointerUp}
        onClick={onFabClick}
        onContextMenu={(e) => e.preventDefault()}
        animate={radialOpen ? { rotate: 45, scale: 0.9 } : { rotate: 0, scale: 1 }}
        whileTap={reduce ? undefined : { scale: 0.84 }}
        transition={spring.celebrate}
      >
        +
      </motion.button>
      {TABS.slice(0, 3).map(Tab)}
      <div style={{ width: 58, flex: 'none' }} aria-hidden />
      {TABS.slice(3).map(Tab)}
    </nav>
  )
}
