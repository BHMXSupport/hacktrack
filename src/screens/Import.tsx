import { useState } from 'react'
import { useApp } from '../lib/store'
import { IcBack, IcDrop } from '../components/icons'
import { Disclaimer } from '../components/controls'

export function Import() {
  const { dispatch } = useApp()

  const [email, setEmail]     = useState('')
  const [orden, setOrden]     = useState('')
  const [consent, setConsent] = useState(false)

  function handleImport() {
    dispatch({ t: 'importProducts', names: ['BPC-157', 'Retatrutide'] })
    dispatch({ t: 'tab', tab: 'inicio' })
    dispatch({ t: 'go', screen: 's-app' })
    dispatch({ t: 'toast', msg: 'Productos importados' })
  }

  function handleManual() {
    dispatch({ t: 'go', screen: 's-app' })
  }

  return (
    <div className="scroll" style={{ paddingBottom: 32 }}>

      {/* Top bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '16px 20px 8px',
        position: 'sticky',
        top: 0,
        background: 'var(--bg)',
        zIndex: 10,
      }}>
        <button
          className="iconbtn"
          onClick={() => dispatch({ t: 'go', screen: 's-app' })}
          aria-label="Regresar"
        >
          <IcBack />
        </button>
        <span className="h2" style={{ margin: 0 }}>Importar productos</span>
      </div>

      <div style={{ padding: '8px 20px 0', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Info card */}
        <div className="card" style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
            background: 'var(--ink-100)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--brand-700)',
          }}>
            <IcDrop />
          </div>
          <p className="body" style={{ margin: 0, color: 'var(--ink-700)' }}>
            Puedes importar una orden para precargar tus productos; tú traes tus datos.
            Este paso es opcional.
          </p>
        </div>

        {/* Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Email */}
          <div>
            <label className="label" htmlFor="import-email">
              Correo electrónico
            </label>
            <input
              id="import-email"
              className="field"
              type="email"
              placeholder="ejemplo@correo.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>

          {/* Número de orden */}
          <div>
            <label className="label" htmlFor="import-orden">
              Número de orden
            </label>
            <input
              id="import-orden"
              className="field"
              type="text"
              placeholder="ej. HT-00001"
              value={orden}
              onChange={e => setOrden(e.target.value)}
              autoComplete="off"
            />
          </div>

          {/* Consent checkbox */}
          <label style={{
            display: 'flex', alignItems: 'flex-start', gap: 12,
            cursor: 'pointer', userSelect: 'none',
          }}>
            <input
              type="checkbox"
              checked={consent}
              onChange={e => setConsent(e.target.checked)}
              style={{
                width: 20, height: 20, marginTop: 2, flexShrink: 0,
                accentColor: 'var(--brand-700)', cursor: 'pointer',
              }}
            />
            <span className="sm" style={{ color: 'var(--ink-700)', lineHeight: '1.5' }}>
              Doy mi consentimiento para transferir los datos de mi orden de forma segura.
            </span>
          </label>
        </div>

        {/* Disclaimer */}
        <Disclaimer kind="general" />

        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button
            className="btn btn-brand"
            onClick={handleImport}
            disabled={!consent}
            style={{ opacity: consent ? 1 : 0.45, cursor: consent ? 'pointer' : 'not-allowed' }}
          >
            Importar orden
          </button>
          <button
            className="btn btn-outline"
            onClick={handleManual}
          >
            Lo agrego manualmente
          </button>
        </div>

      </div>
    </div>
  )
}
