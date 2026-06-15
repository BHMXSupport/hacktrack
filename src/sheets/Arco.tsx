import { Sheet } from '../components/Sheet'
import { IcShield } from '../components/icons'
import { useApp } from '../lib/store'

export function ArcoSheet() {
  const { state, dispatch } = useApp()

  function handleAcceso() {
    if (typeof window === 'undefined') return
    const payload = {
      log: state.log,
      profile: state.profile,
      settings: state.settings,
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'hacktrack-datos.json'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    dispatch({ t: 'toast', msg: 'Datos exportados' })
  }

  return (
    <Sheet title="Derechos ARCO" onClose={() => dispatch({ t: 'sheet', sheet: 'perfil' })}>
      <div className="rowlist" style={{ padding: '0 16px 8px' }}>

        {/* Acceso */}
        <button
          className="row"
          style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%' }}
          onClick={handleAcceso}
        >
          <span className="row-ic" style={{ color: 'var(--brand-700)' }}>
            <IcShield size={20} />
          </span>
          <span className="row-main">
            <span className="row-label">Acceso</span>
            <span className="row-sub">Descargar mis datos</span>
          </span>
        </button>

        {/* Rectificación */}
        <button
          className="row"
          style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%' }}
          onClick={() => dispatch({ t: 'sheet', sheet: 'medidas' })}
        >
          <span className="row-ic" style={{ color: 'var(--brand-700)' }}>
            <IcShield size={20} />
          </span>
          <span className="row-main">
            <span className="row-label">Rectificación</span>
            <span className="row-sub">Corregir mis datos</span>
          </span>
        </button>

        {/* Cancelación */}
        <button
          className="row danger"
          style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%' }}
          onClick={() => dispatch({ t: 'sheet', sheet: 'confirm-delete', arg: '__account' })}
        >
          <span className="row-ic" style={{ color: 'var(--error)' }}>
            <IcShield size={20} />
          </span>
          <span className="row-main">
            <span className="row-label">Cancelación</span>
            <span className="row-sub">Borrar mis datos</span>
          </span>
        </button>

        {/* Oposición */}
        <button
          className="row danger"
          style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%' }}
          onClick={() => dispatch({ t: 'sheet', sheet: 'confirm-delete', arg: '__account' })}
        >
          <span className="row-ic" style={{ color: 'var(--error)' }}>
            <IcShield size={20} />
          </span>
          <span className="row-main">
            <span className="row-label">Oposición</span>
            <span className="row-sub">Revocar consentimiento</span>
          </span>
        </button>
      </div>

      <p className="sm" style={{ padding: '0 16px 20px', color: 'var(--ink-400)' }}>
        Tus derechos ARCO están protegidos por la Ley Federal de Protección de Datos Personales en
        Posesión de los Particulares (LFPDPPP). Ejércelos en cualquier momento.
      </p>
    </Sheet>
  )
}
