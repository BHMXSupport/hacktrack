import { motion } from 'framer-motion'
import { useApp } from '../lib/store'
import { IcBack, IcShield, IcCheck, IcChevron } from '../components/icons'

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
            <div
              style={{
                width: 80,
                height: 80,
                borderRadius: '50%',
                background: 'var(--card)',
                border: '3px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 32,
                color: 'var(--brand-700)',
                overflow: 'hidden',
              }}
            >
              {/* Placeholder de avatar — sin imagen externa (no imágenes de perfil remotas) */}
              <IcShield size={36} style={{ color: 'var(--brand-700)' }} />
            </div>
            <div className="h1" style={{ margin: 0, textAlign: 'center' }}>
              Alejandro
            </div>
            <div className="sm" style={{ color: 'var(--ink-400)', margin: 0 }}>
              Miembro desde 2023
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
              <button className="row">
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
              <button className="row">
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
              <button className="row">
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
            <div
              className="badge badge-mint"
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <IcShield size={14} />
              <span className="mono">Hecho en México · Cumple con LFPDPPP</span>
            </div>

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
