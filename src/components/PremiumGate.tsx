// PremiumGate — envuelve contenido Plus. Si no hay suscripción, muestra un preview borroso + CTA al paywall.
import type { ReactNode } from 'react'
import { useApp } from '../lib/store'

export function PremiumGate({ children, label = 'Función Plus' }: { children: ReactNode; label?: string }) {
  const { state, dispatch } = useApp()
  if (state.settings.premium) return <>{children}</>
  return (
    <div style={{ position: 'relative', borderRadius: 'var(--r-lg)', overflow: 'hidden' }}>
      <div aria-hidden style={{ filter: 'blur(7px)', pointerEvents: 'none', userSelect: 'none', opacity: 0.65 }}>
        {children}
      </div>
      <div
        style={{
          position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 10, background: 'color-mix(in srgb, var(--bg) 35%, transparent)', textAlign: 'center', padding: 16,
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
  )
}
