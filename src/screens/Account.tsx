import { useState } from 'react'
import { useApp } from '../lib/store'
import { IcDrop, IcShield } from '../components/icons'
import { Disclaimer } from '../components/controls'

// SVG logos para proveedores OAuth (sin imágenes externas)
function AppleLogo() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.15 2.95.97 3.63 2.38-3.18 2.05-2.43 6.64.93 7.85-.75 1.58-1.57 3.23-3.21 2.78zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </svg>
  )
}

function GoogleLogo() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  )
}

export function Account() {
  const { dispatch } = useApp()
  const [showPw, setShowPw] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    dispatch({ t: 'tab', tab: 'inicio' })
    dispatch({ t: 'go', screen: 's-app' })
  }

  function handleBiohack() {
    dispatch({ t: 'go', screen: 's-import' })
  }

  return (
    <div
      className="scroll"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        padding: '32px 20px 40px',
        maxWidth: 480,
        margin: '0 auto',
        minHeight: '100dvh',
        boxSizing: 'border-box',
      }}
    >
      {/* Header — icono + wordmark */}
      <header
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 8,
          marginBottom: 32,
        }}
      >
        <IcDrop
          size={32}
          style={{ color: 'var(--brand-700)' }}
          aria-hidden="true"
        />
        <span
          className="h1"
          style={{
            color: 'var(--brand-700)',
            margin: 0,
            letterSpacing: '-0.01em',
          }}
        >
          Hacktrack
        </span>
      </header>

      {/* Título de pantalla */}
      <h2
        className="display-l"
        style={{
          textAlign: 'center',
          marginBottom: 24,
          color: 'var(--ink-900)',
        }}
      >
        Crea tu cuenta
      </h2>

      {/* Card destacada BiohackMX */}
      <div
        className="card"
        style={{
          border: '1px solid var(--brand-700)',
          borderRadius: 20,
          padding: 0,
          marginBottom: 24,
          overflow: 'hidden',
          boxShadow: '0 4px 16px rgba(11,18,32,.08)',
        }}
      >
        {/* Barra de acento superior (mint gradient) */}
        <div
          style={{
            height: 4,
            background: 'linear-gradient(90deg, var(--brand-700) 0%, #5eead4 100%)',
          }}
          aria-hidden="true"
        />

        <div style={{ padding: 24 }}>
          {/* Encabezado de la card */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 16 }}>
            <div
              aria-hidden="true"
              style={{
                background: 'rgba(14,90,82,.10)',
                borderRadius: 12,
                padding: 8,
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <IcLeafFilled size={24} />
            </div>
            <div>
              <p
                className="body"
                style={{
                  fontWeight: 600,
                  fontSize: 18,
                  color: 'var(--ink-900)',
                  margin: '0 0 4px',
                }}
              >
                Únete con BiohackMX
              </p>
              <p className="sm" style={{ color: 'var(--ink-700)', margin: 0 }}>
                Inicias sesión en su sitio; nosotros nunca vemos tu contraseña.
              </p>
            </div>
          </div>

          <button
            className="btn btn-brand"
            style={{ width: '100%', height: 52, borderRadius: 16, fontSize: 16 }}
            onClick={handleBiohack}
          >
            Conectar con BiohackMX
          </button>
        </div>
      </div>

      {/* Divider */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          marginBottom: 24,
        }}
        aria-hidden="true"
      >
        <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        <span className="sm" style={{ color: 'var(--ink-400)', whiteSpace: 'nowrap' }}>
          o crea tu cuenta en Hacktrack
        </span>
        <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
      </div>

      {/* Botones sociales */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        <button
          className="btn btn-outline"
          style={{
            flex: 1,
            height: 52,
            borderRadius: 16,
            fontSize: 15,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
          type="button"
          aria-label="Continuar con Apple"
        >
          <AppleLogo />
          Continuar con Apple
        </button>
        <button
          className="btn btn-outline"
          style={{
            flex: 1,
            height: 52,
            borderRadius: 16,
            fontSize: 15,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
          type="button"
          aria-label="Continuar con Google"
        >
          <GoogleLogo />
          Continuar con Google
        </button>
      </div>

      {/* Formulario email / contraseña */}
      <form
        onSubmit={handleCreate}
        style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}
      >
        {/* Campo correo */}
        <div>
          <label className="label" htmlFor="ht-email">
            Correo electrónico
          </label>
          <input
            id="ht-email"
            className="field"
            type="email"
            autoComplete="email"
            placeholder="tu@correo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        {/* Campo contraseña */}
        <div>
          <label className="label" htmlFor="ht-password">
            Contraseña
          </label>
          <div style={{ position: 'relative' }}>
            <input
              id="ht-password"
              className="field"
              type={showPw ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ paddingRight: 48 }}
            />
            <button
              type="button"
              aria-label={showPw ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              onClick={() => setShowPw((v) => !v)}
              style={{
                position: 'absolute',
                right: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 4,
                color: 'var(--ink-400)',
                lineHeight: 0,
              }}
            >
              {showPw ? (
                // Ojo tachado (ocultar)
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                  <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              ) : (
                // Ojo (mostrar)
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>
        </div>

        <button
          type="submit"
          className="btn btn-brand"
          style={{ height: 52, borderRadius: 16, fontSize: 16, marginTop: 4 }}
        >
          Crear cuenta
        </button>
      </form>

      {/* Footer */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16,
          marginTop: 'auto',
          textAlign: 'center',
        }}
      >
        {/* Link "ya tengo cuenta" */}
        <button
          type="button"
          className="btn btn-ghost"
          style={{ fontSize: 15, color: 'var(--brand-700)', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          onClick={() => dispatch({ t: 'go', screen: 's-app' })}
        >
          Ya tengo cuenta · Iniciar sesión
        </button>

        {/* Disclaimer de auto-registro */}
        <Disclaimer kind="general" />

        {/* Legal LFPDPPP */}
        <p
          className="sm"
          style={{
            color: 'var(--ink-400)',
            fontSize: 12,
            lineHeight: '1.6',
            maxWidth: 360,
          }}
        >
          Al crear una cuenta, aceptas nuestra Política de Privacidad y confirmas
          que has leído el{' '}
          <strong style={{ color: 'var(--ink-700)' }}>
            Aviso de Privacidad (LFPDPPP)
          </strong>{' '}
          para el manejo seguro de tus datos personales en México.
        </p>

        {/* Insignia de cumplimiento */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 14px',
            borderRadius: 9999,
            background: 'var(--ink-100)',
            color: 'var(--ink-700)',
          }}
        >
          <IcShield size={14} aria-hidden="true" />
          <span className="sm" style={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace' }}>
            Hecho en México · Cumple con LFPDPPP
          </span>
        </div>
      </div>
    </div>
  )
}

// Ícono de hoja relleno (sin jeringas — compliance)
function IcLeafFilled({ size = 24 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="var(--brand-700)"
      stroke="none"
      aria-hidden="true"
    >
      <path d="M4 20c8 1 14-4 16-16C10 4 5 9 4 20Z" />
      <path d="M4 20C7 14 11 11 16 9" stroke="white" strokeWidth="1.5" strokeLinecap="round" fill="none" />
    </svg>
  )
}
