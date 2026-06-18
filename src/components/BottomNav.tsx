// BottomNav — barra de navegación inferior.
// n=435: FAB con menú radial al long-press (Dosis / Medida / Comida).
// n=436: botón lupa de búsqueda global (despacha 'sheet' a 'search' — sheet definida en sheets/Search.tsx).
// n=458: badge de racha + mini-tira semanal en tabs Inicio/Diario.
import { motion, useReducedMotion } from 'framer-motion'
import { useCallback } from 'react'
import { useApp, weekStatus } from '../lib/store'
import { protocolStreak } from '../lib/calendar'
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
        top: 0,
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

// Bottom nav: 6 tabs (3 + FAB + 3) + FAB central que abre la hoja "Agregar" (captura universal:
// Dosis · Comida · Medidas). El menú radial long-press se retiró: una sola UI de captura, sin duplicar.
export function BottomNav() {
  const { state, dispatch } = useApp()
  const reduce = useReducedMotion()

  // Derivar si hay dosis pendientes hoy
  const today = new Date(state.todayTs)
  const prods = dayProducts(state, today)
  const doneCount = prods.filter((p) => doseTakenOnProduct(state, today, p)).length
  const hasPending = prods.length > doneCount

  // n=458: racha y semana
  const streak = protocolStreak(state, today)
  const week = weekStatus(state.log, today, true) // doseOnly

  // FAB → abre la hoja de captura universal "Agregar" (Dosis · Comida · Medidas)
  const onFabClick = useCallback(() => {
    dispatch({ t: 'sheet', sheet: 'agregar' })
  }, [dispatch])

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
            {/* Prioridad: el pendiente (accionable) gana; la racha solo si no hay pendiente,
                para que los dos badges nunca se apilen en la misma esquina. */}
            {isHome && hasPending && <PendingBadge visible={!reduce} />}
            {/* n=458: badge de racha en tab Inicio (solo si no hay pendiente) */}
            {isHome && !hasPending && !reduce && <StreakBadge streak={streak} />}
          </span>
          {/* n=458: mini-tira semanal en tab Diario */}
          {isDiario && <WeekStrip days={week} />}
        </motion.span>
        {/* Cinturón de seguridad anti-bleed: la etiqueta recorta limpio en vez de empujar la fila */}
        <span style={{ maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {label}
        </span>
      </button>
    )
  }

  return (
    <nav className="bottomnav">
      <motion.button
        className="navfab"
        aria-label="Agregar registro"
        onClick={onFabClick}
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
