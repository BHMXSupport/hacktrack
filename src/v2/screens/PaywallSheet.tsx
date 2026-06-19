// PaywallSheet v2 — design system "Precision × Accessible"
// Hacktrack Plus — presentación honesta, sin countdown manipulador.
// CTA activa premium vía setSetting key:'premium' value:true (mock de pago).
// Compliance: sin claims médicos, es-MX, tap targets ≥44px.
// SheetId a cablear: 'paywall' → PaywallSheet.
import { useState } from 'react'
import { Check, BarChart2, Database, Download, Flame } from 'lucide-react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { useApp } from '../../lib/store'
import { protocolStreak } from '../../lib/calendar'
import { Sheet } from '../ui/Sheet'
import { Button } from '../ui/Button'
import { Glass } from '../ui/Glass'
import { SegmentedTabs } from '../ui/SegmentedTabs'

// ── Datos estáticos ───────────────────────────────────────────────────────────

type Plan = 'mensual' | 'anual'

const PLAN_OPTIONS: { value: Plan; label: string }[] = [
  { value: 'mensual', label: 'Mensual' },
  { value: 'anual',   label: 'Anual' },
]

// Precios en MXN
const PRICE_MXN: Record<Plan, number> = { mensual: 99, anual: 799 }
const SAVE_PCT = Math.round((1 - PRICE_MXN.anual / (PRICE_MXN.mensual * 12)) * 100) // ≈ 33

const ROWS_FREE: { label: string }[] = [
  { label: 'Registro de dosis diario' },
  { label: 'Protocolo activo (1 producto)' },
  { label: 'Historial 30 días' },
  { label: 'Racha y adherencia básica' },
]

