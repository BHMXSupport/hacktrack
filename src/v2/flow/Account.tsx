/**
 * Account.tsx — v2 flow
 *
 * Crea cuenta (nombre obligatorio + correo opcional). Cuenta OBLIGATORIA (sin opción "sin cuenta").
 * Sin backend la cuenta es LOCAL: no hay contraseña que verificar, así que no se muestra
 * el campo ni el medidor de fortaleza (nada debe parecer una verificación real).
 * "Crear cuenta" → dispatch setName + finishOnboarding (va a 's-app').
 * "Ya tengo cuenta" → dispatch go 's-login'.
 *
 * ScreenId: 's-account'
 * Dispatch used:
 *   { t: 'setName', name: string }       — guarda el nombre en el perfil
 *   { t: 'finishOnboarding' }            — marca justOnboarded:true, screen→'s-app'
 *   { t: 'go', screen: 's-login' }       — navega al login existente
 *   { t: 'go', screen: 's-goal' }        — atrás
 */
import { useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { ChevronLeft, Eye, EyeOff, Shield, User } from 'lucide-react'
import { useApp } from '../../lib/store'
import { backendEnabled } from '../../lib/backend/config'
import { signUp } from '../../lib/backend/auth'
import { CURRENT_CONSENT_VERSION } from '../screens/Ajustes'
import { Button } from '../ui/Button'

// Aviso de Privacidad servido como página estática dentro de la PWA → URL real, enlazable (Epic E).
const PRIVACY_URL = `${import.meta.env.BASE_URL}aviso-privacidad.html`

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const fade = {
  hidden: { opacity: 0, y: 14 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: [0, 0, 0.2, 1] as [number, number, number, number] },
  },
}

