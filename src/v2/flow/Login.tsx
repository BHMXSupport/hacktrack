/**
 * Login.tsx — v2 flow
 *
 * Con backend (backendEnabled): email + contraseña reales contra Supabase; muestra
 * el error específico de auth.ts. Sin backend: NO se finge verificación de
 * credenciales — la cuenta es local, se entra directo y la nube se marca
 * "Próximamente" (sin campo de contraseña ni "¿Olvidaste tu contraseña?").
 * Estética "Bitácora": masthead editorial (kicker mono + titular serif), azul interactivo.
 * Éxito → finishOnboarding + go 's-app'.
 * "Crear cuenta" → go 's-goal' (pasa por TODO el onboarding, igual que un usuario nuevo; no salta a s-account).
 *
 * ScreenId: 's-login'
 * Dispatch:
 *   { t: 'finishOnboarding' }        — auth ok, marca justOnboarded, screen→'s-app'
 *   { t: 'go', screen: 's-forgot' }  — recuperar contraseña (solo con backend)
 *   { t: 'go', screen: 's-goal' }    — crear cuenta nueva → arranca el onboarding desde el objetivo
 */
import { useState, useId } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { ChevronLeft, Eye, EyeOff, Shield, CloudOff } from 'lucide-react'
import { useApp } from '../../lib/store'
import { backendEnabled } from '../../lib/backend/config'
import { signIn } from '../../lib/backend/auth'
import { Button } from '../ui/Button'
import { Glass } from '../ui/Glass'
import { fadeUp, staggerContainer } from '../lib/motion'

// ── Validación ────────────────────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

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
      <label htmlFor={id} className="text-[13px] font-semibold text-ink-2">
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
  const [loginError, setLoginError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Input class compartido — placa de registro editorial
  const inputCls =
    'h-12 w-full rounded-[10px] border border-hairline bg-surface px-4 text-[15px] text-ink placeholder:text-ink-3 focus:border-blue focus:outline-none focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--blue)_18%,transparent)] transition-[border-color,box-shadow]'

  function handleEmailBlur() {
    setEmailError(email.trim() !== '' && !EMAIL_RE.test(email.trim()))
  }

  function handleEmailChange(e: React.ChangeEvent<HTMLInputElement>) {
    setEmail(e.target.value)
    if (emailError && EMAIL_RE.test(e.target.value.trim())) setEmailError(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (loading) return
    if (!EMAIL_RE.test(email.trim())) { setEmailError(true); return }
    setLoginError(null)
    setLoading(true)
    // Auth real contra Supabase; el mensaje específico de mapAuthError llega a la UI.
    const res = await signIn(email.trim(), password)
    setLoading(false)
    if (!res.ok) { setLoginError(res.error); return }
    dispatch({ t: 'finishOnboarding' })
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
          className="inline-flex h-11 w-11 items-center justify-center rounded-md text-ink-2 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
        >
          <ChevronLeft size={22} />
        </button>
        <div className="flex-1" />
      </header>

      <motion.div
        initial={reduce ? false : 'hidden'}
        animate="show"
        variants={staggerContainer}
        className="flex flex-1 flex-col gap-6 px-5 pt-2"
      >
        {/* Masthead editorial: kicker mono + titular serif + regla */}
        <motion.div variants={fadeUp} className="flex flex-col items-center gap-2 pt-4 text-center">
          <p className="font-mono text-[12px] font-medium uppercase tracking-[0.16em] text-ink-2">
            Hacktrack · Tu bitácora
          </p>
          <h1 className="font-serif text-[30px] font-normal leading-[1.1] tracking-[-0.01em] text-ink">
            Inicia sesión
          </h1>
          <p className="text-[14px] text-ink-2">Bienvenido de vuelta</p>
          <div aria-hidden className="mt-1 h-[1.5px] w-16 bg-[color-mix(in_srgb,var(--ink)_60%,transparent)]" />
        </motion.div>

        {/* Sin backend: la cuenta es local — no se finge verificación de credenciales */}
        {!backendEnabled && (
          <motion.div variants={fadeUp} className="flex flex-col gap-4">
            <Glass className="flex items-start gap-3 p-4">
              <CloudOff size={18} className="mt-0.5 shrink-0 text-blue" aria-hidden="true" />
              <div className="flex flex-col gap-1">
                <span className="inline-flex w-fit items-center rounded-full border border-[color-mix(in_srgb,var(--blue)_30%,transparent)] bg-[color-mix(in_srgb,var(--blue)_10%,transparent)] px-2 py-0.5 font-mono text-[12px] font-medium uppercase tracking-[0.08em] text-blue">
                  Próximamente
                </span>
                <p className="text-[14px] font-semibold text-ink">Cuenta en la nube</p>
                <p className="text-[13px] leading-relaxed text-ink-2">
                  Tu cuenta es local por ahora — la sincronización llega pronto.
                  Entra directo a tus datos guardados en este dispositivo.
                </p>
              </div>
            </Glass>
            <Button size="full" onClick={() => dispatch({ t: 'finishOnboarding' })}>
              Entrar
            </Button>
          </motion.div>
        )}

        {/* Formulario (solo con backend real) */}
        {backendEnabled && (
        <motion.form
          variants={fadeUp}
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
              className={inputCls + (emailError ? ' border-alert focus:border-alert focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--alert)_18%,transparent)]' : '')}
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
                className="absolute right-1 top-1/2 -translate-y-1/2 inline-flex h-11 w-11 items-center justify-center rounded text-ink-2 hover:text-ink"
              >
                {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </Field>

          {/* Olvidé contraseña */}
          <button
            type="button"
            onClick={() => dispatch({ t: 'go', screen: 's-forgot' })}
            className="self-end rounded text-[13px] font-semibold text-blue hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
          >
            ¿Olvidaste tu contraseña?
          </button>

          {/* Error de login — mensaje específico de mapAuthError */}
          {loginError && (
            <Glass className="px-4 py-3">
              <p role="alert" className="text-center text-[13px] text-alert">
                {loginError}
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
        )}

        {/* Separador */}
        <motion.div variants={fadeUp} className="flex items-center gap-4" aria-hidden="true">
          <div className="h-px flex-1 bg-hairline" />
          <span className="font-mono text-[12px] text-ink-3">o</span>
          <div className="h-px flex-1 bg-hairline" />
        </motion.div>

        {/* Crear cuenta */}
        <motion.div variants={fadeUp}>
          <Button
            size="full"
            variant="outline"
            onClick={() => dispatch({ t: 'go', screen: 's-goal' })}
          >
            ¿No tienes cuenta? Crear cuenta
          </Button>
        </motion.div>

        {/* Footer */}
        <motion.div variants={fadeUp} className="mt-auto flex flex-col items-center gap-4 pt-2">
          {/* Trust badges — píldoras de confianza */}
          <div className="flex flex-wrap justify-center gap-3">
            {['Datos locales', 'Sin rastreo', 'Hecho en México'].map((txt) => (
              <span
                key={txt}
                className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-surface px-3 py-1 font-mono text-[12px] font-medium text-ink-2"
              >
                <Shield size={11} className="text-blue" />
                {txt}
              </span>
            ))}
          </div>
          {/* Disclaimer */}
          <p className="text-center text-[12px] leading-relaxed text-ink-2">
            Hacktrack es una herramienta de seguimiento personal.
            No reemplaza consejo médico profesional.
          </p>
        </motion.div>
      </motion.div>
    </div>
  )
}
