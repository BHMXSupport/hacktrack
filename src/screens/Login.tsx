import { useState } from 'react'
import { motion } from 'framer-motion'
import { useApp } from '../lib/store'
import { staggerParent, staggerItem } from '../lib/motion'
import { IcDrop } from '../components/icons'
import { BiohackmxConnect } from '../components/BiohackmxConnect'
import { Disclaimer } from '../components/controls'
import { AppleLogo, GoogleLogo } from '../components/SocialAuth'
import { TrustBadge } from '../components/identity'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function Login() {
  const { dispatch } = useApp()
  const [showPw, setShowPw] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [emailError, setEmailError] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loginError, setLoginError] = useState(false)

  function handleEmailBlur() {
    setEmailError(email.trim() !== '' && !EMAIL_RE.test(email.trim()))
  }

  function handleEmailChange(e: React.ChangeEvent<HTMLInputElement>) {
    setEmail(e.target.value)
    if (emailError && EMAIL_RE.test(e.target.value.trim())) setEmailError(false)
  }

  function enter(e: React.FormEvent) {
    e.preventDefault()
    if (loading) return
    setLoginError(false)
    setLoading(true)
    setTimeout(() => {
      setLoading(false)
      // En el futuro: si auth falla → setLoginError(true); return
      dispatch({ t: 'tab', tab: 'inicio' })
      dispatch({ t: 'go', screen: 's-app' })
    }, 600)
  }

  return (
    <div
      className="scroll"
      style={{ display: 'flex', flexDirection: 'column', padding: '32px 20px 40px', maxWidth: 480, margin: '0 auto', minHeight: '100dvh', boxSizing: 'border-box' }}
    >
      <motion.div variants={staggerParent} initial="initial" animate="animate" style={{ display: 'contents' }}>

        <motion.div variants={staggerItem}>
          <header style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginBottom: 32 }}>
            <IcDrop size={32} style={{ color: 'var(--brand-700)' }} aria-hidden="true" />
            <span className="h1" style={{ color: 'var(--brand-700)', margin: 0, letterSpacing: '-0.01em' }}>Hacktrack</span>
          </header>
        </motion.div>

        <motion.div variants={staggerItem}>
          <h2 className="display-l" style={{ textAlign: 'center', marginBottom: 6, color: 'var(--ink-900)' }}>
            Inicia sesión
          </h2>
          <p className="sm" style={{ textAlign: 'center', color: 'var(--ink-400)', marginBottom: 24 }}>
            Bienvenido de vuelta
          </p>
        </motion.div>

        {/* Conexión con BiohackMX — opción principal */}
        <motion.div variants={staggerItem}>
          <div style={{ marginBottom: 24 }}>
            <BiohackmxConnect />
          </div>
        </motion.div>

        <motion.div variants={staggerItem}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }} aria-hidden="true">
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            <span className="sm" style={{ color: 'var(--ink-400)', whiteSpace: 'nowrap' }}>o continúa con</span>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>
        </motion.div>

        <motion.div variants={staggerItem}>
          {/* labels cortas (el logo identifica el proveedor) para no desbordar a 412px */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
            <button className="btn btn-outline btn-social" type="button" aria-label="Continuar con Apple" style={{ minWidth: 0 }}>
              <AppleLogo /> Apple
            </button>
            <button className="btn btn-outline btn-social" type="button" aria-label="Continuar con Google" style={{ minWidth: 0 }}>
              <GoogleLogo /> Google
            </button>
          </div>
        </motion.div>

        <motion.div variants={staggerItem}>
          <form onSubmit={enter} style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
            <div>
              <label className="label" htmlFor="lg-email">Correo electrónico</label>
              <input
                id="lg-email"
                className={'field' + (emailError ? ' error' : '')}
                type="email"
                autoComplete="email"
                placeholder="tu@correo.com"
                value={email}
                onChange={handleEmailChange}
                onBlur={handleEmailBlur}
                aria-describedby={emailError ? 'lg-email-error' : undefined}
                aria-invalid={emailError ? 'true' : undefined}
              />
              {emailError && (
                <p id="lg-email-error" role="alert" className="field-error sm" style={{ color: 'var(--error)', marginTop: 4 }}>
                  Ingresa un correo electrónico válido.
                </p>
              )}
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
            <button type="button" className="sm" style={{ alignSelf: 'flex-end', background: 'none', border: 0, color: 'var(--brand-700)', fontWeight: 600, cursor: 'pointer', padding: 0 }} onClick={() => dispatch({ t: 'go', screen: 's-forgot' })}>¿Olvidaste tu contraseña?</button>
            {loginError && (
              <p role="alert" className="field-error sm" style={{ color: 'var(--error)', textAlign: 'center' }}>
                No pudimos iniciar sesión. Verifica tus datos e intenta de nuevo.
              </p>
            )}
            <button
              type="submit"
              className="btn btn-brand"
              style={{ height: 52, borderRadius: 16, fontSize: 16, marginTop: 4, opacity: loading ? 0.7 : 1 }}
              disabled={loading}
              aria-disabled={loading}
              aria-busy={loading}
            >
              {loading ? 'Entrando…' : 'Iniciar sesión'}
            </button>
          </form>
        </motion.div>

        <motion.div variants={staggerItem}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, marginTop: 'auto', textAlign: 'center' }}>
            <button type="button" className="btn btn-ghost" style={{ fontSize: 15, color: 'var(--brand-700)', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }} onClick={() => dispatch({ t: 'go', screen: 's-account' })}>
              ¿No tienes cuenta? · Crear cuenta
            </button>
            <Disclaimer kind="general" />
            <TrustBadge />
          </div>
        </motion.div>

      </motion.div>
    </div>
  )
}
