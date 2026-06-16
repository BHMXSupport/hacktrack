// PremiumGate — envuelve contenido Plus. Si no hay suscripción, muestra un preview borroso + CTA al paywall.
// El CTA es STICKY: en contenido alto sigue el scroll (flota a media pantalla) para que no se pierda.
import type { ReactNode } from 'react'
import { useApp } from '../lib/store'

export function PremiumGate({ children, label = 'Función Plus' }: { children: ReactNode; label?: string }) {
  const { state, dispatch } = useApp()
  if (state.settings.premium) return <>{children}</>
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
            <button className="btn btn-brand btn-sm" style={{ width: 'auto', padding: '0 18px' }} onClick={() => dispatch({ t: 'sheet', sheet: 'paywall' })}>
              Desbloquear con Plus
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
