import { motion, useMotionValue, useTransform, animate, useReducedMotion } from 'framer-motion'
import { useEffect } from 'react'
import { useApp } from '../lib/store'
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

// Bottom nav: 6 tabs (3 + FAB + 3) + FAB central que abre la hoja "Agregar".
export function BottomNav() {
  const { state, dispatch } = useApp()
  const reduce = useReducedMotion()

  // Derivar si hay dosis pendientes hoy
  const today = new Date(state.todayTs)
  const prods = dayProducts(state, today)
  const doneCount = prods.filter((p) => doseTakenOnProduct(state, today, p)).length
  const hasPending = prods.length > doneCount

  const Tab = ([id, label, Icon]: (typeof TABS)[number]) => {
    const active = state.tab === id
    const isHome = id === 'inicio'
    return (
      <button
        key={id}
        className={'navtab' + (active ? ' active' : '')}
        onClick={() => dispatch({ t: 'tab', tab: id })}
        style={{ position: 'relative' }}
      >
        <motion.span animate={{ scale: active ? 1.1 : 1, y: active ? -1 : 0 }} transition={spring.ui} style={{ display: 'flex', position: 'relative' }}>
          <Icon />
          {isHome && <PendingBadge visible={hasPending && !reduce} />}
        </motion.span>
        {label}
      </button>
    )
  }

  return (
    <nav className="bottomnav">
      <motion.button
        className="navfab"
        aria-label="Agregar registro"
        onClick={() => dispatch({ t: 'sheet', sheet: 'agregar' })}
        whileTap={reduce ? undefined : { scale: 0.84, rotate: 45 }}
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
