// Hacktrack v2 — Ajustes. Precision × Accessible.
// R48: PIN de acceso, segundo recordatorio, avisos por correo, alias de productos.
// R50: cerrar sesión (go 's-login').
import { useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import {
  Bell, Clock, Moon, Sun, Ruler, ChevronRight, User, ShieldCheck,
  Lock, Mail, Tag, LogOut, ListChecks, Download, Contrast, LayoutGrid, Calculator,
} from 'lucide-react'
import { Sheet } from '../ui/Sheet'
import { Button } from '../ui/Button'
import { SegmentedTabs } from '../ui/SegmentedTabs'
import { useApp } from '../../lib/store'
import { requestNotif, notifPermission, notifSupported } from '../../lib/notifications'
import type { ThemeMode, UnitSystem } from '../../lib/types'

// ── constante de versión de consentimiento (misma que la v1 original) ──────────
export const CURRENT_CONSENT_VERSION = 'v1.0'

// ── helper: etiqueta legible del permiso de notificaciones ────────────────────
function permLabel(p: ReturnType<typeof notifPermission>): string {
  if (p === 'granted') return 'Activadas'
  if (p === 'denied') return 'Bloqueadas en el sistema'
  if (p === 'unsupported') return 'No compatibles con este navegador'
  return 'Sin permiso'
}

// ── fila genérica: tap target ≥44px garantizado ──────────────────────────────
function Row({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex min-h-[44px] items-center gap-3 px-1 ${className}`}>
      {children}
    </div>
  )
}

// ── label de sección ──────────────────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-1 pb-1.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
      {children}
    </p>
  )
}

// ── card contenedor de filas ──────────────────────────────────────────────────
function RowCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col divide-y divide-white/6 rounded-xl bg-raised">
      {children}
    </div>
  )
}

// ── switch accesible (aria-checked + role=switch + tap ≥44px) ────────────────
function Switch({
  checked,
  onChange,
  label,
  disabled = false,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={[
        'relative h-[28px] w-[48px] shrink-0 rounded-full transition-colors duration-200',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        checked ? 'bg-teal' : 'bg-white/15',
      ].join(' ')}
    >
      <span
        className={[
          'absolute top-[3px] left-[3px] h-[22px] w-[22px] rounded-full bg-white shadow transition-transform duration-200',
          checked ? 'translate-x-[20px]' : 'translate-x-0',
        ].join(' ')}
      />
    </button>
  )
}

// ── chevron decorativo ────────────────────────────────────────────────────────
function Chevron() {
  return <ChevronRight size={16} className="shrink-0 text-muted-foreground" />
}

// ── sub-Sheet de confirmación de borrado de datos ─────────────────────────────
function DeleteConfirmDialog({
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
            className="absolute inset-0 bg-black/60"
            style={{ backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCancel}
          />
          <motion.div
            role="alertdialog"
            aria-label="Confirmar borrado de cuenta"
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
            <h3 className="mb-1 text-[18px] font-bold text-foreground">¿Borrar todos mis datos?</h3>
            <p className="mb-5 text-[13px] leading-relaxed text-muted-foreground">
              Esta acción eliminará permanentemente tu historial, protocolos y configuración de este
              dispositivo. No se puede deshacer.
            </p>
            <div className="flex flex-col gap-2">
              <Button
                variant="primary"
                size="full"
                className="bg-alert text-white shadow-none"
                onClick={onConfirm}
              >
                Sí, borrar todo
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

// ── sub-sheet de confirmación de cierre de sesión (R50) ─────────────────────
function LogoutConfirmDialog({
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
            className="absolute inset-0 bg-black/60"
            style={{ backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCancel}
          />
          <motion.div
            role="alertdialog"
            aria-label="Confirmar cierre de sesión"
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
    </AnimatePresence>
  )
}

// ── sub-sheet de alias de productos (R48) ────────────────────────────────────
function AliasSheet({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const { state, dispatch } = useApp()
  const products = state.importedProducts ?? []
  const aliases = state.productAliases ?? {}
  const [drafts, setDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(products.map((p) => [p, aliases[p] ?? '']))
  )

  function save(product: string) {
    const alias = (drafts[product] ?? '').trim()
    dispatch({ t: 'setProductAlias', product, alias: alias || null })
  }

  function saveAll() {
    products.forEach(save)
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose} title="Nombres privados">
      <div className="flex flex-col gap-4 pb-2">
        <p className="text-[13px] text-muted-foreground">
          Asigna un alias personalizado a cada producto. Solo tú lo verás en la app.
        </p>

        {products.length === 0 ? (
          <p className="italic text-[13px] text-muted-foreground">
            Sin productos en protocolo.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {products.map((product) => (
              <div key={product} className="flex flex-col gap-1">
                <label
                  htmlFor={`alias-${product}`}
                  className="text-[12px] font-semibold text-muted-foreground"
                >
                  {product}
                </label>
                <input
                  id={`alias-${product}`}
                  type="text"
                  value={drafts[product] ?? ''}
                  placeholder="Alias privado (p.ej. Tratamiento A)"
                  maxLength={32}
                  onChange={(e) =>
                    setDrafts((d) => ({ ...d, [product]: e.target.value }))
                  }
                  onBlur={() => save(product)}
                  className={[
                    'h-[44px] w-full rounded-xl border border-white/10 bg-raised px-3',
                    'text-[14px] text-foreground placeholder:text-muted-foreground',
                    'focus:outline-none focus-visible:ring-1 focus-visible:ring-teal',
                  ].join(' ')}
                />
              </div>
            ))}
          </div>
        )}

        {products.length > 0 && (
          <Button variant="primary" size="full" onClick={saveAll}>
            Guardar aliases
          </Button>
        )}
      </div>
    </Sheet>
  )
}

// ── componente principal ──────────────────────────────────────────────────────
export function Ajustes({
  open,
  onClose,
  onOpenPerfil,
}: {
  open: boolean
  onClose: () => void
  onOpenPerfil?: () => void
}) {
  const { state, dispatch } = useApp()
  const { settings, profile, protocol } = state

  // ── estado local ──────────────────────────────────────────────────────────
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [showAdvancedReminders, setShowAdvancedReminders] = useState(false)
  const [showAliasSheet, setShowAliasSheet] = useState(false)
  const fileImportRef = useRef<HTMLInputElement>(null)
  const reduce = useReducedMotion()

  // permiso de notificaciones (lectura en tiempo de render)
  const perm = notifPermission()

  // tema actual
  const currentTheme: ThemeMode = settings.themeMode ?? (settings.darkMode ? 'dark' : 'auto')

  // unidades
  const currentUnit: UnitSystem = settings.unitSystem ?? 'metric'

  // hora de recordatorio
  const reminderTime = protocol?.reminderTime ?? '08:00'
  const hasProtocol = protocol != null

  // segundo recordatorio
  const cadenceMode = protocol?.cadence?.mode
  const supportsSecondReminder = cadenceMode === 'cadaN' || cadenceMode === 'ciclo'
  const secondReminderMin: number | null = (settings.secondReminderMin ?? null) as number | null

  // ── handlers ──────────────────────────────────────────────────────────────
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
      dispatch({ t: 'toast', msg: 'Activa las notificaciones en ajustes del sistema.' })
    }
  }

  function handleTimeChange(e: React.ChangeEvent<HTMLInputElement>) {
    dispatch({ t: 'setReminderTime', time: e.target.value })
  }

  function handleDeleteAccount() {
    dispatch({ t: 'arcoDelete' })
    setShowDeleteConfirm(false)
    onClose()
  }

  function handleLogout() {
    dispatch({ t: 'go', screen: 's-login' })
    setShowLogoutConfirm(false)
    onClose()
  }

  // importar JSON backup
  const handleImportFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = (ev) => {
        try {
          const parsed = JSON.parse(ev.target?.result as string)
          const importedState = parsed.state ?? parsed
          // #46: validar estructura mínima razonable — debe tener log (array) + settings +
          // al menos protocols o products para ser un respaldo Hacktrack válido.
          const hasLog = Array.isArray(importedState.log)
          const hasSettings = typeof importedState.settings === 'object' && importedState.settings !== null
          const hasProtocols =
            (typeof importedState.protocols === 'object' && importedState.protocols !== null) ||
            Array.isArray(importedState.importedProducts)
          if (!hasLog || !hasSettings || !hasProtocols) {
            dispatch({ t: 'toast', msg: 'Archivo de respaldo inválido' })
            return
          }
          // #46: pedir confirmación antes de sobreescribir todos los datos
          const ok = window.confirm(
            'Esto reemplazará TODOS tus datos actuales. No se puede deshacer.',
          )
          if (!ok) return
          dispatch({ t: 'replaceState', state: importedState })
        } catch {
          dispatch({ t: 'toast', msg: 'Error al leer el archivo — verifica que sea un respaldo válido.' })
        }
      }
      reader.readAsText(file)
      e.target.value = ''
    },
    [dispatch],
  )

  return (
    <>
      <Sheet open={open} onClose={onClose} title="Ajustes">
        <div className="flex flex-col gap-5 pb-2">

          {/* ── PERFIL ────────────────────────────────────────────────────── */}
          <section>
            <SectionLabel>Perfil</SectionLabel>
            <RowCard>
              <button
                type="button"
                onClick={onOpenPerfil}
                className="flex min-h-[44px] w-full items-center gap-3 px-4 py-2 text-left"
                aria-label="Ver perfil y privacidad"
              >
                <User size={18} className="shrink-0 text-teal" />
                <span className="flex flex-1 flex-col">
                  <span className="text-[15px] font-medium text-foreground">
                    {profile.name ?? 'Tu perfil'}
                  </span>
                  <span className="text-[12px] text-muted-foreground">
                    Perfil y privacidad
                  </span>
                </span>
                <Chevron />
              </button>
            </RowCard>
          </section>

          {/* ── PROTOCOLOS ────────────────────────────────────────────────── */}
          <section>
            <SectionLabel>Protocolos</SectionLabel>
            <RowCard>
              <button
                type="button"
                onClick={() => dispatch({ t: 'sheet', sheet: 'protocolos' })}
                className="flex min-h-[44px] w-full items-center gap-3 px-4 py-2.5 text-left"
                aria-label="Mis protocolos"
              >
                <ListChecks size={18} className="shrink-0 text-teal" />
                <span className="flex flex-1 flex-col">
                  <span className="text-[15px] font-medium text-foreground">Mis protocolos</span>
                  <span className="text-[12px] text-muted-foreground">Cadencia, días y dosis por producto</span>
                </span>
                <Chevron />
              </button>
              <div className="mx-4 h-px bg-white/[0.06]" />
              <button
                type="button"
                onClick={() => dispatch({ t: 'sheet', sheet: 'import' })}
                className="flex min-h-[44px] w-full items-center gap-3 px-4 py-2.5 text-left"
                aria-label="Importar protocolos"
              >
                <Download size={18} className="shrink-0 text-teal" />
                <span className="flex flex-1 flex-col">
                  <span className="text-[15px] font-medium text-foreground">Importar protocolos</span>
                  <span className="text-[12px] text-muted-foreground">Agrega productos a tu seguimiento</span>
                </span>
                <Chevron />
              </button>
              <div className="mx-4 h-px bg-white/[0.06]" />
              <button
                type="button"
                onClick={() => dispatch({ t: 'sheet', sheet: 'calc' })}
                className="flex min-h-[44px] w-full items-center gap-3 px-4 py-2.5 text-left"
                aria-label="Calculadora de reconstitución"
              >
                <Calculator size={18} className="shrink-0 text-teal" />
                <span className="flex flex-1 flex-col">
                  <span className="text-[15px] font-medium text-foreground">Calculadora de reconstitución</span>
                  <span className="text-[12px] text-muted-foreground">mg de vial + agua → unidades</span>
                </span>
                <Chevron />
              </button>
            </RowCard>
          </section>

          {/* ── APARIENCIA ────────────────────────────────────────────────── */}
          <section>
            <SectionLabel>Apariencia</SectionLabel>
            <RowCard>
              <Row className="px-4 py-3">
                <span className="flex flex-1 flex-col gap-2">
                  <span className="flex items-center gap-2">
                    {currentTheme === 'light' ? (
                      <Sun size={16} className="text-teal" />
                    ) : (
                      <Moon size={16} className="text-teal" />
                    )}
                    <span className="text-[14px] font-medium text-foreground">Modo de pantalla</span>
                  </span>
                  <SegmentedTabs<ThemeMode>
                    options={[
                      { value: 'auto', label: 'Auto' },
                      { value: 'dark', label: 'Oscuro' },
                      { value: 'light', label: 'Claro' },
                    ]}
                    value={currentTheme}
                    onChange={(mode) => dispatch({ t: 'setThemeMode', mode })}
                  />
                </span>
              </Row>
            </RowCard>
          </section>

          {/* ── ACCESIBILIDAD ─────────────────────────────────────────────── */}
          <section>
            <SectionLabel>Accesibilidad</SectionLabel>
            <RowCard>
              <Row className="px-4 py-3">
                <Contrast size={18} className={settings.highContrast ? 'shrink-0 text-teal' : 'shrink-0 text-muted-foreground'} />
                <span className="flex flex-1 flex-col">
                  <span className="text-[14px] font-medium text-foreground">Alto contraste</span>
                  <span className="text-[12px] text-muted-foreground">Texto más legible (no cambia el tamaño)</span>
                </span>
                <Switch
                  checked={!!settings.highContrast}
                  onChange={(v) => dispatch({ t: 'setSetting', key: 'highContrast', value: v })}
                  label="Activar alto contraste"
                />
              </Row>
              <div className="mx-4 h-px bg-white/[0.06]" />
              <Row className="px-4 py-3">
                <LayoutGrid size={18} className={settings.simpleMode ? 'shrink-0 text-teal' : 'shrink-0 text-muted-foreground'} />
                <span className="flex flex-1 flex-col">
                  <span className="text-[14px] font-medium text-foreground">Modo simple</span>
                  <span className="text-[12px] text-muted-foreground">Solo Inicio, Diario y Progreso</span>
                </span>
                <Switch
                  checked={!!settings.simpleMode}
                  onChange={(v) => dispatch({ t: 'setSetting', key: 'simpleMode', value: v })}
                  label="Activar modo simple"
                />
              </Row>
            </RowCard>
          </section>

          {/* ── UNIDADES ──────────────────────────────────────────────────── */}
          <section>
            <SectionLabel>Unidades</SectionLabel>
            <RowCard>
              <Row className="px-4 py-3">
                <Ruler size={18} className="shrink-0 text-teal" />
                <span className="flex flex-1 flex-col gap-2">
                  <span className="text-[14px] font-medium text-foreground">Peso y medidas</span>
                  <SegmentedTabs<UnitSystem>
                    options={[
                      { value: 'metric', label: 'kg · cm' },
                      { value: 'imperial', label: 'lb · in' },
                    ]}
                    value={currentUnit}
                    onChange={(v) => dispatch({ t: 'setSetting', key: 'unitSystem', value: v })}
                  />
                </span>
              </Row>
            </RowCard>
            <p className="mt-1.5 px-1 text-[11px] text-muted-foreground">
              Los valores se convierten automáticamente. El almacenamiento siempre es métrico.
            </p>
          </section>

          {/* ── SEGURIDAD (R48) ───────────────────────────────────────────── */}
          <section>
            <SectionLabel>Seguridad</SectionLabel>
            <RowCard>
              {/* PIN de acceso */}
              <Row className="px-4">
                <Lock
                  size={18}
                  className={settings.pinEnabled ? 'shrink-0 text-teal' : 'shrink-0 text-muted-foreground'}
                />
                <span className="flex flex-1 flex-col">
                  <span className="text-[14px] font-medium text-foreground">PIN de acceso</span>
                  <span className="text-[12px] text-muted-foreground">
                    {settings.pinEnabled
                      ? 'Protegido — se solicita al abrir la app'
                      : 'Desactivado'}
                  </span>
                </span>
                <Switch
                  checked={!!settings.pinEnabled}
                  onChange={(v) => dispatch({ t: 'setSetting', key: 'pinEnabled', value: v })}
                  label="Activar PIN de acceso"
                />
              </Row>
            </RowCard>
            <p className="mt-1.5 px-1 text-[11px] text-muted-foreground">
              El PIN se almacena localmente y protege el acceso a la app.
            </p>
          </section>

          {/* ── RECORDATORIOS ────────────────────────────────────────────── */}
          <section>
            <SectionLabel>Recordatorios</SectionLabel>
            <RowCard>

              {/* Toggle principal */}
              <Row className="px-4">
                <Bell
                  size={18}
                  className={[
                    'shrink-0',
                    settings.remindersEnabled && perm === 'granted' ? 'text-teal' : 'text-muted-foreground',
                  ].join(' ')}
                />
                <span className="flex flex-1 flex-col">
                  <span className="text-[14px] font-medium text-foreground">
                    Recordatorio de registro
                  </span>
                  <span
                    className={[
                      'text-[12px]',
                      perm === 'denied' ? 'text-alert' : 'text-muted-foreground',
                    ].join(' ')}
                  >
                    {settings.remindersEnabled && perm === 'granted'
                      ? 'Es hora de tu registro de hoy'
                      : permLabel(perm)}
                  </span>
                </span>
                <Switch
                  checked={!!(settings.remindersEnabled && perm === 'granted')}
                  onChange={handleRemindersToggle}
                  label="Activar recordatorio de registro"
                />
              </Row>

              {/* Selector de hora */}
              <Row className="px-4">
                <Clock
                  size={18}
                  className={hasProtocol ? 'shrink-0 text-teal' : 'shrink-0 text-muted-foreground'}
                />
                <span className="flex flex-1 flex-col">
                  <span
                    className={[
                      'text-[14px] font-medium',
                      hasProtocol ? 'text-foreground' : 'text-muted-foreground',
                    ].join(' ')}
                  >
                    Hora del recordatorio
                  </span>
                  {!hasProtocol && (
                    <span className="text-[12px] italic text-muted-foreground">
                      Configura un protocolo primero
                    </span>
                  )}
                </span>
                <input
                  type="time"
                  value={reminderTime}
                  disabled={!hasProtocol}
                  aria-label="Hora del recordatorio"
                  onChange={handleTimeChange}
                  className={[
                    'h-[36px] rounded-md bg-card px-2 font-mono text-[13px] tabular-nums text-foreground',
                    'border border-white/10 focus:outline-none focus-visible:ring-1 focus-visible:ring-teal',
                    !hasProtocol ? 'cursor-not-allowed opacity-40' : '',
                  ].join(' ')}
                />
              </Row>

              {/* Resumen semanal */}
              <Row className="px-4">
                <span className="flex flex-1 flex-col">
                  <span className="text-[14px] font-medium text-foreground">Resumen semanal</span>
                  <span className="text-[12px] text-muted-foreground">
                    Notificación de adherencia los lunes
                  </span>
                </span>
                <Switch
                  checked={settings.weeklySummary}
                  onChange={(v) => dispatch({ t: 'setSetting', key: 'weeklySummary', value: v })}
                  label="Activar resumen semanal"
                />
              </Row>

              {/* Opciones avanzadas: segundo recordatorio + rescate (R48) */}
              {settings.remindersEnabled && (
                <>
                  <button
                    type="button"
                    aria-expanded={showAdvancedReminders}
                    aria-label="Opciones avanzadas de recordatorios"
                    onClick={() => setShowAdvancedReminders((v) => !v)}
                    className="flex min-h-[44px] w-full items-center gap-3 px-4 py-2 text-left"
                  >
                    <span className="flex flex-1 flex-col">
                      <span className="text-[14px] font-medium text-foreground">
                        Opciones avanzadas
                      </span>
                      <span className="text-[12px] text-muted-foreground">
                        Segundo recordatorio y aviso de rescate
                      </span>
                    </span>
                    <ChevronRight
                      size={16}
                      className={[
                        'shrink-0 text-muted-foreground transition-transform duration-200',
                        showAdvancedReminders ? 'rotate-90' : '',
                      ].join(' ')}
                    />
                  </button>

                  <AnimatePresence initial={false}>
                    {showAdvancedReminders && (
                      <motion.div
                        key="advanced"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={reduce ? { duration: 0.1 } : { duration: 0.22 }}
                        className="overflow-hidden"
                      >
                        {/* Segundo recordatorio (R48) — solo para ciclo/cadaN */}
                        {supportsSecondReminder && (
                          <div className="flex flex-col gap-2 px-4 pb-3 pt-1">
                            <span className="text-[12px] text-muted-foreground">
                              Segundo recordatorio — para reconstitución o seguimiento del ciclo
                            </span>
                            <div
                              role="group"
                              aria-label="Segundo recordatorio"
                              className="flex overflow-hidden rounded-lg border border-white/10"
                            >
                              {([
                                { key: null, label: 'Sin' },
                                { key: 30, label: '30m' },
                                { key: 60, label: '1h' },
                                { key: 120, label: '2h' },
                              ] as const).map(({ key, label }) => {
                                const active = secondReminderMin === key
                                return (
                                  <button
                                    key={String(key)}
                                    type="button"
                                    aria-pressed={active}
                                    aria-label={
                                      key === null
                                        ? 'Sin segundo recordatorio'
                                        : `Segundo recordatorio ${label} antes`
                                    }
                                    onClick={() =>
                                      dispatch({
                                        t: 'setSetting',
                                        key: 'secondReminderMin',
                                        value: key as unknown as string,
                                      })
                                    }
                                    className={[
                                      'flex-1 py-1.5 text-[12px] font-semibold font-mono tabular-nums transition-colors',
                                      active
                                        ? 'bg-teal text-primary-foreground'
                                        : 'bg-transparent text-muted-foreground hover:bg-white/5',
                                    ].join(' ')}
                                  >
                                    {label}
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        )}

                        {/* Aviso de rescate */}
                        <div className="flex flex-col gap-2 px-4 pb-3 pt-1">
                          <span className="text-[12px] text-muted-foreground">
                            Ventana de rescate — si no registras a tiempo
                          </span>
                          <div
                            role="group"
                            aria-label="Ventana de rescate"
                            className="flex overflow-hidden rounded-lg border border-white/10"
                          >
                            {([
                              { key: 0, label: 'Sin' },
                              { key: 15, label: '15m' },
                              { key: 30, label: '30m' },
                              { key: 60, label: '1h' },
                            ] as const).map(({ key, label }) => {
                              const active = ((settings.rescueWindowMin ?? 0) as number) === key
                              return (
                                <button
                                  key={key}
                                  type="button"
                                  aria-pressed={active}
                                  aria-label={
                                    key === 0
                                      ? 'Sin aviso de rescate'
                                      : `Aviso de rescate a los ${label}`
                                  }
                                  onClick={() =>
                                    dispatch({
                                      t: 'setRescueWindow',
                                      minutes: key as 0 | 15 | 30 | 60,
                                    })
                                  }
                                  className={[
                                    'flex-1 py-1.5 text-[12px] font-semibold font-mono tabular-nums transition-colors',
                                    active
                                      ? 'bg-teal text-primary-foreground'
                                      : 'bg-transparent text-muted-foreground hover:bg-white/5',
                                  ].join(' ')}
                                >
                                  {label}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </>
              )}
            </RowCard>
          </section>

          {/* ── AVISOS POR CORREO (R48) ───────────────────────────────────── */}
          <section>
            <SectionLabel>Comunicaciones</SectionLabel>
            <RowCard>
              <Row className="px-4">
                <Mail
                  size={18}
                  className={settings.emailNotices ? 'shrink-0 text-teal' : 'shrink-0 text-muted-foreground'}
                />
                <span className="flex flex-1 flex-col">
                  <span className="text-[14px] font-medium text-foreground">
                    Avisos por correo
                  </span>
                  <span className="text-[12px] text-muted-foreground">
                    {settings.emailNotices
                      ? 'Recibirás resúmenes y alertas al correo registrado'
                      : 'Desactivado — solo notificaciones en el dispositivo'}
                  </span>
                </span>
                <Switch
                  checked={!!settings.emailNotices}
                  onChange={(v) => dispatch({ t: 'setSetting', key: 'emailNotices', value: v })}
                  label="Activar avisos por correo"
                />
              </Row>
            </RowCard>
            {settings.emailNotices && !profile.email && (
              <p className="mt-1.5 px-1 text-[11px] text-alert">
                Configura un correo en tu perfil para recibir avisos.
              </p>
            )}
          </section>

          {/* ── PRIVACIDAD — alias de productos (R48) ─────────────────────── */}
          <section>
            <SectionLabel>Privacidad</SectionLabel>
            <RowCard>
              <button
                type="button"
                onClick={() => setShowAliasSheet(true)}
                className="flex min-h-[44px] w-full items-center gap-3 px-4 py-2 text-left"
                aria-label="Gestionar nombres privados de productos"
              >
                <Tag size={18} className="shrink-0 text-teal" />
                <span className="flex flex-1 flex-col">
                  <span className="text-[14px] font-medium text-foreground">
                    Nombres privados
                  </span>
                  <span className="text-[12px] text-muted-foreground">
                    Alias personalizados para cada producto
                  </span>
                </span>
                <Chevron />
              </button>
            </RowCard>
          </section>

          {/* ── CUENTA ────────────────────────────────────────────────────── */}
          <section>
            <SectionLabel>Cuenta</SectionLabel>
            <RowCard>
              {/* Respaldo — importar */}
              <button
                type="button"
                onClick={() => fileImportRef.current?.click()}
                className="flex min-h-[44px] w-full items-center gap-3 px-4 py-2 text-left"
                aria-label="Importar respaldo JSON"
              >
                <span className="flex flex-1 flex-col">
                  <span className="text-[14px] font-medium text-foreground">
                    Importar respaldo
                  </span>
                  <span className="text-[12px] text-muted-foreground">
                    Restaurar datos desde archivo JSON
                  </span>
                </span>
                <Chevron />
              </button>
              <input
                ref={fileImportRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                aria-hidden
                onChange={handleImportFile}
              />

              {/* Privacidad → abre Perfil */}
              <button
                type="button"
                onClick={onOpenPerfil}
                className="flex min-h-[44px] w-full items-center gap-3 px-4 py-2 text-left"
                aria-label="Ver perfil y privacidad, derechos ARCO"
              >
                <ShieldCheck size={18} className="shrink-0 text-teal" />
                <span className="flex flex-1 flex-col">
                  <span className="text-[14px] font-medium text-foreground">
                    Privacidad y derechos ARCO
                  </span>
                  <span className="text-[12px] text-muted-foreground">
                    Exportar, corregir, cancelar y oponerse
                  </span>
                </span>
                <Chevron />
              </button>

              {/* Cerrar sesión (R50) */}
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
                <Chevron />
              </button>
            </RowCard>
          </section>

          {/* ── ELIMINAR CUENTA ───────────────────────────────────────────── */}
          <section>
            <RowCard>
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="flex min-h-[44px] w-full items-center gap-3 px-4 py-2 text-left"
                aria-label="Borrar mi cuenta y datos"
              >
                <span className="flex-1 text-[14px] font-medium text-alert">
                  Borrar mi cuenta
                </span>
              </button>
            </RowCard>
            <p className="mt-1.5 px-1 text-[11px] text-muted-foreground">
              Tu historial se guarda solo en tu dispositivo. Al borrar, no hay recuperación.
            </p>
          </section>
        </div>
      </Sheet>

      {/* Confirmación de borrado (nivel overlay dentro del sheet) */}
      <DeleteConfirmDialog
        open={showDeleteConfirm}
        onConfirm={handleDeleteAccount}
        onCancel={() => setShowDeleteConfirm(false)}
      />

      {/* Confirmación de cierre de sesión (R50) */}
      <LogoutConfirmDialog
        open={showLogoutConfirm}
        onConfirm={handleLogout}
        onCancel={() => setShowLogoutConfirm(false)}
      />

      {/* Sheet de aliases de productos (R48) */}
      <AliasSheet open={showAliasSheet} onClose={() => setShowAliasSheet(false)} />
    </>
  )
}
