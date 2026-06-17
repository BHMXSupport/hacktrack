import { useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useApp } from '../lib/store'
import { IcBack, IcShield, IcCheck, IcChevron, IcClose } from '../components/icons'
import { UserAvatar, TrustBadge } from '../components/identity'
import { dur, spring } from '../lib/motion'
import { CURRENT_CONSENT_VERSION } from './Ajustes'

// ── Íconos semánticos ARCO (N=391 / N=447) ────────────────────────────────────
function IcDownload({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  )
}
function IcPencil({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5Z" />
    </svg>
  )
}
function IcTrash({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  )
}
function IcShieldOff({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3 5 6v6c0 1.5.5 3 1.3 4.2M12 3l7 3v5.2a9 9 0 0 1-3.7 7.3" />
      <line x1="2" y1="2" x2="22" y2="22" />
    </svg>
  )
}
function IcDocument({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="12" y2="17" />
    </svg>
  )
}
function IcPerson({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  )
}
function IcLock({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  )
}

// ── indicador de completitud del perfil (N=389) ──────────────────────────────
type ProfileField = {
  key: keyof import('../lib/types').Profile | 'email'
  label: string
}
const PROFILE_FIELDS: ProfileField[] = [
  { key: 'name',     label: 'Nombre' },
  { key: 'email',    label: 'Correo' },
  { key: 'peso',     label: 'Peso' },
  { key: 'est',      label: 'Altura' },
  { key: 'grasa',    label: '% Grasa' },
  { key: 'musculo',  label: '% Músculo' },
  { key: 'edad',     label: 'Edad' },
  { key: 'sexo',     label: 'Sexo' },
]

