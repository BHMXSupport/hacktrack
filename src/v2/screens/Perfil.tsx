// Hacktrack v2 — Perfil y privacidad. Precision × Accessible.
// R46: nombre editable inline. R50: cerrar sesión, aviso privacidad real, oposición/revocación real.
import { useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import {
  ShieldCheck, Download, Pencil, Trash2, ShieldOff, FileText, User, ChevronRight,
  LogOut, Check, X as XIcon, Scale, Ruler, Percent, Activity, Gauge,
} from 'lucide-react'
import { Sheet } from '../ui/Sheet'
import { Button } from '../ui/Button'
import { useApp } from '../../lib/store'
import { signOut } from '../../lib/backend/auth'
import { CURRENT_CONSENT_VERSION } from './Ajustes'

// URL real del Aviso de Privacidad completo (página estática dentro de la PWA)
const PRIVACY_URL = `${import.meta.env.BASE_URL}aviso-privacidad.html`

// Resumen de cambios de la versión vigente del aviso — ACTUALIZAR en cada bump de
// CURRENT_CONSENT_VERSION: el diálogo de re-consentimiento lo muestra antes de "Acepto".
const CONSENT_VERSION_SUMMARY =
  'Local-first: tus datos viven en tu dispositivo; el respaldo en la nube es opcional. ' +
  'Derechos ARCO ejercitables desde la app o por correo.'

// ── helpers de descarga ────────────────────────────────────────────────────────
function triggerDownload(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

// ── fila genérica: tap target ≥44px ──────────────────────────────────────────
function Row({
  icon,
  label,
  sub,
  iconClass = 'text-teal',
  labelClass = 'text-foreground',
  onClick,
  chevron = true,
}: {
  icon: React.ReactNode
  label: string
  sub?: string
  iconClass?: string
  labelClass?: string
  onClick?: () => void
  chevron?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[44px] w-full items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-white/3"
      aria-label={label}
    >
      <span className={['shrink-0', iconClass].join(' ')}>{icon}</span>
      <span className="flex flex-1 flex-col">
        <span className={['text-[14px] font-medium', labelClass].join(' ')}>{label}</span>
        {sub && <span className="text-[12px] text-muted-foreground">{sub}</span>}
      </span>
      {chevron && <ChevronRight size={16} className="shrink-0 text-muted-foreground" />}
    </button>
  )
}

// ── card contenedor de filas ─────────────────────────────────────────────────
function RowCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col divide-y divide-white/6 overflow-hidden rounded-xl bg-raised">
      {children}
    </div>
  )
}

// ── label de sección ─────────────────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-1 pb-1.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
      {children}
    </p>
  )
}

// ── barra de progreso de perfil ───────────────────────────────────────────────
type ProfileFieldKey = 'name' | 'email' | 'peso' | 'est' | 'grasa' | 'musculo' | 'edad' | 'sexo'
const PROFILE_FIELDS: { key: ProfileFieldKey; label: string }[] = [
  { key: 'name', label: 'Nombre' },
  { key: 'email', label: 'Correo' },
  { key: 'peso', label: 'Peso' },
  { key: 'est', label: 'Altura' },
  { key: 'grasa', label: '% grasa' },
  { key: 'musculo', label: '% músculo' },
  { key: 'edad', label: 'Edad' },
  { key: 'sexo', label: 'Sexo' },
]

function ProfileCompleteness({ profile }: { profile: import('../../lib/types').Profile }) {
  const filled = PROFILE_FIELDS.filter((f) => {
    const v = (profile as unknown as Record<string, unknown>)[f.key]
    return v != null && v !== ''
  })
  const total = PROFILE_FIELDS.length
  const count = filled.length
  const pct = Math.round((count / total) * 100)
  const missing = PROFILE_FIELDS.filter((f) => {
    const v = (profile as unknown as Record<string, unknown>)[f.key]
    return v == null || v === ''
  })

  return (
    <div className="w-full max-w-[300px]">
      <div className="mb-1 flex justify-between">
        <span className="text-[12px] text-muted-foreground">Perfil completo</span>
        <span className="font-mono text-[12px] font-bold tabular-nums text-foreground">
          {count} / {total}
        </span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-white/10">
        <motion.div
          className="h-full rounded-full bg-teal"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>
      {missing.length > 0 && (
        <p className="mt-1 text-[11px] italic text-muted-foreground">
          Falta: {missing.slice(0, 3).map((f) => f.label).join(', ')}
          {missing.length > 3 && ` y ${missing.length - 3} más`}
        </p>
      )}
    </div>
  )
}

// ── badge de cumplimiento LFPDPPP ─────────────────────────────────────────────
function LfpdpppBadge() {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-raised px-4 py-3">
      <ShieldCheck size={18} className="shrink-0 text-teal" />
      <span className="text-[12px] font-semibold text-secondary-foreground">
        Hecho en México · Cumple LFPDPPP
      </span>
    </div>
  )
}

