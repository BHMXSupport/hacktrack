// OnboardingProgress — barra segmentada de progreso de onboarding.
// Uso: <OnboardingProgress step={2} total={4} />
import { motion } from 'framer-motion'
import { spring } from '../lib/motion'

export function OnboardingProgress({ step, total }: { step: number; total: number }) {
  return (
    <div
      role="progressbar"
      aria-valuenow={step}
      aria-valuemax={total}
      aria-label="Progreso del registro"
      style={{ display: 'flex', gap: 4, width: '100%' }}
    >
      {Array.from({ length: total }, (_, i) => {
        const filled = i < step
        return (
          <motion.div
            key={i}
            initial={{ opacity: 0 }}
            animate={{
              opacity: 1,
              backgroundColor: filled ? 'var(--brand-500)' : 'var(--ink-200)',
            }}
            transition={filled ? spring.ui : { duration: 0.15 }}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 999,
              overflow: 'hidden',
            }}
          />
        )
      })}
    </div>
  )
}
