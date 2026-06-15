import { useApp } from '../lib/store'
import type { TabId } from '../lib/store'
import { IcHome, IcDiary, IcProto, IcGear } from './icons'

const TABS: [TabId, string, (p: { className?: string }) => JSX.Element][] = [
  ['inicio', 'Inicio', IcHome],
  ['diario', 'Diario', IcDiary],
  ['protocolo', 'Progreso', IcProto],
  ['ajustes', 'Ajustes', IcGear],
]

// Bottom nav compartida: 4 tabs (2 + FAB + 2) + FAB central que abre la hoja "Registrar".
export function BottomNav() {
  const { state, dispatch } = useApp()
  const Tab = ([id, label, Icon]: (typeof TABS)[number]) => (
    <button
      key={id}
      className={'navtab' + (state.tab === id ? ' active' : '')}
      onClick={() => dispatch({ t: 'tab', tab: id })}
    >
      <Icon />
      {label}
    </button>
  )
  return (
    <nav className="bottomnav">
      <button className="navfab" aria-label="Agregar registro" onClick={() => dispatch({ t: 'sheet', sheet: 'agregar' })}>
        +
      </button>
      {TABS.slice(0, 2).map(Tab)}
      <div style={{ width: 58, flex: 'none' }} aria-hidden />
      {TABS.slice(2).map(Tab)}
    </nav>
  )
}
