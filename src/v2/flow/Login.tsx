/**
 * Login.tsx — v2 flow
 *
 * Inicio de sesión mock (email + contraseña). Simula delay de 600ms.
 * Éxito → finishOnboarding + go 's-app'.
 * "¿Olvidaste tu contraseña?" → go 's-forgot'.
 * "Crear cuenta" → go 's-goal' (pasa por TODO el onboarding, igual que un usuario nuevo; no salta a s-account).
 *
 * ScreenId: 's-login'
 * Dispatch:
 *   { t: 'finishOnboarding' }        — auth ok, marca justOnboarded, screen→'s-app'
 *   { t: 'go', screen: 's-forgot' }  — recuperar contraseña
 *   { t: 'go', screen: 's-goal' }    — crear cuenta nueva → arranca el onboarding desde el objetivo
 */
import { useState, useId } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { ChevronLeft, Eye, EyeOff, Droplet, Shield } from 'lucide-react'
import { useApp } from '../../lib/store'
import { Button } from '../ui/Button'
import { Glass } from '../ui/Glass'

// ── Validación ────────────────────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// ── Animación ─────────────────────────────────────────────────────────────────

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
}

const fade = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.26, ease: [0, 0, 0.2, 1] as [number, number, number, number] },
  },
}

// ── Subcomponente: campo de formulario ────────────────────────────────────────

