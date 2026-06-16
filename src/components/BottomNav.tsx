import { motion } from 'framer-motion'
import { useApp } from '../lib/store'
import type { TabId } from '../lib/store'
import { IcHome, IcDiary, IcProto, IcVida, IcFood, IcWeek } from './icons'
import { spring } from '../lib/motion'

const TABS: [TabId, string, (p: { className?: string }) => JSX.Element][] = [
  ['inicio', 'Inicio', IcHome],
  ['diario', 'Diario', IcDiary],
  ['protocolo', 'Progreso', IcProto],
  ['vida', 'Vida', IcVida],
  ['comida', 'Comida', IcFood],
  ['semana', 'Semana', IcWeek],
]

// Bottom nav: 6 tabs (3 + FAB + 3) + FAB central que abre la hoja "Agregar".
export function BottomNav() {
  const { state, dispatch } = useApp()
  const Tab = ([id, label, Icon]: (typeof TABS)[number]) => {
    const active = state.tab === id
    return (
      <button
        key={id}
        className={'navtab' + (active ? ' active' : '')}
        onClick={() => dispatch({ t: 'tab', tab: id })}
      >
        <motion.span animate={{ scale: active ? 1.1 : 1, y: active ? -1 : 0 }} transition={spring.ui} style={{ display: 'flex' }}>
          <Icon />
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
        whileTap={{ scale: 0.9 }}
        transition={spring.ui}
      >
        +
      </motion.button>
      {TABS.slice(0, 3).map(Tab)}
      <div style={{ width: 58, flex: 'none' }} aria-hidden />
      {TABS.slice(3).map(Tab)}
    </nav>
  )
}