// Input estilizado con tokens v2
function Field({
  id,
  label,
  error,
  errorId,
  required,
  children,
}: {
  id: string
  label: string
  error?: string
  errorId?: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-semibold text-secondary-foreground">
        {label}
        {required && (
          <span aria-hidden="true" className="ml-0.5 text-alert">
            *
          </span>
        )}
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

export function Account() {
  const { dispatch } = useApp()
  const reduce = useReducedMotion()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [tried, setTried] = useState(false)
  const [emailError, setEmailError] = useState(false)
  const [accepted, setAccepted] = useState(false)

  function handleEmailBlur() {
    setEmailError(email.trim() !== '' && !EMAIL_RE.test(email.trim()))
  }
  function handleEmailChange(e: React.ChangeEvent<HTMLInputElement>) {
    setEmail(e.target.value)
    if (emailError && EMAIL_RE.test(e.target.value.trim())) setEmailError(false)
  }

  const [authError, setAuthError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const canCreate = name.trim() !== '' && accepted

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setTried(true); return }
    if (!accepted) return
    const mail = email.trim()
    if (backendEnabled) {
      // Cuenta real: correo + contraseña obligatorios; maneja errores (correo en uso, etc.).
      if (!EMAIL_RE.test(mail)) { setEmailError(true); return }
      if (password.length < 6) { setAuthError('La contraseña debe tener al menos 6 caracteres.'); return }
      setSubmitting(true); setAuthError(null)
      const res = await signUp(mail, password)
      setSubmitting(false)
      if (!res.ok) { setAuthError(res.error); return }
    }
    dispatch({ t: 'setName', name: name.trim() })
    // BUG FIX: el correo se capturaba pero nunca se guardaba en el perfil. Lo persistimos si es válido.
    if (mail && EMAIL_RE.test(mail)) dispatch({ t: 'setProfileFields', patch: { email: mail } })
    // Consentimiento: se marca activo SOLO aquí, al aceptar el checkbox (antes venía pre-activado en initialState).
    dispatch({ t: 'setSetting', key: 'consentActive', value: true })
    dispatch({ t: 'setSetting', key: 'consentVersion', value: CURRENT_CONSENT_VERSION })
    // Marca de tiempo de aceptación (LFPDPPP): fuera del estado porque UserSettings no tiene la clave.
    try { localStorage.setItem('ht:consentAcceptedAt', String(Date.now())) } catch { /* modo privado */ }
    dispatch({ t: 'finishOnboarding' })
  }

  // Fortaleza de contraseña básica (visual, no bloquea)
  const pwScore = password.length === 0 ? 0
    : password.length < 8 ? 1
    : /[A-Z]/.test(password) && /[0-9]/.test(password) ? 3
    : 2
  const pwColor = ['', '#E85D3A', '#E8A33A', '#2FB57C'][pwScore]
  const pwLabel = ['', 'Débil', 'Moderada', 'Fuerte'][pwScore]

  // Shared input class
  const inputCls =
    'h-12 w-full rounded-lg border border-white/10 bg-raised px-4 text-[15px] text-foreground placeholder:text-secondary-foreground/70 focus:border-teal/60 focus:outline-none focus:ring-2 focus:ring-teal/20 transition-colors'

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
          onClick={() => dispatch({ t: 'go', screen: 's-protocol' })}
          className="inline-flex h-11 w-11 items-center justify-center rounded-md text-secondary-foreground hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
        >
          <ChevronLeft size={22} />
        </button>

        {/* Paso 5 de 5 */}
        <div className="flex-1 flex flex-col gap-1">
          <span className="text-[11px] font-semibold text-secondary-foreground">Paso 5 de 5</span>
          <div className="h-1 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuenow={5} aria-valuemin={1} aria-valuemax={5} aria-label="Último paso">
            <div className="h-full w-full rounded-full bg-teal" />
          </div>
        </div>

        <div className="w-11" />
      </header>

      <motion.div
        initial={reduce ? false : 'hidden'}
        animate="show"
        variants={{ show: { transition: { staggerChildren: 0.08 } } }}
        className="flex flex-1 flex-col gap-6 px-5 pt-2"
      >
        {/* Título */}
        <motion.div variants={fade} className="text-center">
          <h1 className="text-[26px] font-bold leading-tight tracking-tight text-foreground">
            ¡Casi listo!
          </h1>
          <p className="mt-2 text-[14px] text-secondary-foreground">
            {backendEnabled
              ? 'Tus registros se guardan en tu dispositivo. Con tu cuenta puedes activar el respaldo opcional en la nube.'
              : 'Tus registros se guardan solo en este dispositivo. Tu cuenta es local por ahora — la sincronización llega pronto.'}
          </p>
        </motion.div>

        {/* Formulario */}
        <motion.form
          variants={fade}
          onSubmit={handleCreate}
          className="flex flex-col gap-4"
          noValidate
        >
          {/* Nombre */}
          <Field
            id="ht-name"
            label="¿Cómo te llamas?"
            required
            error={tried && !name.trim() ? 'Escribe tu nombre para continuar.' : undefined}
            errorId="ht-name-error"
          >
            <div className="relative">
              <input
                id="ht-name"
                type="text"
                autoComplete="given-name"
                placeholder="Tu nombre"
                value={name}
                onChange={(e) => setName(e.target.value)}
                aria-required="true"
                aria-describedby={tried && !name.trim() ? 'ht-name-error' : undefined}
                aria-invalid={tried && !name.trim() ? 'true' : undefined}
                className={inputCls + (tried && !name.trim() ? ' border-alert focus:border-alert focus:ring-alert/20' : '')}
              />
              {name.trim() && (
                <User size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-teal" aria-hidden="true" />
              )}
            </div>
            {name.trim() && (
              <p aria-live="polite" className="text-[13px] font-semibold text-teal">
                Hola, {name.trim()}
              </p>
            )}
          </Field>

          {/* Correo */}
          <Field
            id="ht-email"
            label={backendEnabled ? 'Correo electrónico' : 'Correo electrónico (opcional)'}
            required={backendEnabled}
            error={emailError ? 'Ingresa un correo electrónico válido.' : undefined}
            errorId="ht-email-error"
          >
            <input
              id="ht-email"
              type="email"
              autoComplete="email"
              placeholder="tu@correo.com"
              value={email}
              onChange={handleEmailChange}
              onBlur={handleEmailBlur}
              aria-describedby={emailError ? 'ht-email-error' : undefined}
              aria-invalid={emailError ? 'true' : undefined}
              className={inputCls + (emailError ? ' border-alert focus:border-alert focus:ring-alert/20' : '')}
            />
          </Field>

          {/* Contraseña — solo con backend real; sin backend nada la verifica y mostrarla sería teatro */}
          {backendEnabled ? (
            <Field id="ht-password" label="Contraseña" required>
              <div className="relative">
                <input
                  id="ht-password"
                  type={showPw ? 'text' : 'password'}
                  autoComplete="new-password"
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
              {/* Indicador de fortaleza */}
              {password && (
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex gap-1">
                    {[1, 2, 3].map((n) => (
                      <div
                        key={n}
                        className="h-1 w-8 rounded-full transition-colors duration-200"
                        style={{ background: n <= pwScore ? pwColor : 'rgba(255,255,255,0.1)' }}
                      />
                    ))}
                  </div>
                  <span className="text-[11px] font-medium" style={{ color: pwColor }}>
                    {pwLabel}
                  </span>
                </div>
              )}
            </Field>
          ) : (
            <p className="flex items-center gap-2 text-[12px] leading-relaxed text-secondary-foreground">
              <span className="inline-flex shrink-0 items-center rounded-full border border-teal/25 bg-teal/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-teal">
                Próximamente
              </span>
              Cuenta en la nube con contraseña y respaldo.
            </p>
          )}

          {/* Trust badges — visibles antes del consentimiento */}
          <div className="flex flex-wrap gap-2">
            {[
              'Datos locales',
              'Sin rastreo',
              'Hecho en México',
            ].map((txt) => (
              <span
                key={txt}
                className="inline-flex items-center gap-1.5 rounded-full border border-teal/30 bg-teal/15 px-3 py-1 text-[11px] font-medium text-teal"
              >
                <Shield size={11} />
                {txt}
              </span>
            ))}
          </div>

          {/* Disclaimer médico — posición visible, antes del checkbox */}
          <p className="text-[12px] leading-relaxed text-secondary-foreground">
            No reemplaza consejo médico profesional.
          </p>

          {/* Checkbox de privacidad — contenedor sólido para consentimiento legible */}
          <div className="rounded-xl border border-white/10 bg-raised/80 p-4 flex items-start gap-3">
            <input
              id="ht-privacy"
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              aria-required="true"
              className="mt-0.5 h-6 w-6 flex-shrink-0 cursor-pointer rounded accent-teal"
            />
            <label htmlFor="ht-privacy" className="block cursor-pointer text-[13px] leading-relaxed text-foreground">
              He leído y acepto el{' '}
              <a
                href={PRIVACY_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="font-semibold text-teal underline underline-offset-2"
              >
                Aviso de Privacidad
              </a>.
              Tu historial se guarda solo en tu dispositivo.
            </label>
          </div>

          {/* CTA crear */}
          {authError && (
            <p role="alert" className="-mb-1 text-center text-[13px] text-alert">{authError}</p>
          )}
          <Button
            type="submit"
            size="full"
            disabled={!canCreate || submitting}
            aria-disabled={!canCreate || submitting}
            aria-busy={submitting}
          >
            {submitting ? 'Creando…' : 'Crear cuenta'}
          </Button>
        </motion.form>

        {/* Separador */}
        <motion.div variants={fade} className="flex items-center gap-4" aria-hidden="true">
          <div className="h-px flex-1 bg-white/8" />
          <span className="text-[12px] text-secondary-foreground">o</span>
          <div className="h-px flex-1 bg-white/8" />
        </motion.div>

        {/* Cuenta obligatoria: solo "ya tengo cuenta" (se quitó "continuar sin cuenta") */}
        <motion.div variants={fade}>
          <Button size="full" variant="outline" onClick={() => dispatch({ t: 'go', screen: 's-login' })}>
            Ya tengo cuenta · Iniciar sesión
          </Button>
        </motion.div>
      </motion.div>
    </div>
  )
}
