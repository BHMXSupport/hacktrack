// PremiumGate — envuelve contenido Plus. Si no hay suscripción, muestra un preview borroso + CTA al paywall.
// n=453: prop variant con copy de CTA contextual por pantalla.
// El CTA es STICKY: en contenido alto sigue el scroll (flota a media pantalla) para que no se pierda.
import type { ReactNode } from 'react'
import { useApp } from '../lib/store'

export type PremiumVariant = 'default' | 'food' | 'summary' | 'pharma'

interface VariantCopy {
  cta: string
  benefit: string
}

const VARIANT_COPY: Record<PremiumVariant, VariantCopy> = {
  default: {
    cta: 'Desbloquear con Plus',
    benefit: 'Accede a todas las funciones avanzadas de Hacktrack.',
  },
  food: {
    cta: 'Desbloquear nutrición',
    benefit: 'Registra comidas, macros y calorías para ver el cuadro completo.',
  },
  summary: {
    cta: 'Ver resumen completo',
    benefit: 'Analiza tendencias semanales, adherencia y promedios en detalle.',
  },
  pharma: {
    cta: 'Ver curva detallada',
    benefit: 'Consulta la curva de presencia estimada y el análisis farmacocinético de tus protocolos.',
  },
}

export function PremiumGate({
  children,
  label = 'Función Plus',
  variant = 'default',
}: {
  children: ReactNode
  label?: string
  variant?: PremiumVariant
}) {
  const { state, dispatch } = useApp()
  if (state.settings.premium) return <>{children}</>

  const copy = VARIANT_COPY[variant]

  return (
    // sin overflow:hidden aquí: dejaría el CTA pegado y rompería el position:sticky
    <div style={{ position: 'relative' }}>
      {/* preview borroso (se recorta a sí mismo) */}
      <div
        aria-hidden
        {...({ inert: '' } as Record<string, string>)}
        style={{ filter: 'blur(7px)', pointerEvents: 'none', userSelect: 'none', opacity: 0.6, borderRadius: 'var(--r-lg)', overflow: 'hidden' }}
      >
        {children}
      </div>

      {/* velo translúcido sobre todo el preview */}
      <div aria-hidden style={{ position: 'absolute', inset: 0, background: 'color-mix(in srgb, var(--bg) 42%, transparent)', borderRadius: 'var(--r-lg)', pointerEvents: 'none' }} />

      {/* CTA sticky: flota a ~40% del alto visible y sigue el scroll dentro de la zona bloqueada */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        <div style={{ position: 'sticky', top: '40vh', display: 'flex', justifyContent: 'center', padding: '0 16px' }}>
          <div
            style={{
              display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center', pointerEvents: 'auto',
              background: 'color-mix(in srgb, var(--surface) 90%, transparent)', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)',
              border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '16px 20px', boxShadow: 'var(--e2)', maxWidth: '88%',
            }}
          >
            <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="var(--brand-700)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <rect x="4" y="11" width="16" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" />
            </svg>
            <span className="sm" style={{ fontWeight: 600, color: 'var(--ink-900)' }}>{label}</span>
            {/* n=453: línea de beneficio contextual */}
            <span className="sm" style={{ color: 'var(--ink-400)', fontSize: 12 }}>{copy.benefit}</span>
            <button className="btn btn-brand btn-sm" style={{ width: 'auto', padding: '0 18px' }} onClick={() => dispatch({ t: 'sheet', sheet: 'paywall' })}>
              {copy.cta}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
