import { useState } from 'react'
import { useApp } from '../lib/store'
import { IcDrop, IcShield } from '../components/icons'
import { BiohackmxConnect } from '../components/BiohackmxConnect'
import { Disclaimer } from '../components/controls'

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

export function Login() {
  const { dispatch } = useApp()
  const [showPw, setShowPw] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  function enter() {
    dispatch({ t: 'tab', tab: 'inicio' })
    dispatch({ t: 'go', screen: 's-app' })
  }

  return (
    <div
      className="scroll"
      style={{ display: 'flex', flexDirection: 'column', padding: '32px 20px 40px', maxWidth: 480, margin: '0 auto', minHeight: '100dvh', boxSizing: 'border-box' }}
    >
      <header style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginBottom: 32 }}>
        <IcDrop size={32} style={{ color: 'var(--brand-700)' }} aria-hidden="true" />
        <span className="h1" style={{ color: 'var(--brand-700)', margin: 0, letterSpacing: '-0.01em' }}>Hacktrack</span>
      </header>

      <h2 className="display-l" style={{ textAlign: 'center', marginBottom: 6, color: 'var(--ink-900)' }}>
        Inicia sesión
      </h2>
      <p className="sm" style={{ textAlign: 'center', color: 'var(--ink-400)', marginBottom: 24 }}>
        Bienvenido de vuelta
      </p>

      {/* Conexión con BiohackMX — opción principal */}
      <div style={{ marginBottom: 24 }}>
        <BiohackmxConnect />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }} aria-hidden="true">
        <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        <span className="sm" style={{ color: 'var(--ink-400)', whiteSpace: 'nowrap' }}>o continúa con</span>
        <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        <button className="btn btn-outline" style={{ flex: 1, height: 52, borderRadius: 16, fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }} type="button" aria-label="Continuar con Apple">
          <AppleLogo /> Apple
        </button>
        <button className="btn btn-outline" style={{ flex: 1, height: 52, borderRadius: 16, fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }} type="button" aria-label="Continuar con Google">
          <GoogleLogo /> Google
        </button>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); enter() }} style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
        <div>
          <label className="label" htmlFor="lg-email">Correo electrónico</label>
          <input id="lg-email" className="field" type="email" autoComplete="email" placeholder="tu@correo.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="lg-password">Contraseña</label>
          <div style={{ position: 'relative' }}>
            <input id="lg-password" className="field" type={showPw ? 'text' : 'password'} autoComplete="current-password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} style={{ paddingRight: 48 }} />
            <button type="button" aria-label={showPw ? 'Ocultar contraseña' : 'Mostrar contraseña'} onClick={() => setShowPw((v) => !v)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--ink-400)', lineHeight: 0 }}>
              {showPw ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" /><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
              )}
            </button>
          </div>
        </div>
        <button type="submit" className="btn btn-brand" style={{ height: 52, borderRadius: 16, fontSize: 16, marginTop: 4 }}>
          Iniciar sesión
        </button>
      </form>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, marginTop: 'auto', textAlign: 'center' }}>
        <button type="button" className="btn btn-ghost" style={{ fontSize: 15, color: 'var(--brand-700)', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }} onClick={() => dispatch({ t: 'go', screen: 's-account' })}>
          ¿No tienes cuenta? · Crear cuenta
        </button>
        <Disclaimer kind="general" />
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 9999, background: 'var(--ink-100)', color: 'var(--ink-700)' }}>
          <IcShield size={14} aria-hidden="true" />
          <span className="sm" style={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace' }}>Hecho en México · Cumple con LFPDPPP</span>
        </div>
      </div>
    </div>
  )
}
