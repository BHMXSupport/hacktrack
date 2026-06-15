import { motion } from 'framer-motion'
import { useApp } from '../lib/store'
import type { TabId } from '../lib/store'
import { IcHome, IcDiary, IcProto, IcGear } from './icons'
import { spring } from '../lib/motion'

const TABS: [TabId, string, (p: { className?: string }) => JSX.Element][] = [
  ['inicio', 'Inicio', IcHome],
  ['diario', 'Diario', IcDiary],
  ['protocolo', 'Progreso', IcProto],
  ['ajustes', 'Ajustes', IcGear],
]

// Bottom nav compartida: 4 tabs (2 + FAB + 2) + FAB central que abre la hoja "Registrar".
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
      {TABS.slice(0, 2).map(Tab)}
      <div style={{ width: 58, flex: 'none' }} aria-hidden />
      {TABS.slice(2).map(Tab)}
    </nav>
  )
}
