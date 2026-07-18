// Hacktrack v2 — Ajustes. Design system "Bitácora" (LOCKED): filas editoriales de papel-y-tinta,
// §-folios por sección, hairlines en vez de vidrio, azul = interactivo, ámbar solo energía.
// R48: PIN de acceso, segundo recordatorio, avisos por correo, alias de productos.
// R50: cerrar sesión (go 's-login').
import { useState, useRef, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import {
  Bell, Clock, Ruler, ChevronRight, User, ShieldCheck,
  Mail, Tag, LogOut, ListChecks, Download, Contrast, LayoutGrid, Calculator, CreditCard,
} from 'lucide-react'
import { Sheet } from '../ui/Sheet'
import { FolioLabel } from '../ui/FolioLabel'
import { useModalStack } from '../ui/modalStack'
import { NOTIF_PROMPT_DISMISSED_KEY } from '../ui/NotifPermissionPrompt'
import { Switch } from '../ui/Switch'
import { backendEnabled } from '../../lib/backend/config'
import { getSession, signOut } from '../../lib/backend/auth'
import { pullRemote, deleteRemote, getSyncStatus, onSyncStatusChange, markCloudSyncedNow, clearSyncStatus, countMergeChanges } from '../../lib/backend/sync'
import { unsubscribePush } from '../../lib/backend/push'
import { Button } from '../ui/Button'
import { SegmentedTabs } from '../ui/SegmentedTabs'
import { useApp, sanitizeImport, importHasData, prepareSyncPayload } from '../../lib/store'
import type { AppState, SyncPayload } from '../../lib/store'
import { mergeStates, TOMBSTONE_TTL_MS } from '../../lib/merge'
import { requestNotif, notifPermission, notifSupported } from '../../lib/notifications'
import { requestNativeNotifPermission } from '../../lib/native/notifications'
import { IMPORT_ENTRY_ENABLED } from '../../lib/buildFlags'
import type { ThemeMode, UnitSystem } from '../../lib/types'

// ── constante de versión de consentimiento (misma que la v1 original) ──────────
export const CURRENT_CONSENT_VERSION = 'v1.0'

// ── detección simple de iOS ────────────────────────────────────────────────────
const isIOS = /iPad|iPhone|iPod/.test(
  typeof navigator !== 'undefined' ? navigator.userAgent : '',
)

// ── helper: etiqueta legible del permiso de notificaciones ────────────────────
function permLabel(p: ReturnType<typeof notifPermission>): string {
  if (p === 'granted') return 'Activadas'
  if (p === 'denied') return 'Bloqueadas en el sistema'
  if (p === 'unsupported') return 'No compatibles con este navegador'
  return 'Sin permiso'
}

// ── helper: fecha/hora legible de la última copia en la nube ──────────────────
function formatSyncTime(ts: number): string {
  return new Date(ts).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

// ── borrado de cuenta (Cancelación ARCO) — compartido por Ajustes y Perfil ────
// (1) Con backend y sesión: borra la copia en la NUBE (fila user_state + suscripciones push, y
//     des-suscribe el push del navegador) ANTES del borrado local; si falla, devuelve el error para
//     que el caller avise honesto — nunca "todo borrado" cuando la nube conserva el historial.
//     En éxito cierra también la sesión de Supabase (el token sb-* es un residuo del usuario borrado).
// (2) Limpia las claves residuales de localStorage fuera del estado (unidades, coach, última copia…).
export async function purgeAccountData(): Promise<{ cloudError: string | null }> {
  let cloudError: string | null = null
  if (backendEnabled) {
    const sess = await getSession().catch(() => null)
    if (sess) {
      // mejor esfuerzo: si falla, el delete por user_id de abajo borra igual la fila del servidor
      try { await unsubscribePush() } catch { /* sin SW/push en este navegador */ }
      const res = await deleteRemote(sess.userId)
      if (res.ok) {
        try { await signOut() } catch { /* sin red: el borrado remoto ya ocurrió */ }
      } else {
        cloudError = res.error // la sesión se conserva para poder reintentar el borrado
      }
    }
  }
  try {
    ;['hacktrack:v1', 'hacktrack-glass-ml', 'hk_diario_coach', 'ht:lastError', 'ht:consentAcceptedAt'].forEach((k) => localStorage.removeItem(k))
    Object.keys(localStorage).filter((k) => k.startsWith('ht_unit_')).forEach((k) => localStorage.removeItem(k))
  } catch { /* modo privado / sin acceso a localStorage */ }
  clearSyncStatus() // borra 'hacktrack:lastCloudSyncAt' y resetea el estado de sync en memoria
  return { cloudError }
}

// Aviso honesto cuando el borrado local ocurrió pero el remoto no (guía de reintento incluida).
export const CLOUD_DELETE_FAILED_MSG =
  'Se borraron los datos de este dispositivo, pero la copia en la nube no se pudo eliminar. Con conexión, vuelve a intentar «Eliminar mis datos».'

// ── fila genérica: tap target ≥44px garantizado ──────────────────────────────
function Row({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex min-h-[44px] items-center gap-3 px-1 ${className}`}>
      {children}
    </div>
  )
}

// ── label de sección — §-folio editorial (graft del veredicto v2) ─────────────
function SectionLabel({ n, children }: { n?: number; children: React.ReactNode }) {
  return (
    <FolioLabel n={n} className="px-1 pb-2.5">
      {children}
    </FolioLabel>
  )
}

// ── card contenedor de filas — pozo cálido con hairlines (reglas, no sombras) ─
function RowCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col divide-y divide-hairline overflow-hidden rounded-[10px] border border-hairline bg-raised">
      {children}
    </div>
  )
}

// Switch accesible reutilizable → movido a ../ui/Switch (compartido con titulación por fases, etc.)

// ── chevron decorativo ────────────────────────────────────────────────────────
function Chevron() {
  return <ChevronRight size={16} className="shrink-0 text-ink-3" />
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
  // En la pila de modales: Escape cierra este diálogo (tope), no el Sheet de abajo.
  useModalStack(open, onCancel)
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
            aria-label="Confirmar borrado de cuenta"
            className="pointer-events-auto relative w-full rounded-t-[26px] border-t border-hairline bg-paper p-5 pb-[max(24px,env(safe-area-inset-bottom))]"
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
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-ink-3" />
            <h3 className="mb-1 font-serif text-[20px] font-medium tracking-tight text-ink">¿Borrar todos mis datos?</h3>
            <p className="mb-5 text-[14px] leading-relaxed text-ink-2">
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
    </AnimatePresence>,
    document.body,
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
  // En la pila de modales: Escape cierra este diálogo (tope), no el Sheet de abajo.
  useModalStack(open, onCancel)
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
            className="pointer-events-auto relative w-full rounded-t-[26px] border-t border-hairline bg-paper p-5 pb-[max(24px,env(safe-area-inset-bottom))]"
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
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-ink-3" />
            <div className="mb-4 flex flex-col items-center gap-2 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-[10px] border border-hairline bg-raised">
                <LogOut size={22} className="text-ink" strokeWidth={1.6} />
              </div>
              <h3 className="font-serif text-[20px] font-medium tracking-tight text-ink">¿Cerrar sesión?</h3>
              <p className="max-w-[300px] text-[14px] leading-relaxed text-ink-2">
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

// ── sub-sheet de confirmación de "Reemplazar todo con la nube" (destructivo) ──
// "Restaurar de la nube" ya NO reemplaza (combina por registro, sin pérdida); esta ruta es la única
// destructiva que queda y por eso exige confirmación explícita en la pila de modales.
function ReplaceCloudConfirmDialog({
  open,
  onConfirm,
  onCancel,
}: {
  open: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  const reduce = useReducedMotion()
  // En la pila de modales: Escape cierra este diálogo (tope), no el Sheet de abajo.
  useModalStack(open, onCancel)
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
            aria-label="Confirmar reemplazo con la copia de la nube"
            className="pointer-events-auto relative w-full rounded-t-[26px] border-t border-hairline bg-paper p-5 pb-[max(24px,env(safe-area-inset-bottom))]"
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
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-ink-3" />
            <h3 className="mb-1 font-serif text-[20px] font-medium tracking-tight text-ink">¿Reemplazar todo con la nube?</h3>
            <p className="mb-5 text-[14px] leading-relaxed text-ink-2">
              Esto descartará lo que solo exista en este dispositivo y dejará exactamente la copia de la
              nube. Tu PIN, tu consentimiento y el modo solo local no cambian. No se puede deshacer. Si
              solo quieres traer lo que falta, usa «Restaurar de la nube» — esa combina sin borrar nada.
            </p>
            <div className="flex flex-col gap-2">
              <Button
                variant="primary"
                size="full"
                className="bg-alert text-white shadow-none"
                onClick={onConfirm}
              >
                Sí, reemplazar todo
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
  const [search, setSearch] = useState('')
  // Producto que acaba de guardarse (para feedback visual momentáneo)
  const [savedProduct, setSavedProduct] = useState<string | null>(null)

  // Re-sincronizar drafts con productos/aliases al abrir (#100)
  useEffect(() => {
    if (open) {
      const currentProducts = state.importedProducts ?? []
      const currentAliases = state.productAliases ?? {}
      setDrafts(Object.fromEntries(currentProducts.map((p) => [p, currentAliases[p] ?? ''])))
      setSearch('')
      setSavedProduct(null)
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  function save(product: string) {
    const alias = (drafts[product] ?? '').trim()
    dispatch({ t: 'setProductAlias', product, alias: alias || null })
    // Feedback visual: mostrar check por 1.2 s
    setSavedProduct(product)
    window.setTimeout(() => setSavedProduct((p) => (p === product ? null : p)), 1200)
  }

  function saveAll() {
    products.forEach(save)
    onClose()
  }

  const query = search.trim().toLowerCase()
  const filteredProducts = query
    ? products.filter((p) => p.toLowerCase().includes(query))
    : products

  return (
    <Sheet open={open} onClose={onClose} title="Nombres privados">
      <div className="flex flex-col gap-4 pb-2">
        <p className="text-[14px] leading-relaxed text-ink-2">
          Asigna un alias personalizado a cada producto. Solo tú lo verás en la app.
        </p>

        {products.length === 0 ? (
          <p className="italic text-[13px] text-ink-3">
            Sin productos en protocolo.
          </p>
        ) : (
          <>
            {/* Buscador de productos */}
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar producto…"
              aria-label="Filtrar productos por nombre"
              className={[
                'h-[44px] w-full rounded-[8px] border border-hairline bg-raised px-3',
                'text-[15px] text-ink placeholder:text-ink-3',
                'focus:outline-none focus-visible:ring-1 focus-visible:ring-blue',
              ].join(' ')}
            />

            <div className="flex flex-col gap-3">
              {filteredProducts.length === 0 && (
                <p className="italic text-[13px] text-ink-3">
                  Sin resultados para "{search}".
                </p>
              )}
              {filteredProducts.map((product) => {
                const isSaved = savedProduct === product
                return (
                  <div key={product} className="flex flex-col gap-1">
                    <label
                      htmlFor={`alias-${product}`}
                      className="flex items-center gap-1.5 font-mono text-[12px] font-medium uppercase tracking-[0.08em] text-ink-2"
                    >
                      {product}
                      {/* Feedback de guardado — estado ok con texto (nunca solo color) */}
                      {isSaved && (
                        <span className="text-[11px] font-semibold normal-case tracking-normal text-ok">
                          ✓ Guardado
                        </span>
                      )}
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
                        'h-[44px] w-full rounded-[8px] border bg-raised px-3 transition-colors duration-200',
                        'text-[15px] text-ink placeholder:text-ink-3',
                        'focus:outline-none focus-visible:ring-1 focus-visible:ring-blue',
                        isSaved ? 'border-ok' : 'border-hairline',
                      ].join(' ')}
                    />
                  </div>
                )
              })}
            </div>
          </>
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

// ── selector de tema Papel / Tinta con vista previa ──────────────────────────
// La preview usa los colores FIJOS de cada tema (muestra lo que elegirías, no el tema
// actual): mini-página con numeral serif, tick ámbar y hairline — la firma Bitácora en
// miniatura. Auto = mitad Papel / mitad Tinta. Misma acción de siempre (setThemeMode).
const THEME_OPTIONS: { value: ThemeMode; name: string; sub: string }[] = [
  // 'auto' es por HORARIO (Tinta 19–7 h, provider.tsx), no por ajuste del sistema — el sub lo dice tal cual.
  { value: 'auto', name: 'Auto', sub: 'noche 19–7 h' },
  { value: 'light', name: 'Papel', sub: 'claro' },
  { value: 'dark', name: 'Tinta', sub: 'oscuro' },
]

function ThemeSwatch({ mode }: { mode: ThemeMode }) {
  const halves = mode === 'auto' ? (['light', 'dark'] as const) : ([mode] as const)
  return (
    <span aria-hidden className="flex h-11 w-full overflow-hidden rounded-[7px] border border-hairline">
      {halves.map((h) => {
        const t =
          h === 'light'
            ? { bg: '#F4F1EA', ink: '#1A1712', amber: '#C9761F', rule: 'rgba(26,23,18,.25)' }
            : { bg: '#14110C', ink: '#F2EDE3', amber: '#F0A63C', rule: 'rgba(255,255,255,.18)' }
        return (
          <span key={h} className="flex min-w-0 flex-1 flex-col justify-center gap-1 px-2" style={{ background: t.bg }}>
            {/* Numeral serif en miniatura — "el número serif gigante es sagrado" */}
            <span className="font-serif leading-none tabular-nums" style={{ color: t.ink, fontSize: 14 }}>
              92<span style={{ fontSize: 9 }}>%</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="h-1 w-1 shrink-0 rounded-full" style={{ background: t.amber }} />
              <span className="h-px min-w-0 flex-1" style={{ background: t.rule }} />
            </span>
          </span>
        )
      })}
    </span>
  )
}

// ── componente principal ──────────────────────────────────────────────────────
export function Ajustes({
  open,
  onClose,
  onOpenPerfil,
  onOpenProtocolos,
  onOpenCalc,
  onOpenImport,
}: {
  open: boolean
  onClose: () => void
  onOpenPerfil?: () => void
  onOpenProtocolos?: () => void
  onOpenCalc?: () => void
  onOpenImport?: () => void
}) {
  const { state, dispatch } = useApp()
  const { settings, profile, protocol } = state

  // ── estado local ──────────────────────────────────────────────────────────
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [showAdvancedReminders, setShowAdvancedReminders] = useState(false)
  const [restoreState, setRestoreState] = useState<'idle' | 'busy'>('idle')
  const [showReplaceConfirm, setShowReplaceConfirm] = useState(false)
  const [replaceBusy, setReplaceBusy] = useState(false)

  // Estado real de la copia en la nube (última subida exitosa / fallo pendiente).
  const [syncStatus, setSyncStatus] = useState(() => getSyncStatus())
  useEffect(() => onSyncStatusChange(() => setSyncStatus(getSyncStatus())), [])

  // Restaurar desde la nube = pull → MERGE por registro → aplicar (Opción C). NO destructivo: combina
  // el respaldo con lo local sin perder la versión más nueva de ningún registro (leyes de lib/merge.ts),
  // por eso ya no exige confirmación. Los mensajes son honestos: dicen qué pasó de verdad.
  // "Sin respaldo" solo se muestra cuando de verdad no hay fila; un error de red/permiso da su propio mensaje.
  async function handleRestore() {
    const sess = await getSession()
    if (!sess) { dispatch({ t: 'toast', msg: 'Inicia sesión para restaurar' }); setRestoreState('idle'); return }
    setRestoreState('busy')
    const remote = await pullRemote(sess.userId)
    setRestoreState('idle')
    if (!remote.ok) { dispatch({ t: 'toast', msg: remote.error }); return }
    if (remote.empty) { dispatch({ t: 'toast', msg: 'No hay respaldo en la nube todavía' }); return }
    // El blob remoto se SANEA antes de fusionar (mergeStates tolera colecciones ausentes pero no
    // valida items corruptos; sanitizeImport es esa validación). El payload local sale de
    // prepareSyncPayload — la ÚNICA fuente de exclusión de lo device-local.
    const remoteClean = sanitizeImport(remote.data as Partial<AppState>).state as unknown as SyncPayload
    const local = prepareSyncPayload(state)
    const { merged, changedVsLocal, changedVsRemote } = mergeStates(local, remoteClean, Date.now() - TOMBSTONE_TTL_MS)
    if (!changedVsLocal) {
      // Nada nuevo para este dispositivo. Si tampoco hay nada que subir, local == nube → sello honesto.
      if (!changedVsRemote) {
        markCloudSyncedNow()
        dispatch({ t: 'toast', msg: 'Ya estás al día con la nube' })
      } else {
        dispatch({ t: 'toast', msg: 'Tu respaldo no trae nada nuevo — este dispositivo va adelante' })
      }
      return
    }
    // applyMerged conserva lo device-local (PIN, consentimiento, cloudSync, localOnly, UI efímera)
    // y recomputa cachés — las decisiones de ESTA instalación nunca vienen de la nube (LFPDPPP).
    const n = countMergeChanges(local, merged)
    dispatch({ t: 'applyMerged', merged })
    // "Última copia" solo cuando local == nube tras aplicar; si quedó algo por subir, lo estampa
    // el ciclo de sync (useCloudSync) cuando el push CAS lo consiga de verdad.
    if (!changedVsRemote) markCloudSyncedNow()
    dispatch({ t: 'toast', msg: `Combinado con tu respaldo — ${n} cambio${n === 1 ? '' : 's'} aplicado${n === 1 ? '' : 's'}` })
  }

  // Reemplazar TODO con la nube: la semántica destructiva de siempre (pull → reemplazo vía
  // loadRemoteState → hydrate), detrás de un diálogo de confirmación en la pila de modales.
  async function handleReplaceAll() {
    setShowReplaceConfirm(false)
    const sess = await getSession()
    if (!sess) { dispatch({ t: 'toast', msg: 'Inicia sesión para restaurar' }); return }
    setReplaceBusy(true)
    const remote = await pullRemote(sess.userId)
    setReplaceBusy(false)
    if (!remote.ok) { dispatch({ t: 'toast', msg: remote.error }); return }
    if (remote.empty) { dispatch({ t: 'toast', msg: 'No hay respaldo en la nube todavía' }); return }
    const incoming = remote.data as Partial<AppState>
    // ÚNICO predicado de resultado, el MISMO que usa el reducer: sanitizeImport + importHasData
    // sobre el blob SANEADO. (Un pre-check crudo divergiría: un blob cuyas entradas se descartan
    // TODAS al sanear pasaría aquí, el reducer lo rechazaría, y el toast mentiría éxito.)
    if (!importHasData(sanitizeImport(incoming).state)) {
      dispatch({ t: 'toast', msg: 'El respaldo en la nube está vacío — no se restauró (tus datos siguen intactos)' })
      return
    }
    // Decisiones del DISPOSITIVO — PIN, consentimiento (activo + versión), respaldo en la nube y
    // modo solo local — sobreviven al reemplazo: un respaldo viejo no puede reactivar un
    // consentimiento revocado ni re-encender las subidas (LFPDPPP: re-consentir es un acto explícito).
    const withDeviceLocal: Partial<AppState> = {
      ...incoming,
      localOnly: state.localOnly,
      settings: {
        ...(incoming.settings ?? settings),
        pinEnabled: settings.pinEnabled,
        pinHash: settings.pinHash ?? null,
        consentActive: settings.consentActive,
        consentVersion: settings.consentVersion,
        cloudSync: settings.cloudSync,
      },
    }
    dispatch({ t: 'loadRemoteState', state: withDeviceLocal })
    // Solo se estampa "última copia" en éxito real: el predicado de arriba es el mismo que aplica
    // el reducer, que además es dueño del toast ('Restaurado desde la nube' / 'N omitidas') — aquí
    // NO se toastea para no tapar el aviso de entradas descartadas.
    markCloudSyncedNow()
  }
  const [showAliasSheet, setShowAliasSheet] = useState(false)
  const fileImportRef = useRef<HTMLInputElement>(null)
  const reduce = useReducedMotion()

  // permiso de notificaciones (lectura en tiempo de render)
  const perm = notifPermission()

  // ¿El usuario descartó el aviso de permisos con "No volver a preguntar"?
  // Se relee al abrir Ajustes (la clave vive en localStorage, fuera del estado).
  const [notifPromptDismissed, setNotifPromptDismissed] = useState(false)
  useEffect(() => {
    if (!open) return
    try {
      setNotifPromptDismissed(localStorage.getItem(NOTIF_PROMPT_DISMISSED_KEY) === '1')
    } catch {
      setNotifPromptDismissed(false)
    }
  }, [open])

  function handleResetNotifPrompt() {
    try { localStorage.removeItem(NOTIF_PROMPT_DISMISSED_KEY) } catch { /* modo privado */ }
    setNotifPromptDismissed(false)
    dispatch({ t: 'toast', msg: 'Listo — verás el aviso la próxima vez que abras la app' })
  }

  // tema actual
  const currentTheme: ThemeMode = settings.themeMode ?? (settings.darkMode ? 'dark' : 'auto')

  // Tema RESUELTO (espejo de applyTheme del provider) — solo para el chrome nativo del
  // picker de hora (color-scheme): antes iba clavado a oscuro y en Papel pintaba el
  // control nativo oscuro sobre fondo claro.
  const _hour = new Date().getHours()
  const nativeScheme: 'dark' | 'light' =
    currentTheme === 'light' ? 'light'
    : currentTheme === 'auto' ? (_hour >= 19 || _hour < 7 ? 'dark' : 'light')
    : 'dark'

  // unidades
  const currentUnit: UnitSystem = settings.unitSystem ?? 'metric'

  // hora del RESUMEN DIARIO (la "general" de Ajustes). Los recordatorios POR DOSIS usan la hora de cada
  // protocolo (se configura en cada protocolo); aquí solo se elige la hora del resumen de todos.
  const summaryTime = settings.summaryTime ?? '08:00'
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
    // Nativo (Capacitor): el permiso del OS se pide por LocalNotifications; en web es no-op (false).
    const nativeGranted = await requestNativeNotifPermission()
    const result = nativeGranted ? 'granted' : await requestNotif()
    if (result === 'granted') {
      dispatch({ t: 'setSetting', key: 'remindersEnabled', value: true })
    } else {
      dispatch({ t: 'toast', msg: 'Activa las notificaciones en ajustes del sistema.' })
    }
  }

  function handleTimeChange(e: React.ChangeEvent<HTMLInputElement>) {
    dispatch({ t: 'setSetting', key: 'summaryTime', value: e.target.value })
  }

  async function handleDeleteAccount() {
    // Corta cualquier push debounced pendiente ANTES de borrar la nube (que no re-suba la fila recién borrada)
    dispatch({ t: 'setSetting', key: 'cloudSync', value: false })
    const { cloudError } = await purgeAccountData()
    dispatch({ t: 'arcoDelete' })
    // El toast honesto va DESPUÉS de arcoDelete para no ser tapado por su 'Tus datos fueron borrados.'
    if (cloudError) dispatch({ t: 'toast', msg: CLOUD_DELETE_FAILED_MSG })
    setShowDeleteConfirm(false)
    onClose()
  }

  function handleLogout() {
    // Cierra también la sesión de Supabase; si no, persiste en localStorage y el respaldo
    // seguiría subiendo a la cuenta "cerrada" (y el siguiente usuario del dispositivo la hereda).
    void signOut()
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
          // No reemplazar TODO con un respaldo vacío (estructura válida pero sin datos) → evita perder
          // todo sin querer. Mismo predicado compartido que el restore de nube, sobre el blob saneado.
          if (!importHasData(sanitizeImport(importedState).state)) {
            dispatch({ t: 'toast', msg: 'El respaldo está vacío — no se importó (tus datos siguen intactos)' })
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

  // §-folio incremental: se numera en orden de render (la sección Nube es condicional).
  let sec = 0

  return (
    <>
      <Sheet open={open} onClose={onClose} title="Ajustes">
        <div className="flex flex-col gap-6 pb-2">

          {/* ── PERFIL ────────────────────────────────────────────────────── */}
          <section>
            <SectionLabel n={++sec}>Perfil</SectionLabel>
            <RowCard>
              <button
                type="button"
                onClick={onOpenPerfil}
                className="flex min-h-[44px] w-full items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-surface"
                aria-label="Ver perfil y privacidad"
              >
                <User size={18} strokeWidth={1.6} className="shrink-0 text-blue" />
                <span className="flex flex-1 flex-col">
                  <span className="text-[15px] font-medium text-ink">
                    {profile.name ?? 'Tu perfil'}
                  </span>
                  <span className="text-[12px] text-ink-3">
                    Perfil y privacidad
                  </span>
                </span>
                <Chevron />
              </button>
            </RowCard>
          </section>

          {/* ── PROTOCOLOS ────────────────────────────────────────────────── */}
          <section>
            <SectionLabel n={++sec}>Protocolos</SectionLabel>
            <RowCard>
              <button
                type="button"
                onClick={() => (onOpenProtocolos ? onOpenProtocolos() : dispatch({ t: 'sheet', sheet: 'protocolos' }))}
                className="flex min-h-[44px] w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-surface"
                aria-label="Mis protocolos"
              >
                <ListChecks size={18} strokeWidth={1.6} className="shrink-0 text-blue" />
                <span className="flex flex-1 flex-col">
                  <span className="text-[15px] font-medium text-ink">Mis protocolos</span>
                  <span className="text-[12px] text-ink-3">Cadencia, días y dosis por producto</span>
                </span>
                <Chevron />
              </button>
              {IMPORT_ENTRY_ENABLED && (
                <button
                  type="button"
                  onClick={() => (onOpenImport ? onOpenImport() : dispatch({ t: 'sheet', sheet: 'import' }))}
                  className="flex min-h-[44px] w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-surface"
                  aria-label="Importar protocolos"
                >
                  <Download size={18} strokeWidth={1.6} className="shrink-0 text-blue" />
                  <span className="flex flex-1 flex-col">
                    <span className="text-[15px] font-medium text-ink">Importar protocolos</span>
                    <span className="text-[12px] text-ink-3">Agrega productos a tu seguimiento</span>
                  </span>
                  <Chevron />
                </button>
              )}
              <button
                type="button"
                onClick={() => (onOpenCalc ? onOpenCalc() : dispatch({ t: 'sheet', sheet: 'calc' }))}
                className="flex min-h-[44px] w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-surface"
                aria-label="Calculadora de reconstitución"
              >
                <Calculator size={18} strokeWidth={1.6} className="shrink-0 text-blue" />
                <span className="flex flex-1 flex-col">
                  <span className="text-[15px] font-medium text-ink">Calculadora de reconstitución</span>
                  <span className="text-[12px] text-ink-3">mg de vial + agua → unidades</span>
                </span>
                <Chevron />
              </button>
            </RowCard>
          </section>

          {/* ── APARIENCIA — selector Papel / Tinta con vista previa ──────── */}
          <section>
            <SectionLabel n={++sec}>Apariencia</SectionLabel>
            <RowCard>
              <Row className="px-4 py-3">
                <span className="flex flex-1 flex-col gap-2.5">
                  <span className="text-[15px] font-medium text-ink">Tema</span>
                  <div role="group" aria-label="Tema de la app" className="grid grid-cols-3 gap-2">
                    {THEME_OPTIONS.map((o) => {
                      const active = currentTheme === o.value
                      return (
                        <button
                          key={o.value}
                          type="button"
                          aria-pressed={active}
                          aria-label={`Tema ${o.name} (${o.sub})`}
                          onClick={() => dispatch({ t: 'setThemeMode', mode: o.value })}
                          className={[
                            'flex min-h-[44px] flex-col gap-1.5 rounded-[10px] border p-2 text-left transition-colors',
                            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2',
                            active
                              ? 'border-blue bg-[color-mix(in_srgb,var(--blue)_8%,transparent)]'
                              : 'border-hairline bg-surface hover:bg-raised',
                          ].join(' ')}
                        >
                          <ThemeSwatch mode={o.value} />
                          <span className="flex w-full items-baseline justify-between gap-1">
                            <span className={['text-[13px] font-semibold', active ? 'text-blue' : 'text-ink'].join(' ')}>
                              {o.name}
                            </span>
                            <span className="font-mono text-[11px] text-ink-3">{o.sub}</span>
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </span>
              </Row>
            </RowCard>
          </section>

          {/* ── ACCESIBILIDAD ─────────────────────────────────────────────── */}
          <section>
            <SectionLabel n={++sec}>Accesibilidad</SectionLabel>
            <RowCard>
              <Row className="px-4 py-3">
                <Contrast size={18} strokeWidth={1.6} className={settings.highContrast ? 'shrink-0 text-blue' : 'shrink-0 text-ink-3'} />
                <span className="flex flex-1 flex-col">
                  <span className="text-[15px] font-medium text-ink">Alto contraste</span>
                  <span className="text-[12px] text-ink-3">Texto más legible (no cambia el tamaño)</span>
                </span>
                <Switch
                  checked={!!settings.highContrast}
                  onChange={(v) => dispatch({ t: 'setSetting', key: 'highContrast', value: v })}
                  label="Activar alto contraste"
                />
              </Row>
              <Row className="px-4 py-3">
                <LayoutGrid size={18} strokeWidth={1.6} className={settings.simpleMode ? 'shrink-0 text-blue' : 'shrink-0 text-ink-3'} />
                <span className="flex flex-1 flex-col">
                  <span className="text-[15px] font-medium text-ink">Modo simple</span>
                  <span className="text-[12px] text-ink-3">Solo Inicio, Diario y Progreso</span>
                </span>
                <Switch
                  checked={!!settings.simpleMode}
                  onChange={(v) => {
                    dispatch({ t: 'setSetting', key: 'simpleMode', value: v })
                    if (v && !['inicio', 'diario', 'protocolo'].includes(state.tab ?? '')) {
                      dispatch({ t: 'tab', tab: 'inicio' })
                    }
                  }}
                  label="Activar modo simple"
                />
              </Row>
            </RowCard>
          </section>

          {/* ── UNIDADES ──────────────────────────────────────────────────── */}
          <section>
            <SectionLabel n={++sec}>Unidades</SectionLabel>
            <RowCard>
              <Row className="px-4 py-3">
                <Ruler size={18} strokeWidth={1.6} className="shrink-0 text-blue" />
                <span className="flex flex-1 flex-col gap-2">
                  <span className="text-[15px] font-medium text-ink">Peso y medidas</span>
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
            <p className="mt-1.5 px-1 text-[12px] text-ink-3">
              Los valores se convierten automáticamente. El almacenamiento siempre es métrico.
            </p>
          </section>

          {/* ── SEGURIDAD ─────────────────────────────────────────────────── */}
          <section>
            <SectionLabel n={++sec}>Seguridad</SectionLabel>
            <RowCard>
              <Row className="px-4">
                <ShieldCheck size={18} strokeWidth={1.6} className={settings.pinEnabled ? 'shrink-0 text-blue' : 'shrink-0 text-ink-3'} />
                <span className="flex flex-1 flex-col">
                  <span className="text-[15px] font-medium text-ink">Bloqueo con PIN</span>
                  <span className="text-[12px] text-ink-3">
                    {settings.pinEnabled ? 'Se pide al abrir la app' : 'Pide un PIN de 4 dígitos al abrir'}
                  </span>
                </span>
                <Switch
                  checked={settings.pinEnabled}
                  label="Activar bloqueo con PIN"
                  onChange={(next) => {
                    if (next) {
                      // El PIN se activa al CONFIRMARLO en el setup, no al togglear (evita quedar bloqueado sin PIN).
                      dispatch({ t: 'sheet', sheet: 'pin-setup' })
                    } else {
                      dispatch({ t: 'setSetting', key: 'pinEnabled', value: false })
                      dispatch({ t: 'setSetting', key: 'pinHash', value: null })
                      dispatch({ t: 'toast', msg: 'PIN desactivado' })
                    }
                  }}
                />
              </Row>
              {settings.pinEnabled && (
                <button
                  type="button"
                  onClick={() => dispatch({ t: 'sheet', sheet: 'pin-setup' })}
                  className="flex min-h-[44px] w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-surface"
                  aria-label="Cambiar PIN"
                >
                  <Tag size={18} strokeWidth={1.6} className="shrink-0 text-blue" />
                  <span className="flex-1 text-[15px] font-medium text-ink">Cambiar PIN</span>
                  <ChevronRight size={16} className="text-ink-3" />
                </button>
              )}
            </RowCard>
            <p className="mt-1.5 px-1 text-[12px] leading-relaxed text-ink-3">
              Bloqueo casual de privacidad (no cifrado). Si olvidas el PIN tendrás que borrar los datos del dispositivo para entrar — aún no hay recuperación en la nube.
            </p>
          </section>

          {/* ── NUBE (solo visible si hay backend configurado; en el beta local-first no aparece) ── */}
          {backendEnabled && (
            <section>
              <SectionLabel n={++sec}>Nube</SectionLabel>
              <RowCard>
                <Row className="px-4">
                  <Download size={18} strokeWidth={1.6} className={settings.cloudSync ? 'shrink-0 text-blue' : 'shrink-0 text-ink-3'} />
                  <span className="flex flex-1 flex-col">
                    <span className="text-[15px] font-medium text-ink">Respaldo y sincronización</span>
                    <span
                      className={[
                        'text-[12px]',
                        settings.cloudSync && syncStatus.lastPushFailed ? 'text-alert' : 'text-ink-3',
                      ].join(' ')}
                    >
                      {!settings.cloudSync
                        ? 'Opcional — requiere iniciar sesión'
                        : syncStatus.lastPushFailed
                          ? 'No se pudo sincronizar el último cambio — se reintenta con el siguiente'
                          : syncStatus.lastSyncAt
                            ? `Última sincronización: ${formatSyncTime(syncStatus.lastSyncAt)}`
                            : 'Tus datos se respaldan y sincronizan entre tus dispositivos'}
                    </span>
                  </span>
                  <Switch
                    checked={!!settings.cloudSync}
                    label="Activar respaldo y sincronización"
                    onChange={(next) => dispatch({ t: 'setSetting', key: 'cloudSync', value: next })}
                  />
                </Row>
                {/* Combinar (no destructivo): pull → merge por registro → aplicar. Sin confirmación
                    porque no puede perder datos (leyes de lib/merge.ts). */}
                <button
                  type="button"
                  disabled={restoreState === 'busy'}
                  onClick={handleRestore}
                  className="flex min-h-[44px] w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-surface disabled:opacity-50"
                  aria-label="Restaurar desde la nube (combina con lo de este dispositivo)"
                >
                  <Download size={18} strokeWidth={1.6} className="shrink-0 rotate-180 text-blue" />
                  <span className="flex flex-1 flex-col">
                    <span className="text-[15px] font-medium text-ink">{restoreState === 'busy' ? 'Restaurando…' : 'Restaurar de la nube'}</span>
                    <span className="text-[12px] text-ink-3">Combina tu respaldo con este dispositivo — no borra nada</span>
                  </span>
                  <ChevronRight size={16} className="text-ink-3" />
                </button>
                {/* Reemplazo destructivo: exige confirmación (diálogo en la pila de modales). */}
                <button
                  type="button"
                  disabled={replaceBusy}
                  onClick={() => setShowReplaceConfirm(true)}
                  className="flex min-h-[44px] w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-surface disabled:opacity-50"
                  aria-label="Reemplazar todo con la copia de la nube"
                >
                  <span className="flex flex-1 flex-col">
                    <span className="text-[15px] font-medium text-alert">{replaceBusy ? 'Reemplazando…' : 'Reemplazar todo con la nube'}</span>
                    <span className="text-[12px] text-ink-3">Descarta lo de este dispositivo y deja la copia de la nube</span>
                  </span>
                  <ChevronRight size={16} className="text-ink-3" />
                </button>
              </RowCard>
            </section>
          )}

          {/* ── RECORDATORIOS ────────────────────────────────────────────── */}
          <section>
            <SectionLabel n={++sec}>Recordatorios</SectionLabel>
            <RowCard>

              {/* Toggle principal */}
              <Row className="px-4">
                <Bell
                  size={18}
                  strokeWidth={1.6}
                  className={[
                    'shrink-0',
                    settings.remindersEnabled && perm === 'granted' ? 'text-blue' : 'text-ink-3',
                  ].join(' ')}
                />
                <span className="flex flex-1 flex-col">
                  <span className="text-[15px] font-medium text-ink">
                    Recordatorio de registro
                  </span>
                  <span
                    className={[
                      'text-[12px]',
                      perm === 'denied' ? 'text-alert' : 'text-ink-3',
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

              {/* Cómo funcionan: por dosis (cada protocolo a su hora) + resumen diario. Nota honesta de iOS. */}
              <p className="mx-4 mt-0.5 mb-1 border-none pb-2 text-[12px] leading-relaxed text-ink-3">
                Recibes un aviso <span className="text-ink">por cada dosis</span>, a la hora de cada protocolo (la configuras en cada uno).
                {isIOS && ' En iPhone los recordatorios funcionan con la app abierta; con la app cerrada llegarán cuando conectemos el servidor de avisos.'}
              </p>

              {/* Resumen diario — hora del aviso "hoy tienes programado…" con TODOS los protocolos activos */}
              <Row className="px-4">
                <Clock
                  size={18}
                  strokeWidth={1.6}
                  className={hasProtocol ? 'shrink-0 text-blue' : 'shrink-0 text-ink-3'}
                />
                <span className="flex flex-1 flex-col">
                  <span
                    className={[
                      'text-[15px] font-medium',
                      hasProtocol ? 'text-ink' : 'text-ink-3',
                    ].join(' ')}
                  >
                    Resumen diario
                  </span>
                  <span className="text-[12px] text-ink-3">
                    {hasProtocol ? 'Un aviso con todo lo de hoy, a esta hora' : 'Configura un protocolo primero'}
                  </span>
                </span>
                <input
                  type="time"
                  value={summaryTime}
                  disabled={!hasProtocol}
                  aria-label="Hora del resumen diario"
                  onChange={handleTimeChange}
                  style={{ colorScheme: nativeScheme }}
                  className={[
                    'h-[36px] rounded-[8px] bg-surface px-2 font-mono text-[13px] tabular-nums text-ink',
                    'border border-hairline focus:outline-none focus-visible:ring-1 focus-visible:ring-blue',
                    !hasProtocol ? 'cursor-not-allowed opacity-40' : '',
                  ].join(' ')}
                />
              </Row>

              {/* Resumen semanal */}
              <Row className="px-4">
                <span className="flex flex-1 flex-col">
                  <span className="text-[15px] font-medium text-ink">Resumen semanal</span>
                  <span className="text-[12px] text-ink-3">
                    {perm !== 'granted'
                      ? 'Activa primero los recordatorios'
                      : 'Notificación de adherencia los lunes'}
                  </span>
                </span>
                <Switch
                  checked={settings.weeklySummary}
                  onChange={(v) => {
                    if (perm !== 'granted') {
                      dispatch({ t: 'toast', msg: 'Concede permiso de notificaciones primero' })
                      return
                    }
                    dispatch({ t: 'setSetting', key: 'weeklySummary', value: v })
                  }}
                  label="Activar resumen semanal"
                />
              </Row>

              {/* Reactivar el aviso de permisos si fue descartado con "No volver a preguntar".
                  Solo aparece cuando la clave está puesta y el permiso sigue sin concederse
                  (con permiso concedido el aviso ya no aplica y la fila prometería algo falso). */}
              {notifPromptDismissed && perm !== 'granted' && (
                <button
                  type="button"
                  onClick={handleResetNotifPrompt}
                  className="flex min-h-[44px] w-full items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-surface"
                  aria-label="Volver a mostrar el aviso de permisos"
                >
                  <span className="flex flex-1 flex-col">
                    <span className="text-[15px] font-medium text-ink">
                      Volver a mostrar el aviso de permisos
                    </span>
                    <span className="text-[12px] text-ink-3">
                      Lo descartaste con «No volver a preguntar»
                    </span>
                  </span>
                  <Chevron />
                </button>
              )}

              {/* Opciones avanzadas: segundo recordatorio + rescate (R48) */}
              {settings.remindersEnabled && perm === 'granted' && (
                <>
                  <button
                    type="button"
                    aria-expanded={showAdvancedReminders}
                    aria-label="Opciones avanzadas de recordatorios"
                    onClick={() => setShowAdvancedReminders((v) => !v)}
                    className="flex min-h-[44px] w-full items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-surface"
                  >
                    <span className="flex flex-1 flex-col">
                      <span className="text-[15px] font-medium text-ink">
                        Opciones avanzadas
                      </span>
                      <span className="text-[12px] text-ink-3">
                        Segundo recordatorio y aviso de rescate
                      </span>
                    </span>
                    <ChevronRight
                      size={16}
                      className={[
                        'shrink-0 text-ink-3 transition-transform duration-200',
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
                        {/* Pre-aviso antes de la dosis (R48). Antes se ocultaba por completo si la cadencia
                            no era ciclo/cadaN → el usuario no entendía por qué faltaba el bloque. Ahora SIEMPRE
                            se muestra; si no aplica, queda deshabilitado con una nota del porqué. */}
                        <div className="flex flex-col gap-2 px-4 pb-3 pt-1">
                          <span className="font-mono text-[12px] font-medium uppercase tracking-[0.08em] text-ink-2">
                            Pre-aviso antes de la dosis
                          </span>
                          <span className="-mt-1 text-[12px] text-ink-3">
                            Recibe un aviso antes de la hora programada para tenerlo listo.
                          </span>
                          <div
                            role="group"
                            aria-label="Pre-aviso antes de la dosis"
                            className={[
                              'flex overflow-hidden rounded-[8px] border border-hairline bg-surface',
                              supportsSecondReminder ? '' : 'pointer-events-none opacity-40',
                            ].join(' ')}
                          >
                            {([
                              { key: null, label: 'Sin' },
                              { key: 30, label: '30m' },
                              { key: 60, label: '1h' },
                              { key: 120, label: '2h' },
                            ] as const).map(({ key, label }) => {
                              const active = secondReminderMin === key
                              const disp = key === null ? 'Sin' : `−${label}`
                              return (
                                <button
                                  key={String(key)}
                                  type="button"
                                  disabled={!supportsSecondReminder}
                                  aria-pressed={active}
                                  aria-label={
                                    key === null
                                      ? 'Sin pre-aviso'
                                      : `Pre-aviso ${label} antes de la dosis`
                                  }
                                  onClick={() =>
                                    dispatch({
                                      t: 'setSetting',
                                      key: 'secondReminderMin',
                                      value: key as unknown as string,
                                    })
                                  }
                                  className={[
                                    'min-h-[44px] flex-1 py-1.5 text-[12px] font-semibold font-mono tabular-nums transition-colors',
                                    active
                                      ? 'bg-blue text-primary-foreground'
                                      : 'bg-transparent text-ink-2 hover:bg-raised',
                                  ].join(' ')}
                                >
                                  {disp}
                                </button>
                              )
                            })}
                          </div>
                          {!supportsSecondReminder && (
                            <span className="text-[12px] text-ink-3">
                              Solo para protocolos de ciclo o cada N días.
                            </span>
                          )}
                        </div>

                        {/* Aviso de rescate */}
                        <div className="flex flex-col gap-2 px-4 pb-3 pt-1">
                          <span className="font-mono text-[12px] font-medium uppercase tracking-[0.08em] text-ink-2">
                            Ventana de rescate — si no registras a tiempo
                          </span>
                          <div
                            role="group"
                            aria-label="Ventana de rescate"
                            className="flex overflow-hidden rounded-[8px] border border-hairline bg-surface"
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
                                    'min-h-[44px] flex-1 py-1.5 text-[12px] font-semibold font-mono tabular-nums transition-colors',
                                    active
                                      ? 'bg-blue text-primary-foreground'
                                      : 'bg-transparent text-ink-2 hover:bg-raised',
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
          {/* Interino: no hay backend de correo todavía — switch deshabilitado */}
          <section>
            <SectionLabel n={++sec}>Comunicaciones</SectionLabel>
            <RowCard>
              <Row className="px-4">
                <Mail
                  size={18}
                  strokeWidth={1.6}
                  className="shrink-0 text-ink-3 opacity-50"
                />
                <span className="flex flex-1 flex-col opacity-50">
                  <span className="text-[15px] font-medium text-ink">
                    Avisos por correo · Próximamente
                  </span>
                  <span className="text-[12px] text-ink-3">
                    Disponible cuando conectemos tu cuenta.
                  </span>
                </span>
                <Switch
                  checked={false}
                  onChange={() => {}}
                  disabled
                  label="Avisos por correo — próximamente"
                />
              </Row>
            </RowCard>
          </section>

          {/* ── PRIVACIDAD — alias de productos (R48) ─────────────────────── */}
          <section>
            <SectionLabel n={++sec}>Privacidad</SectionLabel>
            <RowCard>
              <button
                type="button"
                onClick={() => setShowAliasSheet(true)}
                className="flex min-h-[44px] w-full items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-surface"
                aria-label="Gestionar nombres privados de productos"
              >
                <Tag size={18} strokeWidth={1.6} className="shrink-0 text-blue" />
                <span className="flex flex-1 flex-col">
                  <span className="text-[15px] font-medium text-ink">
                    Nombres privados
                  </span>
                  <span className="text-[12px] text-ink-3">
                    Alias personalizados para cada producto
                  </span>
                </span>
                <Chevron />
              </button>
            </RowCard>
          </section>

          {/* ── PLAN Y FACTURACIÓN ────────────────────────────────────────── */}
          <section>
            <SectionLabel n={++sec}>Plan y facturación</SectionLabel>
            <RowCard>
              {/* Estado de plan — HONESTO: durante la beta no hay cargos ni suscripción, así que no
                  hay panel de facturación (mostrar "próximo cargo" sería inventar un dato falso).
                  Cuando exista pago real (MercadoPago), esta fila se expande a: método de pago,
                  próximo cargo, historial y CANCELAR — requisito legal (Profeco: cancelar debe ser
                  tan fácil como suscribirse). Spec en el handoff de Auth & Backend, épica C. */}
              <Row className="px-4 py-3">
                <CreditCard size={18} strokeWidth={1.6} className="shrink-0 text-blue" />
                <span className="flex flex-1 flex-col">
                  <span className="text-[15px] font-medium text-ink">Gratis durante la beta</span>
                  <span className="text-[12px] leading-relaxed text-ink-3">
                    No tienes cargos ni suscripciones activas. Si Hacktrack Plus llega a tener costo, te
                    avisaremos aquí antes de cualquier cobro y podrás cancelar cuando quieras.
                  </span>
                </span>
              </Row>
            </RowCard>
          </section>

          {/* ── CUENTA ─────────────────────────────────────────────────────── */}
          <section>
            <SectionLabel n={++sec}>Cuenta</SectionLabel>
            <RowCard>
              {/* Respaldo — importar */}
              <button
                type="button"
                onClick={() => fileImportRef.current?.click()}
                className="flex min-h-[44px] w-full items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-surface"
                aria-label="Importar respaldo JSON"
              >
                <span className="flex flex-1 flex-col">
                  <span className="text-[15px] font-medium text-ink">
                    Importar respaldo
                  </span>
                  <span className="text-[12px] text-ink-3">
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
                className="flex min-h-[44px] w-full items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-surface"
                aria-label="Ver perfil y privacidad, derechos ARCO"
              >
                <ShieldCheck size={18} strokeWidth={1.6} className="shrink-0 text-blue" />
                <span className="flex flex-1 flex-col">
                  <span className="text-[15px] font-medium text-ink">
                    Privacidad y derechos ARCO
                  </span>
                  <span className="text-[12px] text-ink-3">
                    Exportar, corregir, cancelar y oponerse
                  </span>
                </span>
                <Chevron />
              </button>

              {/* Cerrar sesión (R50) */}
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(true)}
                className="flex min-h-[44px] w-full items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-surface"
                aria-label="Cerrar sesión"
              >
                <LogOut size={18} strokeWidth={1.6} className="shrink-0 text-ink-3" />
                <span className="flex flex-1 flex-col">
                  <span className="text-[15px] font-medium text-ink">Cerrar sesión</span>
                  <span className="text-[12px] text-ink-3">
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
                className="flex min-h-[44px] w-full items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-surface"
                aria-label="Borrar mi cuenta y datos"
              >
                <span className="flex-1 text-[15px] font-medium text-alert">
                  Borrar mi cuenta
                </span>
              </button>
            </RowCard>
            <p className="mt-1.5 px-1 text-[12px] text-ink-3">
              Tu historial se guarda solo en tu dispositivo. Al borrar, no hay recuperación.
            </p>
          </section>

          {/* Sello de build — para diagnosticar caché: si el hash no coincide con el último deploy, estás en un bundle viejo. */}
          <p className="px-1 pt-2 text-center font-mono text-[11px] tracking-[0.04em] text-ink-3">
            build {__BUILD_SHA__} · {__BUILD_TIME__.slice(0, 16).replace('T', ' ')}
          </p>
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

      {/* Confirmación de "Reemplazar todo con la nube" (destructivo) */}
      <ReplaceCloudConfirmDialog
        open={showReplaceConfirm}
        onConfirm={handleReplaceAll}
        onCancel={() => setShowReplaceConfirm(false)}
      />

      {/* Sheet de aliases de productos (R48) */}
      <AliasSheet open={showAliasSheet} onClose={() => setShowAliasSheet(false)} />
    </>
  )
}
