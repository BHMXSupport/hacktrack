/**
 * Forgot.tsx — v2 flow
 *
 * Recuperación de acceso. Solo con backend existe un emisor de correos: sin backend
 * NO se promete ningún enlace — se muestra que la función aún no está disponible.
 * Como los datos son LOCALES al dispositivo, lo explicamos claro:
 * recuperamos el acceso a la cuenta (sync), no los datos del dispositivo.
 * Estética "Bitácora": titular serif, azul interactivo, columnas impresas.
 *
 * ScreenId: 's-forgot'
 * Dispatch:
 *   { t: 'toast', msg }              — confirmación
 *   { t: 'go', screen: 's-login' }   — volver a iniciar sesión
 */
import { useState, useId } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { ChevronLeft, KeyRound, Shield, Check } from 'lucide-react'
import { useApp } from '../../lib/store'
import { backendEnabled } from '../../lib/backend/config'
import { resetPassword } from '../../lib/backend/auth'
import { Button } from '../ui/Button'
import { Glass } from '../ui/Glass'
import { fadeUp } from '../lib/motion'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function Forgot() {
  const { dispatch } = useApp()
  const reduce = useReducedMotion()
  const uid = useId()
  const [email, setEmail] = useState('')
  const [error, setError] = useState(false)
  const [sent, setSent] = useState(false)

  const inputCls =
    'h-12 w-full rounded-[10px] border border-hairline bg-surface px-4 text-[15px] text-ink placeholder:text-ink-3 focus:border-blue focus:outline-none focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--blue)_18%,transparent)] transition-[border-color,box-shadow]'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!backendEnabled) return
    if (!EMAIL_RE.test(email.trim())) { setError(true); return }
    setError(false)
    // El mensaje es neutro ("si el correo existe") para no revelar qué correos están registrados.
    await resetPassword(email.trim())
    setSent(true)
    dispatch({ t: 'toast', msg: 'Si el correo existe, te enviamos un enlace' })
  }

  return (
    <div
      className="relative z-10 flex h-full flex-col overflow-y-auto"
      style={{ paddingBottom: 'max(40px, calc(32px + env(safe-area-inset-bottom)))' }}
    >
      <header
        className="flex flex-shrink-0 items-center gap-4 px-4"
        style={{ paddingTop: 'max(14px, env(safe-area-inset-top))', paddingBottom: 12 }}
      >
        <button
          aria-label="Atrás"
          onClick={() => dispatch({ t: 'go', screen: 's-login' })}
          className="inline-flex h-11 w-11 items-center justify-center rounded-md text-ink-2 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
        >
          <ChevronLeft size={22} />
        </button>
        <div className="flex-1" />
      </header>

      <motion.div
        initial={reduce ? false : 'hidden'}
        animate="show"
        variants={{ show: { transition: { staggerChildren: 0.07 } } }}
        className="flex flex-1 flex-col gap-6 px-5 pt-2"
      >
        <motion.div variants={fadeUp} className="flex flex-col items-center gap-3 pt-4 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full border border-hairline bg-[color-mix(in_srgb,var(--blue)_10%,transparent)]">
            <KeyRound size={26} className="text-blue" aria-hidden="true" />
          </span>
          <h1 className="font-serif text-[28px] font-normal leading-[1.1] tracking-[-0.01em] text-ink">Recuperar acceso</h1>
          <p className="max-w-[300px] text-[14px] text-ink-2">
            {backendEnabled
              ? 'Te enviaremos un enlace para restablecer tu contraseña de cuenta.'
              : 'Esta función aún no está disponible en la beta.'}
          </p>
        </motion.div>

        {!backendEnabled ? (
          <motion.div variants={fadeUp}>
            <Glass className="flex flex-col items-center gap-3 p-6 text-center">
              <span className="inline-flex items-center rounded-full border border-[color-mix(in_srgb,var(--blue)_30%,transparent)] bg-[color-mix(in_srgb,var(--blue)_10%,transparent)] px-2.5 py-0.5 font-mono text-[12px] font-medium uppercase tracking-[0.08em] text-blue">
                Próximamente
              </span>
              <p className="text-[15px] font-semibold text-ink">
                La recuperación por correo llega con la nube
              </p>
              <p className="text-[13px] leading-relaxed text-ink-2">
                Tu cuenta es local por ahora — la sincronización llega pronto. No hay
                contraseña de nube que restablecer: entra directo desde iniciar sesión.
              </p>
            </Glass>
          </motion.div>
        ) : sent ? (
          <motion.div variants={fadeUp}>
            <Glass className="flex flex-col items-center gap-3 p-6 text-center">
              {/* Éxito: forma (check) + texto + color — nunca color solo */}
              <span className="grid h-12 w-12 place-items-center rounded-full bg-[color-mix(in_srgb,var(--ok)_14%,transparent)] text-ok">
                <Check size={24} strokeWidth={2.5} />
              </span>
              <p className="text-[15px] font-semibold text-ink">Revisa tu correo</p>
              <p className="text-[13px] text-ink-2">
                Si <span className="text-ink">{email.trim()}</span> tiene una cuenta, te llegará un enlace en unos minutos.
              </p>
            </Glass>
          </motion.div>
        ) : (
          <motion.form variants={fadeUp} onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${uid}-email`} className="text-[13px] font-semibold text-ink-2">
                Correo electrónico
              </label>
              <input
                id={`${uid}-email`}
                type="email"
                autoComplete="email"
                placeholder="tu@correo.com"
                value={email}
                onChange={(e) => { setEmail(e.target.value); if (error && EMAIL_RE.test(e.target.value.trim())) setError(false) }}
                aria-invalid={error ? 'true' : undefined}
                className={inputCls + (error ? ' border-alert focus:border-alert focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--alert)_18%,transparent)]' : '')}
              />
              {error && <p role="alert" className="text-[12px] text-alert">Ingresa un correo electrónico válido.</p>}
            </div>
            <Button type="submit" size="full">Enviar enlace</Button>
          </motion.form>
        )}

        {/* Nota: datos locales */}
        <motion.div variants={fadeUp}>
          <Glass className="flex items-start gap-3 p-4">
            <Shield size={16} className="mt-0.5 shrink-0 text-blue" aria-hidden />
            <p className="text-[12px] leading-relaxed text-ink-2">
              Tus <span className="text-ink">registros se guardan en este dispositivo</span>, no en la nube.
              {backendEnabled
                ? ' Recuperar la contraseña restaura el acceso a tu cuenta, no borra ni recupera datos locales.'
                : ' Nada de esto afecta tus datos locales.'}
            </p>
          </Glass>
        </motion.div>

        <motion.div variants={fadeUp} className="mt-auto pt-2">
          <Button size="full" variant="outline" onClick={() => dispatch({ t: 'go', screen: 's-login' })}>
            Volver a iniciar sesión
          </Button>
        </motion.div>
      </motion.div>
    </div>
  )
}
