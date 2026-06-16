// Hacktrack — Ajustes. Quiet Signal: whitespace generoso, un héroe por sección, jerarquía por escala tipográfica.
import { useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { IcBell, IcChevron, IcShield, IcCheck, IcBack } from '../components/icons'
import { Glyph } from '../components/glyphs'
import { Toggle, Disclaimer } from '../components/controls'
import { useApp } from '../lib/store'
import { requestNotif, notifPermission, notifSupported } from '../lib/notifications'
import { dur, ease, spring } from '../lib/motion'

// ── micro animaciones ──────────────────────────────────────────────────────────
const fadeSlide = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  exit:    { opacity: 0, y: -4 },
  transition: { duration: dur.fast, ease: ease.decelerate },
}

// ── etiqueta legible del permiso de notificaciones ────────────────────────────
function permLabel(p: ReturnType<typeof notifPermission>): string {
  if (p === 'granted')     return 'Activadas'
  if (p === 'denied')      return 'Bloqueadas en el navegador'
  if (p === 'unsupported') return 'No compatibles'
  return 'Sin permiso'
}

// ── sección con título de label ───────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="sm"
      style={{
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        color: 'var(--ink-400)',
        marginBottom: 8,
        paddingLeft: 4,
      }}
    >
      {children}
    </p>
  )
}

// ── fila de icono SVG inline (para los casos sin Glyph) ──────────────────────
function RowIcon({ children }: { children: React.ReactNode }) {
  return <span className="row-ic">{children}</span>
}