const ROWS_PLUS: { label: string; Icon: typeof Check }[] = [
  { label: 'Multi-protocolo (varios productos)', Icon: Database },
  { label: 'Historial ilimitado (90 días+)',     Icon: BarChart2 },
  { label: 'Exportación de datos JSON + CSV',    Icon: Download },
  { label: 'Resumen semanal avanzado',           Icon: BarChart2 },
  { label: 'Proyección de progreso con ETA',     Icon: BarChart2 },
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
  const [plan, setPlan] = useState<Plan>('mensual')

  const streak = protocolStreak(state, new Date(state.todayTs))

  // Personalizar primera fila Plus con el producto activo
  const activeProduct = state.activeProduct
  const activeAlias   = activeProduct ? (state.productAliases?.[activeProduct] ?? activeProduct) : null
  const plusRows = activeAlias
    ? [{ label: `Seguimiento avanzado de ${activeAlias}`, Icon: BarChart2 }, ...ROWS_PLUS.slice(1)]
    : ROWS_PLUS

  const price   = PRICE_MXN[plan]
  const period  = plan === 'mensual' ? '/mes' : '/año'
  const dailyEq = plan === 'anual' ? (price / 365).toFixed(2) : null

  function activate() {
    dispatch({ t: 'setSetting', key: 'premium', value: true })
    dispatch({ t: 'toast', msg: `Hacktrack Plus activado` })
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose} title="Hacktrack Plus">
      <div className="flex flex-col gap-6">

        {/* ── Hero ───────────────────────────────────────────────────────── */}
        <section>
          <motion.h2
            className="text-[22px] font-bold text-foreground text-center"
            initial={reduce ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
          >
            Eleva tu seguimiento
          </motion.h2>
          <p className="mt-1.5 text-[13px] text-secondary-foreground text-center">
            Desbloquea herramientas avanzadas para optimizar tu protocolo.
          </p>
        </section>

        {/* ── Racha (si aplica) ───────────────────────────────────────────── */}
        {streak >= 3 && (
          <motion.div
            initial={reduce ? false : { opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.22, delay: 0.08 }}
          >
            <Glass
              className="flex items-center justify-center gap-2 py-3 text-center"
              style={{
                background: 'linear-gradient(135deg, rgba(10,46,40,0.9) 0%, rgba(95,201,184,0.15) 100%)',
              }}
            >
              <Flame size={15} className="text-teal shrink-0" aria-hidden="true" />
              <span className="text-[13px] font-semibold text-foreground">
                Llevas {streak} día{streak !== 1 ? 's' : ''} de racha — no la pierdas
              </span>
            </Glass>
          </motion.div>
        )}

        {/* ── Toggle de plan + precio ─────────────────────────────────────── */}
        <section className="flex flex-col items-center gap-4">
          <div className="relative">
            <SegmentedTabs<Plan>
              options={PLAN_OPTIONS}
              value={plan}
              onChange={setPlan}
            />
            {/* Badge de ahorro anual — no animado, informativo */}
            <span
              className="absolute -top-2.5 -right-2 text-[10px] font-bold bg-teal text-void px-1.5 py-0.5 rounded-full pointer-events-none whitespace-nowrap"
              aria-label={`Ahorra ${SAVE_PCT}% con el plan anual`}
            >
              -{SAVE_PCT}%
            </span>
          </div>

          {/* Precio dinámico */}
          <div className="text-center">
            <AnimatePresence mode="wait">
              <motion.span
                key={plan}
                initial={reduce ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.14 }}
                className="font-mono text-[32px] font-bold text-foreground tabular-nums"
              >
                ${price}
              </motion.span>
            </AnimatePresence>
            <span className="text-[14px] text-muted-foreground ml-1">{period}</span>

            <AnimatePresence>
              {dailyEq && (
                <motion.p
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.18 }}
                  className="text-[12px] text-muted-foreground mt-0.5"
                >
                  equivale a{' '}
                  <strong className="text-teal font-semibold">${dailyEq}</strong> / día
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        </section>

        {/* ── Tabla comparativa honesta ───────────────────────────────────── */}
        <Glass className="p-0 overflow-hidden divide-y divide-white/8">
          {/* Lo que ya tienes */}
          <div className="px-4 py-2.5 bg-white/4">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Lo que ya tienes
            </span>
          </div>
          <motion.div
            variants={reduce ? undefined : rowContainer}
            initial="hidden"
            animate="show"
          >
            {ROWS_FREE.map((row, i) => (
              <motion.div
                key={row.label}
                variants={reduce ? undefined : rowItem}
                className="flex items-center gap-3 px-4 py-3"
                style={{ borderBottom: i < ROWS_FREE.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}
              >
                <Check size={15} strokeWidth={2} className="text-muted-foreground shrink-0" aria-hidden="true" />
                <span className="text-[13px] text-secondary-foreground leading-snug">{row.label}</span>
              </motion.div>
            ))}
          </motion.div>

          {/* Plus desbloquea */}
          <div className="px-4 py-2.5 bg-teal/8 border-t border-teal/20">
            <span className="text-[11px] font-bold uppercase tracking-wider text-teal">
              Plus desbloquea
            </span>
          </div>
          <motion.div
            variants={reduce ? undefined : rowContainer}
            initial="hidden"
            animate="show"
          >
            {plusRows.map((row, i) => (
              <motion.div
                key={row.label}
                variants={reduce ? undefined : rowItem}
                className="flex items-center gap-3 px-4 py-3 bg-teal/[0.02]"
                style={{ borderBottom: i < plusRows.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}
              >
                <Check size={15} strokeWidth={2.5} className="text-teal shrink-0" aria-hidden="true" />
                <span className="text-[13px] text-foreground leading-snug">{row.label}</span>
              </motion.div>
            ))}
          </motion.div>
        </Glass>

        {/* ── CTA cluster ─────────────────────────────────────────────────── */}
        <section className="flex flex-col gap-3">
          <Button
            variant="primary"
            size="full"
            onClick={activate}
            className="h-[52px] text-[16px]"
          >
            Activar Hacktrack Plus
          </Button>

          <Button
            variant="ghost"
            size="full"
            onClick={onClose}
            className="h-[52px] text-[15px] text-muted-foreground"
          >
            Quizás después
          </Button>

          <div className="flex flex-col items-center gap-2 pt-1">
            <button
              type="button"
              className="text-[12px] text-teal underline underline-offset-2 bg-transparent border-none cursor-pointer py-1 min-h-[44px] flex items-center"
              onClick={() => dispatch({ t: 'toast', msg: 'Restaurar compra (próximamente)' })}
            >
              Restaurar compra
            </button>
            <p className="text-[11px] text-muted-foreground text-center max-w-[260px] leading-relaxed">
              Pago único por período elegido. Sin renovación automática forzada.
              Cancela cuando quieras.
            </p>
          </div>
        </section>

      </div>
    </Sheet>
  )
}
