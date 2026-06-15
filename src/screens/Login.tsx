import { useState } from 'react'
import { useApp } from '../lib/store'
import { IcDrop } from '../components/icons'
import { BiohackmxConnect } from '../components/BiohackmxConnect'
import { Disclaimer } from '../components/controls'
import { AppleLogo, GoogleLogo } from '../components/SocialAuth'
import { TrustBadge } from '../components/identity'

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
        <TrustBadge />
      </div>
    </div>
  )
}
