// Hacktrack v2 — Perfil y privacidad. Precision × Accessible.
// Sheet con derechos ARCO (LFPDPPP), badge de cumplimiento y diálogo de eliminación de cuenta.
import { useState, useRef } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import {
  ShieldCheck, Download, Pencil, Trash2, ShieldOff, FileText, User, ChevronRight,
} from 'lucide-react'
import { Sheet } from '../ui/Sheet'
import { Button } from '../ui/Button'
import { useApp } from '../../lib/store'
import { CURRENT_CONSENT_VERSION } from './Ajustes'

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
  return (
    <AnimatePresence>
      {open && (
        <div className="absolute inset-0 z-[60] flex items-end">
          <motion.div
            className="absolute inset-0 bg-black/65"
            style={{ backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCancel}
          />
          <motion.div
            role="alertdialog"
            aria-label="Confirmar eliminación de cuenta"
            className="relative w-full rounded-t-[24px] bg-background p-5 pb-[max(24px,env(safe-area-inset-bottom))]"
            initial={reduce ? { opacity: 0 } : { y: '100%' }}
            animate={reduce ? { opacity: 1 } : { y: 0 }}
            exit={reduce ? { opacity: 0 } : { y: '100%' }}
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
                Sí, borrar todo mis datos
              </Button>
              <Button variant="ghost" size="full" onClick={onCancel}>
                Cancelar
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

// ── componente principal ──────────────────────────────────────────────────────
export function Perfil({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, dispatch } = useApp()
  const { settings, profile } = state

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showMoreArco, setShowMoreArco] = useState(false)
  const [emailDraft, setEmailDraft] = useState(profile.email ?? '')
  const [emailEditing, setEmailEditing] = useState(false)
  const [emailError, setEmailError] = useState('')
  const reduce = useReducedMotion()

  const avatarFileRef = useRef<HTMLInputElement>(null)

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

  // ── exportar CSV (90 días) — Acceso para médico ───────────────────────────
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
    dispatch({ t: 'arcoDelete' })
    setShowDeleteConfirm(false)
    onClose()
  }

  // ── aceptar re-consentimiento ─────────────────────────────────────────────
  function handleAcceptConsent() {
    dispatch({ t: 'setSetting', key: 'consentVersion', value: CURRENT_CONSENT_VERSION })
    dispatch({ t: 'setSetting', key: 'consentActive', value: true })
    dispatch({ t: 'toast', msg: 'Consentimiento actualizado.' })
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
                onClick={handleAcceptConsent}
                className="flex w-full items-center gap-2 rounded-xl bg-warn/20 px-4 py-3 text-left"
                aria-label="Aviso de privacidad actualizado — toca para revisar y aceptar"
              >
                <ShieldCheck size={16} className="shrink-0 text-warn" />
                <span className="text-[13px] font-semibold text-warn">
                  Aviso de privacidad actualizado — toca para aceptar
                </span>
              </motion.button>
            )}
          </AnimatePresence>

          {/* ── Avatar + nombre + completitud ────────────────────────────── */}
          <section className="flex flex-col items-center gap-3 pt-1">
            <div className="relative inline-block">
              {/* Avatar */}
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
                capture="user"
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
            <RowCard>
              {/* Nombre */}
              <Row
                icon={<User size={18} />}
                label="Nombre"
                sub={profile.name ?? 'Sin configurar'}
                onClick={() => dispatch({ t: 'toast', msg: 'Edita tu nombre en Ajustes.' })}
              />

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
            </RowCard>
          </section>

          {/* ── Privacidad y datos (ARCO) ────────────────────────────────── */}
          <section>
            <SectionLabel>Privacidad y derechos ARCO</SectionLabel>
            <RowCard>
              {/* Estado de consentimiento */}
              <Row
                icon={<ShieldCheck size={18} />}
                label={
                  needsReConsent
                    ? 'Consentimiento — ¡actualización!'
                    : 'Estado de consentimiento'
                }
                sub={consentLabel}
                labelClass={needsReConsent ? 'text-warn' : 'text-foreground'}
                onClick={needsReConsent ? handleAcceptConsent : undefined}
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
                    Rectificación, oposición, exportar para médico
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
                    {/* Acceso — CSV para médico */}
                    <Row
                      icon={<Download size={18} />}
                      label="Exportar para médico (CSV)"
                      sub="Dosis y medidas · últimos 90 días"
                      onClick={exportCSV}
                    />

                    {/* Rectificación — corregir datos */}
                    <Row
                      icon={<Pencil size={18} />}
                      label="Corregir mis datos"
                      sub="Rectificación"
                      onClick={() =>
                        dispatch({ t: 'toast', msg: 'Edita tus datos en el perfil o el diario.' })
                      }
                    />

                    {/* Oposición — gestionar consentimiento */}
                    <Row
                      icon={<ShieldOff size={18} />}
                      label="Gestionar consentimiento"
                      sub="Oposición"
                      onClick={() =>
                        dispatch({
                          t: 'toast',
                          msg: 'Para revocar tu consentimiento, elimina tus datos.',
                        })
                      }
                    />

                    {/* Aviso de privacidad */}
                    <Row
                      icon={<FileText size={18} />}
                      label="Aviso de privacidad"
                      sub="LFPDPPP — Ley Federal de Protección de Datos"
                      onClick={() =>
                        dispatch({ t: 'toast', msg: 'Aviso de privacidad — próximamente.' })
                      }
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </RowCard>
          </section>

          {/* ── Microcopy de privacidad ───────────────────────────────────── */}
          <section>
            <div className="flex gap-3 rounded-xl bg-raised px-4 py-3">
              <ShieldCheck size={16} className="mt-0.5 shrink-0 text-teal" />
              <div>
                <p className="text-[13px] font-semibold text-foreground">Almacenamiento local</p>
                <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">
                  Todos tus datos viven en tu dispositivo (localStorage). No se envían a servidores
                  externos. Puedes exportarlos o eliminarlos en cualquier momento.
                </p>
              </div>
            </div>
          </section>

          {/* ── Badge LFPDPPP ────────────────────────────────────────────── */}
          <LfpdpppBadge />

          {/* ── Borrar cuenta ────────────────────────────────────────────── */}
          <section>
            <RowCard>
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="flex min-h-[44px] w-full items-center gap-3 px-4 py-2 text-left"
                aria-label="Borrar mi cuenta y todos mis datos"
              >
                <span className="flex-1 text-[14px] font-medium text-alert">Borrar mi cuenta</span>
              </button>
            </RowCard>
            <p className="mt-1.5 px-1 text-[11px] text-muted-foreground">
              Ejerces tu derecho de Cancelación (LFPDPPP art. 28). Acción irreversible.
            </p>
          </section>
        </div>
      </Sheet>

      {/* Confirmación de borrado de cuenta */}
      <DeleteAccountDialog
        open={showDeleteConfirm}
        onConfirm={handleDeleteAccount}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </>
  )
}