export function Ajustes() {
  const { state, dispatch } = useApp()
  const { settings, profile, protocol } = state

  // ── estado local ──────────────────────────────────────────────────────────
  const [nameEditing, setNameEditing] = useState(false)
  const [nameDraft, setNameDraft]     = useState(profile.name ?? '')
  const nameInputRef                  = useRef<HTMLInputElement>(null)

  // permiso en tiempo de render (no se re-pide aquí, solo se lee)
  const perm = notifPermission()

  // ── handlers ──────────────────────────────────────────────────────────────
  function commitName() {
    const trimmed = nameDraft.trim()
    dispatch({ t: 'setName', name: trimmed })
    setNameEditing(false)
  }

  function handleNameKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter')  { e.preventDefault(); commitName() }
    if (e.key === 'Escape') { setNameEditing(false); setNameDraft(profile.name ?? '') }
  }

  async function handleRemindersToggle(next: boolean) {
    if (!next) {
      dispatch({ t: 'setSetting', key: 'remindersEnabled', value: false })
      return
    }
    if (!notifSupported()) {
      dispatch({ t: 'toast', msg: 'Tu navegador no admite notificaciones.' })
      return
    }
    const result = await requestNotif()
    if (result === 'granted') {
      dispatch({ t: 'setSetting', key: 'remindersEnabled', value: true })
    } else {
      dispatch({ t: 'toast', msg: 'Activa las notificaciones en tu navegador para usar recordatorios.' })
      // deja el toggle off (no despachamos remindersEnabled=true)
    }
  }

  function handleTimeChange(e: React.ChangeEvent<HTMLInputElement>) {
    dispatch({ t: 'setReminderTime', time: e.target.value })
  }

  const reminderTime = protocol?.reminderTime ?? '08:00'
  const hasProtocol  = protocol != null

  const close = () => dispatch({ t: 'sheet', sheet: null })

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={spring.sheet}
      style={{ position: 'absolute', inset: 0, background: 'var(--bg)', zIndex: 50 }}
    >
    <div className="scroll">

      {/* ── Cabecera ─────────────────────────────────────────────────────────── */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 40,
          background: 'var(--bg)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '16px 20px 12px',
        }}
      >
        <button className="iconbtn" onClick={close} aria-label="Volver"><IcBack size={22} /></button>
        <h1 className="h1" style={{ margin: 0, flex: 1 }}>Ajustes</h1>
      </header>

      <main
        style={{
          padding: '0 20px 32px',
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
          maxWidth: 800,
          margin: '0 auto',
        }}
      >

        {/* ── PERFIL ─────────────────────────────────────────────────────────── */}
        <section>
          <SectionLabel>Perfil</SectionLabel>
          <div className="rowlist card">
            {/* Nombre */}
            <div className="row" style={{ alignItems: 'flex-start', minHeight: 56 }}>
              <RowIcon>
                {/* icono persona outline */}
                <svg
                  width={20} height={20} viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
                  style={{ color: 'var(--brand-700)' }}
                >
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
                </svg>
              </RowIcon>

              <span className="row-main" style={{ flex: 1 }}>
                <span className="row-label">Nombre</span>

                <AnimatePresence mode="wait" initial={false}>
                  {nameEditing ? (
                    <motion.span
                      key="editing"
                      {...fadeSlide}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}
                    >
                      <input
                        ref={nameInputRef}
                        className="field"
                        type="text"
                        value={nameDraft}
                        autoFocus
                        maxLength={48}
                        placeholder="Tu nombre"
                        aria-label="Nombre"
                        onChange={(e) => setNameDraft(e.target.value)}
                        onKeyDown={handleNameKey}
                        onBlur={commitName}
                        style={{ flex: 1, fontSize: '13px' }}
                      />
                      <button
                        aria-label="Guardar nombre"
                        onClick={commitName}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          padding: 4,
                          color: 'var(--brand-700)',
                        }}
                      >
                        <IcCheck size={18} />
                      </button>
                    </motion.span>
                  ) : (
                    <motion.span
                      key="display"
                      {...fadeSlide}
                      style={{ display: 'block', marginTop: 2 }}
                    >
                      <span className="row-sub">
                        {profile.name ? profile.name : (
                          <span style={{ color: 'var(--ink-300)', fontStyle: 'italic' }}>Sin nombre</span>
                        )}
                      </span>
                    </motion.span>
                  )}
                </AnimatePresence>
              </span>

              {!nameEditing && (
                <button
                  className="row-end"
                  aria-label="Editar nombre"
                  onClick={() => {
                    setNameDraft(profile.name ?? '')
                    setNameEditing(true)
                    // el autoFocus del input se encarga del foco
                  }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
                >
                  <IcChevron size={18} style={{ color: 'var(--ink-300)' }} />
                </button>
              )}
            </div>
          </div>
        </section>

        {/* ── RECORDATORIOS ──────────────────────────────────────────────────── */}
        <section>
          <SectionLabel>Recordatorios</SectionLabel>
          <div className="rowlist card">

            {/* Fila 1: Toggle de activación */}
            <div className="row">
              <RowIcon>
                <IcBell size={20} style={{ color: 'var(--brand-700)' }} />
              </RowIcon>
              <span className="row-main">
                <span className="row-label">Recordatorio de registro</span>
                <span className="row-sub" style={{ color: perm === 'denied' ? 'var(--danger, #e55)' : undefined }}>
                  {perm === 'granted' && settings.remindersEnabled
                    ? 'Es hora de tu registro de hoy'
                    : permLabel(perm)}
                </span>
              </span>
              <span className="row-end">
                <Toggle
                  on={settings.remindersEnabled && perm === 'granted'}
                  onChange={handleRemindersToggle}
                  label="Activar recordatorio de registro"
                />
              </span>
            </div>

            {/* Fila 2: Selector de hora */}
            <div className="row" style={{ alignItems: 'flex-start', minHeight: 56 }}>
              <RowIcon>
                {/* icono reloj outline */}
                <svg
                  width={20} height={20} viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
                  style={{ color: hasProtocol ? 'var(--brand-700)' : 'var(--ink-300)' }}
                >
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v5l3 3" />
                </svg>
              </RowIcon>
              <span className="row-main" style={{ flex: 1 }}>
                <span className="row-label" style={{ color: hasProtocol ? undefined : 'var(--ink-300)' }}>
                  Hora del recordatorio
                </span>
                {hasProtocol ? (
                  <span className="row-sub" style={{ color: 'var(--ink-400)' }}>
                    Aplica a todas tus tomas
                  </span>
                ) : (
                  <span className="row-sub" style={{ color: 'var(--ink-300)', fontStyle: 'italic' }}>
                    Configura un protocolo primero
                  </span>
                )}
              </span>
              <span className="row-end">
                <input
                  type="time"
                  className="field"
                  value={reminderTime}
                  disabled={!hasProtocol}
                  aria-label="Hora del recordatorio"
                  onChange={handleTimeChange}
                  style={{
                    fontSize: '13px',
                    fontFamily: 'var(--font-mono, monospace)',
                    width: 96,
                    textAlign: 'center',
                    opacity: hasProtocol ? 1 : 0.4,
                    cursor: hasProtocol ? 'auto' : 'not-allowed',
                  }}
                />
              </span>
            </div>

            {/* Plus (premium) — desbloquea Alimentación + Resumen avanzados */}
            <div className="row">
              <RowIcon>
                <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--brand-700)' }}>
                  <rect x="4" y="11" width="16" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" />
                </svg>
              </RowIcon>
              <span className="row-main">
                <span className="row-label">Plus</span>
                <span className="row-sub">{settings.premium ? 'Activo' : 'Desbloquea perspectivas avanzadas'}</span>
              </span>
              <span className="row-end">
                <Toggle
                  on={settings.premium}
                  onChange={(v) => dispatch({ t: 'setSetting', key: 'premium', value: v })}
                  label="Activar Plus"
                />
              </span>
            </div>

            {/* Fila 3: Resumen semanal */}
            <div className="row">
              <RowIcon>
                <svg
                  width={20} height={20} viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
                  style={{ color: 'var(--brand-700)' }}
                >
                  <path d="M3 18l4-8 4 6 3-4 4 6" /><path d="M21 21H3" />
                </svg>
              </RowIcon>
              <span className="row-main">
                <span className="row-label">Resumen semanal</span>
              </span>
              <span className="row-end">
                <Toggle
                  on={settings.weeklySummary}
                  onChange={(v) => dispatch({ t: 'setSetting', key: 'weeklySummary', value: v })}
                  label="Activar resumen semanal"
                />
              </span>
            </div>

            {/* Fila 4: Avisos por correo */}
            <div className="row">
              <RowIcon>
                <svg
                  width={20} height={20} viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
                  style={{ color: 'var(--brand-700)' }}
                >
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <path d="m2 7 10 7 10-7" />
                </svg>
              </RowIcon>
              <span className="row-main">
                <span className="row-label">Avisos por correo</span>
              </span>
              <span className="row-end">
                <Toggle
                  on={settings.emailNotices}
                  onChange={(v) => dispatch({ t: 'setSetting', key: 'emailNotices', value: v })}
                  label="Activar avisos por correo"
                />
              </span>
            </div>

          </div>
        </section>

        {/* ── APARIENCIA ─────────────────────────────────────────────────────── */}
        <section>
          <SectionLabel>Apariencia</SectionLabel>
          <div className="rowlist card">

            {/* Tema oscuro */}
            <div className="row">
              <RowIcon>
                <svg
                  width={20} height={20} viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
                  style={{ color: 'var(--brand-700)' }}
                >
                  <path d="M12 3a9 9 0 1 0 9 9 7 7 0 0 1-9-9Z" />
                </svg>
              </RowIcon>
              <span className="row-main">
                <span className="row-label">Tema oscuro</span>
              </span>
              <span className="row-end">
                <Toggle
                  on={settings.darkMode}
                  onChange={(v) => dispatch({ t: 'setSetting', key: 'darkMode', value: v })}
                  label="Activar tema oscuro"
                />
              </span>
            </div>

            {/* Unidades */}
            <button
              className="row"
              style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer' }}
              aria-label="Configurar unidades"
              onClick={() => dispatch({ t: 'toast', msg: 'Configuración de unidades próximamente' })}
            >
              <RowIcon>
                <svg
                  width={20} height={20} viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
                  style={{ color: 'var(--brand-700)' }}
                >
                  <path d="M21 6H3M3 12h12M3 18h6" />
                </svg>
              </RowIcon>
              <span className="row-main">
                <span className="row-label">Unidades</span>
              </span>
              <span className="row-end">
                <IcChevron size={18} style={{ color: 'var(--ink-300)' }} />
              </span>
            </button>

          </div>
        </section>

        {/* ── CUENTA ─────────────────────────────────────────────────────────── */}
        <section>
          <SectionLabel>Cuenta</SectionLabel>
          <div className="rowlist card">

            {/* Importar de BiohackMX */}
            <button
              className="row"
              style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer' }}
              aria-label="Importar de BiohackMX"
              onClick={() => dispatch({ t: 'go', screen: 's-import' })}
            >
              <RowIcon>
                <svg
                  width={20} height={20} viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
                  style={{ color: 'var(--brand-700)' }}
                >
                  <path d="M21 12a9 9 0 0 1-9 9m9-9a9 9 0 0 0-9-9m9 9H3m9 9a9 9 0 0 1-9-9m9 9c1.66 0 3-4.03 3-9s-1.34-9-3-9m0 18c-1.66 0-3-4.03 3-9s1.34-9 3-9M3 12a9 9 0 0 1 9-9" />
                </svg>
              </RowIcon>
              <span className="row-main">
                <span className="row-label">Importar de BiohackMX</span>
              </span>
              <span className="row-end">
                <IcChevron size={18} style={{ color: 'var(--ink-300)' }} />
              </span>
            </button>

            {/* Perfil y privacidad */}
            <button
              className="row"
              style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer' }}
              aria-label="Perfil y privacidad"
              onClick={() => dispatch({ t: 'sheet', sheet: 'perfil' })}
            >
              <RowIcon>
                <IcShield size={20} style={{ color: 'var(--brand-700)' }} />
              </RowIcon>
              <span className="row-main">
                <span className="row-label">Perfil y privacidad</span>
              </span>
              <span className="row-end">
                <IcChevron size={18} style={{ color: 'var(--ink-300)' }} />
              </span>
            </button>

            {/* PIN de acceso */}
            <div className="row">
              <RowIcon>
                <svg
                  width={20} height={20} viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
                  style={{ color: 'var(--brand-700)' }}
                >
                  <rect x="5" y="11" width="14" height="10" rx="2" />
                  <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                </svg>
              </RowIcon>
              <span className="row-main">
                <span className="row-label">PIN de acceso</span>
              </span>
              <span className="row-end">
                <Toggle
                  on={settings.pinEnabled}
                  onChange={(v) => dispatch({ t: 'setSetting', key: 'pinEnabled', value: v })}
                  label="Activar PIN de acceso"
                />
              </span>
            </div>

            {/* Cerrar sesión — vuelve a Iniciar sesión (conserva tus datos) */}
            <button
              className="row danger"
              style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer' }}
              aria-label="Cerrar sesión"
              onClick={() => dispatch({ t: 'go', screen: 's-login' })}
            >
              <RowIcon>
                <svg
                  width={20} height={20} viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
                >
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </RowIcon>
              <span className="row-main">
                <span className="row-label">Cerrar sesión</span>
              </span>
            </button>

          </div>
        </section>

        {/* Disclaimer — audit guardrail: no reducir instancias */}
        <Disclaimer kind="general" />

        {/* Banner decorativo */}
        <div
          style={{
            borderRadius: 20,
            overflow: 'hidden',
            background: 'linear-gradient(135deg, var(--brand-700) 0%, #063B36 100%)',
            padding: '28px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
          aria-hidden
        >
          <p className="body" style={{ color: '#ffffff', fontWeight: 600, margin: 0 }}>Tu progreso es constante.</p>
          <p className="sm" style={{ color: 'var(--brand-100, #acefe4)', margin: 0 }}>
            Continúa optimizando tu rutina día con día.
          </p>
        </div>

      </main>
    </div>
    </motion.div>
  )
}
