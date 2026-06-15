// Hacktrack — primitivas de identidad/confianza compartidas (fuente única de verdad).
import { useApp } from '../lib/store'
import { IcShield } from './icons'

// Avatar del usuario: inicial real del nombre (state.profile.name) o escudo si no hay.
export function UserAvatar({ size = 44, tone = 'filled' }: { size?: number; tone?: 'filled' | 'soft' }) {
  const { state } = useApp()
  const initial = state.profile.name?.trim().charAt(0).toUpperCase()
  const filled = tone === 'filled'
  return (
    <div
      aria-hidden="true"
      style={{
        width: size, height: size, borderRadius: 999, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: filled ? 'var(--brand-700)' : 'var(--card)',
        color: filled ? 'var(--ink-0)' : 'var(--brand-700)',
        border: filled ? 'none' : '3px solid var(--border)',
        fontWeight: 700, fontSize: Math.round(size * 0.42), overflow: 'hidden',
      }}
    >
      {initial ?? <IcShield size={Math.round(size * 0.5)} style={{ color: filled ? 'var(--ink-0)' : 'var(--brand-700)' }} />}
    </div>
  )
}

// Badge de cumplimiento LFPDPPP — copy legal centralizado (consistente en toda la app).
export function TrustBadge() {
  return (
    <div
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px',
        borderRadius: 9999, background: 'var(--ink-100)', color: 'var(--ink-700)',
      }}
    >
      <IcShield size={14} />
      <span className="sm" style={{ fontSize: 12, fontFamily: 'JetBrains Mono' }}>Hecho en México · Cumple LFPDPPP</span>
    </div>
  )
}

// Chip de confianza compacto ("Tus datos son tuyos") — para Home/encabezados.
export function TrustChip({ onClick }: { onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px',
        borderRadius: 9999, background: 'var(--ink-100)', border: 'none',
        color: 'var(--ink-400)', cursor: onClick ? 'pointer' : 'default',
      }}
    >
      <IcShield size={12} />
      <span className="sm" style={{ fontSize: 11.5 }}>Tus datos son tuyos</span>
    </button>
  )
}
