// PaywallSheet — "Bitácora": "Hacktrack Plus" en desarrollo (interino honesto).
// Durante la beta TODO es gratis: sin precios, sin checkout, sin activación fingida.
// El CONTENIDO honesto se conserva EXACTO; solo cambia el vestido editorial.
// Compliance: sin claims médicos, es-MX, tap targets ≥44px.
// SheetId: 'paywall' → se abre desde los gates de Semana y RecetasHacktrack.
import { useEffect } from 'react'
import { Check, Cloud, BarChart2, TrendingUp, UtensilsCrossed, Wrench } from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'
import { useApp } from '../../lib/store'
import { Sheet } from '../ui/Sheet'
import { Button } from '../ui/Button'
import { Glass } from '../ui/Glass'
import { EASE } from '../lib/motion'

// ── Datos estáticos ───────────────────────────────────────────────────────────

// Roadmap de Plus — funciones en construcción, no una oferta de venta.
const ROWS_COMING: { label: string; Icon: typeof Check }[] = [
  { label: 'Respaldo y sincronización en la nube', Icon: Cloud },
  { label: 'Resumen semanal avanzado',             Icon: BarChart2 },
  { label: 'Proyección de progreso con ETA',       Icon: TrendingUp },
  { label: 'Recetario completo',                   Icon: UtensilsCrossed },
]

// Variante de entrada en stagger para las filas (easing firma Bitácora)
const rowContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.055, delayChildren: 0.1 } },
}
const rowItem = {
  hidden: { opacity: 0, x: -8 },
  show:   { opacity: 1, x: 0, transition: { duration: 0.2, ease: EASE } },
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

        {/* ── Hero: sello "En desarrollo" (ámbar suave, texto tinta AA) + titular serif ── */}
        <section className="flex flex-col items-center gap-3">
          <motion.span
            initial={reduce ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: EASE }}
            className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-amber-soft px-3 py-1.5 font-mono text-[12px] font-medium uppercase tracking-[0.14em] text-ink"
          >
            <Wrench size={12} aria-hidden="true" className="text-amber" />
            En desarrollo
          </motion.span>
          <motion.h2
            className="text-center font-serif text-[26px] font-medium leading-[1.15] tracking-tight text-ink"
            initial={reduce ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: EASE }}
          >
            Todo Hacktrack es gratis durante la beta
          </motion.h2>
          <p className="max-w-[300px] text-center text-[14px] leading-relaxed text-ink-2">
            Estamos construyendo Hacktrack Plus. Mientras tanto, todas las funciones
            están desbloqueadas sin costo.
          </p>
        </section>

        {/* ── Lo que viene — columna impresa con kicker de folio ────────────── */}
        <Glass className="overflow-hidden p-0">
          <div className="flex items-center gap-2.5 border-b border-hairline bg-raised px-4 py-3">
            <span aria-hidden className="h-1.5 w-1.5 shrink-0 bg-amber" />
            <span className="font-mono text-[12px] font-medium uppercase tracking-[0.16em] text-ink-2">
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
                style={{ borderBottom: i < ROWS_COMING.length - 1 ? '1px solid var(--hairline)' : 'none' }}
              >
                <row.Icon size={15} strokeWidth={2} className="shrink-0 text-blue" aria-hidden="true" />
                <span className="text-[14px] leading-snug text-ink">{row.label}</span>
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

          <p className="mx-auto max-w-[280px] text-center text-[12px] leading-relaxed text-ink-3">
            Nada se cobra durante la beta. Si Plus llega a tener costo,
            te lo diremos dentro de la app antes de cualquier cambio.
          </p>
        </section>

      </div>
    </Sheet>
  )
}
