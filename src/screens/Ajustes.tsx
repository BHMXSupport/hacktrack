// Hacktrack — Ajustes. Quiet Signal: whitespace generoso, un héroe por sección, jerarquía por escala tipográfica.
import { useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { IcBell, IcChevron, IcShield, IcCheck, IcBack, IcClose } from '../components/icons'
import { Glyph } from '../components/glyphs'
import { Toggle, Disclaimer, Segmented } from '../components/controls'
import { Sparkline } from '../components/charts'
import { AdherenceRing } from '../components/AdherenceRing'
import { useApp, adherence as adherenceCalc } from '../lib/store'
import { protocolStreak } from '../lib/calendar'
import type { ThemeMode, FontScale, UnitSystem } from '../lib/types'
import { requestNotif, notifPermission, notifSupported } from '../lib/notifications'
import { dur, ease, spring } from '../lib/motion'

// ── Constante de la versión de privacidad ──────────────────────────────────────
export const CURRENT_CONSENT_VERSION = 'v1.0'

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

// ── Sheet de confirmación de cierre de sesión ─────────────────────────────────
function LogoutConfirmSheet({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'flex-end',
      }}
      onClick={onCancel}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={spring.sheet}
        style={{
          background: 'var(--bg)', borderRadius: '20px 20px 0 0',
          padding: '28px 20px 40px', width: '100%',
          display: 'flex', flexDirection: 'column', gap: 16,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center', textAlign: 'center' }}>
          <div
            style={{
              width: 48, height: 48, borderRadius: 12,
              background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="var(--ink-700)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </div>
          <span className="h2" style={{ margin: 0 }}>¿Cerrar sesión?</span>
          <span className="body" style={{ color: 'var(--ink-400)', maxWidth: 280 }}>
            Tus datos quedan guardados en este dispositivo. Podrás volver a iniciar sesión sin perder nada.
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            className="btn"
            style={{ width: '100%', height: 52, background: 'var(--error)', color: '#fff', fontSize: 17, fontWeight: 600, border: 'none', borderRadius: 14, cursor: 'pointer' }}
            onClick={onConfirm}
          >
            Cerrar sesión
          </button>
          <button
            className="btn btn-ghost"
            style={{ width: '100%', height: 52, fontSize: 17 }}
            onClick={onCancel}
          >
            Cancelar
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ── Sheet de unidades ─────────────────────────────────────────────────────────
function UnitsSheet({ onClose }: { onClose: () => void }) {
  const { state, dispatch } = useApp()
  const currentUnit: UnitSystem = state.settings.unitSystem ?? 'metric'

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'flex-end' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={spring.sheet}
        style={{ background: 'var(--bg)', borderRadius: '20px 20px 0 0', padding: '28px 20px 40px', width: '100%' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24 }}>
          <span className="h2" style={{ flex: 1, margin: 0 }}>Sistema de unidades</span>
          <button className="iconbtn" onClick={onClose} aria-label="Cerrar"><IcClose size={22} /></button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <p className="sm" style={{ color: 'var(--ink-400)', marginBottom: 8 }}>Peso y medidas corporales</p>
            <Segmented<UnitSystem>
              options={[
                { value: 'metric',   label: 'kg / cm' },
                { value: 'imperial', label: 'lb / in' },
              ]}
              value={currentUnit}
              onChange={(v) => dispatch({ t: 'setSetting', key: 'unitSystem', value: v })}
            />
          </div>
          <p className="sm" style={{ color: 'var(--ink-300)', fontStyle: 'italic', margin: 0 }}>
            Los valores se convierten automáticamente en la presentación. El almacenamiento siempre es en unidades métricas.
          </p>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ── Sheet de selección de escala tipográfica ──────────────────────────────────
function FontScaleSheet({ onClose }: { onClose: () => void }) {
  const { state, dispatch } = useApp()
  const currentScale: FontScale = state.settings.fontScale ?? 'md'

  function applyScale(scale: FontScale) {
    dispatch({ t: 'setSetting', key: 'fontScale', value: scale })
    const map: Record<FontScale, string> = { sm: '0.9', md: '1', lg: '1.12' }
    document.documentElement.style.setProperty('--font-scale', map[scale])
    document.documentElement.setAttribute('data-fontscale', scale)
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'flex-end' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={spring.sheet}
        style={{ background: 'var(--bg)', borderRadius: '20px 20px 0 0', padding: '28px 20px 40px', width: '100%' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24 }}>
          <span className="h2" style={{ flex: 1, margin: 0 }}>Tamaño de texto</span>
          <button className="iconbtn" onClick={onClose} aria-label="Cerrar"><IcClose size={22} /></button>
        </div>
        <Segmented<FontScale>
          options={[
            { value: 'sm', label: 'Pequeño' },
            { value: 'md', label: 'Normal' },
            { value: 'lg', label: 'Grande' },
          ]}
          value={currentScale}
          onChange={(v) => { applyScale(v); onClose() }}
        />
        <p className="sm" style={{ color: 'var(--ink-300)', marginTop: 12, fontStyle: 'italic' }}>
          Afecta todo el texto de la aplicación.
        </p>
      </motion.div>
    </motion.div>
  )
}

// ── Sheet de alias por producto (modo privado) ────────────────────────────────
function AliasSheet({ onClose }: { onClose: () => void }) {
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

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'flex-end' }}
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
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
          <span className="h2" style={{ flex: 1, margin: 0 }}>Nombres privados</span>
          <button className="iconbtn" onClick={onClose} aria-label="Cerrar"><IcClose size={22} /></button>
        </div>
        <p className="sm" style={{ color: 'var(--ink-400)', marginBottom: 20 }}>
          Asigna un alias personalizado a cada producto. Solo tú lo verás.
        </p>
        {products.length === 0 && (
          <p className="body" style={{ color: 'var(--ink-300)', fontStyle: 'italic' }}>
            Sin productos en protocolo.
          </p>
        )}
        <div className="rowlist card">
          {products.map((product) => (
            <div key={product} className="row" style={{ alignItems: 'flex-start', minHeight: 56 }}>
              <span className="row-main" style={{ flex: 1 }}>
                <span className="row-label">{product}</span>
                <input
                  className="field"
                  type="text"
                  value={drafts[product] ?? ''}
                  placeholder="Alias privado (p.ej. Tratamiento A)"
                  maxLength={32}
                  style={{ marginTop: 4, fontSize: 13, width: '100%' }}
                  onChange={(e) => setDrafts((d) => ({ ...d, [product]: e.target.value }))}
                  onBlur={() => save(product)}
                />
              </span>
            </div>
          ))}
        </div>
        <button
          className="btn"
          style={{ marginTop: 20, width: '100%', height: 48 }}
          onClick={() => { products.forEach(save); onClose() }}
        >
          Guardar aliases
        </button>
      </motion.div>
    </motion.div>
  )
}

// ── Sheet de stock y costo por producto ──────────────────────────────────────
function StockSheet({ product, onClose }: { product: string; onClose: () => void }) {
  const { state, dispatch } = useApp()
  const proto = state.protocols[product]
  const [totalMg, setTotalMg] = useState(String(proto?.vialStock?.totalMg ?? ''))
  const [costStr, setCostStr] = useState(String(proto?.purchaseCost ?? ''))
  const [mgBought, setMgBought] = useState(String(proto?.purchasedMg ?? ''))

  function save() {
    const mg = parseFloat(totalMg)
    if (mg > 0) dispatch({ t: 'setVialStock', product, totalMg: mg })
    const cost = parseFloat(costStr)
    const bought = parseFloat(mgBought)
    if (bought > 0) {
      dispatch({ t: 'setPurchase', product, purchasedMg: bought, purchasedAt: Date.now(), cost: isNaN(cost) ? null : cost })
    }
    onClose()
  }

  // calcula días restantes basado en dosis estimada y cadencia
  const cadence = proto?.cadence
  const dosesPerWeek = cadence ? (() => {
    const m = cadence.mode
    if (m === 'dia') return cadence.days.filter(Boolean).length
    if (m === 'sem') return cadence.every > 0 ? 7 / cadence.every : 1
    if (m === 'cadaN') return 7 / (cadence.n ?? 1)
    return 1
  })() : 0

  const mgNum = parseFloat(totalMg)
  const usedMg = proto?.vialStock?.usedMg ?? 0
  const remainMg = isNaN(mgNum) ? 0 : Math.max(0, mgNum - usedMg)
  const costNum = parseFloat(costStr)
  const boughtNum = parseFloat(mgBought)

  const costPerDose = boughtNum > 0 && !isNaN(costNum) ? costNum / (boughtNum / (dosesPerWeek > 0 ? boughtNum / dosesPerWeek : 1)) : null

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'flex-end' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={spring.sheet}
        style={{ background: 'var(--bg)', borderRadius: '20px 20px 0 0', padding: '28px 20px 40px', width: '100%', maxHeight: '80vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20 }}>
          <span className="h2" style={{ flex: 1, margin: 0 }}>Stock · {product}</span>
          <button className="iconbtn" onClick={onClose} aria-label="Cerrar"><IcClose size={22} /></button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label className="sm" style={{ color: 'var(--ink-400)', display: 'block', marginBottom: 4 }}>Stock total del vial (mg)</label>
            <input
              className="field"
              type="number"
              inputMode="decimal"
              min="0"
              placeholder="p.ej. 10"
              value={totalMg}
              onChange={(e) => setTotalMg(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>
          <div>
            <label className="sm" style={{ color: 'var(--ink-400)', display: 'block', marginBottom: 4 }}>mg comprados en el último lote</label>
            <input
              className="field"
              type="number"
              inputMode="decimal"
              min="0"
              placeholder="p.ej. 10"
              value={mgBought}
              onChange={(e) => setMgBought(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>
          <div>
            <label className="sm" style={{ color: 'var(--ink-400)', display: 'block', marginBottom: 4 }}>Costo del lote (MXN)</label>
            <input
              className="field"
              type="number"
              inputMode="decimal"
              min="0"
              placeholder="p.ej. 2500"
              value={costStr}
              onChange={(e) => setCostStr(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>

          {/* Resumen calculado */}
          {remainMg > 0 && (
            <div className="card" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="sm" style={{ color: 'var(--ink-400)' }}>Stock restante</span>
                <span className="sm mono" style={{ color: 'var(--ink-700)' }}>{remainMg.toFixed(1)} mg</span>
              </div>
              {costPerDose != null && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="sm" style={{ color: 'var(--ink-400)' }}>Costo por dosis est.</span>
                  <span className="sm mono" style={{ color: 'var(--ink-700)' }}>${costPerDose.toFixed(2)} MXN</span>
                </div>
              )}
              {remainMg <= 0 && (
                <div style={{ color: 'var(--error)', fontSize: 12, fontWeight: 600, marginTop: 4 }}>
                  <Glyph name="efecto" size={13} color="currentColor" style={{ verticalAlign: '-2px', marginRight: 3 }} /> Stock agotado — considera reponer
                </div>
              )}
            </div>
          )}

          <button className="btn" style={{ height: 48, marginTop: 4 }} onClick={save}>
            Guardar
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ── helpers de export ─────────────────────────────────────────────────────────
function triggerDownload(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

// ── Hero card de protocolo activo ─────────────────────────────────────────────
function ProtocolHeroCard() {
  const { state, dispatch } = useApp()
  const { protocol, protocols, activeProduct } = state
  if (!protocol || !activeProduct) return null

  const streak = protocolStreak(state, new Date(state.todayTs))
  const adherence = adherenceCalc(state, 30)?.pct ?? 0 // adherencia real de 30 días (antes: streak×3.34 inventado)

  return (
    <motion.button
      className="card"
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: dur.base, ease: ease.decelerate }}
      onClick={() => dispatch({ t: 'sheet', sheet: 'protocolo-edit' })}
      style={{
        background: 'linear-gradient(135deg, var(--brand-900) 0%, var(--brand-700) 100%)',
        border: 'none',
        cursor: 'pointer',
        width: '100%',
        textAlign: 'left',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '14px 18px',
        borderRadius: 16,
        marginBottom: 4,
      }}
    >
      <AdherenceRing
        value={adherence}
        goal={100}
        size={40}
        stroke={5}
        label="racha"
        streak={streak}
      />
      <div style={{ flex: 1 }}>
        <div className="body" style={{ color: '#fff', fontWeight: 700, margin: 0 }}>
          {state.productAliases?.[activeProduct] ?? activeProduct}
        </div>
        {protocol.curPhase > 0 && (
          <div className="sm" style={{ color: 'var(--brand-100)', margin: 0 }}>
            Fase {protocol.curPhase}{protocol.progN > 0 ? ` de ${protocol.progN}` : ''} · {streak > 0 ? `${streak} días seguidos` : 'Sin racha aún'}
          </div>
        )}
        {protocol.curPhase === 0 && (
          <div className="sm" style={{ color: 'var(--brand-100)', margin: 0 }}>
            {streak > 0 ? `${streak} días seguidos` : 'Sin racha aún'}
          </div>
        )}
      </div>
      <IcChevron size={18} style={{ color: 'var(--brand-300)' }} />
    </motion.button>
  )
}

export function Ajustes() {
  const { state, dispatch } = useApp()
  const { settings, profile, protocol } = state

  // ── estado local ──────────────────────────────────────────────────────────
  const [nameEditing, setNameEditing]     = useState(false)
  const [nameDraft, setNameDraft]         = useState(profile.name ?? '')
  const nameInputRef                      = useRef<HTMLInputElement>(null)
  const [showLogout, setShowLogout]       = useState(false)
  const [showUnits, setShowUnits]         = useState(false)
  const [showFontScale, setShowFontScale] = useState(false)
  const [showAlias, setShowAlias]         = useState(false)
  const [stockProduct, setStockProduct]   = useState<string | null>(null)
  const [showAdvancedReminders, setShowAdvancedReminders] = useState(false)
  const [showMore, setShowMore]           = useState(false)
  const fileImportRef                     = useRef<HTMLInputElement>(null)

  // permiso en tiempo de render (no se re-pide aquí, solo se lee)
  const perm = notifPermission()

  // ── datos de perfil ───────────────────────────────────────────────────────
  const weightHistory = state.history?.['Peso'] ?? []
  const weightData    = weightHistory.map((s) => s.value)
  const lastWeight    = weightData[weightData.length - 1]
  const firstWeight   = weightData[0]
  const weightDelta   = weightData.length >= 2 ? lastWeight! - firstWeight! : null

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
    }
  }

  function handleTimeChange(e: React.ChangeEvent<HTMLInputElement>) {
    dispatch({ t: 'setReminderTime', time: e.target.value })
  }

  // ── exportar JSON completo ────────────────────────────────────────────────
  function exportJSON() {
    try {
      const payload = JSON.stringify({ schemaVersion: 1, exportedAt: Date.now(), state }, null, 2)
      triggerDownload(payload, `hacktrack-backup-${new Date().toISOString().slice(0, 10)}.json`, 'application/json')
      dispatch({ t: 'toast', msg: 'Respaldo JSON descargado' })
    } catch {
      dispatch({ t: 'toast', msg: 'Error al exportar datos' })
    }
  }

  // ── exportar CSV diario (90 días) ─────────────────────────────────────────
  function exportCSV() {
    try {
      const now = Date.now()
      const cutoff = now - 90 * 86400000
      const rows: string[][] = [['Fecha', 'Hora', 'Tipo', 'Producto', 'Valor', 'Unidad', 'mg_canónicos', 'Nota']]
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
            '',
            item.doseMg != null ? String(item.doseMg) : '',
            item.note ?? '',
          ])
        }
      }
      const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n')
      triggerDownload(csv, `hacktrack-diario-90d-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv;charset=utf-8')
      dispatch({ t: 'toast', msg: 'CSV descargado (últimos 90 días)' })
    } catch {
      dispatch({ t: 'toast', msg: 'Error al exportar CSV' })
    }
  }

  // ── importar respaldo JSON (con confirmación: restaurar SOBRESCRIBE todo) ─────────────────
  const [pendingRestore, setPendingRestore] = useState<{ state: Record<string, unknown>; fecha: string | null; registros: number; productos: number } | null>(null)
  const handleImportFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string)
        const importedState = parsed.state ?? parsed
        if (!importedState.log || !importedState.settings) throw new Error('Formato inválido')
        // NO restaurar de inmediato: mostrar resumen + confirmación (un toque accidental reemplazaba TODO sin aviso).
        const registros = Array.isArray(importedState.log) ? (importedState.log as Array<{ items?: unknown[] }>).reduce((a, g) => a + (g.items?.length ?? 0), 0) : 0
        const productos = importedState.protocols ? Object.keys(importedState.protocols).length : 0
        const fecha = typeof parsed.exportedAt === 'string' ? new Date(parsed.exportedAt).toLocaleDateString('es-MX') : (typeof parsed.exportedAt === 'number' ? new Date(parsed.exportedAt).toLocaleDateString('es-MX') : null)
        setPendingRestore({ state: importedState, fecha, registros, productos })
      } catch {
        dispatch({ t: 'toast', msg: 'Error al leer el archivo — verifica que sea un respaldo válido' })
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }, [dispatch])

  // ── startTrial (7 días) ───────────────────────────────────────────────────
  function startTrial() {
    const trialEnd = Date.now() + 7 * 86400000
    dispatch({ t: 'setSetting', key: 'trialEndsAt', value: trialEnd })
    dispatch({ t: 'setSetting', key: 'premium', value: true })
    dispatch({ t: 'toast', msg: '¡Prueba gratuita de 7 días iniciada!' })
  }

  const trialEndsAt: number | null | undefined = settings.trialEndsAt as number | null | undefined
  const trialActive  = trialEndsAt != null && trialEndsAt > Date.now()
  const trialDaysLeft = trialActive ? Math.ceil((trialEndsAt! - Date.now()) / 86400000) : 0

  const reminderTime = protocol?.reminderTime ?? '08:00'
  const hasProtocol  = protocol != null

  // ── segundo recordatorio (cadaN / ciclo) ──────────────────────────────────
  const cadenceMode  = protocol?.cadence?.mode
  const supportsSecondReminder = cadenceMode === 'cadaN' || cadenceMode === 'ciclo'
  const secondReminderMin: number | null = (settings.secondReminderMin ?? null) as number | null

  // ── racha para badge de urgencia de trial ────────────────────────────────
  const streak = protocolStreak(state, new Date(state.todayTs))

  const close = () => dispatch({ t: 'sheet', sheet: null })

  return (
    <>
      {/* Confirmación de restauración — restaurar SOBRESCRIBE todo, así que pedimos confirmar con un resumen */}
      {pendingRestore && (
        <div onClick={() => setPendingRestore(null)}
          style={{ position: 'absolute', inset: 0, zIndex: 90, background: 'color-mix(in srgb, var(--ink-900) 55%, transparent)', display: 'flex', alignItems: 'flex-end' }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ width: '100%', background: 'var(--surface)', borderRadius: '20px 20px 0 0', padding: '22px 20px calc(20px + env(safe-area-inset-bottom))', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h3 className="h3" style={{ margin: 0, color: 'var(--ink-900)' }}>¿Restaurar este respaldo?</h3>
            <p className="sm" style={{ margin: 0, color: 'var(--ink-400)' }}>
              {pendingRestore.fecha ? `Respaldo del ${pendingRestore.fecha}. ` : ''}{pendingRestore.registros} registro{pendingRestore.registros !== 1 ? 's' : ''} · {pendingRestore.productos} producto{pendingRestore.productos !== 1 ? 's' : ''}.
            </p>
            <p className="sm" style={{ margin: 0, color: 'var(--error)', fontWeight: 600 }}>
              Reemplazará TODOS tus datos actuales (diario, medidas, comida, protocolos). No se puede deshacer.
            </p>
            <button className="btn" style={{ height: 48, width: '100%', background: 'var(--error)', color: '#fff', border: 'none' }}
              onClick={() => { dispatch({ t: 'replaceState', state: pendingRestore.state as Partial<typeof state> }); setPendingRestore(null) }}>
              Restaurar y reemplazar mis datos
            </button>
            <button className="btn btn-ghost" style={{ height: 44, width: '100%' }} onClick={() => setPendingRestore(null)}>
              Cancelar
            </button>
          </div>
        </div>
      )}
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
          {/* Hero de "producto activo" removido: mostraba solo UN producto (activeProduct), lo que
              confundía vs "Mis productos" (que lista TODOS). Todos los productos cuentan como activos;
              la lista única es "Mis productos" más abajo. */}

          {/* ── PERFIL ─────────────────────────────────────────────────────────── */}
          <section>
            <SectionLabel>Perfil</SectionLabel>
            <div className="rowlist card">
              {/* Nombre */}
              <div className="row" style={{ alignItems: 'flex-start', minHeight: 56 }}>
                <RowIcon>
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
                            background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--brand-700)',
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

                  {/* Sparkline de peso inline (N=450): ≥3 puntos. flexWrap + nowrap por par para no competir con el chevron de editar. */}
                  {weightData.length >= 3 && (
                    <span style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 4, minWidth: 0 }}>
                      <Sparkline data={weightData.slice(-12)} w={56} h={20} color="var(--brand-500)" />
                      {lastWeight != null && (
                        <span className="sm mono" style={{ color: 'var(--ink-400)', whiteSpace: 'nowrap' }}>{lastWeight.toFixed(1)} kg</span>
                      )}
                      {weightDelta != null && (
                        <span
                          className="sm mono"
                          style={{ color: weightDelta <= 0 ? 'var(--success)' : 'var(--error)', fontWeight: 600, whiteSpace: 'nowrap' }}
                        >
                          {weightDelta <= 0 ? '↓' : '↑'}{Math.abs(weightDelta).toFixed(1)}
                        </span>
                      )}
                    </span>
                  )}
                </span>

                {!nameEditing && (
                  <button
                    className="row-end"
                    aria-label="Editar nombre"
                    onClick={() => { setNameDraft(profile.name ?? ''); setNameEditing(true) }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
                  >
                    <IcChevron size={18} style={{ color: 'var(--ink-300)' }} />
                  </button>
                )}
              </div>
            </div>
          </section>

          {/* ── MIS PRODUCTOS (N=385) ────────────────────────────────────────── */}
          {(state.importedProducts ?? []).length > 0 && (
            <section>
              <SectionLabel>Mis productos</SectionLabel>
              <div className="rowlist card">
                {(state.importedProducts ?? []).filter((p) => !state.protocols[p]?.archived).map((product) => {
                  const proto = state.protocols[product]
                  const alias = state.productAliases?.[product]
                  const cadLabel = (() => {
                    if (!proto) return ''
                    const m = proto.cadence?.mode
                    if (m === 'dia') return 'Diario'
                    if (m === 'sem') return `Cada ${proto.cadence.every} sem.`
                    if (m === 'cadaN') return `Cada ${proto.cadence.n ?? 1} días`
                    if (m === 'ciclo') return `Ciclo ${proto.cadence.on}/${proto.cadence.off}`
                    if (m === 'uso') return 'Por demanda'
                    return ''
                  })()
                  const stockLeft = proto?.vialStock ? Math.max(0, proto.vialStock.totalMg - proto.vialStock.usedMg) : null
                  const lowStock  = stockLeft != null && stockLeft <= 2

                  return (
                    <div key={product} style={{ display: 'flex', width: '100%' }}>
                      <button
                        className="row"
                        style={{ background: 'none', border: 'none', flex: 1, textAlign: 'left', cursor: 'pointer' }}
                        aria-label={`Editar protocolo de ${product}`}
                        onClick={() => {
                          // editar ESTE producto sin reasignar el primario de Inicio (arg = foco de edición)
                          dispatch({ t: 'sheet', sheet: 'protocolo-edit', arg: product })
                        }}
                      >
                        <RowIcon>
                          <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="var(--brand-700)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                            <path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2v-4M9 21H5a2 2 0 0 1-2-2v-4m0 0h18" />
                          </svg>
                        </RowIcon>
                        <span className="row-main">
                          <span className="row-label">{alias ?? product}</span>
                          {cadLabel && (
                            <span className="row-sub" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
                              <span>{cadLabel}</span>
                              {lowStock && (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: 'var(--warning-ink)' }}>
                                  · <Glyph name="efecto" size={13} color="currentColor" style={{ verticalAlign: '-2px' }} /> Stock bajo
                                </span>
                              )}
                            </span>
                          )}
                        </span>
                        <span className="row-end">
                          <IcChevron size={18} style={{ color: 'var(--ink-300)' }} />
                        </span>
                      </button>
                      {/* botón de stock (N=386) */}
                      <button
                        aria-label={`Stock de ${product}`}
                        onClick={() => setStockProduct(product)}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          padding: '0 12px', color: lowStock ? 'var(--warning)' : 'var(--ink-300)',
                          alignSelf: 'center',
                        }}
                      >
                        <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 10H3M21 6H3M21 14H3M21 18H3" />
                        </svg>
                      </button>
                    </div>
                  )
                })}
                <button
                  className="row"
                  style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer' }}
                  aria-label="Añadir producto"
                  onClick={() => {
                    dispatch({ t: 'sheet', sheet: null })
                    dispatch({ t: 'tab', tab: 'protocolo' })
                  }}
                >
                  <RowIcon>
                    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="var(--brand-700)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                  </RowIcon>
                  <span className="row-main">
                    <span className="row-label" style={{ color: 'var(--brand-700)' }}>Añadir producto</span>
                  </span>
                </button>
              </div>
            </section>
          )}

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
                  <span className="row-sub" style={{ color: perm === 'denied' ? 'var(--error)' : undefined }}>
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
                      fontFamily: 'JetBrains Mono, monospace',
                      width: 96,
                      textAlign: 'center',
                      opacity: hasProtocol ? 1 : 0.4,
                      cursor: hasProtocol ? 'auto' : 'not-allowed',
                    }}
                  />
                </span>
              </div>

              {/* Opciones avanzadas (segundo recordatorio + rescate) detrás de un disclosure
                  para reducir densidad y evitar que los segmentados de 4 botones compitan en la misma fila */}
              {settings.remindersEnabled && (
                <>
                  <button
                    type="button"
                    className="row"
                    style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer' }}
                    aria-expanded={showAdvancedReminders}
                    aria-label="Opciones avanzadas de recordatorios"
                    onClick={() => setShowAdvancedReminders((v) => !v)}
                  >
                    <RowIcon>
                      <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--brand-700)' }}>
                        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
                        <circle cx="12" cy="12" r="3.5" />
                      </svg>
                    </RowIcon>
                    <span className="row-main">
                      <span className="row-label">Opciones avanzadas</span>
                      <span className="row-sub" style={{ color: 'var(--ink-400)' }}>Segundo recordatorio y aviso de rescate</span>
                    </span>
                    <span className="row-end">
                      <IcChevron size={18} style={{ color: 'var(--ink-300)', transform: showAdvancedReminders ? 'rotate(90deg)' : 'none', transition: 'transform 0.18s' }} />
                    </span>
                  </button>

                  <AnimatePresence initial={false}>
                    {showAdvancedReminders && (
                      <motion.div
                        key="advanced-reminders"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        style={{ overflow: 'hidden' }}
                      >
                        {/* Fila: Segundo recordatorio (N=403) — solo para ciclo/cadaN. Control en 2ª línea full-width (anti-bleed). */}
                        {supportsSecondReminder && (
                          <div className="row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 10 }}>
                            <span style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                              <RowIcon>
                                <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="var(--brand-700)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                  <circle cx="12" cy="13" r="8" />
                                  <path d="M12 9v4l2 2" />
                                  <path d="M9 2h6" />
                                </svg>
                              </RowIcon>
                              <span className="row-main" style={{ flex: 1 }}>
                                <span className="row-label">Segundo recordatorio</span>
                                <span className="row-sub" style={{ color: 'var(--ink-400)' }}>
                                  Para reconstitución o seguimiento del ciclo
                                </span>
                              </span>
                            </span>
                            {/* minutos antes: desactivado · 30m · 1h · 2h */}
                            {(() => {
                              const opts: { key: number | null; label: string }[] = [
                                { key: null, label: 'Sin' },
                                { key: 30,   label: '30m' },
                                { key: 60,   label: '1h' },
                                { key: 120,  label: '2h' },
                              ]
                              return (
                                <span
                                  role="group"
                                  aria-label="Segundo recordatorio"
                                  style={{
                                    display: 'flex', borderRadius: 10, border: '1px solid var(--border)',
                                    overflow: 'hidden', background: 'var(--surface)', width: '100%',
                                  }}
                                >
                                  {opts.map(({ key, label }, idx) => {
                                    const active = secondReminderMin === key
                                    return (
                                      <button
                                        key={label}
                                        type="button"
                                        aria-pressed={active}
                                        onClick={() => dispatch({ t: 'setSetting', key: 'secondReminderMin', value: key as unknown as string })}
                                        style={{
                                          flex: 1, padding: '7px 6px', fontSize: 12, fontWeight: active ? 700 : 500,
                                          border: 'none',
                                          borderRight: idx < opts.length - 1 ? '1px solid var(--border)' : 'none',
                                          cursor: 'pointer',
                                          background: active ? 'var(--brand-700)' : 'transparent',
                                          color: active ? '#fff' : 'var(--ink-700)',
                                          transition: 'background 0.15s, color 0.15s',
                                          lineHeight: 1.4,
                                          fontFamily: 'JetBrains Mono, monospace',
                                        }}
                                      >
                                        {label}
                                      </button>
                                    )
                                  })}
                                </span>
                              )
                            })()}
                          </div>
                        )}

                        {/* Fila: Ventana de rescate — control en 2ª línea full-width (anti-bleed) */}
                        <div className="row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 10 }}>
                          <span style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                            <RowIcon>
                              <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--brand-700)' }}>
                                <circle cx="12" cy="13" r="8" />
                                <path d="M12 9v4l2 2" />
                                <path d="M9 2h6M12 2v3" />
                              </svg>
                            </RowIcon>
                            <span className="row-main" style={{ flex: 1 }}>
                              <span className="row-label">Aviso de rescate</span>
                              <span className="row-sub" style={{ color: 'var(--ink-400)' }}>
                                Segundo aviso si no registras a tiempo
                              </span>
                            </span>
                          </span>
                          {(() => {
                            type RW = 0 | 15 | 30 | 60
                            const current: RW = (settings.rescueWindowMin as RW) ?? 0
                            const opts: { key: RW; label: string }[] = [
                              { key: 0,  label: 'Sin' },
                              { key: 15, label: '15m' },
                              { key: 30, label: '30m' },
                              { key: 60, label: '1h' },
                            ]
                            return (
                              <span role="group" aria-label="Ventana de rescate" style={{ display: 'flex', borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden', background: 'var(--surface)', width: '100%' }}>
                                {opts.map(({ key, label }) => {
                                  const active = current === key
                                  return (
                                    <button
                                      key={key}
                                      type="button"
                                      aria-pressed={active}
                                      aria-label={key === 0 ? 'Sin aviso de rescate' : `Aviso de rescate a los ${label}`}
                                      onClick={() => dispatch({ t: 'setRescueWindow', minutes: key })}
                                      style={{
                                        flex: 1, padding: '7px 6px', fontSize: 12, fontWeight: active ? 700 : 500,
                                        border: 'none', borderRight: key !== 60 ? '1px solid var(--border)' : 'none',
                                        cursor: 'pointer', background: active ? 'var(--brand-700)' : 'transparent',
                                        color: active ? '#fff' : 'var(--ink-700)',
                                        transition: 'background 0.15s, color 0.15s', lineHeight: 1.4,
                                        fontFamily: 'JetBrains Mono, monospace',
                                      }}
                                    >
                                      {label}
                                    </button>
                                  )
                                })}
                              </span>
                            )
                          })()}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </>
              )}

              {/* Fila: Plus / trial */}
              <div className="row">
                <RowIcon>
                  <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--brand-700)' }}>
                    <rect x="4" y="11" width="16" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" />
                  </svg>
                </RowIcon>
                <span className="row-main">
                  <span className="row-label">Plus</span>
                  <span className="row-sub">
                    {settings.premium
                      ? trialActive ? `Prueba gratuita — ${trialDaysLeft} día${trialDaysLeft !== 1 ? 's' : ''} restante${trialDaysLeft !== 1 ? 's' : ''}` : 'Activo'
                      : 'Desbloquea perspectivas avanzadas'}
                  </span>
                </span>
                {/* badge inline (no apilado) para no crecer la fila ni desalinear respecto al icono */}
                <span className="row-end" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  {trialActive && trialDaysLeft <= 2 && (
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#fff', background: 'var(--error)', borderRadius: 6, padding: '2px 6px', whiteSpace: 'nowrap' }}>
                      Vence pronto
                    </span>
                  )}
                  <Toggle
                    on={settings.premium}
                    onChange={(v) => {
                      if (v && !settings.premium && !trialEndsAt) {
                        startTrial()
                      } else {
                        dispatch({ t: 'setSetting', key: 'premium', value: v })
                      }
                    }}
                    label="Activar Plus"
                  />
                </span>
              </div>

              {/* Fila 3: Resumen semanal */}
              <div className="row">
                <RowIcon>
                  <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--brand-700)' }}>
                    <path d="M3 18l4-8 4 6 3-4 4 6" /><path d="M21 21H3" />
                  </svg>
                </RowIcon>
                <span className="row-main"><span className="row-label">Resumen semanal</span></span>
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
                  <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--brand-700)' }}>
                    <rect x="2" y="4" width="20" height="16" rx="2" />
                    <path d="m2 7 10 7 10-7" />
                  </svg>
                </RowIcon>
                <span className="row-main">
                  <span className="row-label">Avisos por correo</span>
                  {profile.email && <span className="row-sub">{profile.email}</span>}
                  {!profile.email && <span className="row-sub" style={{ color: 'var(--ink-300)', fontStyle: 'italic' }}>Sin correo configurado</span>}
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

              {/* Tema: segmentado Auto / Claro / Oscuro (N=381). flexWrap permite que el segmentado baje a 2ª línea en fontScale grande. */}
              <div className="row" style={{ alignItems: 'flex-start', minHeight: 64, flexWrap: 'wrap', rowGap: 10 }}>
                <RowIcon>
                  <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--brand-700)' }}>
                    <path d="M12 3a9 9 0 1 0 9 9 7 7 0 0 1-9-9Z" />
                  </svg>
                </RowIcon>
                <span className="row-main" style={{ flex: 1, minWidth: 0 }}>
                  <span className="row-label">Tema</span>
                  {(settings.themeMode ?? 'auto') === 'auto' && (
                    <span className="row-sub" style={{ color: 'var(--ink-400)', marginTop: 2, display: 'block' }}>
                      Respeta la preferencia del sistema
                    </span>
                  )}
                </span>
                <span className="row-end" style={{ alignSelf: 'center' }}>
                  {(() => {
                    const current: ThemeMode = settings.themeMode ?? 'auto'
                    const opts: { key: ThemeMode; label: string }[] = [
                      { key: 'auto',  label: 'Auto' },
                      { key: 'light', label: 'Claro' },
                      { key: 'dark',  label: 'Oscuro' },
                    ]
                    return (
                      <span role="group" aria-label="Modo de tema" style={{ display: 'inline-flex', borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden', background: 'var(--surface)' }}>
                        {opts.map(({ key, label }) => {
                          const active = current === key
                          return (
                            <button
                              key={key} type="button" aria-pressed={active} aria-label={`Tema ${label}`}
                              onClick={() => dispatch({ t: 'setThemeMode', mode: key })}
                              style={{
                                padding: '5px 10px', fontSize: 12, fontWeight: active ? 700 : 500,
                                border: 'none', borderRight: key !== 'dark' ? '1px solid var(--border)' : 'none',
                                cursor: 'pointer', background: active ? 'var(--brand-700)' : 'transparent',
                                color: active ? '#fff' : 'var(--ink-700)',
                                transition: 'background 0.15s, color 0.15s', lineHeight: 1.4,
                              }}
                            >
                              {label}
                            </button>
                          )
                        })}
                      </span>
                    )
                  })()}
                </span>
              </div>

              {/* Unidades reales (N=382 / N=442) */}
              <button
                className="row"
                style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer' }}
                aria-label="Configurar unidades"
                onClick={() => setShowUnits(true)}
              >
                <RowIcon>
                  <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--brand-700)' }}>
                    <path d="M21 6H3M3 12h12M3 18h6" />
                  </svg>
                </RowIcon>
                <span className="row-main">
                  <span className="row-label">Unidades</span>
                  <span className="row-sub">{(settings.unitSystem ?? 'metric') === 'metric' ? 'kg · cm' : 'lb · in'}</span>
                </span>
                <span className="row-end">
                  <IcChevron size={18} style={{ color: 'var(--ink-300)' }} />
                </span>
              </button>

              {/* Escala tipográfica (N=441) */}
              <button
                className="row"
                style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer' }}
                aria-label="Tamaño de texto"
                onClick={() => setShowFontScale(true)}
              >
                <RowIcon>
                  <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--brand-700)' }}>
                    <path d="M4 20h16M6 20V8l6-4 6 4v12" />
                  </svg>
                </RowIcon>
                <span className="row-main">
                  <span className="row-label">Tamaño de texto</span>
                  <span className="row-sub">{{ sm: 'Pequeño', md: 'Normal', lg: 'Grande' }[settings.fontScale ?? 'md']}</span>
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
                // usuario ya en la app: el back de Import debe regresar a la app, no a login
                onClick={() => { dispatch({ t: 'setReturnTo', screen: 's-app' }); dispatch({ t: 'go', screen: 's-import' }) }}
              >
                <RowIcon>
                  <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--brand-700)' }}>
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

              {/* PIN de acceso (N=383 / N=444) */}
              <div className="row">
                <RowIcon>
                  <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--brand-700)' }}>
                    <rect x="5" y="11" width="14" height="10" rx="2" />
                    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                  </svg>
                </RowIcon>
                <span className="row-main">
                  <span className="row-label">PIN de acceso</span>
                  <span className="row-sub" style={{ color: 'var(--ink-400)' }}>
                    {settings.pinEnabled
                      ? settings.pinHash ? 'Configurado' : 'Activado (sin PIN configurado)'
                      : 'Desactivado'}
                  </span>
                </span>
                <span className="row-end">
                  <Toggle
                    on={settings.pinEnabled}
                    onChange={(v) => {
                      dispatch({ t: 'setSetting', key: 'pinEnabled', value: v })
                      if (v) dispatch({ t: 'toast', msg: 'Configura tu PIN en el próximo inicio de sesión' })
                    }}
                    label="Activar PIN de acceso"
                  />
                </span>
              </div>

              {/* Modo privado de nombres (N=445) */}
              <button
                className="row"
                style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer' }}
                aria-label="Nombres privados de productos"
                onClick={() => setShowAlias(true)}
              >
                <RowIcon>
                  <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--brand-700)' }}>
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                    <path d="M3 3l18 18" />
                  </svg>
                </RowIcon>
                <span className="row-main">
                  <span className="row-label">Nombres privados</span>
                  <span className="row-sub" style={{ color: 'var(--ink-400)' }}>
                    {Object.keys(state.productAliases ?? {}).length > 0
                      ? `${Object.keys(state.productAliases ?? {}).length} alias configurado${Object.keys(state.productAliases ?? {}).length !== 1 ? 's' : ''}`
                      : 'Alias personalizados para tus péptidos'}
                  </span>
                </span>
                <span className="row-end">
                  <IcChevron size={18} style={{ color: 'var(--ink-300)' }} />
                </span>
              </button>

              {/* Cerrar sesión — con confirmación (N=384) */}
              <button
                className="row danger"
                style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer' }}
                aria-label="Cerrar sesión"
                onClick={() => setShowLogout(true)}
              >
                <RowIcon>
                  <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
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

          {/* ── VER MÁS: Respaldo + Soporte colapsados por defecto para reducir densidad ─── */}
          {!showMore && (
            <button
              type="button"
              className="btn btn-ghost"
              style={{ alignSelf: 'center', width: 'auto', padding: '0 16px', fontSize: 14, color: 'var(--brand-700)' }}
              onClick={() => setShowMore(true)}
              aria-expanded={false}
            >
              Ver más · Respaldo y soporte
            </button>
          )}

          <AnimatePresence initial={false}>
          {showMore && (
          <motion.div
            key="ajustes-more"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 24 }}
          >
          {/* ── RESPALDO (N=405 / N=406 / N=498) ──────────────────────────────── */}
          <section>
            <SectionLabel>Respaldo</SectionLabel>
            <div className="rowlist card">

              {/* Exportar JSON completo */}
              <button
                className="row"
                style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer' }}
                aria-label="Exportar todos mis datos"
                onClick={exportJSON}
              >
                <RowIcon>
                  <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="var(--brand-700)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                </RowIcon>
                <span className="row-main">
                  <span className="row-label">Exportar mis datos (JSON)</span>
                  <span className="row-sub">Respaldo completo — protocolos, diario, medidas</span>
                </span>
                <span className="row-end">
                  <IcChevron size={18} style={{ color: 'var(--ink-300)' }} />
                </span>
              </button>

              {/* Exportar CSV 90 días */}
              <button
                className="row"
                style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer' }}
                aria-label="Exportar CSV del diario"
                onClick={exportCSV}
              >
                <RowIcon>
                  <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="var(--brand-700)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="17" rx="2" />
                    <path d="M3 9h18M8 2v4M16 2v4" />
                    <path d="M14 13h4v4M18 13l-4 4" />
                  </svg>
                </RowIcon>
                <span className="row-main">
                  <span className="row-label">Exportar para médico (CSV)</span>
                  <span className="row-sub">Dosis y medidas de los últimos 90 días</span>
                </span>
                <span className="row-end">
                  <IcChevron size={18} style={{ color: 'var(--ink-300)' }} />
                </span>
              </button>

              {/* Importar respaldo (N=406) */}
              <button
                className="row"
                style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer' }}
                aria-label="Importar respaldo JSON"
                onClick={() => fileImportRef.current?.click()}
              >
                <RowIcon>
                  <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="var(--brand-700)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                </RowIcon>
                <span className="row-main">
                  <span className="row-label">Restaurar desde respaldo</span>
                  <span className="row-sub">Importar archivo JSON de respaldo</span>
                </span>
                <span className="row-end">
                  <IcChevron size={18} style={{ color: 'var(--ink-300)' }} />
                </span>
              </button>
              <input
                ref={fileImportRef}
                type="file"
                accept=".json,application/json"
                style={{ display: 'none' }}
                onChange={handleImportFile}
                aria-hidden="true"
              />

              {/* Nota de privacidad de almacenamiento local (N=497) */}
              <div className="row" style={{ pointerEvents: 'none', opacity: 0.9 }}>
                <RowIcon>
                  <IcShield size={18} style={{ color: 'var(--ink-400)' }} />
                </RowIcon>
                <span className="row-main">
                  <span className="row-label" style={{ color: 'var(--ink-400)', fontSize: 13 }}>Todo en tu dispositivo</span>
                  <span className="row-sub">Tus datos viven en localStorage — nunca se envían a servidores externos.</span>
                </span>
              </div>

            </div>
          </section>

          {/* ── SOPORTE (N=451) ──────────────────────────────────────────────── */}
          <section>
            <SectionLabel>Soporte</SectionLabel>
            <div className="rowlist card">
              <a
                className="row"
                href="mailto:soporte@biohackmx.com.mx?subject=Feedback%20Hacktrack"
                aria-label="Enviar feedback"
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <RowIcon>
                  <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="var(--brand-700)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                  </svg>
                </RowIcon>
                <span className="row-main"><span className="row-label">Enviar feedback</span></span>
                <span className="row-end"><IcChevron size={18} style={{ color: 'var(--ink-300)' }} /></span>
              </a>
              <a
                className="row"
                href="mailto:soporte@biohackmx.com.mx?subject=Problema%20en%20Hacktrack"
                aria-label="Reportar un problema"
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <RowIcon>
                  <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="var(--brand-700)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 8v4M12 16h.01" />
                  </svg>
                </RowIcon>
                <span className="row-main"><span className="row-label">Reportar un problema</span></span>
                <span className="row-end"><IcChevron size={18} style={{ color: 'var(--ink-300)' }} /></span>
              </a>
              <button
                className="row"
                style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer' }}
                aria-label="Calificar la app"
                onClick={() => dispatch({ t: 'toast', msg: 'Calificación disponible cuando la app esté en las tiendas' })}
              >
                <RowIcon>
                  <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="var(--brand-700)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                </RowIcon>
                <span className="row-main"><span className="row-label">Calificar la app</span></span>
                <span className="row-end"><IcChevron size={18} style={{ color: 'var(--ink-300)' }} /></span>
              </button>
            </div>
          </section>
          </motion.div>
          )}
          </AnimatePresence>

          {/* Disclaimer */}
          <Disclaimer kind="general" />

          {/* Banner decorativo */}
          <div
            style={{
              borderRadius: 20, overflow: 'hidden',
              background: 'linear-gradient(135deg, var(--brand-700) 0%, var(--brand-900) 100%)',
              padding: '28px 24px', display: 'flex', flexDirection: 'column', gap: 4,
            }}
            aria-hidden
          >
            <p className="body" style={{ color: '#ffffff', fontWeight: 600, margin: 0 }}>Tu progreso es constante.</p>
            <p className="sm" style={{ color: 'var(--brand-100)', margin: 0 }}>
              Continúa optimizando tu rutina día con día.
            </p>
          </div>

        </main>
      </div>
      </motion.div>

      {/* ── Sheets flotantes ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showLogout && (
          <LogoutConfirmSheet
            key="logout"
            onConfirm={() => { setShowLogout(false); dispatch({ t: 'go', screen: 's-login' }) }}
            onCancel={() => setShowLogout(false)}
          />
        )}
        {showUnits && <UnitsSheet key="units" onClose={() => setShowUnits(false)} />}
        {showFontScale && <FontScaleSheet key="fontscale" onClose={() => setShowFontScale(false)} />}
        {showAlias && <AliasSheet key="alias" onClose={() => setShowAlias(false)} />}
        {stockProduct && <StockSheet key={`stock-${stockProduct}`} product={stockProduct} onClose={() => setStockProduct(null)} />}
      </AnimatePresence>
    </>
  )
}
