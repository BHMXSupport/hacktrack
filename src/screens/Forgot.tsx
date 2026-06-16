// Forgot — recuperación de contraseña por correo.
// Navegación: atrás → s-login, "Enviar enlace" → toast + go s-login.
import { useState } from 'react'
import { motion } from 'framer-motion'
import { useApp } from '../lib/store'
import { IcBack } from '../components/icons'
import { Disclaimer } from '../components/controls'
import { staggerParent, staggerItem } from '../lib/motion'

export function Forgot() {
  const { dispatch } = useApp()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    dispatch({ t: 'toast', msg: 'Si el correo existe, te enviamos un enlace' })
    setSent(true)
    setTimeout(() => {
      dispatch({ t: 'go', screen: 's-login' })
    }, 1800)
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
      <motion.div
        variants={staggerParent}
        initial="initial"
        animate="animate"
        style={{ display: 'contents' }}
      >
        {/* Header: atrás + título centrado */}
        <motion.div variants={staggerItem}>
          <header
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 36,
            }}
          >
            <button
              className="iconbtn"
              aria-label="Atrás"
              onClick={() => dispatch({ t: 'go', screen: 's-login' })}
            >
              <IcBack size={22} />
            </button>
            <div style={{ width: 36 }} />
          </header>
        </motion.div>

        {/* Título */}
        <motion.div variants={staggerItem} style={{ marginBottom: 32 }}>
          <h1 className="display-l" style={{ color: 'var(--ink-900)', marginBottom: 8 }}>
            Recuperar contraseña
          </h1>
          <p className="body" style={{ color: 'var(--ink-400)' }}>
            Te enviaremos un enlace a tu correo para que puedas restablecer tu contraseña.
          </p>
        </motion.div>

        {/* Formulario */}
        <motion.div variants={staggerItem}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label className="label" htmlFor="ht-forgot-email">
                Correo electrónico
              </label>
              <input
                id="ht-forgot-email"
                className="field"
                type="email"
                autoComplete="email"
                inputMode="email"
                placeholder="tu@correo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-required="true"
                disabled={sent}
              />
            </div>

            <button
              type="submit"
              className="btn btn-brand"
              disabled={!email.trim() || sent}
              style={{
                height: 52,
                borderRadius: 16,
                fontSize: 16,
                marginTop: 4,
                opacity: !email.trim() || sent ? 0.5 : 1,
                cursor: !email.trim() || sent ? 'not-allowed' : 'pointer',
                transition: 'opacity 0.2s',
              }}
            >
              {sent ? 'Enlace enviado' : 'Enviar enlace'}
            </button>
          </form>
        </motion.div>

        {/* Footer */}
        <motion.div
          variants={staggerItem}
          style={{ marginTop: 'auto', paddingTop: 32, textAlign: 'center' }}
        >
          <button
            type="button"
            className="btn btn-ghost"
            style={{
              fontSize: 15,
              color: 'var(--brand-700)',
              textDecoration: 'underline',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              marginBottom: 16,
            }}
            onClick={() => dispatch({ t: 'go', screen: 's-login' })}
          >
            Volver a iniciar sesión
          </button>
          <Disclaimer kind="general" />
        </motion.div>
      </motion.div>
    </div>
  )
}
