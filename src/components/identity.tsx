// Hacktrack — primitivas de identidad/confianza compartidas (fuente única de verdad).
import { useApp } from '../lib/store'
import { IcShield } from './icons'

// ── Paleta de colores de categoría (N=387) ─────────────────────────────────────
export const CATEGORY_COLOR: Record<string, string> = {
  Metabolismo:    '#0e5a52',
  Recuperación:  '#2e6b9e',
  Cognitivo:     '#5b3e9e',
  Piel:          '#9e3e7d',
  'Anti-Aging':  '#9e5b3e',
  Crecimiento:   '#3e9e58',
  Reproductivo:  '#9e3e47',
  Explorar:      '#3e709e',
}

// ── Avatar del usuario (N=387 / N=388) ─────────────────────────────────────────
// Prioridades:
// 1. avatarDataUrl (foto de cámara/galería — N=388)
// 2. Initial del nombre con color de categoría (settings.avatarColor o curGoal) — (N=387)
// 3. IcShield fallback
export function UserAvatar({
  size = 44,
  tone = 'filled',
}: {
  size?: number
  tone?: 'filled' | 'soft'
}) {
  const { state } = useApp()
  const initial      = state.profile.name?.trim().charAt(0).toUpperCase()
  const avatarUrl    = state.profile.avatarDataUrl as string | null | undefined
  const filled       = tone === 'filled'

  // color: avatarColor > categoría activa > brand-700
  const avatarColor: string =
    state.settings.avatarColor as string
    ?? (state.curGoal ? CATEGORY_COLOR[state.curGoal] ?? 'var(--brand-700)' : 'var(--brand-700)')

  // foto de cámara/galería
  if (avatarUrl) {
    return (
      <div
        aria-hidden="true"
        style={{
          width: size, height: size, borderRadius: 999, flexShrink: 0,
          overflow: 'hidden',
          border: filled ? 'none' : '3px solid var(--border)',
        }}
      >
        <img
          src={avatarUrl}
          alt=""
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      </div>
    )
  }

  return (
    <div
      aria-hidden="true"
      style={{
        width: size, height: size, borderRadius: 999, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: filled ? avatarColor : 'var(--card)',
        color: filled ? 'var(--ink-0)' : avatarColor,
        border: filled ? 'none' : '3px solid var(--border)',
        fontWeight: 700, fontSize: Math.round(size * 0.42), overflow: 'hidden',
      }}
    >
      {initial ?? <IcShield size={Math.round(size * 0.5)} style={{ color: filled ? 'var(--ink-0)' : avatarColor }} />}
    </div>
  )
}

// ── Color-picker de avatar (N=387) ─────────────────────────────────────────────
// 8 opciones: los 7 colores de categoría + brand-700 "por defecto".
export function AvatarColorPicker({ onClose }: { onClose?: () => void }) {
  const { state, dispatch } = useApp()
  const current = state.settings.avatarColor as string | null | undefined

  const palette: { key: string; label: string; color: string }[] = [
    { key: 'brand',   label: 'Predeterminado', color: 'var(--brand-700)' },
    ...Object.entries(CATEGORY_COLOR).map(([cat, color]) => ({ key: cat, label: cat, color })),
  ]

  return (
    <div
      style={{
        display: 'flex', flexWrap: 'wrap', gap: 10,
        justifyContent: 'center', padding: '4px 0',
      }}
      role="radiogroup"
      aria-label="Color de avatar"
    >
      {palette.map(({ key, label, color }) => {
        const active = key === 'brand' ? !current : current === color
        return (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            title={label}
            onClick={() => {
              dispatch({
                t: 'setSetting',
                key: 'avatarColor',
                value: key === 'brand' ? (null as unknown as string) : color,
              })
              onClose?.()
            }}
            style={{
              width: 36, height: 36, borderRadius: 999, border: 'none', cursor: 'pointer',
              background: color === 'var(--brand-700)' ? '#0e5a52' : color,
              boxShadow: active ? '0 0 0 3px var(--bg), 0 0 0 5px ' + (color === 'var(--brand-700)' ? '#0e5a52' : color) : 'none',
              transition: 'box-shadow 0.15s',
            }}
          />
        )
      })}
    </div>
  )
}

// ── Badge de cumplimiento LFPDPPP — copy legal centralizado ────────────────────
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

// ── Chip de confianza compacto ("Tus datos son tuyos") — para Home/encabezados ─
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
