import { useState } from 'react'
import { motion } from 'framer-motion'
import { useApp } from '../lib/store'
import { IcDrop, IcBack } from '../components/icons'
import { staggerParent, staggerItem } from '../lib/motion'
import { BiohackmxConnect } from '../components/BiohackmxConnect'
import { Disclaimer } from '../components/controls'
import { AppleLogo, GoogleLogo } from '../components/SocialAuth'
import { TrustBadge } from '../components/identity'

export function Account() {
  const { dispatch } = useApp()
  const [showPw, setShowPw] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [tried, setTried] = useState(false)

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setTried(true); return }
    dispatch({ t: 'setName', name: name.trim() })
    dispatch({ t: 'tab', tab: 'inicio' })
    dispatch({ t: 'go', screen: 's-app' })
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
      <motion.div variants={staggerParent} initial="initial" animate="animate" style={{ display: 'contents' }}>

      {/* Header — 3 columnas: atrás | logo+wordmark | spacer */}
      <motion.div variants={staggerItem}>
        <header
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 32,
          }}
        >
          <button
            className="iconbtn"
            aria-label="Atrás"
            onClick={() => dispatch({ t: 'go', screen: 's-goal' })}
          >
            <IcBack size={22} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
          </div>
          <div style={{ width: 36 }} />
        </header>
      </motion.div>

      {/* Título de pantalla */}
      <motion.div variants={staggerItem}>
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
      </motion.div>

      {/* Conexión con BiohackMX — opción principal */}
      <motion.div variants={staggerItem} style={{ marginBottom: 24 }}>
        <BiohackmxConnect />
      </motion.div>

      {/* Divider */}
      <motion.div
        variants={staggerItem}
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
      </motion.div>

      {/* Botones sociales */}
      <motion.div variants={staggerItem} style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        <button
          className="btn btn-outline btn-social"
          type="button"
          aria-label="Continuar con Apple"
        >
          <AppleLogo />
          Continuar con Apple
        </button>
        <button
          className="btn btn-outline btn-social"
          type="button"
          aria-label="Continuar con Google"
        >
          <GoogleLogo />
          Continuar con Google
        </button>
      </motion.div>

      {/* Formulario email / contraseña */}
      <motion.div variants={staggerItem}>
      <form
        onSubmit={handleCreate}
        style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}
      >
        {/* Campo nombre (requerido) */}
        <div>
          <label className="label" htmlFor="ht-name">
            ¿Cómo te llamas?<span aria-hidden="true" style={{ color: 'var(--error)' }}> *</span>
          </label>
          <input
            id="ht-name"
            className={'field' + (tried && !name.trim() ? ' error' : '')}
            type="text"
            autoComplete="given-name"
            placeholder="Tu nombre"
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-required="true"
            aria-describedby={tried && !name.trim() ? 'name-error' : undefined}
          />
          {tried && !name.trim() && (
            <p id="name-error" role="alert" className="field-error sm" style={{ color: 'var(--error)', marginTop: 4 }}>
              Escribe tu nombre para continuar.
            </p>
          )}
        </div>

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
          disabled={!name.trim()}
          style={{ height: 52, borderRadius: 16, fontSize: 16, marginTop: 4, opacity: name.trim() ? 1 : 0.5, cursor: name.trim() ? 'pointer' : 'not-allowed' }}
        >
          Crear cuenta
        </button>
      </form>
      </motion.div>

      {/* Footer */}
      <motion.div
        variants={staggerItem}
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
          onClick={() => dispatch({ t: 'go', screen: 's-login' })}
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
        <TrustBadge />
      </motion.div>

      </motion.div>
    </div>
  )
}