function Field({
  id,
  label,
  error,
  errorId,
  children,
}: {
  id: string
  label: string
  error?: string
  errorId?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-semibold text-secondary-foreground">
        {label}
      </label>
      {children}
      {error && (
        <p id={errorId} role="alert" className="text-[12px] text-alert">
          {error}
        </p>
      )}
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────

export function Login() {
  const { dispatch } = useApp()
  const reduce = useReducedMotion()
  const uid = useId()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [emailError, setEmailError] = useState(false)
  const [loginError, setLoginError] = useState(false)
  const [loading, setLoading] = useState(false)

  // Input class compartido
  const inputCls =
    'h-12 w-full rounded-lg border border-white/10 bg-raised px-4 text-[15px] text-foreground placeholder:text-secondary-foreground/70 focus:border-teal/60 focus:outline-none focus:ring-2 focus:ring-teal/20 transition-colors'

  function handleEmailBlur() {
    setEmailError(email.trim() !== '' && !EMAIL_RE.test(email.trim()))
  }

  function handleEmailChange(e: React.ChangeEvent<HTMLInputElement>) {
    setEmail(e.target.value)
    if (emailError && EMAIL_RE.test(e.target.value.trim())) setEmailError(false)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (loading) return
    if (!EMAIL_RE.test(email.trim())) { setEmailError(true); return }
    setLoginError(false)
    setLoading(true)
    // Mock: 600ms delay → éxito
    window.setTimeout(() => {
      setLoading(false)
      // Aquí: si auth fallara → setLoginError(true); return
      dispatch({ t: 'finishOnboarding' })
    }, 600)
  }

  return (
    <div
      className="relative z-10 flex h-full flex-col overflow-y-auto"
      style={{ paddingBottom: 'max(40px, calc(32px + env(safe-area-inset-bottom)))' }}
    >
      {/* App bar */}
      <header
        className="flex flex-shrink-0 items-center gap-4 px-4"
        style={{
          paddingTop: 'max(14px, env(safe-area-inset-top))',
          paddingBottom: 12,
        }}
      >
        <button
          aria-label="Atrás"
          onClick={() => dispatch({ t: 'go', screen: 's-onboarding' })}
          className="inline-flex h-11 w-11 items-center justify-center rounded-md text-secondary-foreground hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
        >
          <ChevronLeft size={22} />
        </button>
        <div className="flex-1" />
      </header>

      <motion.div
        initial={reduce ? false : 'hidden'}
        animate="show"
        variants={stagger}
        className="flex flex-1 flex-col gap-6 px-5 pt-2"
      >
        {/* Logo + título */}
        <motion.div variants={fade} className="flex flex-col items-center gap-3 pt-4 text-center">
          <span
            className="flex h-14 w-14 items-center justify-center rounded-2xl"
            style={{ background: 'color-mix(in srgb, #5FC9B8 14%, transparent)' }}
          >
            <Droplet size={28} className="text-teal" aria-hidden="true" />
          </span>
          <h1 className="text-[26px] font-bold leading-tight tracking-tight text-foreground">
            Inicia sesión
          </h1>
          <p className="text-[14px] text-secondary-foreground">Bienvenido de vuelta</p>
        </motion.div>

        {/* Formulario */}
        <motion.form
          variants={fade}
          onSubmit={handleSubmit}
          className="flex flex-col gap-4"
          noValidate
        >
          {/* Email */}
          <Field
            id={`${uid}-email`}
            label="Correo electrónico"
            error={emailError ? 'Ingresa un correo electrónico válido.' : undefined}
            errorId={`${uid}-email-error`}
          >
            <input
              id={`${uid}-email`}
              type="email"
              autoComplete="email"
              placeholder="tu@correo.com"
              value={email}
              onChange={handleEmailChange}
              onBlur={handleEmailBlur}
              aria-describedby={emailError ? `${uid}-email-error` : undefined}
              aria-invalid={emailError ? 'true' : undefined}
              className={inputCls + (emailError ? ' border-alert focus:border-alert focus:ring-alert/20' : '')}
            />
          </Field>

          {/* Contraseña */}
          <Field id={`${uid}-password`} label="Contraseña">
            <div className="relative">
              <input
                id={`${uid}-password`}
                type={showPw ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputCls + ' pr-12'}
              />
              <button
                type="button"
                aria-label={showPw ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-1 top-1/2 -translate-y-1/2 inline-flex h-11 w-11 items-center justify-center rounded text-secondary-foreground hover:text-foreground"
              >
                {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </Field>

          {/* Olvidé contraseña */}
          <button
            type="button"
            onClick={() => dispatch({ t: 'go', screen: 's-forgot' })}
            className="self-end text-[13px] font-semibold text-teal hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring rounded"
          >
            ¿Olvidaste tu contraseña?
          </button>

          {/* Error de login */}
          {loginError && (
            <Glass className="py-3 px-4">
              <p role="alert" className="text-[13px] text-alert text-center">
                No pudimos iniciar sesión. Verifica tus datos e intenta de nuevo.
              </p>
            </Glass>
          )}

          {/* CTA entrar */}
          <Button
            type="submit"
            size="full"
            disabled={loading}
            aria-disabled={loading}
            aria-busy={loading}
            className={loading ? 'opacity-70' : ''}
          >
            {loading ? 'Entrando…' : 'Iniciar sesión'}
          </Button>
        </motion.form>

        {/* Separador */}
        <motion.div variants={fade} className="flex items-center gap-4" aria-hidden="true">
          <div className="h-px flex-1 bg-white/8" />
          <span className="text-[12px] text-secondary-foreground">o</span>
          <div className="h-px flex-1 bg-white/8" />
        </motion.div>

        {/* Crear cuenta */}
        <motion.div variants={fade}>
          <Button
            size="full"
            variant="outline"
            onClick={() => dispatch({ t: 'go', screen: 's-goal' })}
          >
            ¿No tienes cuenta? Crear cuenta
          </Button>
        </motion.div>

        {/* Footer */}
        <motion.div variants={fade} className="mt-auto flex flex-col items-center gap-4 pt-2">
          {/* Trust badges */}
          <div className="flex flex-wrap justify-center gap-3">
            {['Datos locales', 'Sin rastreo', 'Hecho en México'].map((txt) => (
              <span
                key={txt}
                className="inline-flex items-center gap-1.5 rounded-full border border-teal/20 bg-teal/8 px-3 py-1 text-[11px] font-medium text-teal"
              >
                <Shield size={11} />
                {txt}
              </span>
            ))}
          </div>
          {/* Disclaimer */}
          <p className="text-center text-[11px] leading-relaxed text-secondary-foreground">
            Hacktrack es una herramienta de seguimiento personal.
            No reemplaza consejo médico profesional.
          </p>
        </motion.div>
      </motion.div>
    </div>
  )
}
