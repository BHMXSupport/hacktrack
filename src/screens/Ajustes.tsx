import { IcBell, IcChevron, IcDrop } from '../components/icons'
import { Toggle, Disclaimer } from '../components/controls'
import { useApp } from '../lib/store'

export function Ajustes() {
  const { state, dispatch } = useApp()
  const { settings } = state

  return (
    <div className="scroll has-nav">
      {/* Cabecera pegajosa */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 40,
          background: 'var(--bg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px 12px',
        }}
      >
        <h1 className="h1" style={{ margin: 0 }}>Ajustes</h1>
        {/* Avatar decorativo */}
        <div
          aria-hidden
          style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            background: 'var(--brand-100, #acefe4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <IcDrop size={18} style={{ color: 'var(--brand-700)' }} />
        </div>
      </header>

      <main style={{ padding: '0 20px 32px', display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 800, margin: '0 auto' }}>

        {/* ── RECORDATORIOS ── */}
        <section>
          <p className="sm" style={{ textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-400)', marginBottom: 8, paddingLeft: 4 }}>
            Recordatorios
          </p>
          <div className="rowlist card">
            {/* Recordatorio de registro — tappable para editar hora */}
            <button
              className="row"
              style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer' }}
              aria-label="Editar hora de recordatorio"
              onClick={() => dispatch({ t: 'toast', msg: 'Configura tu hora de recordatorio' })}
            >
              <span className="row-ic">
                <IcBell size={20} style={{ color: 'var(--brand-700)' }} />
              </span>
              <span className="row-main">
                <span className="row-label">Recordatorio de registro</span>
                <span className="row-sub">Es hora de tu registro de hoy</span>
              </span>
              <span className="row-end">
                <span className="badge badge-mint mono">08:00</span>
              </span>
            </button>

            {/* Resumen semanal */}
            <div className="row">
              <span className="row-ic">
                <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--brand-700)' }}>
                  <path d="M3 18l4-8 4 6 3-4 4 6" /><path d="M21 21H3" />
                </svg>
              </span>
              <span className="row-main">
                <span className="row-label">Resumen semanal</span>
              </span>
              <span className="row-end">
                <Toggle
                  on={settings.weeklySummary}
                  onChange={(v) => dispatch({ t: 'setSetting', key: 'weeklySummary', value: v })}
                  label="Activar resumen semanal"
                />
              </span>
            </div>

            {/* Avisos por correo */}
            <div className="row">
              <span className="row-ic">
                <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--brand-700)' }}>
                  <rect x="2" y="4" width="20" height="16" rx="2" /><path d="m2 7 10 7 10-7" />
                </svg>
              </span>
              <span className="row-main">
                <span className="row-label">Avisos por correo</span>
              </span>
              <span className="row-end">
                <Toggle
                  on={settings.emailNotices}
                  onChange={(v) => dispatch({ t: 'setSetting', key: 'emailNotices', value: v })}
                  label="Activar avisos por correo"
                />
              </span>
            </div>
          </div>
        </section>

        {/* ── APARIENCIA ── */}
        <section>
          <p className="sm" style={{ textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-400)', marginBottom: 8, paddingLeft: 4 }}>
            Apariencia
          </p>
          <div className="rowlist card">
            {/* Tema oscuro */}
            <div className="row">
              <span className="row-ic">
                <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--brand-700)' }}>
                  <path d="M12 3a9 9 0 1 0 9 9 7 7 0 0 1-9-9Z" />
                </svg>
              </span>
              <span className="row-main">
                <span className="row-label">Tema oscuro</span>
              </span>
              <span className="row-end">
                <Toggle
                  on={settings.darkMode}
                  onChange={(v) => dispatch({ t: 'setSetting', key: 'darkMode', value: v })}
                  label="Activar tema oscuro"
                />
              </span>
            </div>

            {/* Unidades */}
            <button
              className="row"
              style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer' }}
              aria-label="Configurar unidades"
              onClick={() => dispatch({ t: 'toast', msg: 'Configuración de unidades próximamente' })}
            >
              <span className="row-ic">
                <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--brand-700)' }}>
                  <path d="M21 6H3M3 12h12M3 18h6" />
                </svg>
              </span>
              <span className="row-main">
                <span className="row-label">Unidades</span>
              </span>
              <span className="row-end">
                <IcChevron size={18} style={{ color: 'var(--ink-300)' }} />
              </span>
            </button>
          </div>
        </section>

        {/* ── CUENTA ── */}
        <section>
          <p className="sm" style={{ textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-400)', marginBottom: 8, paddingLeft: 4 }}>
            Cuenta
          </p>
          <div className="rowlist card">
            {/* Importar de BiohackMX */}
            <button
              className="row"
              style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer' }}
              aria-label="Importar de BiohackMX"
              onClick={() => dispatch({ t: 'go', screen: 's-import' })}
            >
              <span className="row-ic">
                <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--brand-700)' }}>
                  <path d="M21 12a9 9 0 0 1-9 9m9-9a9 9 0 0 0-9-9m9 9H3m9 9a9 9 0 0 1-9-9m9 9c1.66 0 3-4.03 3-9s-1.34-9-3-9m0 18c-1.66 0-3-4.03 3-9s1.34-9 3-9M3 12a9 9 0 0 1 9-9" />
                </svg>
              </span>
              <span className="row-main">
                <span className="row-label">Importar de BiohackMX</span>
              </span>
              <span className="row-end">
                <IcChevron size={18} style={{ color: 'var(--ink-300)' }} />
              </span>
            </button>

            {/* Perfil y privacidad */}
            <button
              className="row"
              style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer' }}
              aria-label="Perfil y privacidad"
              onClick={() => dispatch({ t: 'sheet', sheet: 'perfil' })}
            >
              <span className="row-ic">
                <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--brand-700)' }}>
                  <path d="M12 3 5 6v6c0 4 3 7 7 9 4-2 7-5 7-9V6l-7-3Z" />
                </svg>
              </span>
              <span className="row-main">
                <span className="row-label">Perfil y privacidad</span>
              </span>
              <span className="row-end">
                <IcChevron size={18} style={{ color: 'var(--ink-300)' }} />
              </span>
            </button>

            {/* PIN de acceso — P1-3: refleja estado real de settings.pinEnabled */}
            <div className="row">
              <span className="row-ic">
                <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--brand-700)' }}>
                  <rect x="5" y="11" width="14" height="10" rx="2" />
                  <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                </svg>
              </span>
              <span className="row-main">
                <span className="row-label">PIN de acceso</span>
              </span>
              <span className="row-end">
                <Toggle
                  on={settings.pinEnabled}
                  onChange={(v) => dispatch({ t: 'setSetting', key: 'pinEnabled', value: v })}
                  label="Activar PIN de acceso"
                />
              </span>
            </div>

            {/* Cerrar sesión — acción destructiva */}
            <button
              className="row danger"
              style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer' }}
              aria-label="Cerrar sesión"
              onClick={() => dispatch({ t: 'reset' })}
            >
              <span className="row-ic">
                <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </span>
              <span className="row-main">
                <span className="row-label">Cerrar sesión</span>
              </span>
            </button>
          </div>
        </section>

        {/* Disclaimer — audit guardrail: no reducir instancias */}
        <Disclaimer kind="general" />

        {/* Banner decorativo */}
        <div
          style={{
            borderRadius: 20,
            overflow: 'hidden',
            background: 'linear-gradient(135deg, var(--brand-700) 0%, #063B36 100%)',
            padding: '28px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
          aria-hidden
        >
          <p className="body" style={{ color: '#ffffff', fontWeight: 600, margin: 0 }}>Tu progreso es constante.</p>
          <p className="sm" style={{ color: 'var(--brand-100, #acefe4)', margin: 0 }}>Continúa optimizando tu rutina día con día.</p>
        </div>

      </main>
    </div>
  )
}
