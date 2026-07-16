// PaywallSheet v2 — "Hacktrack Plus" en desarrollo (interino honesto).
// Durante la beta TODO es gratis: sin precios, sin checkout, sin activación fingida.
// Compliance: sin claims médicos, es-MX, tap targets ≥44px.
// SheetId: 'paywall' → se abre desde los gates de Semana y RecetasHacktrack.
import { useEffect } from 'react'
import { Check, Cloud, BarChart2, TrendingUp, UtensilsCrossed, Wrench } from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'
import { useApp } from '../../lib/store'
import { Sheet } from '../ui/Sheet'
import { Button } from '../ui/Button'
import { Glass } from '../ui/Glass'

// ── Datos estáticos ───────────────────────────────────────────────────────────

// Roadmap de Plus — funciones en construcción, no una oferta de venta.
const ROWS_COMING: { label: string; Icon: typeof Check }[] = [
  { label: 'Respaldo y sincronización en la nube', Icon: Cloud },
  { label: 'Resumen semanal avanzado',             Icon: BarChart2 },
  { label: 'Proyección de progreso con ETA',       Icon: TrendingUp },
  { label: 'Recetario completo',                   Icon: UtensilsCrossed },
]

// Variante de entrada en stagger para las filas
const rowContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.055, delayChildren: 0.1 } },
}
const rowItem = {
  hidden: { opacity: 0, x: -8 },
  show:   { opacity: 1, x: 0, transition: { duration: 0.2, ease: 'easeOut' as const } },
}

// ── Componente ────────────────────────────────────────────────────────────────

export function PaywallSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, dispatch } = useApp()
  const reduce = useReducedMotion()

  // Los gates (Semana avanzada, recetario) leen settings.premium, pero no existe
  // compra: mientras Plus esté en desarrollo el gate se abre al llegar aquí.
  // Invariante: nada puede quedar más bloqueado que antes y nadie pierde acceso.
  useEffect(() => {
    if (open && !state.settings.premium) {
      dispatch({ t: 'setSetting', key: 'premium', value: true })
    }
  }, [open, state.settings.premium, dispatch])

  return (
    <Sheet open={open} onClose={onClose} title="Hacktrack Plus">
      <div className="flex flex-col gap-6">

        {/* ── Hero ───────────────────────────────────────────────────────── */}
        <section className="flex flex-col items-center gap-3">
          <motion.span
            initial={reduce ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="inline-flex items-center gap-1.5 rounded-full border border-teal/30 bg-teal/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-teal"
          >
            <Wrench size={12} aria-hidden="true" />
            En desarrollo
          </motion.span>
          <motion.h2
            className="text-[22px] font-bold text-foreground text-center"
            initial={reduce ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
          >
            Todo Hacktrack es gratis durante la beta
          </motion.h2>
          <p className="text-[13px] text-secondary-foreground text-center max-w-[300px]">
            Estamos construyendo Hacktrack Plus. Mientras tanto, todas las funciones
            están desbloqueadas sin costo.
          </p>
        </section>

        {/* ── Lo que viene ────────────────────────────────────────────────── */}
        <Glass className="p-0 overflow-hidden">
          <div className="px-4 py-2.5 bg-teal/8 border-b border-teal/20">
            <span className="text-[11px] font-bold uppercase tracking-wider text-teal">
              Lo que viene
            </span>
          </div>
          <motion.div
            variants={reduce ? undefined : rowContainer}
            initial="hidden"
            animate="show"
          >
            {ROWS_COMING.map((row, i) => (
              <motion.div
                key={row.label}
                variants={reduce ? undefined : rowItem}
                className="flex items-center gap-3 px-4 py-3"
                style={{ borderBottom: i < ROWS_COMING.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}
              >
                <row.Icon size={15} strokeWidth={2} className="text-teal shrink-0" aria-hidden="true" />
                <span className="text-[13px] text-foreground leading-snug">{row.label}</span>
              </motion.div>
            ))}
          </motion.div>
        </Glass>

        {/* ── CTA ─────────────────────────────────────────────────────────── */}
        <section className="flex flex-col gap-3">
          <Button
            variant="primary"
            size="full"
            onClick={onClose}
            className="h-[52px] text-[16px]"
          >
            Entendido
          </Button>

          <p className="text-[11px] text-muted-foreground text-center max-w-[280px] leading-relaxed mx-auto">
            Nada se cobra durante la beta. Si Plus llega a tener costo,
            te lo diremos dentro de la app antes de cualquier cambio.
          </p>
        </section>

      </div>
    </Sheet>
  )
}
