import { motion, useReducedMotion } from 'framer-motion'
import { Home, BookOpen, BarChart3, Activity, Utensils, CalendarDays, Plus } from 'lucide-react'
import type { TabId } from '../../lib/store'
import { cn } from '../../lib/cn'

type TabDef = { id: TabId; label: string; Icon: typeof Home }
const TABS: TabDef[] = [
  { id: 'inicio', label: 'Inicio', Icon: Home },
  { id: 'diario', label: 'Diario', Icon: BookOpen },
  { id: 'protocolo', label: 'Protocolo', Icon: BarChart3 },
  { id: 'vida', label: 'Vida', Icon: Activity },
  { id: 'comida', label: 'Comida', Icon: Utensils },
  { id: 'semana', label: 'Semana', Icon: CalendarDays },
]

// #25: modo simple → solo Inicio / Diario / Progreso
const SIMPLE_IDS: TabId[] = ['inicio', 'diario', 'protocolo']

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
      className="glass absolute inset-x-2 z-30 flex items-stretch rounded-[22px]"
      style={{
        bottom: 'max(8px, env(safe-area-inset-bottom))',
        backdropFilter: 'blur(28px) saturate(160%)',
        WebkitBackdropFilter: 'blur(28px) saturate(160%)',
      }}
    >
      {left.map((t) => (
        <NavTab key={t.id} t={t} active={active === t.id} reduce={!!reduce} onClick={() => onTab(t.id)} />
      ))}
      <div className="relative w-[58px] shrink-0">
        <button
          onClick={onFab}
          aria-label="Agregar registro"
          className="absolute -top-5 left-1/2 grid h-[58px] w-[58px] -translate-x-1/2 place-items-center rounded-full text-primary-foreground shadow-glow active:scale-95"
          style={{ background: 'linear-gradient(135deg, var(--teal-dim), var(--teal))', border: '4px solid var(--void)' }}
        >
          <Plus size={26} strokeWidth={2.5} />
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
        'relative flex min-h-[60px] flex-1 flex-col items-center justify-center gap-1 text-[11px] font-semibold',
        active ? 'text-teal' : 'text-secondary-foreground',
      )}
    >
      {active && (
        <motion.span
          layoutId="nav-led"
          transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 320, damping: 30 }}
          className="absolute top-0 h-0.5 w-4 rounded-full bg-teal"
        />
      )}
      <Icon size={21} strokeWidth={2} />
      <span>{t.label}</span>
    </button>
  )
}