function ProfileCompleteness({ profile }: { profile: import('../lib/types').Profile }) {
  const filled  = PROFILE_FIELDS.filter((f) => {
    const v = (profile as unknown as Record<string, unknown>)[f.key as string]
    return v != null && v !== ''
  })
  const total   = PROFILE_FIELDS.length
  const count   = filled.length
  const pct     = Math.round((count / total) * 100)
  const missing = PROFILE_FIELDS.filter((f) => {
    const v = (profile as unknown as Record<string, unknown>)[f.key as string]
    return v == null || v === ''
  })

  return (
    <div style={{ width: '100%', maxWidth: 280 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span className="sm" style={{ color: 'var(--ink-400)' }}>Perfil completo</span>
        <span className="sm mono" style={{ color: 'var(--ink-700)', fontWeight: 700 }}>{count} / {total}</span>
      </div>
      {/* barra de progreso */}
      <div style={{ height: 4, background: 'var(--ink-100)', borderRadius: 99, overflow: 'hidden' }}>
        <motion.div
          style={{ height: '100%', background: 'var(--brand-700)', borderRadius: 99 }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>
      {missing.length > 0 && (
        <p className="sm" style={{ color: 'var(--ink-300)', marginTop: 4, fontStyle: 'italic' }}>
          {/* Máx 3 campos visibles + 'y N más' para no envolver a 3 líneas en perfiles vacíos */}
          Falta: {missing.slice(0, 3).map((f) => f.label).join(', ')}
          {missing.length > 3 && ` y ${missing.length - 3} más`}
        </p>
      )}
    </div>
  )
}

// ── Sheet de re-consentimiento (N=446) ────────────────────────────────────────
function ReConsentSheet({ onAccept, onClose }: { onAccept: () => void; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={spring.sheet}
        style={{ background: 'var(--bg)', borderRadius: '20px 20px 0 0', padding: '28px 20px 40px', width: '100%', maxHeight: '70vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
          <span className="h2" style={{ flex: 1, margin: 0 }}>Aviso de privacidad actualizado</span>
          <button className="iconbtn" onClick={onClose} aria-label="Cerrar"><IcClose size={22} /></button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
          <p className="body" style={{ margin: 0 }}>
            Hemos actualizado nuestro aviso de privacidad ({CURRENT_CONSENT_VERSION}).
          </p>
          <ul className="sm" style={{ color: 'var(--ink-400)', paddingLeft: 20, margin: 0, lineHeight: 1.7 }}>
            <li>Todos tus datos se almacenan localmente en tu dispositivo.</li>
            <li>No se comparten con terceros sin tu consentimiento explícito.</li>
            <li>Puedes exportar o eliminar tus datos en cualquier momento.</li>
          </ul>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            className="btn"
            style={{ width: '100%', height: 48 }}
            onClick={onAccept}
          >
            Acepto la versión actualizada
          </button>
          <button className="btn btn-ghost" style={{ width: '100%', height: 48 }} onClick={onClose}>
            Más tarde
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

export function Perfil() {
  const { state, dispatch } = useApp()
  const { settings, profile } = state

  const [showReConsent, setShowReConsent] = useState(
    settings.consentVersion !== CURRENT_CONSENT_VERSION
  )
  const [emailDraft, setEmailDraft]   = useState(profile.email ?? '')
  const [emailEditing, setEmailEditing] = useState(false)
  const [emailError, setEmailError]   = useState('')
  const [showMoreArco, setShowMoreArco] = useState(false)

  // Avatar photo upload ref (N=388 / N=448)
  const avatarFileRef = useRef<HTMLInputElement>(null)

  const close = () => dispatch({ t: 'sheet', sheet: null })

  const consentLabel =
    settings.consentVersion +
    ' — ' +
    (settings.consentActive ? 'activo' : 'revocado')

  const needsReConsent = settings.consentVersion !== CURRENT_CONSENT_VERSION

  // ── Exportar datos (N=92) ─────────────────────────────────────────────────
  function exportJSON() {
    try {
      const blob = new Blob([JSON.stringify({ schemaVersion: 1, exportedAt: Date.now(), state }, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `hacktrack-backup-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 5000)
      dispatch({ t: 'toast', msg: 'Respaldo JSON descargado' })
    } catch {
      dispatch({ t: 'toast', msg: 'Error al exportar datos' })
    }
  }

  function exportCSV() {
    try {
      const cutoff = Date.now() - 90 * 86400000
      const rows: string[][] = [['Fecha', 'Hora', 'Tipo', 'Producto', 'Valor', 'mg_canónicos', 'Nota']]
      for (const group of state.log) {
        for (const item of group.items) {
          if (item.ts < cutoff) continue
          const d = new Date(item.ts)
          rows.push([d.toLocaleDateString('es-MX'), item.t, item.type, item.product ?? item.n, item.u, item.doseMg != null ? String(item.doseMg) : '', item.note ?? ''])
        }
      }
      const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n')
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `hacktrack-diario-90d-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 5000)
      dispatch({ t: 'toast', msg: 'CSV descargado (últimos 90 días)' })
    } catch {
      dispatch({ t: 'toast', msg: 'Error al exportar CSV' })
    }
  }

  // ── Manejo de foto de avatar (N=388 / N=448) ─────────────────────────────
  function handleAvatarFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const MAX = 256 * 1024 // 256 kB cap
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
        // recortar al cuadrado central
        const side = Math.min(img.width, img.height)
        const sx = (img.width - side) / 2
        const sy = (img.height - side) / 2
        ctx.drawImage(img, sx, sy, side, side, 0, 0, SIZE, SIZE)
        let quality = 0.85
        let out = canvas.toDataURL('image/jpeg', quality)
        // reducir si supera 256 kB
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

  // ── Validación de email (N=390) ───────────────────────────────────────────
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
    if (e.key === 'Enter')  { e.preventDefault(); commitEmail() }
    if (e.key === 'Escape') { setEmailEditing(false); setEmailDraft(profile.email ?? ''); setEmailError('') }
  }

  return (
    <>
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 320, damping: 32 }}
        style={{ position: 'absolute', inset: 0, background: 'var(--bg)', zIndex: 50 }}
      >
        <div className="scroll">
          {/* Top bar */}
          <header
            style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px',
              borderBottom: '1px solid var(--border)', position: 'sticky',
              top: 'env(safe-area-inset-top, 0px)', background: 'var(--bg)', zIndex: 10,
            }}
          >
            <button className="iconbtn" onClick={close} aria-label="Volver">
              <IcBack size={22} />
            </button>
            <span className="h2" style={{ flex: 1, margin: 0 }}>Perfil y privacidad</span>
          </header>

          <div style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 32 }}>

            {/* ── Banner de nuevo consentimiento (N=446) ─────────────────────
                Una sola señal a la vez: si el sheet ya está abierto, no mostramos también el banner. */}
            <AnimatePresence>
              {needsReConsent && !showReConsent && (
                <motion.button
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                  style={{
                    background: 'var(--warning)',
                    border: 'none', borderRadius: 12, padding: '10px 16px',
                    display: 'flex', alignItems: 'center', gap: 10,
                    cursor: 'pointer', textAlign: 'left', width: '100%',
                    color: '#fff',
                  }}
                  onClick={() => setShowReConsent(true)}
                >
                  <IcShield size={18} />
                  <span className="sm" style={{ fontWeight: 600, color: '#fff' }}>
                    Aviso de privacidad actualizado — toca para revisar
                  </span>
                </motion.button>
              )}
            </AnimatePresence>

            {/* Avatar + nombre + completitud (N=388/448/389) */}
            <section style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              {/* Avatar con botón de foto */}
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <UserAvatar size={88} tone="soft" />
                <button
                  aria-label="Cambiar foto de perfil"
                  onClick={() => avatarFileRef.current?.click()}
                  style={{
                    position: 'absolute', bottom: 0, right: 0,
                    width: 28, height: 28, borderRadius: 999,
                    background: 'var(--brand-700)', border: '2px solid var(--bg)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                </button>
                <input
                  ref={avatarFileRef}
                  type="file"
                  accept="image/*"
                  capture="user"
                  style={{ display: 'none' }}
                  onChange={handleAvatarFile}
                  aria-hidden
                />
              </div>
              <div className="h1" style={{ margin: 0, textAlign: 'center' }}>
                {profile.name ?? 'Tu perfil'}
              </div>
              <div className="sm" style={{ color: 'var(--ink-400)', margin: 0 }}>
                Tus datos son tuyos
              </div>

              {/* Completitud del perfil (N=389) */}
              <ProfileCompleteness profile={profile} />
            </section>

            {/* ── Campo de email (N=390) ────────────────────────────────────── */}
            <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div className="body" style={{ color: 'var(--ink-700)', fontWeight: 600, paddingLeft: 4 }}>
                Información personal
              </div>
              {/* 'rowlist' (sin 'card') — unificado con las demás secciones para evitar doble borde/sombra y padding extra */}
              <div className="rowlist">
                <div className="row" style={{ alignItems: 'flex-start', minHeight: 56 }}>
                  <span className="row-ic">
                    <span style={{ color: 'var(--brand-700)', display: 'flex' }}><IcPerson size={18} /></span>
                  </span>
                  <span className="row-main">
                    <span className="row-label">Nombre</span>
                    <span className="row-sub">{profile.name ?? <span style={{ color: 'var(--ink-300)', fontStyle: 'italic' }}>Sin configurar</span>}</span>
                  </span>
                  <span className="row-end">
                    <IcChevron size={16} style={{ color: 'var(--ink-400)' }} />
                  </span>
                </div>

                {/* Email */}
                <div className="row" style={{ alignItems: 'flex-start', minHeight: 56 }}>
                  <span className="row-ic">
                    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="var(--brand-700)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="4" width="20" height="16" rx="2" />
                      <path d="m2 7 10 7 10-7" />
                    </svg>
                  </span>
                  <span className="row-main" style={{ flex: 1 }}>
                    <span className="row-label">Correo electrónico</span>
                    <AnimatePresence mode="wait" initial={false}>
                      {emailEditing ? (
                        <motion.span
                          key="email-editing"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: dur.fast }}
                          style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}
                        >
                          <input
                            className="field"
                            type="email"
                            value={emailDraft}
                            autoFocus
                            maxLength={80}
                            placeholder="tu@correo.com"
                            aria-label="Correo electrónico"
                            onChange={(e) => { setEmailDraft(e.target.value); setEmailError('') }}
                            onKeyDown={handleEmailKey}
                            onBlur={commitEmail}
                            style={{ fontSize: 13, width: '100%' }}
                          />
                          {emailError && (
                            <span className="sm" style={{ color: 'var(--error)' }}>{emailError}</span>
                          )}
                        </motion.span>
                      ) : (
                        <motion.span
                          key="email-display"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: dur.fast }}
                          style={{ display: 'block', marginTop: 2 }}
                        >
                          <span className="row-sub">
                            {profile.email ?? <span style={{ color: 'var(--ink-300)', fontStyle: 'italic' }}>Sin correo</span>}
                          </span>
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </span>
                  {!emailEditing && (
                    <button
                      aria-label="Editar correo"
                      className="row-end"
                      onClick={() => { setEmailDraft(profile.email ?? ''); setEmailEditing(true) }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
                    >
                      <IcPencil size={16} />
                    </button>
                  )}
                </div>
              </div>
            </section>

            {/* ── Sección: Privacidad y datos (N=391/447) ──────────────────── */}
            <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div className="body" style={{ color: 'var(--ink-700)', fontWeight: 600, paddingLeft: 4 }}>
                Privacidad y datos
              </div>
              <div className="rowlist">
                {/* Estado de consentimiento — badge Nuevo si necesita re-aceptar */}
                <button className="row" onClick={() => dispatch({ t: 'sheet', sheet: 'arco' })}>
                  <span className="row-ic">
                    <IcShield size={18} style={{ color: 'var(--brand-700)' }} />
                  </span>
                  <span className="row-main">
                    <span className="row-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      Estado de consentimiento
                      {needsReConsent && (
                        <span style={{ fontSize: 10, fontWeight: 700, color: '#fff', background: 'var(--warning)', borderRadius: 6, padding: '2px 6px' }}>
                          ¡Nuevo!
                        </span>
                      )}
                    </span>
                    <span className="row-sub mono">{consentLabel}</span>
                  </span>
                  <span className="row-end">
                    <IcChevron size={16} style={{ color: 'var(--ink-400)' }} />
                  </span>
                </button>

                {/* Acciones primarias: Descargar (Acceso) + Eliminar (Cancelación). El resto, bajo 'Gestionar' para reducir densidad. */}
                {/* Acceso — JSON completo */}
                <button className="row" aria-label="Descargar mis datos en JSON (Acceso)" onClick={exportJSON}>
                  <span className="row-ic" style={{ color: 'var(--brand-700)' }}>
                    <IcDownload size={18} />
                  </span>
                  <span className="row-main">
                    <span className="row-label">Descargar mis datos</span>
                    <span className="row-sub">JSON completo · respaldo local (Acceso)</span>
                  </span>
                  <span className="row-end">
                    <IcChevron size={16} style={{ color: 'var(--ink-400)' }} />
                  </span>
                </button>

                {/* Eliminar datos (Cancelación) */}
                <button className="row" aria-label="Eliminar todos mis datos (Cancelación)" onClick={() => dispatch({ t: 'sheet', sheet: 'arco' })}>
                  <span className="row-ic" style={{ color: 'var(--error)' }}>
                    <IcTrash size={18} />
                  </span>
                  <span className="row-main">
                    <span className="row-label" style={{ color: 'var(--error)' }}>Eliminar mis datos</span>
                    <span className="row-sub">Borrar todo de este dispositivo (Cancelación)</span>
                  </span>
                  <span className="row-end">
                    <IcChevron size={16} style={{ color: 'var(--ink-400)' }} />
                  </span>
                </button>

                {/* Disclosure: resto de gestiones ARCO + aviso, colapsados por defecto */}
                <button
                  className="row"
                  aria-label="Gestionar mis datos y consentimiento (ARCO)"
                  aria-expanded={showMoreArco}
                  onClick={() => setShowMoreArco((v) => !v)}
                >
                  <span className="row-ic" style={{ color: 'var(--brand-700)' }}>
                    <IcShield size={18} />
                  </span>
                  <span className="row-main">
                    <span className="row-label">Gestionar mis datos (ARCO)</span>
                    <span className="row-sub">Rectificación, oposición, exportar para médico, aviso</span>
                  </span>
                  <span className="row-end">
                    <IcChevron size={16} style={{ color: 'var(--ink-400)', transform: showMoreArco ? 'rotate(90deg)' : 'none', transition: 'transform 0.18s' }} />
                  </span>
                </button>

                <AnimatePresence initial={false}>
                  {showMoreArco && (
                    <motion.div
                      key="arco-more"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      style={{ overflow: 'hidden' }}
                    >
                      {/* Acceso — CSV 90 días para médico */}
                      <button className="row" aria-label="Exportar CSV para médico" onClick={exportCSV}>
                        <span className="row-ic" style={{ color: 'var(--brand-700)' }}>
                          <IcDownload size={18} />
                        </span>
                        <span className="row-main">
                          <span className="row-label">Exportar para médico (CSV)</span>
                          <span className="row-sub">Dosis y medidas · últimos 90 días</span>
                        </span>
                        <span className="row-end">
                          <IcChevron size={16} style={{ color: 'var(--ink-400)' }} />
                        </span>
                      </button>

                      {/* Corregir mis datos (Rectificación) */}
                      <button className="row" aria-label="Corregir mis datos (Rectificación)" onClick={() => dispatch({ t: 'sheet', sheet: 'arco' })}>
                        <span className="row-ic" style={{ color: 'var(--brand-700)' }}>
                          <IcPencil size={18} />
                        </span>
                        <span className="row-main">
                          <span className="row-label">Corregir mis datos</span>
                          <span className="row-sub">Rectificación</span>
                        </span>
                        <span className="row-end">
                          <IcChevron size={16} style={{ color: 'var(--ink-400)' }} />
                        </span>
                      </button>

                      {/* Gestionar consentimiento (Oposición) */}
                      <button className="row" aria-label="Gestionar consentimiento (Oposición / Cancelación)" onClick={() => dispatch({ t: 'sheet', sheet: 'arco' })}>
                        <span className="row-ic" style={{ color: 'var(--brand-700)' }}>
                          <IcShieldOff size={18} />
                        </span>
                        <span className="row-main">
                          <span className="row-label">Gestionar consentimiento</span>
                          <span className="row-sub">Oposición / Cancelación</span>
                        </span>
                        <span className="row-end">
                          <IcChevron size={16} style={{ color: 'var(--ink-400)' }} />
                        </span>
                      </button>

                      {/* Aviso de privacidad */}
                      <button className="row" aria-label="Aviso de privacidad" onClick={() => dispatch({ t: 'toast', msg: 'Aviso de privacidad — próximamente' })}>
                        <span className="row-ic" style={{ color: 'var(--brand-700)' }}>
                          <IcDocument size={18} />
                        </span>
                        <span className="row-main">
                          <span className="row-label">Aviso de privacidad</span>
                        </span>
                        <span className="row-end">
                          <IcChevron size={16} style={{ color: 'var(--ink-400)' }} />
                        </span>
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </section>

            {/* ── Resumen privacidad datos locales (N=497) ──────────────────── */}
            <section>
              <div className="card" style={{ padding: '14px 16px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <IcShield size={18} style={{ color: 'var(--brand-700)', flexShrink: 0, marginTop: 2 }} />
                <div>
                  <p className="sm" style={{ fontWeight: 600, margin: '0 0 2px' }}>Almacenamiento local</p>
                  <p className="sm" style={{ color: 'var(--ink-400)', margin: 0, lineHeight: 1.5 }}>
                    Todos tus datos viven en tu dispositivo (localStorage). Nunca se envían a servidores externos. Puedes exportarlos o eliminarlos en Ajustes → Respaldo.
                  </p>
                </div>
              </div>
            </section>

            {/* ── Sección: Cuenta ──────────────────────────────────────────── */}
            <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div className="body" style={{ color: 'var(--ink-700)', fontWeight: 600, paddingLeft: 4 }}>
                Cuenta
              </div>
              <div className="rowlist">
                {/* Información personal → medidas */}
                <button className="row" aria-label="Información personal" onClick={() => dispatch({ t: 'sheet', sheet: 'medidas' })}>
                  <span className="row-ic" style={{ color: 'var(--brand-700)' }}>
                    <IcPerson size={18} />
                  </span>
                  <span className="row-main">
                    <span className="row-label">Información personal</span>
                  </span>
                  <span className="row-end">
                    <IcChevron size={16} style={{ color: 'var(--ink-400)' }} />
                  </span>
                </button>

                {/* Seguridad */}
                <button className="row" aria-label="Seguridad y contraseña" onClick={() => dispatch({ t: 'toast', msg: 'Seguridad y contraseña — próximamente' })}>
                  <span className="row-ic" style={{ color: 'var(--brand-700)' }}>
                    <IcLock size={18} />
                  </span>
                  <span className="row-main">
                    <span className="row-label">Seguridad y contraseña</span>
                  </span>
                  <span className="row-end">
                    <IcChevron size={16} style={{ color: 'var(--ink-400)' }} />
                  </span>
                </button>

                {/* Cerrar sesión (N=384) — sin confirmación aquí, solo navega */}
                <button className="row" aria-label="Cerrar sesión" onClick={() => dispatch({ t: 'go', screen: 's-login' })}>
                  <span className="row-ic">
                    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="var(--brand-700)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                      <polyline points="16 17 21 12 16 7" />
                      <line x1="21" y1="12" x2="9" y2="12" />
                    </svg>
                  </span>
                  <span className="row-main">
                    <span className="row-label">Cerrar sesión</span>
                    <span className="row-sub" style={{ color: 'var(--ink-300)', fontStyle: 'italic' }}>Tus datos se conservan</span>
                  </span>
                  <span className="row-end">
                    <IcChevron size={16} style={{ color: 'var(--ink-400)' }} />
                  </span>
                </button>
              </div>
            </section>

            {/* Footer: badge LFPDPPP + borrar cuenta */}
            <section
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, paddingBottom: 32 }}
            >
              <TrustBadge />

              <button
                className="row danger"
                style={{ width: '100%', borderRadius: 12 }}
                onClick={() => dispatch({ t: 'sheet', sheet: 'confirm-delete', arg: '__account' })}
              >
                <span className="row-main">
                  <span className="row-label">Borrar mi cuenta</span>
                </span>
              </button>
            </section>
          </div>
        </div>
      </motion.div>

      {/* Re-consent sheet (N=446) */}
      <AnimatePresence>
        {showReConsent && (
          <ReConsentSheet
            key="reconsent"
            onAccept={() => {
              dispatch({ t: 'setSetting', key: 'consentVersion', value: CURRENT_CONSENT_VERSION })
              dispatch({ t: 'setSetting', key: 'consentActive', value: true })
              setShowReConsent(false)
            }}
            onClose={() => setShowReConsent(false)}
          />
        )}
      </AnimatePresence>
    </>
  )
}
