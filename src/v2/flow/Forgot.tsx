/**
 * Forgot.tsx — v2 flow
 *
 * Recuperación de acceso. Como los datos son LOCALES al dispositivo, lo explicamos claro:
 * recuperamos el acceso a la cuenta (sync), no los datos del dispositivo.
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
import { Button } from '../ui/Button'
import { Glass } from '../ui/Glass'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const fade = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.26, ease: [0, 0, 0.2, 1] as [number, number, number, number] } },
}

export function Forgot() {
  const { dispatch } = useApp()
  const reduce = useReducedMotion()
  const uid = useId()
  const [email, setEmail] = useState('')
  const [error, setError] = useState(false)
  const [sent, setSent] = useState(false)

  const inputCls =
    'h-12 w-full rounded-lg border border-white/10 bg-raised px-4 text-[15px] text-foreground placeholder:text-secondary-foreground/70 focus:border-teal/60 focus:outline-none focus:ring-2 focus:ring-teal/20 transition-colors'

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!EMAIL_RE.test(email.trim())) { setError(true); return }
    setError(false)
    setSent(true)
    dispatch({ t: 'toast', msg: 'Si el correo existe, te enviamos un enlace' })
  }

  return (
    <div
      className="flex h-full flex-col overflow-y-auto"
      style={{ paddingBottom: 'max(40px, calc(32px + env(safe-area-inset-bottom)))' }}
    >
      <header
        className="flex flex-shrink-0 items-center gap-4 px-4"
        style={{ paddingTop: 'max(14px, env(safe-area-inset-top))', paddingBottom: 12 }}
      >
        <button
          aria-label="Atrás"
          onClick={() => dispatch({ t: 'go', screen: 's-login' })}
          className="inline-flex h-11 w-11 items-center justify-center rounded-md text-secondary-foreground hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
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
        <motion.div variants={fade} className="flex flex-col items-center gap-3 pt-4 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: 'color-mix(in srgb, #5FC9B8 14%, transparent)' }}>
            <KeyRound size={26} className="text-teal" aria-hidden="true" />
          </span>
          <h1 className="text-[26px] font-bold leading-tight tracking-tight text-foreground">Recuperar acceso</h1>
          <p className="max-w-[300px] text-[14px] text-secondary-foreground">
            Te enviaremos un enlace para restablecer tu contraseña de cuenta.
          </p>
        </motion.div>

        {sent ? (
          <motion.div variants={fade}>
            <Glass className="flex flex-col items-center gap-3 p-6 text-center">
              <span className="grid h-12 w-12 place-items-center rounded-full bg-teal/12 text-teal">
                <Check size={24} strokeWidth={2.5} />
              </span>
              <p className="text-[15px] font-semibold text-foreground">Revisa tu correo</p>
              <p className="text-[13px] text-secondary-foreground">
                Si <span className="text-foreground">{email.trim()}</span> tiene una cuenta, te llegará un enlace en unos minutos.
              </p>
            </Glass>
          </motion.div>
        ) : (
          <motion.form variants={fade} onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${uid}-email`} className="text-[13px] font-semibold text-secondary-foreground">
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
                className={inputCls + (error ? ' border-alert focus:border-alert focus:ring-alert/20' : '')}
              />
              {error && <p role="alert" className="text-[12px] text-alert">Ingresa un correo electrónico válido.</p>}
            </div>
            <Button type="submit" size="full">Enviar enlace</Button>
          </motion.form>
        )}

        {/* Nota: datos locales */}
        <motion.div variants={fade}>
          <Glass className="flex items-start gap-3 p-4">
            <Shield size={16} className="mt-0.5 shrink-0 text-teal" aria-hidden />
            <p className="text-[12px] leading-relaxed text-secondary-foreground">
              Tus <span className="text-foreground">registros se guardan en este dispositivo</span>, no en la nube. Recuperar la
              contraseña restaura el acceso a tu cuenta, no borra ni recupera datos locales. ¿Olvidaste tu PIN? Puedes
              restablecerlo desde Ajustes → Seguridad.
            </p>
          </Glass>
        </motion.div>

        <motion.div variants={fade} className="mt-auto pt-2">
          <Button size="full" variant="outline" onClick={() => dispatch({ t: 'go', screen: 's-login' })}>
            Volver a iniciar sesión
          </Button>
        </motion.div>
      </motion.div>
    </div>
  )
}
