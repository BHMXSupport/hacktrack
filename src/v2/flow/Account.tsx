/**
 * Account.tsx — v2 flow
 *
 * Crea cuenta (nombre obligatorio + correo opcional). Cuenta OBLIGATORIA (sin opción "sin cuenta").
 * Sin backend la cuenta es LOCAL: no hay contraseña que verificar, así que no se muestra
 * el campo ni el medidor de fortaleza (nada debe parecer una verificación real).
 * Estética "Bitácora": folio de paso, titular serif, azul interactivo. El consentimiento
 * (checkbox + Aviso de Privacidad) conserva su copy y semántica EXACTOS.
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
import { FolioLabel } from '../ui/FolioLabel'
import { fadeUp } from '../lib/motion'

// Aviso de Privacidad servido como página estática dentro de la PWA → URL real, enlazable (Epic E).
const PRIVACY_URL = `${import.meta.env.BASE_URL}aviso-privacidad.html`

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Input estilizado con tokens Bitácora
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
      <label htmlFor={id} className="text-[13px] font-semibold text-ink-2">
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

  // Fortaleza de contraseña básica (visual, no bloquea) — colores de estado con tokens (AA por tema)
  const pwScore = password.length === 0 ? 0
    : password.length < 8 ? 1
    : /[A-Z]/.test(password) && /[0-9]/.test(password) ? 3
    : 2
  const pwColor = ['', 'var(--alert)', 'var(--warn)', 'var(--ok)'][pwScore]
  const pwLabel = ['', 'Débil', 'Moderada', 'Fuerte'][pwScore]

  // Shared input class — placa de registro editorial
  const inputCls =
    'h-12 w-full rounded-[10px] border border-hairline bg-surface px-4 text-[15px] text-ink placeholder:text-ink-3 focus:border-blue focus:outline-none focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--blue)_18%,transparent)] transition-[border-color,box-shadow]'

  return (
    <div
      className="relative z-10 flex h-full flex-col overflow-y-auto"
      style={{ paddingBottom: 'max(40px, calc(32px + env(safe-area-inset-bottom)))' }}
    >
      {/* App bar — folio editorial */}
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
          className="inline-flex h-11 w-11 items-center justify-center rounded-md text-ink-2 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
        >
          <ChevronLeft size={22} />
        </button>

        {/* Paso 5 de 5 */}
        <div className="flex flex-1 flex-col gap-1.5">
          <FolioLabel n={5}>Paso 5 de 5</FolioLabel>
          <div className="h-1 overflow-hidden rounded-full bg-raised" role="progressbar" aria-valuenow={5} aria-valuemin={1} aria-valuemax={5} aria-label="Último paso">
            <div className="h-full w-full rounded-full bg-blue" />
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
        {/* Título serif */}
        <motion.div variants={fadeUp} className="text-center">
          <h1 className="font-serif text-[28px] font-normal leading-[1.1] tracking-[-0.01em] text-ink">
            ¡Casi listo!
          </h1>
          <p className="mt-2 text-[14px] text-ink-2">
            {backendEnabled
              ? 'Tus registros se guardan en tu dispositivo. Con tu cuenta puedes activar el respaldo opcional en la nube.'
              : 'Tus registros se guardan solo en este dispositivo. Tu cuenta es local por ahora — la sincronización llega pronto.'}
          </p>
        </motion.div>

        {/* Formulario */}
        <motion.form
          variants={fadeUp}
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
                className={inputCls + (tried && !name.trim() ? ' border-alert focus:border-alert focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--alert)_18%,transparent)]' : '')}
              />
              {name.trim() && (
                <User size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-blue" aria-hidden="true" />
              )}
            </div>
            {name.trim() && (
              <p aria-live="polite" className="font-serif text-[15px] text-ink">
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
              className={inputCls + (emailError ? ' border-alert focus:border-alert focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--alert)_18%,transparent)]' : '')}
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
                  className="absolute right-1 top-1/2 -translate-y-1/2 inline-flex h-11 w-11 items-center justify-center rounded text-ink-2 hover:text-ink"
                >
                  {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {/* Indicador de fortaleza — estado nunca solo-color: barra + etiqueta en tinta */}
              {password && (
                <div className="mt-1 flex items-center gap-2">
                  <div className="flex gap-1">
                    {[1, 2, 3].map((n) => (
                      <div
                        key={n}
                        className="h-1 w-8 rounded-full transition-colors duration-200"
                        style={{ background: n <= pwScore ? pwColor : 'var(--raised)' }}
                      />
                    ))}
                  </div>
                  <span className="text-[12px] font-medium text-ink-2">
                    {pwLabel}
                  </span>
                </div>
              )}
            </Field>
          ) : (
            <p className="flex items-center gap-2 text-[12px] leading-relaxed text-ink-2">
              <span className="inline-flex shrink-0 items-center rounded-full border border-[color-mix(in_srgb,var(--blue)_30%,transparent)] bg-[color-mix(in_srgb,var(--blue)_10%,transparent)] px-2 py-0.5 font-mono text-[12px] font-medium uppercase tracking-[0.08em] text-blue">
                Próximamente
              </span>
              Cuenta en la nube con contraseña y respaldo.
            </p>
          )}

          {/* Trust badges — visibles antes del consentimiento (píldoras de confianza, azul) */}
          <div className="flex flex-wrap gap-2">
            {[
              'Datos locales',
              'Sin rastreo',
              'Hecho en México',
            ].map((txt) => (
              <span
                key={txt}
                className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-surface px-3 py-1 font-mono text-[12px] font-medium text-ink-2"
              >
                <Shield size={11} className="text-blue" />
                {txt}
              </span>
            ))}
          </div>

          {/* Disclaimer médico — posición visible, antes del checkbox */}
          <p className="text-[12px] leading-relaxed text-ink-2">
            No reemplaza consejo médico profesional.
          </p>

          {/* Checkbox de privacidad — contenedor sólido para consentimiento legible */}
          <div className="flex items-start gap-3 rounded-sm border border-hairline bg-surface p-4 shadow-[0_1px_2px_rgba(26,23,18,.05)]">
            <input
              id="ht-privacy"
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              aria-required="true"
              className="mt-0.5 h-6 w-6 flex-shrink-0 cursor-pointer rounded accent-blue"
            />
            <label htmlFor="ht-privacy" className="block cursor-pointer text-[13px] leading-relaxed text-ink">
              He leído y acepto el{' '}
              <a
                href={PRIVACY_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="font-semibold text-blue underline underline-offset-2"
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
        <motion.div variants={fadeUp} className="flex items-center gap-4" aria-hidden="true">
          <div className="h-px flex-1 bg-hairline" />
          <span className="font-mono text-[12px] text-ink-3">o</span>
          <div className="h-px flex-1 bg-hairline" />
        </motion.div>

        {/* Cuenta obligatoria: solo "ya tengo cuenta" (se quitó "continuar sin cuenta") */}
        <motion.div variants={fadeUp}>
          <Button size="full" variant="outline" onClick={() => dispatch({ t: 'go', screen: 's-login' })}>
            Ya tengo cuenta · Iniciar sesión
          </Button>
        </motion.div>
      </motion.div>
    </div>
  )
}