// ── sub-sheet de confirmación de borrado ──────────────────────────────────────
function DeleteAccountDialog({
  open,
  onConfirm,
  onCancel,
}: {
  open: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  const reduce = useReducedMotion()
  if (typeof document === 'undefined') return null
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="pointer-events-none fixed inset-0 z-[10000] flex items-end">
          <motion.div
            className="pointer-events-auto absolute inset-0 bg-black/65"
            style={{ backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, pointerEvents: 'none' }}
            onClick={onCancel}
          />
          <motion.div
            role="alertdialog" aria-modal="true"
            aria-label="Confirmar eliminación de cuenta"
            className="pointer-events-auto relative w-full rounded-t-[24px] bg-background p-5 pb-[max(24px,env(safe-area-inset-bottom))]"
            initial={reduce ? { opacity: 0 } : { y: '100%' }}
            animate={reduce ? { opacity: 1 } : { y: 0 }}
            exit={reduce ? { opacity: 0, pointerEvents: 'none' } : { y: '100%', pointerEvents: 'none' }}
            transition={
              reduce
                ? { duration: 0.15 }
                : { type: 'spring', stiffness: 280, damping: 32, mass: 1 }
            }
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-white/20" />
            <div className="mb-4 flex flex-col items-center gap-2 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-alert/15">
                <Trash2 size={22} className="text-alert" />
              </div>
              <h3 className="text-[18px] font-bold text-foreground">
                ¿Cancelar cuenta y borrar datos?
              </h3>
              <p className="max-w-[300px] text-[13px] leading-relaxed text-muted-foreground">
                Ejerces tu derecho de Cancelación (LFPDPPP). Todos tus registros, protocolos y
                configuración serán eliminados de este dispositivo de forma permanente. No se puede
                deshacer.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Button
                variant="primary"
                size="full"
                className="bg-alert text-white shadow-none"
                onClick={onConfirm}
              >
                Sí, borrar todos mis datos
              </Button>
              <Button variant="ghost" size="full" onClick={onCancel}>
                Cancelar
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

// ── sub-sheet de confirmación de cierre de sesión ─────────────────────────────
function LogoutDialog({
  open,
  onConfirm,
  onCancel,
}: {
  open: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  const reduce = useReducedMotion()
  if (typeof document === 'undefined') return null
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="pointer-events-none fixed inset-0 z-[10000] flex items-end">
          <motion.div
            className="pointer-events-auto absolute inset-0 bg-black/60"
            style={{ backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, pointerEvents: 'none' }}
            onClick={onCancel}
          />
          <motion.div
            role="alertdialog" aria-modal="true"
            aria-label="Confirmar cierre de sesión"
            className="pointer-events-auto relative w-full rounded-t-[24px] bg-background p-5 pb-[max(24px,env(safe-area-inset-bottom))]"
            initial={reduce ? { opacity: 0 } : { y: '100%' }}
            animate={reduce ? { opacity: 1 } : { y: 0 }}
            exit={reduce ? { opacity: 0, pointerEvents: 'none' } : { y: '100%', pointerEvents: 'none' }}
            transition={
              reduce
                ? { duration: 0.15 }
                : { type: 'spring', stiffness: 280, damping: 32, mass: 1 }
            }
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-white/20" />
            <div className="mb-4 flex flex-col items-center gap-2 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/8">
                <LogOut size={22} className="text-foreground" />
              </div>
              <h3 className="text-[18px] font-bold text-foreground">¿Cerrar sesión?</h3>
              <p className="max-w-[300px] text-[13px] leading-relaxed text-muted-foreground">
                Tus datos quedan guardados en este dispositivo. Podrás volver a acceder en cualquier
                momento.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Button variant="primary" size="full" onClick={onConfirm}>
                Cerrar sesión
              </Button>
              <Button variant="ghost" size="full" onClick={onCancel}>
                Cancelar
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

// ── re-consentimiento (#82): mostrar el aviso ANTES de aceptar ────────────────
// LFPDPPP: el usuario debe poder revisar qué cambió y el aviso completo antes del
// "Acepto" explícito — nunca aceptar con un solo tap sobre el banner.
function ConsentUpdateDialog({
  open,
  onAccept,
  onCancel,
}: {
  open: boolean
  onAccept: () => void
  onCancel: () => void
}) {
  const reduce = useReducedMotion()
  if (typeof document === 'undefined') return null
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="pointer-events-none fixed inset-0 z-[10000] flex items-end">
          <motion.div
            className="pointer-events-auto absolute inset-0 bg-black/60"
            style={{ backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, pointerEvents: 'none' }}
            onClick={onCancel}
          />
          <motion.div
            role="alertdialog" aria-modal="true"
            aria-label="Aviso de privacidad actualizado — revisar y aceptar"
            className="pointer-events-auto relative w-full rounded-t-[24px] bg-background p-5 pb-[max(24px,env(safe-area-inset-bottom))]"
            initial={reduce ? { opacity: 0 } : { y: '100%' }}
            animate={reduce ? { opacity: 1 } : { y: 0 }}
            exit={reduce ? { opacity: 0, pointerEvents: 'none' } : { y: '100%', pointerEvents: 'none' }}
            transition={
              reduce
                ? { duration: 0.15 }
                : { type: 'spring', stiffness: 280, damping: 32, mass: 1 }
            }
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-white/20" />
            <div className="mb-1 flex items-center gap-2">
              <FileText size={18} className="text-warn" />
              <h3 className="text-[17px] font-bold text-foreground">
                Revisa el Aviso de Privacidad
              </h3>
            </div>
            {/* Se abre tanto por cambio de versión (#82) como para re-aceptar tras revocar */}
            <p className="mb-3 text-[13px] leading-relaxed text-muted-foreground">
              La versión vigente es la {CURRENT_CONSENT_VERSION}. Revísala antes de aceptar —
              aceptar registra tu consentimiento con esa versión y la fecha de hoy.
            </p>
            <div className="mb-3 rounded-xl bg-raised px-4 py-3">
              <p className="text-[12px] font-semibold text-foreground">Qué dice esta versión</p>
              <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">
                {CONSENT_VERSION_SUMMARY}
              </p>
            </div>
            <a
              href={PRIVACY_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mb-4 inline-flex min-h-[44px] items-center text-[13px] font-semibold text-teal underline underline-offset-2"
            >
              Leer el Aviso de Privacidad completo
            </a>
            <div className="flex flex-col gap-2">
              <Button variant="primary" size="full" onClick={onAccept}>
                Acepto
              </Button>
              <Button variant="ghost" size="full" onClick={onCancel}>
                Ahora no
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

// ── aviso de privacidad (acordeón inline dentro del sheet) ───────────────────
function AvisoPrivacidad({
  open,
  onToggle,
}: {
  open: boolean
  onToggle: () => void
}) {
  const reduce = useReducedMotion()
  return (
    <div className="overflow-hidden rounded-xl bg-raised">
      <button
        type="button"
        aria-expanded={open}
        aria-label="Aviso de privacidad LFPDPPP"
        onClick={onToggle}
        className="flex min-h-[44px] w-full items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-white/3"
      >
        <FileText size={18} className="shrink-0 text-teal" />
        <span className="flex flex-1 flex-col">
          <span className="text-[14px] font-medium text-foreground">Aviso de privacidad</span>
          <span className="text-[12px] text-muted-foreground">
            LFPDPPP — Ley Federal de Protección de Datos
          </span>
        </span>
        <ChevronRight
          size={16}
          className={[
            'shrink-0 text-muted-foreground transition-transform duration-200',
            open ? 'rotate-90' : '',
          ].join(' ')}
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="aviso-content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={reduce ? { duration: 0.1 } : { duration: 0.22 }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-3 border-t border-white/6 px-4 py-4">
              <p className="text-[13px] font-semibold text-foreground">
                Aviso de privacidad simplificado
              </p>
              {/* Mantener responsable, versión y fecha en sincronía con public/aviso-privacidad.html */}
              <p className="text-[12px] leading-relaxed text-muted-foreground">
                <span className="font-semibold text-foreground">Responsable:</span> Hacktrack
                (razón social por definir — borrador en revisión legal).
              </p>
              <p className="text-[12px] leading-relaxed text-muted-foreground">
                <span className="font-semibold text-foreground">Datos que recopilamos:</span> nombre,
                correo electrónico (opcional), medidas corporales, registros de dosis y protocolos
                que tú introduces manualmente.
              </p>
              <p className="text-[12px] leading-relaxed text-muted-foreground">
                <span className="font-semibold text-foreground">Finalidad:</span> mostrarte tu
                historial, calcular adherencia y ofrecerte recordatorios. No se usan para publicidad
                ni se comparten con terceros.
              </p>
              <p className="text-[12px] leading-relaxed text-muted-foreground">
                <span className="font-semibold text-foreground">Almacenamiento:</span> local-first —
                tus datos residen en tu dispositivo (localStorage). No se envían a ningún servidor,
                salvo que actives el respaldo opcional en la nube (cifrado en tránsito).
              </p>
              <p className="text-[12px] leading-relaxed text-muted-foreground">
                <span className="font-semibold text-foreground">Derechos ARCO</span> (LFPDPPP
                arts. 22–28): puedes Acceder, Rectificar, Cancelar u Oponerte al tratamiento de tus
                datos en cualquier momento desde esta misma pantalla.
              </p>
              <p className="text-[12px] leading-relaxed text-muted-foreground">
                <a
                  href={PRIVACY_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-teal underline underline-offset-2"
                >
                  Leer el Aviso de Privacidad completo
                </a>{' '}(LFPDPPP).
              </p>
              <p className="text-[12px] font-semibold text-teal">
                Versión {CURRENT_CONSENT_VERSION} · Última actualización: junio de 2026
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── oposición/revocación de consentimiento ────────────────────────────────────
function RevocacionDialog({
  open,
  localOnly,
  consentActive,
  onSetLocalOnly,
  onRevoke,
  onCancel,
}: {
  open: boolean
  localOnly: boolean
  consentActive: boolean
  onSetLocalOnly: (v: boolean) => void
  onRevoke: () => void
  onCancel: () => void
}) {
  const reduce = useReducedMotion()
  if (typeof document === 'undefined') return null
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="pointer-events-none fixed inset-0 z-[10000] flex items-end">
          <motion.div
            className="pointer-events-auto absolute inset-0 bg-black/60"
            style={{ backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, pointerEvents: 'none' }}
            onClick={onCancel}
          />
          <motion.div
            role="dialog"
            aria-label="Gestionar consentimiento y modo local"
            className="pointer-events-auto relative w-full rounded-t-[24px] bg-background p-5 pb-[max(24px,env(safe-area-inset-bottom))]"
            initial={reduce ? { opacity: 0 } : { y: '100%' }}
            animate={reduce ? { opacity: 1 } : { y: 0 }}
            exit={reduce ? { opacity: 0, pointerEvents: 'none' } : { y: '100%', pointerEvents: 'none' }}
            transition={
              reduce
                ? { duration: 0.15 }
                : { type: 'spring', stiffness: 280, damping: 32, mass: 1 }
            }
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-white/20" />
            <div className="mb-1 flex items-center gap-2">
              <ShieldOff size={18} className="text-teal" />
              <h3 className="text-[17px] font-bold text-foreground">
                Gestionar consentimiento (Oposición)
              </h3>
            </div>
            <p className="mb-4 text-[13px] leading-relaxed text-muted-foreground">
              Ejerces tus derechos de Oposición y revocación del consentimiento (LFPDPPP arts. 8 y
              27). Al revocar: se desactiva el respaldo en la nube (si estuviera activo) y tu
              consentimiento queda registrado como revocado. Tus datos permanecen en este
              dispositivo hasta que tú los borres con «Eliminar mis datos».
            </p>

            {/* Toggle modo solo local */}
            <div className="mb-4 flex items-center gap-3 rounded-xl bg-raised px-4 py-3">
              <ShieldCheck size={18} className="shrink-0 text-teal" />
              <span className="flex flex-1 flex-col">
                <span className="text-[14px] font-medium text-foreground">Modo solo local</span>
                <span className="text-[12px] text-muted-foreground">
                  {localOnly
                    ? 'Activo — preferencia registrada'
                    : 'Desactivado'}
                </span>
              </span>
              {/* Chip de estado */}
              <button
                type="button"
                role="switch"
                aria-checked={localOnly}
                aria-label="Activar modo solo local"
                onClick={() => onSetLocalOnly(!localOnly)}
                className={[
                  'relative h-[28px] w-[48px] shrink-0 rounded-full transition-colors duration-200',
                  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2',
                  localOnly ? 'bg-teal' : 'bg-white/15',
                ].join(' ')}
              >
                <span
                  className={[
                    'absolute top-[3px] left-[3px] h-[22px] w-[22px] rounded-full bg-white shadow transition-transform duration-200',
                    localOnly ? 'translate-x-[20px]' : 'translate-x-0',
                  ].join(' ')}
                />
              </button>
            </div>

            {/* Revocación real: consentActive → false (nada de botones sin efecto) */}
            <div className="flex flex-col gap-2">
              {consentActive ? (
                <Button
                  variant="primary"
                  size="full"
                  className="bg-alert text-white shadow-none"
                  onClick={onRevoke}
                >
                  Revocar consentimiento
                </Button>
              ) : (
                <p className="text-center text-[12px] text-muted-foreground">
                  Consentimiento revocado. Puedes volver a aceptarlo desde «Estado de
                  consentimiento».
                </p>
              )}
              <Button variant="ghost" size="full" onClick={onCancel}>
                Cerrar
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

// ── componente principal ──────────────────────────────────────────────────────
export function Perfil({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, dispatch } = useApp()
  const { settings, profile } = state

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [showMoreArco, setShowMoreArco] = useState(false)
  const [showAvisoPrivacidad, setShowAvisoPrivacidad] = useState(false)
  const [showRevocacion, setShowRevocacion] = useState(false)
  const [showConsentUpdate, setShowConsentUpdate] = useState(false)

  // ── nombre editable inline (R46) ──────────────────────────────────────────
  const [nameEditing, setNameEditing] = useState(false)
  const [nameDraft, setNameDraft] = useState(profile.name ?? '')
  const nameInputRef = useRef<HTMLInputElement>(null)

  // ── email editable inline ─────────────────────────────────────────────────
  const [emailDraft, setEmailDraft] = useState(profile.email ?? '')
  const [emailEditing, setEmailEditing] = useState(false)
  const [emailError, setEmailError] = useState('')

  const avatarFileRef = useRef<HTMLInputElement>(null)
  const reduce = useReducedMotion()

  const needsReConsent = settings.consentVersion !== CURRENT_CONSENT_VERSION
  const consentLabel =
    (settings.consentVersion ?? 'v1.0') + ' — ' + (settings.consentActive ? 'activo' : 'revocado')

  // ── exportar JSON ─────────────────────────────────────────────────────────
  function exportJSON() {
    try {
      triggerDownload(
        JSON.stringify({ schemaVersion: 1, exportedAt: Date.now(), state }, null, 2),
        `hacktrack-backup-${new Date().toISOString().slice(0, 10)}.json`,
        'application/json',
      )
      dispatch({ t: 'toast', msg: 'Respaldo JSON descargado' })
    } catch {
      dispatch({ t: 'toast', msg: 'Error al exportar datos' })
    }
  }

  // ── exportar CSV (90 días) ────────────────────────────────────────────────
  function exportCSV() {
    try {
      const cutoff = Date.now() - 90 * 86400000
      const rows: string[][] = [['Fecha', 'Hora', 'Tipo', 'Producto', 'Valor', 'mg_canónicos', 'Nota']]
      for (const group of state.log) {
        for (const item of group.items) {
          if (item.ts < cutoff) continue
          const d = new Date(item.ts)
          rows.push([
            d.toLocaleDateString('es-MX'),
            item.t,
            item.type,
            item.product ?? item.n,
            item.u,
            item.doseMg != null ? String(item.doseMg) : '',
            item.note ?? '',
          ])
        }
      }
      const csv = rows
        .map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(','))
        .join('\n')
      triggerDownload(
        csv,
        `hacktrack-diario-90d-${new Date().toISOString().slice(0, 10)}.csv`,
        'text/csv;charset=utf-8',
      )
      dispatch({ t: 'toast', msg: 'CSV descargado (últimos 90 días)' })
    } catch {
      dispatch({ t: 'toast', msg: 'Error al exportar CSV' })
    }
  }

  // ── foto de avatar ────────────────────────────────────────────────────────
  function handleAvatarFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const MAX = 256 * 1024
    const reader = new FileReader()
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const SIZE = 256
        canvas.width = SIZE
        canvas.height = SIZE
        const ctx = canvas.getContext('2d')!
        const side = Math.min(img.width, img.height)
        const sx = (img.width - side) / 2
        const sy = (img.height - side) / 2
        ctx.drawImage(img, sx, sy, side, side, 0, 0, SIZE, SIZE)
        let quality = 0.85
        let out = canvas.toDataURL('image/jpeg', quality)
        while (out.length > MAX * 1.37 && quality > 0.3) {
          quality -= 0.1
          out = canvas.toDataURL('image/jpeg', quality)
        }
        dispatch({ t: 'setProfileFields', patch: { avatarDataUrl: out } })
      }
      img.src = dataUrl
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  // ── nombre (R46) ─────────────────────────────────────────────────────────
  function commitName() {
    const trimmed = nameDraft.trim()
    dispatch({ t: 'setName', name: trimmed })
    setNameEditing(false)
  }

  function handleNameKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); commitName() }
    if (e.key === 'Escape') {
      setNameEditing(false)
      setNameDraft(profile.name ?? '')
    }
  }

  // ── email ─────────────────────────────────────────────────────────────────
  function commitEmail() {
    const trimmed = emailDraft.trim()
    if (trimmed && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setEmailError('Correo inválido')
      return
    }
    setEmailError('')
    dispatch({ t: 'setProfileFields', patch: { email: trimmed || null } })
    setEmailEditing(false)
  }

  function handleEmailKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); commitEmail() }
    if (e.key === 'Escape') {
      setEmailEditing(false)
      setEmailDraft(profile.email ?? '')
      setEmailError('')
    }
  }

  // ── borrar cuenta (Cancelación ARCO) ─────────────────────────────────────
  function handleDeleteAccount() {
    // ARCO/Cancelación: arcoDelete resetea el estado, pero NO limpiaba las claves secundarias de localStorage
    // (preferencias de unidad, vaso de agua, coach, último error, estado legado v1). Las borramos para no
    // dejar residuos del usuario tras "borrar todos mis datos".
    try {
      ;['hacktrack:v1', 'hacktrack-glass-ml', 'hk_diario_coach', 'ht:lastError', 'ht:consentAcceptedAt'].forEach((k) => localStorage.removeItem(k))
      Object.keys(localStorage).filter((k) => k.startsWith('ht_unit_')).forEach((k) => localStorage.removeItem(k))
    } catch { /* modo privado / sin acceso a localStorage */ }
    dispatch({ t: 'arcoDelete' })
    setShowDeleteConfirm(false)
    onClose()
  }

  // ── cerrar sesión (R50) ───────────────────────────────────────────────────
  async function handleLogout() {
    // Cierra también la sesión de Supabase si el backend está activo (no-op sin backend).
    try { await signOut() } catch { /* sin red: la sesión local se cierra igual */ }
    dispatch({ t: 'go', screen: 's-login' })
    setShowLogoutConfirm(false)
    onClose()
  }

  // ── aceptar re-consentimiento (#82: solo tras VER el aviso en el diálogo) ──
  function handleAcceptConsent() {
    dispatch({ t: 'setSetting', key: 'consentVersion', value: CURRENT_CONSENT_VERSION })
    dispatch({ t: 'setSetting', key: 'consentActive', value: true })
    // Marca de tiempo de aceptación (LFPDPPP): fuera del estado porque UserSettings no tiene la clave.
    try { localStorage.setItem('ht:consentAcceptedAt', String(Date.now())) } catch { /* modo privado */ }
    setShowConsentUpdate(false)
    dispatch({ t: 'toast', msg: 'Consentimiento actualizado.' })
  }

  // ── revocar consentimiento (ARCO) ─────────────────────────────────────────
  function handleRevokeConsent() {
    dispatch({ t: 'setSetting', key: 'consentActive', value: false })
    // Detiene el respaldo en la nube si estuviera activo; los datos locales no se tocan.
    dispatch({ t: 'setSetting', key: 'cloudSync', value: false })
    setShowRevocacion(false)
    dispatch({ t: 'toast', msg: 'Consentimiento revocado. Tus datos siguen en este dispositivo.' })
  }

  return (
    <>
      <Sheet open={open} onClose={onClose} title="Perfil y privacidad">
        <div className="flex flex-col gap-5 pb-2">

          {/* ── Banner de re-consentimiento ──────────────────────────────── */}
          <AnimatePresence>
            {needsReConsent && (
              <motion.button
                type="button"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2 }}
                onClick={() => setShowConsentUpdate(true)}
                className="flex w-full items-center gap-2 rounded-xl bg-warn/20 px-4 py-3 text-left"
                aria-label="Aviso de privacidad actualizado — toca para revisar y aceptar"
              >
                <ShieldCheck size={16} className="shrink-0 text-warn" />
                <span className="text-[13px] font-semibold text-warn">
                  Aviso de privacidad actualizado — toca para revisar
                </span>
              </motion.button>
            )}
          </AnimatePresence>

          {/* ── Avatar + nombre + completitud ────────────────────────────── */}
          <section className="flex flex-col items-center gap-3 pt-1">
            <div className="relative inline-block">
              <div className="h-[80px] w-[80px] overflow-hidden rounded-full bg-raised">
                {(profile as { avatarDataUrl?: string }).avatarDataUrl ? (
                  <img
                    src={(profile as { avatarDataUrl?: string }).avatarDataUrl}
                    alt="Avatar"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <User size={36} className="text-muted-foreground" />
                  </div>
                )}
              </div>
              <button
                type="button"
                aria-label="Cambiar foto de perfil"
                onClick={() => avatarFileRef.current?.click()}
                className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full border-2 border-background bg-teal focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
              >
                <Pencil size={12} className="text-primary-foreground" />
              </button>
              <input
                ref={avatarFileRef}
                type="file"
                accept="image/*"
                className="hidden"
                aria-hidden
                onChange={handleAvatarFile}
              />
            </div>

            <div className="text-center">
              <p className="text-[18px] font-bold text-foreground">
                {profile.name ?? 'Tu perfil'}
              </p>
              <p className="text-[12px] text-muted-foreground">Tus datos son tuyos</p>
            </div>

            <ProfileCompleteness profile={profile} />
          </section>

          {/* ── Información personal ──────────────────────────────────────── */}
          <section>
            <SectionLabel>Información personal</SectionLabel>
            <div className="flex flex-col divide-y divide-white/6 overflow-hidden rounded-xl bg-raised">

              {/* Nombre editable inline (R46) */}
              <div className="flex min-h-[44px] items-start gap-3 px-4 py-2">
                <span className="mt-0.5 shrink-0 text-teal">
                  <User size={18} />
                </span>
                <span className="flex flex-1 flex-col gap-1">
                  <span className="text-[14px] font-medium text-foreground">Nombre</span>
                  <AnimatePresence mode="wait" initial={false}>
                    {nameEditing ? (
                      <motion.span
                        key="name-editing"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.12 }}
                        className="flex items-center gap-2"
                      >
                        <input
                          ref={nameInputRef}
                          type="text"
                          value={nameDraft}
                          autoFocus
                          maxLength={48}
                          placeholder="Tu nombre"
                          aria-label="Nombre"
                          onChange={(e) => setNameDraft(e.target.value)}
                          onKeyDown={handleNameKey}
                          onBlur={commitName}
                          className="flex-1 rounded-md border border-white/10 bg-card px-2 py-1 text-[13px] text-foreground focus:outline-none focus-visible:ring-1 focus-visible:ring-teal"
                        />
                        <button
                          type="button"
                          aria-label="Confirmar nombre"
                          onClick={commitName}
                          className="shrink-0 text-teal"
                        >
                          <Check size={16} />
                        </button>
                        <button
                          type="button"
                          aria-label="Cancelar edición de nombre"
                          onClick={() => {
                            setNameEditing(false)
                            setNameDraft(profile.name ?? '')
                          }}
                          className="shrink-0 text-muted-foreground"
                        >
                          <XIcon size={16} />
                        </button>
                      </motion.span>
                    ) : (
                      <motion.span
                        key="name-display"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.12 }}
                        className="text-[12px] text-muted-foreground"
                      >
                        {profile.name ?? (
                          <span className="italic">Sin nombre</span>
                        )}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </span>
                {!nameEditing && (
                  <button
                    type="button"
                    aria-label="Editar nombre"
                    onClick={() => {
                      setNameDraft(profile.name ?? '')
                      setNameEditing(true)
                    }}
                    className="mt-1 shrink-0 text-muted-foreground"
                  >
                    <Pencil size={14} />
                  </button>
                )}
              </div>

              {/* Correo electrónico */}
              <div className="flex min-h-[44px] items-start gap-3 px-4 py-2">
                <span className="mt-0.5 shrink-0 text-teal">
                  <svg
                    width={18}
                    height={18}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="2" y="4" width="20" height="16" rx="2" />
                    <path d="m2 7 10 7 10-7" />
                  </svg>
                </span>
                <span className="flex flex-1 flex-col gap-1">
                  <span className="text-[14px] font-medium text-foreground">
                    Correo electrónico
                  </span>
                  <AnimatePresence mode="wait" initial={false}>
                    {emailEditing ? (
                      <motion.span
                        key="editing"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.12 }}
                        className="flex flex-col gap-1"
                      >
                        <input
                          type="email"
                          value={emailDraft}
                          autoFocus
                          maxLength={80}
                          placeholder="tu@correo.com"
                          aria-label="Correo electrónico"
                          onChange={(e) => { setEmailDraft(e.target.value); setEmailError('') }}
                          onKeyDown={handleEmailKey}
                          onBlur={commitEmail}
                          className="rounded-md border border-white/10 bg-card px-2 py-1 text-[13px] text-foreground focus:outline-none focus-visible:ring-1 focus-visible:ring-teal"
                        />
                        {emailError && (
                          <span className="text-[12px] text-alert">{emailError}</span>
                        )}
                      </motion.span>
                    ) : (
                      <motion.span
                        key="display"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.12 }}
                        className="text-[12px] text-muted-foreground"
                      >
                        {profile.email ?? (
                          <span className="italic">Sin correo</span>
                        )}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </span>
                {!emailEditing && (
                  <button
                    type="button"
                    aria-label="Editar correo electrónico"
                    onClick={() => { setEmailDraft(profile.email ?? ''); setEmailEditing(true) }}
                    className="mt-1 shrink-0 text-muted-foreground"
                  >
                    <Pencil size={14} />
                  </button>
                )}
              </div>
            </div>
          </section>

          {/* ── Datos biométricos ─────────────────────────────────────────
              Peso/Altura/%/IMC viven en el profile (los registra el onboarding y "Cambio de medidas").
              Antes el perfil solo mostraba Nombre+Correo → parecían "no guardados". Aquí se ven y, al
              tocarlos, se abre su registro (MedidaSheet) para actualizarlos manteniendo el historial. */}
          <section>
            <SectionLabel>Datos biométricos</SectionLabel>
            <RowCard>
              <Row
                icon={<Scale size={18} />}
                label="Peso"
                sub={profile.peso != null ? `${profile.peso} kg` : 'Sin registrar — toca para agregar'}
                onClick={() => dispatch({ t: 'sheet', sheet: 'medida', arg: 'Peso' })}
              />
              <Row
                icon={<Ruler size={18} />}
                label="Altura"
                sub={profile.est != null ? `${profile.est} cm` : 'Sin registrar — toca para agregar'}
                onClick={() => dispatch({ t: 'sheet', sheet: 'medida', arg: 'Altura' })}
              />
              <Row
                icon={<Percent size={18} />}
                label="% grasa"
                sub={profile.grasa != null ? `${profile.grasa} %` : 'Sin registrar — toca para agregar'}
                onClick={() => dispatch({ t: 'sheet', sheet: 'medida', arg: '% grasa' })}
              />
              <Row
                icon={<Activity size={18} />}
                label="% músculo"
                sub={profile.musculo != null ? `${profile.musculo} %` : 'Sin registrar — toca para agregar'}
                onClick={() => dispatch({ t: 'sheet', sheet: 'medida', arg: '% músculo' })}
              />
              <Row
                icon={<Gauge size={18} />}
                label="IMC"
                sub={profile.bmi != null ? `${profile.bmi}` : 'Se calcula con peso y altura'}
                chevron={false}
              />
            </RowCard>
          </section>

          {/* ── Privacidad y datos (ARCO) ────────────────────────────────── */}
          <section>
            <SectionLabel>Privacidad y derechos ARCO</SectionLabel>
            <RowCard>
              {/* Estado de consentimiento — revisar el aviso antes de aceptar (#82) */}
              <Row
                icon={<ShieldCheck size={18} />}
                label={
                  needsReConsent
                    ? 'Consentimiento — ¡actualización!'
                    : 'Estado de consentimiento'
                }
                sub={consentLabel}
                labelClass={needsReConsent ? 'text-warn' : 'text-foreground'}
                onClick={
                  needsReConsent || !settings.consentActive
                    ? () => setShowConsentUpdate(true)
                    : undefined
                }
                chevron={needsReConsent || !settings.consentActive}
              />

              {/* Acceso — descargar JSON */}
              <Row
                icon={<Download size={18} />}
                label="Descargar mis datos"
                sub="JSON completo · respaldo local (Acceso)"
                onClick={exportJSON}
              />

              {/* Cancelación — eliminar cuenta */}
              <Row
                icon={<Trash2 size={18} />}
                label="Eliminar mis datos"
                sub="Borrar todo de este dispositivo (Cancelación)"
                iconClass="text-alert"
                labelClass="text-alert"
                onClick={() => setShowDeleteConfirm(true)}
              />

              {/* Disclosure: más acciones ARCO */}
              <button
                type="button"
                aria-expanded={showMoreArco}
                aria-label="Ver más opciones de gestión de datos (Rectificación y Oposición)"
                onClick={() => setShowMoreArco((v) => !v)}
                className="flex min-h-[44px] w-full items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-white/3"
              >
                <ShieldCheck size={18} className="shrink-0 text-teal" />
                <span className="flex flex-1 flex-col">
                  <span className="text-[14px] font-medium text-foreground">
                    Gestionar mis datos (ARCO)
                  </span>
                  <span className="text-[12px] text-muted-foreground">
                    Rectificación, oposición, exportar historial
                  </span>
                </span>
                <ChevronRight
                  size={16}
                  className={[
                    'shrink-0 text-muted-foreground transition-transform duration-200',
                    showMoreArco ? 'rotate-90' : '',
                  ].join(' ')}
                />
              </button>

              <AnimatePresence initial={false}>
                {showMoreArco && (
                  <motion.div
                    key="arco-more"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={reduce ? { duration: 0.1 } : { duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    {/* Acceso — CSV historial */}
                    <Row
                      icon={<Download size={18} />}
                      label="Exportar historial (CSV)"
                      sub="Tus registros de los últimos 90 días"
                      onClick={exportCSV}
                    />

                    {/* Rectificación — corregir datos */}
                    <Row
                      icon={<Pencil size={18} />}
                      label="Corregir mis datos"
                      sub="Rectificación — edita nombre o correo arriba"
                      onClick={() =>
                        dispatch({ t: 'toast', msg: 'Edita tus datos en el perfil o el diario.' })
                      }
                    />

                    {/* Oposición — gestionar consentimiento / modo local (R50) */}
                    <Row
                      icon={<ShieldOff size={18} />}
                      label="Oposición / revocar consentimiento"
                      sub={
                        settings.consentActive
                          ? 'Revocar consentimiento · modo solo local'
                          : 'Consentimiento revocado'
                      }
                      onClick={() => setShowRevocacion(true)}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </RowCard>
          </section>

          {/* ── Aviso de privacidad (acordeón — R50) ─────────────────────── */}
          <section>
            <AvisoPrivacidad
              open={showAvisoPrivacidad}
              onToggle={() => setShowAvisoPrivacidad((v) => !v)}
            />
          </section>

          {/* ── Microcopy de privacidad ───────────────────────────────────── */}
          <section>
            <div className="flex gap-3 rounded-xl bg-raised px-4 py-3">
              <ShieldCheck size={16} className="mt-0.5 shrink-0 text-teal" />
              <div>
                <p className="text-[13px] font-semibold text-foreground">Almacenamiento local</p>
                <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">
                  Tus datos viven en tu dispositivo (localStorage) y no se envían a ningún servidor,
                  salvo que actives el respaldo opcional en la nube. Puedes exportarlos o
                  eliminarlos en cualquier momento.
                </p>
              </div>
            </div>
          </section>

          {/* ── Badge LFPDPPP ────────────────────────────────────────────── */}
          <LfpdpppBadge />

          {/* ── Cerrar sesión (R50) ──────────────────────────────────────── */}
          <section>
            <RowCard>
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(true)}
                className="flex min-h-[44px] w-full items-center gap-3 px-4 py-2 text-left"
                aria-label="Cerrar sesión"
              >
                <LogOut size={18} className="shrink-0 text-muted-foreground" />
                <span className="flex flex-1 flex-col">
                  <span className="text-[14px] font-medium text-foreground">Cerrar sesión</span>
                  <span className="text-[12px] text-muted-foreground">
                    Tus datos se conservan en este dispositivo
                  </span>
                </span>
                <ChevronRight size={16} className="shrink-0 text-muted-foreground" />
              </button>
            </RowCard>
          </section>
        </div>
      </Sheet>

      {/* Confirmación de borrado de cuenta */}
      <DeleteAccountDialog
        open={showDeleteConfirm}
        onConfirm={handleDeleteAccount}
        onCancel={() => setShowDeleteConfirm(false)}
      />

      {/* Confirmación de cierre de sesión (R50) */}
      <LogoutDialog
        open={showLogoutConfirm}
        onConfirm={handleLogout}
        onCancel={() => setShowLogoutConfirm(false)}
      />

      {/* Oposición / revocación (R50) */}
      <RevocacionDialog
        open={showRevocacion}
        localOnly={state.localOnly}
        consentActive={!!settings.consentActive}
        onSetLocalOnly={(v) => dispatch({ t: 'setLocalOnly', value: v })}
        onRevoke={handleRevokeConsent}
        onCancel={() => setShowRevocacion(false)}
      />

      {/* Re-consentimiento (#82): aviso visible + "Acepto" explícito */}
      <ConsentUpdateDialog
        open={showConsentUpdate}
        onAccept={handleAcceptConsent}
        onCancel={() => setShowConsentUpdate(false)}
      />
    </>
  )
}
