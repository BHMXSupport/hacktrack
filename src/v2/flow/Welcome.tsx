/**
 * Welcome.tsx — v2 flow
 *
 * Celebración post-onboarding. Muestra un resumen de configuración y
 * lleva a 's-app' via seenWelcome (que limpia justOnboarded).
 * Sin claims médicos.
 *
 * ScreenId: 's-welcome'
 * Dispatch:
 *   { t: 'seenWelcome' }          — limpia justOnboarded, screen ya es 's-app'
 *   Opcionalmente: { t: 'tab', tab: 'protocolo' } + { t: 'sheet', sheet: 'registrar' }
 */
import { useEffect } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Sparkles, BarChart2, Leaf } from 'lucide-react'
import { useApp } from '../../lib/store'
import { backendEnabled } from '../../lib/backend/config'
import { CATEGORY_COLOR } from '../../lib/catalog'
import { Button } from '../ui/Button'
import { Glass } from '../ui/Glass'

// ── Animación ─────────────────────────────────────────────────────────────────

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.15 } },
}

const itemFade = {
  hidden: { opacity: 0, y: 18 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.34, ease: [0, 0, 0.2, 1] as [number, number, number, number] },
  },
}

const celebrate = {
  hidden: { scale: 0, opacity: 0 },
  show: {
    scale: 1,
    opacity: 1,
    transition: { type: 'spring', stiffness: 300, damping: 20 } as const,
  },
}

// ── Resumen de stats ──────────────────────────────────────────────────────────

interface StatRowProps {
  icon: React.ReactNode
  label: string
  value: string
  color: string
}

function StatRow({ icon, label, value, color }: StatRowProps) {
  return (
    <Glass className="flex items-center gap-4 py-3 px-4">
      <span
        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full"
        style={{ background: `color-mix(in srgb, ${color} 14%, transparent)` }}
        aria-hidden="true"
      >
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-secondary-foreground">
          {label}
        </p>
        <p className="text-[14px] font-semibold text-foreground truncate">{value}</p>
      </div>
    </Glass>
  )
}

// ── Mapa de etiquetas es-MX para categorías de objetivos ─────────────────────

const GOAL_LABEL: Record<string, string> = {
  Metabolismo: 'Metabolismo',
  Recuperación: 'Recuperación',
  Crecimiento: 'Crecimiento',
  Cognitivo: 'Cognitivo',
  Piel: 'Piel',
  'Anti-Aging': 'Anti-Aging',
  Reproductivo: 'Salud reproductiva',
  Explorar: 'Explorando',
}

// ── Componente principal ──────────────────────────────────────────────────────

