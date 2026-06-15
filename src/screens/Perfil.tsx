import { motion } from 'framer-motion'
import { useApp } from '../lib/store'
import { IcBack, IcShield, IcCheck, IcChevron } from '../components/icons'
import { UserAvatar, TrustBadge } from '../components/identity'

export function Perfil() {
  const { state, dispatch } = useApp()
  const { settings } = state

  const close = () => dispatch({ t: 'sheet', sheet: null })

  const consentLabel =
    settings.consentVersion +
    ' — ' +
    (settings.consentActive ? 'activo' : 'revocado')

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', stiffness: 320, damping: 32 }}
      style={{ position: 'absolute', inset: 0, background: 'var(--bg)', zIndex: 50 }}
    >
      <div className="scroll">
        {/* Top bar */}
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '16px 20px',
            borderBottom: '1px solid var(--border)',
            position: 'sticky',
            top: 0,
            background: 'var(--bg)',
            zIndex: 10,
          }}
        >
          <button
            className="iconbtn"
            onClick={close}
            aria-label="Volver"
          >
            <IcBack size={22} />
          </button>
          <span className="h2" style={{ flex: 1, margin: 0 }}>
            Perfil y privacidad
          </span>
        </header>

        <div style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 32 }}>
          {/* Avatar + nombre */}
          <section style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <UserAvatar size={80} tone="soft" />
            <div className="h1" style={{ margin: 0, textAlign: 'center' }}>
              {state.profile.name ?? 'Tu perfil'}
            </div>
            <div className="sm" style={{ color: 'var(--ink-400)', margin: 0 }}>
              Tus datos son tuyos
            </div>
          </section>

          {/* Sección: Privacidad y datos */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div
              className="body"
              style={{
                color: 'var(--ink-700)',
                fontWeight: 600,
                paddingLeft: 4,
              }}
            >
              Privacidad y datos
            </div>
            <div className="rowlist">
              {/* Estado de consentimiento */}
              <button
                className="row"
                onClick={() => dispatch({ t: 'sheet', sheet: 'arco' })}
              >
                <span className="row-ic">
                  <IcShield size={18} style={{ color: 'var(--brand-700)' }} />
                </span>
                <span className="row-main">
                  <span className="row-label">Estado de consentimiento</span>
                  <span className="row-sub mono">{consentLabel}</span>
                </span>
                <span className="row-end">
                  <IcChevron size={16} style={{ color: 'var(--ink-400)' }} />
                </span>
              </button>

              {/* Derechos ARCO */}
              <button
                className="row"
                onClick={() => dispatch({ t: 'sheet', sheet: 'arco' })}
              >
                <span className="row-ic">
                  <IcCheck size={18} style={{ color: 'var(--brand-700)' }} />
                </span>
                <span className="row-main">
                  <span className="row-label">Derechos ARCO</span>
                </span>
                <span className="row-end">
                  <IcChevron size={16} style={{ color: 'var(--ink-400)' }} />
                </span>
              </button>

              {/* Descargar mis datos (Acceso) */}
              <button
                className="row"
                onClick={() => dispatch({ t: 'sheet', sheet: 'arco' })}
              >
                <span className="row-ic">
                  <IcBack
                    size={18}
                    style={{ color: 'var(--brand-700)', transform: 'rotate(-90deg)' }}
                  />
                </span>
                <span className="row-main">
                  <span className="row-label">Descargar mis datos (Acceso)</span>
                </span>
                <span className="row-end">
                  <IcChevron size={16} style={{ color: 'var(--ink-400)' }} />
                </span>
              </button>

              {/* Corregir mis datos (Rectificación) */}
              <button
                className="row"
                onClick={() => dispatch({ t: 'sheet', sheet: 'arco' })}
              >
                <span className="row-ic">
                  <IcCheck size={18} style={{ color: 'var(--brand-700)' }} />
                </span>
                <span className="row-main">
                  <span className="row-label">Corregir mis datos (Rectificación)</span>
                </span>
                <span className="row-end">
                  <IcChevron size={16} style={{ color: 'var(--ink-400)' }} />
                </span>
              </button>

              {/* Gestionar consentimiento */}
              <button
                className="row"
                onClick={() => dispatch({ t: 'sheet', sheet: 'arco' })}
              >
                <span className="row-ic">
                  <IcShield size={18} style={{ color: 'var(--brand-700)' }} />
                </span>
                <span className="row-main">
                  <span className="row-label">
                    Gestionar consentimiento (Oposición / Cancelación)
                  </span>
                </span>
                <span className="row-end">
                  <IcChevron size={16} style={{ color: 'var(--ink-400)' }} />
                </span>
              </button>

              {/* Aviso de privacidad */}
              <button className="row" onClick={() => dispatch({ t: 'toast', msg: 'Aviso de privacidad — próximamente' })}>
                <span className="row-ic">
                  <IcShield size={18} style={{ color: 'var(--brand-700)' }} />
                </span>
                <span className="row-main">
                  <span className="row-label">Aviso de privacidad</span>
                </span>
                <span className="row-end">
                  <IcChevron size={16} style={{ color: 'var(--ink-400)' }} />
                </span>
              </button>
            </div>
          </section>

          {/* Sección: Cuenta */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div
              className="body"
              style={{
                color: 'var(--ink-700)',
                fontWeight: 600,
                paddingLeft: 4,
              }}
            >
              Cuenta
            </div>
            <div className="rowlist">
              {/* Información personal */}
              <button className="row" onClick={() => dispatch({ t: 'sheet', sheet: 'medidas' })}>
                <span className="row-ic">
                  <IcShield size={18} style={{ color: 'var(--brand-700)' }} />
                </span>
                <span className="row-main">
                  <span className="row-label">Información personal</span>
                </span>
                <span className="row-end">
                  <IcChevron size={16} style={{ color: 'var(--ink-400)' }} />
                </span>
              </button>

              {/* Seguridad y contraseña */}
              <button className="row" onClick={() => dispatch({ t: 'toast', msg: 'Seguridad y contraseña — próximamente' })}>
                <span className="row-ic">
                  <IcShield size={18} style={{ color: 'var(--brand-700)' }} />
                </span>
                <span className="row-main">
                  <span className="row-label">Seguridad y contraseña</span>
                </span>
                <span className="row-end">
                  <IcChevron size={16} style={{ color: 'var(--ink-400)' }} />
                </span>
              </button>

              {/* Cerrar sesión — vuelve a Iniciar sesión (conserva tus datos) */}
              <button className="row" aria-label="Cerrar sesión" onClick={() => dispatch({ t: 'go', screen: 's-login' })}>
                <span className="row-ic">
                  <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="var(--brand-700)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                </span>
                <span className="row-main">
                  <span className="row-label">Cerrar sesión</span>
                </span>
                <span className="row-end">
                  <IcChevron size={16} style={{ color: 'var(--ink-400)' }} />
                </span>
              </button>
            </div>
          </section>

          {/* Footer: badge LFPDPPP + borrar cuenta */}
          <section
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 20,
              paddingBottom: 32,
            }}
          >
            <TrustBadge />

            <button
              className="row danger"
              style={{ width: '100%', borderRadius: 12 }}
              onClick={() =>
                dispatch({ t: 'sheet', sheet: 'confirm-delete', arg: '__account' })
              }
            >
              <span className="row-main">
                <span className="row-label">Borrar mi cuenta</span>
              </span>
            </button>
          </section>
        </div>
      </div>
    </motion.div>
  )
}
