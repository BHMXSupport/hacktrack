import { motion, useReducedMotion } from 'framer-motion'
import { Home, Activity, BookOpen, User, Plus } from 'lucide-react'
import type { TabId } from '../../lib/store'
import { cn } from '../../lib/cn'

// Nav "Bitácora" — barra editorial ANCLADA al borde inferior (ref canónica: columna opaca +
// regla superior + sombra flotante; sin vidrio/blur). IA: 4 pestañas + [+] central (captura).
//   Inicio · Vida · [ + ] · Diario · Cuerpo
// Mapa pestaña → pantalla (TabId existente; el ruteo real lo hace AppV2 con estos ids):
//   Inicio  → 'inicio'  (Inicio / Hoy)               icono Home
//   Vida    → 'vida'    (farmacología / plasma)      icono Activity (pulso)
//   [ + ]   → onFab     (hoja Registrar)             icono Plus
//   Diario  → 'diario'  (bitácora + vista Semana)    icono BookOpen
//   Cuerpo  → 'cuerpo'  (Progreso + vista Comida)    icono User
// AppV2 normaliza los ids legados (protocolo/comida→cuerpo, semana→diario) ANTES de
// pasar `active`, así la pestaña correcta se ilumina aunque el estado traiga un id viejo.
// Labels mono UPPER 12px (piso de label). Activa = azul con subrayado layoutId BAJO el label.
// FAB por tema vía .fab-capture: Papel = azul tinta; Tinta = ámbar con glifo de tinta (el glow).
type TabDef = { id: TabId; label: string; Icon: typeof Home }
const TABS: TabDef[] = [
  { id: 'inicio', label: 'Inicio', Icon: Home },
  { id: 'vida', label: 'Vida', Icon: Activity },
  { id: 'diario', label: 'Diario', Icon: BookOpen },
  { id: 'cuerpo', label: 'Cuerpo', Icon: User },
]

// #25: modo simple → colapsa a Inicio / Diario / Cuerpo (+ FAB).
const SIMPLE_IDS: TabId[] = ['inicio', 'diario', 'cuerpo']

export function FloatingNav({
  active,
  onTab,
  onFab,
  simple = false,
}: {
  active: TabId
  onTab: (t: TabId) => void
  onFab: () => void
  simple?: boolean
}) {
  const reduce = useReducedMotion()
  const visible = simple ? TABS.filter((t) => SIMPLE_IDS.includes(t.id)) : TABS
  const mid = Math.ceil(visible.length / 2)
  const left = visible.slice(0, mid)
  const right = visible.slice(mid)
  return (
    <nav
      aria-label="Navegación principal"
      className="absolute inset-x-0 bottom-0 z-30 flex items-start bg-surface pt-1.5"
      style={{
        paddingBottom: 'max(6px, env(safe-area-inset-bottom))',
        borderTop: '1.5px solid var(--hairline)',
        boxShadow: '0 -2px 0 var(--hairline), 0 -10px 30px rgba(26,23,18,.08)',
      }}
    >
      {left.map((t) => (
        <NavTab key={t.id} t={t} active={active === t.id} reduce={!!reduce} onClick={() => onTab(t.id)} />
      ))}
      <div className="relative w-[58px] shrink-0">
        <button
          onClick={onFab}
          aria-label="Agregar registro"
          className="fab-capture absolute -top-6 left-1/2 grid h-[58px] w-[58px] -translate-x-1/2 place-items-center rounded-full active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
        >
          <Plus size={25} strokeWidth={2.3} />
        </button>
      </div>
      {right.map((t) => (
        <NavTab key={t.id} t={t} active={active === t.id} reduce={!!reduce} onClick={() => onTab(t.id)} />
      ))}
    </nav>
  )
}

function NavTab({ t, active, onClick, reduce }: { t: TabDef; active: boolean; onClick: () => void; reduce: boolean }) {
  const { Icon } = t
  return (
    <button
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex min-h-[58px] flex-1 flex-col items-center justify-start gap-1 pt-1 font-mono text-[12px] font-medium uppercase tracking-[0.06em]',
        active ? 'text-blue' : 'text-ink-2',
      )}
    >
      <Icon size={21} strokeWidth={active ? 2 : 1.8} />
      <span>{t.label}</span>
      {/* Subrayado activo BAJO el label (ref canónica); viaja entre pestañas con layoutId. */}
      <span className="relative h-[3px] w-4">
        {active && (
          <motion.span
            layoutId="nav-led"
            transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 320, damping: 30 }}
            className="absolute inset-0 rounded-full bg-blue"
          />
        )}
      </span>
    </button>
  )
}