export function Welcome() {
  const { state, dispatch } = useApp()
  const reduce = useReducedMotion()

  const name = state.profile.name
  const goal = state.curGoal
  // Todos los objetivos elegidos (principal + secundarios), deduplicados
  const allGoals = [...new Set([state.curGoal, ...(state.secondaryGoals ?? [])].filter(Boolean) as string[])]
  const accentColor = goal
    ? (CATEGORY_COLOR[goal as keyof typeof CATEGORY_COLOR] ?? '#5FC9B8')
    : '#5FC9B8'

  const nMedidas = state.selectedMeasures.length
  const nProductos = Object.keys(state.protocols).length
  const hasProducts = nProductos > 0

  // Si llegamos aquí desde finishOnboarding (justOnboarded=true) marcamos visto.
  // La pantalla Welcome puede renderizarse también desde s-app como modal; en ese caso
  // seenWelcome limpia el flag.
  useEffect(() => {
    // Nada en mount — lo dispatch al CTA para que el user vea la pantalla.
  }, [])

  function handleVerPlan() {
    if (!hasProducts) {
      dispatch({ t: 'tab', tab: 'protocolo' })
      dispatch({ t: 'sheet', sheet: 'registrar' })
    }
    dispatch({ t: 'seenWelcome' })
  }

  const stats: StatRowProps[] = [
    {
      icon: <Sparkles size={16} style={{ color: accentColor }} />,
      label: allGoals.length > 1 ? 'Objetivos' : 'Objetivo',
      value: allGoals.length ? allGoals.map((g) => GOAL_LABEL[g] ?? g).join(' · ') : 'Explorando',
      color: accentColor,
    },
    {
      icon: <BarChart2 size={16} className="text-teal" />,
      label: 'Métricas',
      value:
        nMedidas > 0
          ? `${nMedidas} seleccionada${nMedidas !== 1 ? 's' : ''}`
          : 'Puedes agregar después',
      color: '#5FC9B8',
    },
    {
      icon: <Leaf size={16} style={{ color: '#6B7BE8' }} />,
      label: 'Productos',
      value:
        nProductos > 0
          ? `${nProductos} en seguimiento`
          : 'Agrega desde Protocolo',
      color: '#6B7BE8',
    },
  ]

  return (
    <div
      className="flex min-h-dvh flex-col items-center justify-center bg-void px-6"
      style={{
        paddingTop: 'max(40px, env(safe-area-inset-top))',
        paddingBottom: 'max(40px, calc(32px + env(safe-area-inset-bottom)))',
        background:
          'linear-gradient(160deg, var(--bg-void, #0b1120) 0%, color-mix(in srgb, #5FC9B8 5%, #0b1120) 100%)',
      }}
    >
      <motion.div
        initial={reduce ? false : 'hidden'}
        animate="show"
        variants={stagger}
        className="flex w-full max-w-[400px] flex-col items-center gap-7"
      >
        {/* Ícono de celebración */}
        <motion.div variants={celebrate}>
          <div
            className="flex h-20 w-20 items-center justify-center rounded-full"
            style={{
              background: `color-mix(in srgb, ${accentColor} 15%, transparent)`,
              border: `2px solid color-mix(in srgb, ${accentColor} 30%, transparent)`,
            }}
          >
            <Sparkles
              size={34}
              style={{ color: accentColor }}
              aria-hidden="true"
            />
          </div>
        </motion.div>

        {/* Copy */}
        <motion.div variants={itemFade} className="text-center">
          {name && (
            <p className="mb-1 text-[15px] text-secondary-foreground">
              Hola, {name}
            </p>
          )}
          <h1 className="text-[30px] font-bold leading-tight tracking-tight text-foreground">
            {hasProducts ? 'Tu protocolo está listo' : 'Tu espacio está listo'}
          </h1>
          <p className="mt-2 text-[14px] text-secondary-foreground max-w-[280px] mx-auto">
            {hasProducts
              ? 'Empieza a registrar y observa tu progreso a lo largo del tiempo.'
              : 'Agrega tu primer producto para empezar a registrar.'}
          </p>
        </motion.div>

        {/* Resumen de configuración */}
        <motion.div variants={itemFade} className="flex w-full flex-col gap-2">
          {stats.map((s) => (
            <StatRow key={s.label} {...s} />
          ))}
        </motion.div>

        {/* CTA */}
        <motion.div variants={itemFade} className="w-full flex flex-col gap-2">
          <Button size="full" onClick={handleVerPlan}>
            {hasProducts ? 'Ver mi plan' : 'Agregar mi primer producto'}
          </Button>
          <p className="text-center text-[11px] leading-relaxed text-secondary-foreground">
            {backendEnabled
              ? 'Tus registros se guardan en este dispositivo. Tu cuenta te permite activar el respaldo opcional en la nube.'
              : 'Tus registros se guardan en este dispositivo. La sincronización en la nube llega pronto.'}
          </p>
          <p className="text-center text-[11px] leading-relaxed text-secondary-foreground">
            Hacktrack es una herramienta de seguimiento personal.
            No reemplaza consejo médico.
          </p>
        </motion.div>
      </motion.div>
    </div>
  )
}
