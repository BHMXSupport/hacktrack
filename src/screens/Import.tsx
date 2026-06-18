import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useApp } from '../lib/store'
import { IcBack, IcCheck, IcChevron } from '../components/icons'
import { BiohackmxFlask } from '../components/BiohackmxFlask'
import { Disclaimer } from '../components/controls'
import { EmptyState } from '../components/EmptyState'
import { MOCK_BIOHACKMX_PURCHASES, PEPTIDES, CATEGORY_COLOR } from '../lib/catalog'
import { spring, sharedAxisX, staggerParent, staggerItem } from '../lib/motion'

// ── helpers ──────────────────────────────────────────────────────────────────

// Fecha relativa en es-MX a partir de un string tipo '12 may 2026'
function relDate(raw: string): string {
  try {
    // Normaliza el mes abreviado en español
    const months: Record<string, string> = {
      ene: '01', feb: '02', mar: '03', abr: '04', may: '05', jun: '06',
      jul: '07', ago: '08', sep: '09', oct: '10', nov: '11', dic: '12',
    }
    const parts = raw.trim().toLowerCase().split(/\s+/)
    if (parts.length !== 3) return raw
    const [d, m, y] = parts
    const mm = months[m]
    if (!mm) return raw
    const date = new Date(`${y}-${mm}-${d.padStart(2, '0')}T12:00:00`)
    const diffMs = date.getTime() - Date.now()
    const diffDays = Math.round(diffMs / 86400000)
    const rtf = new Intl.RelativeTimeFormat('es-MX', { numeric: 'auto' })
    if (Math.abs(diffDays) < 30) return rtf.format(diffDays, 'day')
    const diffMonths = Math.round(diffDays / 30)
    if (Math.abs(diffMonths) < 12) return rtf.format(diffMonths, 'month')
    return rtf.format(Math.round(diffDays / 365), 'year')
  } catch {
    return raw
  }
}

// Heurística simple de estado: si la compra tiene >90 días → terminado
function orderBadge(raw: string): 'activo' | 'terminado' {
  try {
    const months: Record<string, string> = {
      ene: '01', feb: '02', mar: '03', abr: '04', may: '05', jun: '06',
      jul: '07', ago: '08', sep: '09', oct: '10', nov: '11', dic: '12',
    }
    const parts = raw.trim().toLowerCase().split(/\s+/)
    if (parts.length !== 3) return 'activo'
    const [d, m, y] = parts
    const mm = months[m]
    if (!mm) return 'activo'
    const date = new Date(`${y}-${mm}-${d.padStart(2, '0')}T12:00:00`)
    const diffDays = (Date.now() - date.getTime()) / 86400000
    return diffDays > 90 ? 'terminado' : 'activo'
  } catch {
    return 'activo'
  }
}

// Cadencia legible a partir de PEPTIDES
function cadenceLabel(name: string): string {
  const e = PEPTIDES[name]
  if (!e) return '—'
  switch (e.type) {
    case 'diaria': return 'Diaria'
    case 'semanal': return 'Semanal'
    case 'lv': return 'Lun / Vie'
    case 'ciclo': return `Ciclo ${e.on}/${e.off} sem`
    case 'cadaN': return `Cada ${e.n} días`
    case 'por-demanda': return 'Por demanda'
    default: return e.type
  }
}

// curPhase estimado a partir de la fecha de inicio: semanas transcurridas / semanas por fase
function estimatePhase(startEpoch: number, name: string): number {
  const entry = PEPTIDES[name]
  if (!entry || !entry.phases || !entry.phaseWeeks) return 0
  const weeksPassed = Math.floor((Date.now() - startEpoch) / (7 * 86400000))
  return Math.min(entry.phases - 1, Math.floor(weeksPassed / entry.phaseWeeks))
}

// Skeleton row
function SkeletonRow() {
  return (
    <div className="row" style={{ pointerEvents: 'none', opacity: 0.5 }}>
      <span className="row-ic">
        <span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 999, background: 'var(--ink-100)' }} />
      </span>
      <span className="row-main">
        <span className="row-label" style={{ background: 'var(--ink-100)', borderRadius: 4, color: 'transparent', width: 100, display: 'inline-block' }}>···</span>
        <span className="row-sub" style={{ background: 'var(--ink-100)', borderRadius: 4, color: 'transparent', width: 140, display: 'inline-block', marginTop: 4 }}>···</span>
      </span>
    </div>
  )
}

// ── Types ─────────────────────────────────────────────────────────────────────

type Phase = 'connect' | 'orders' | 'orders-config' | 'preview'

interface OrderConfig {
  startDate: string    // YYYY-MM-DD
  lastDose: 'hoy' | 'ayer' | 'hace2' | 'hace3' | 'hace4' | 'hace5' | 'hace6' | 'hace7'
  open: boolean
}

const lastDoseOptions: { key: OrderConfig['lastDose']; label: string }[] = [
  { key: 'hoy',   label: 'Hoy' },
  { key: 'ayer',  label: 'Ayer' },
  { key: 'hace2', label: 'Hace 2 días' },
  { key: 'hace3', label: 'Hace 3 días' },
  { key: 'hace4', label: 'Hace 4 días' },
  { key: 'hace5', label: 'Hace 5 días' },
  { key: 'hace6', label: 'Hace 6 días' },
  { key: 'hace7', label: 'Hace 7 días' },
]

function lastDoseOffsetDays(v: OrderConfig['lastDose']): number {
  switch (v) {
    case 'hoy':   return 0
    case 'ayer':  return 1
    case 'hace2': return 2
    case 'hace3': return 3
    case 'hace4': return 4
    case 'hace5': return 5
    case 'hace6': return 6
    case 'hace7': return 7
  }
}

function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Conectar cuenta BiohackMX → elegir de TUS compras cuáles estás usando y quieres trackear
export function Import() {
  const { dispatch } = useApp()
  const [phase, setPhase] = useState<Phase>('connect')
  const [consent, setConsent] = useState(false)
  const [sel, setSel] = useState<Set<string>>(new Set())

  // #112: estados de carga + error
  const [loading, setLoading] = useState(false)
  const [errored, setErrored] = useState(false)
  const [purchases, setPurchases] = useState<typeof MOCK_BIOHACKMX_PURCHASES | null>(null)

  // #108: configuración por producto
  const [configs, setConfigs] = useState<Record<string, OrderConfig>>({})

  const back = () => dispatch({ t: 'go', screen: 's-app' })

  const toggle = (p: string) =>
    setSel((s) => {
      const n = new Set(s)
      n.has(p) ? n.delete(p) : n.add(p)
      return n
    })

  // Simula la carga de pedidos al pasar a 'orders'
  function loadOrders() {
    setLoading(true)
    setErrored(false)
    setPurchases(null)
    // breve skeleton simulado (~700 ms)
    setTimeout(() => {
      // Simula 10 % de error para probar el estado de error:
      // en producción esto sería un fetch real
      const fail = false // cambia a `Math.random() < 0.1` para probar errores
      if (fail) {
        setLoading(false)
        setErrored(true)
      } else {
        setLoading(false)
        setPurchases(MOCK_BIOHACKMX_PURCHASES)
      }
    }, 700)
  }

  useEffect(() => {
    if (phase === 'orders' && purchases === null && !loading && !errored) {
      loadOrders()
    }
  }, [phase])

  const total = purchases?.length ?? 0
  const selList = [...sel]

  // #110: seleccionar / deseleccionar todo
  const allSelected = total > 0 && purchases !== null && selList.length === total
  function toggleAll() {
    if (!purchases) return
    if (allSelected) {
      setSel(new Set())
    } else {
      setSel(new Set(purchases.map((o) => o.product)))
    }
  }

  // Inicializa la configuración por producto con defaults
  function initConfigs(names: string[]) {
    const today = todayIso()
    const next: Record<string, OrderConfig> = {}
    for (const name of names) {
      next[name] = configs[name] ?? { startDate: today, lastDose: 'hoy', open: true }
    }
    setConfigs(next)
  }

  function patchConfig(name: string, patch: Partial<OrderConfig>) {
    setConfigs((c) => ({ ...c, [name]: { ...c[name], ...patch } }))
  }

  // Confirmar: importar + despachar updateProtocolFor por cada producto configurado
  function confirm() {
    dispatch({ t: 'importProducts', names: selList })
    for (const name of selList) {
      const cfg = configs[name]
      if (!cfg) continue
      const parsed = cfg.startDate ? new Date(cfg.startDate + 'T12:00:00').getTime() : NaN
      const startEpoch = Number.isFinite(parsed) ? parsed : Date.now()
      const curPhase = estimatePhase(startEpoch, name)
      dispatch({
        t: 'updateProtocolFor',
        product: name,
        patch: { startDate: startEpoch, curPhase },
      })
    }
    dispatch({ t: 'tab', tab: 'inicio' })
    dispatch({ t: 'go', screen: 's-app' })
    dispatch({ t: 'toast', msg: `${selList.length} producto(s) importado(s)` })
  }

  return (
    <div className="scroll" style={{ paddingBottom: 'max(32px, calc(16px + env(safe-area-inset-bottom, 0px)))' }}>
      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '16px 20px 8px', paddingTop: 'max(16px, env(safe-area-inset-top))', position: 'sticky', top: 0, background: 'var(--bg)', zIndex: 10 }}>
        <button className="iconbtn" onClick={phase === 'orders-config' ? () => setPhase('orders') : phase === 'preview' ? () => setPhase('orders-config') : back} aria-label="Regresar">
          <IcBack />
        </button>
        <span className="h2" style={{ margin: 0 }}>Conectar BiohackMX</span>
      </div>

      <div style={{ padding: '8px 20px 0', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <AnimatePresence mode="wait">

          {/* ── FASE 1: connect ── */}
          {phase === 'connect' && (
            <motion.div key="connect" variants={sharedAxisX} initial="initial" animate="animate" exit="exit" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, textAlign: 'center', padding: 28 }}>
                <div style={{ background: 'color-mix(in srgb, var(--brand-300) 16%, transparent)', borderRadius: 18, padding: 14 }}>
                  <BiohackmxFlask size={40} />
                </div>
                <div className="h2">Conecta tu cuenta de BiohackMX</div>
                <p className="body" style={{ margin: 0, color: 'var(--ink-700)' }}>
                  Trae tus compras para precargar tus productos. Inicias sesión en el sitio de BiohackMX;
                  nosotros nunca vemos tu contraseña.
                </p>
              </div>

              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer', userSelect: 'none' }}>
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  aria-describedby="consent-desc"
                  style={{ width: 20, height: 20, marginTop: 2, flexShrink: 0, accentColor: 'var(--brand-700)', cursor: 'pointer' }}
                />
                <span id="consent-desc" className="sm" style={{ color: 'var(--ink-700)', lineHeight: 1.5 }}>
                  Doy mi consentimiento para transferir los datos de mis compras de forma segura.
                </span>
              </label>

              <Disclaimer kind="general" />

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <button className="btn btn-brand" disabled={!consent} onClick={() => { setPhase('orders') }}
                  style={{ opacity: consent ? 1 : 0.45, cursor: consent ? 'pointer' : 'not-allowed', gap: 10 }}>
                  <BiohackmxFlask size={20} style={{ filter: 'brightness(0) invert(1)' }} />
                  Conectar con BiohackMX
                </button>
                <button className="btn btn-outline" onClick={back}>Lo agrego manualmente</button>
              </div>
            </motion.div>
          )}

          {/* ── FASE 2: orders ── */}
          {phase === 'orders' && (
            <motion.div key="orders" variants={sharedAxisX} initial="initial" animate="animate" exit="exit" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <div className="h2" style={{ marginBottom: 4 }}>Tus compras en BiohackMX</div>
                <p className="sm" style={{ margin: 0 }}>
                  Elige las que estás usando y quieres seguir. Omite las que ya se acabaron o ya no usas.
                </p>
              </div>

              {/* #110: chip seleccionar todo */}
              {!loading && !errored && purchases && purchases.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <motion.button
                    className="btn btn-outline btn-sm"
                    style={{ width: 'auto', padding: '0 14px', fontSize: 13 }}
                    aria-pressed={allSelected}
                    whileTap={{ scale: 0.95 }}
                    onClick={toggleAll}
                  >
                    {allSelected ? 'Deseleccionar todo' : 'Seleccionar todo'}
                  </motion.button>
                  <span aria-live="polite" className="sm" style={{ color: 'var(--ink-400)' }}>
                    Seleccionadas: {sel.size} de {total}
                  </span>
                </div>
              )}

              {/* Skeleton de carga */}
              {loading && (
                <motion.div className="rowlist card" style={{ padding: 0 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  {[0, 1, 2, 3].map((i) => <SkeletonRow key={i} />)}
                </motion.div>
              )}

              {/* Error */}
              {errored && (
                <EmptyState
                  glyph="efecto"
                  color="var(--ink-400)"
                  title="No encontramos compras recientes"
                  subtitle="Verifica tu conexión e intenta de nuevo."
                  cta={{ label: 'Reintentar', onClick: loadOrders }}
                />
              )}

              {/* Lista vacía */}
              {!loading && !errored && purchases && purchases.length === 0 && (
                <EmptyState
                  glyph="efecto"
                  color="var(--ink-400)"
                  title="No encontramos compras recientes"
                  subtitle="Intenta conectar de nuevo o agrega los productos manualmente."
                  cta={{ label: 'Reintentar', onClick: loadOrders }}
                />
              )}

              {/* Lista real */}
              {!loading && !errored && purchases && purchases.length > 0 && (
                <motion.div className="rowlist card" style={{ padding: 0 }} variants={staggerParent} initial="initial" animate="animate">
                  {purchases.map((o) => {
                    const on = sel.has(o.product)
                    const color = PEPTIDES[o.product] ? CATEGORY_COLOR[PEPTIDES[o.product].cat] : 'var(--brand-500)'
                    const badge = orderBadge(o.date)
                    return (
                      <motion.button key={o.product + o.orderId} className="row" onClick={() => toggle(o.product)} aria-pressed={on} variants={staggerItem}>
                        <span className="row-ic">
                          <span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 999, background: color }} />
                        </span>
                        <span className="row-main">
                          <span className="row-label">{o.product}</span>
                          <span className="row-sub" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            {/* #111: cadencia · fecha agrupadas (separador no huérfano) + badge aparte */}
                            <span>{cadenceLabel(o.product)} · {relDate(o.date)}</span>
                            <span
                              style={{
                                fontSize: 11, fontWeight: 600, letterSpacing: 0.3,
                                padding: '1px 6px', borderRadius: 99,
                                background: badge === 'activo' ? 'color-mix(in srgb, #2FB57C 18%, transparent)' : 'color-mix(in srgb, var(--ink-300) 30%, transparent)',
                                color: badge === 'activo' ? '#1a7a53' : 'var(--ink-400)',
                              }}
                            >
                              {badge}
                            </span>
                          </span>
                        </span>
                        <span className="row-end" style={{ display: 'flex', alignItems: 'center' }}>
                          <motion.span
                            style={{
                              width: 24, height: 24, borderRadius: 8, flexShrink: 0,
                              border: on ? '0' : '1.5px solid var(--ink-200)',
                              background: on ? 'var(--brand-700)' : 'transparent',
                              color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}
                            animate={{ scale: on ? 1 : 0.85, opacity: on ? 1 : 0 }}
                            transition={spring.ui}
                          >
                            {on && <IcCheck size={16} />}
                          </motion.span>
                        </span>
                      </motion.button>
                    )
                  })}
                </motion.div>
              )}

              <Disclaimer kind="general" />

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* #108 CTA progresivo: 'Seguir N' → 'Configurar' */}
                <button
                  className="btn btn-brand"
                  disabled={sel.size === 0}
                  onClick={() => { initConfigs(selList); setPhase('orders-config') }}
                  style={{ opacity: sel.size ? 1 : 0.45, cursor: sel.size ? 'pointer' : 'not-allowed' }}
                >
                  {sel.size === 0
                    ? 'Seguir seleccionadas'
                    : sel.size === 1
                    ? 'Configurar 1 producto'
                    : `Configurar ${sel.size} productos`}
                </button>
                <button className="btn btn-outline" onClick={back}>Lo agrego manualmente</button>
              </div>
            </motion.div>
          )}

          {/* ── FASE 3: orders-config ── */}
          {phase === 'orders-config' && (
            <motion.div key="orders-config" variants={sharedAxisX} initial="initial" animate="animate" exit="exit" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <div className="h2" style={{ marginBottom: 4 }}>Configura tu protocolo</div>
                <p className="sm" style={{ margin: 0 }}>
                  Indica cuándo empezaste y cuándo fue tu última dosis para cada producto.
                </p>
              </div>

              {selList.map((name) => {
                const cfg = configs[name] ?? { startDate: todayIso(), lastDose: 'hoy' as const, open: true }
                const color = PEPTIDES[name] ? CATEGORY_COLOR[PEPTIDES[name].cat] : 'var(--brand-500)'
                return (
                  <div key={name} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    {/* Header colapsable */}
                    <button
                      className="row"
                      style={{ border: 'none', background: 'transparent', width: '100%', cursor: 'pointer', padding: '14px 16px' }}
                      onClick={() => patchConfig(name, { open: !cfg.open })}
                      aria-expanded={cfg.open}
                    >
                      <span className="row-ic">
                        <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 999, background: color }} />
                      </span>
                      <span className="row-main">
                        <span className="row-label">{name}</span>
                        <span className="row-sub">{PEPTIDES[name]?.cat ?? ''} · {cadenceLabel(name)}</span>
                      </span>
                      <span className="row-end" style={{ display: 'flex', color: 'var(--ink-400)' }}>
                        <IcChevron size={18} style={{ transform: cfg.open ? 'rotate(90deg)' : 'none', transition: 'transform 0.18s' }} />
                      </span>
                    </button>

                    <AnimatePresence initial={false}>
                      {cfg.open && (
                        <motion.div
                          key="body"
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          style={{ overflow: 'hidden' }}
                        >
                          <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                            {/* (a) Fecha de inicio */}
                            <div>
                              <label className="sm" style={{ color: 'var(--ink-400)', display: 'block', marginBottom: 4 }}>
                                Fecha de inicio
                              </label>
                              <input
                                type="date"
                                value={cfg.startDate}
                                max={todayIso()}
                                onChange={(e) => patchConfig(name, { startDate: e.target.value })}
                                style={{
                                  border: '1.5px solid var(--ink-200)', borderRadius: 8,
                                  padding: '8px 12px', fontSize: 14, color: 'var(--ink-700)',
                                  background: 'var(--bg)', width: '100%', boxSizing: 'border-box',
                                }}
                              />
                            </div>

                            {/* (b) Última dosis — segmented */}
                            <div>
                              <span className="sm" style={{ color: 'var(--ink-400)', display: 'block', marginBottom: 6 }}>
                                Última dosis
                              </span>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                {lastDoseOptions.map((opt) => {
                                  const active = cfg.lastDose === opt.key
                                  return (
                                    <motion.button
                                      key={opt.key}
                                      whileTap={{ scale: 0.93 }}
                                      aria-pressed={active}
                                      onClick={() => patchConfig(name, { lastDose: opt.key })}
                                      style={{
                                        padding: '5px 12px', borderRadius: 99, fontSize: 13, fontWeight: active ? 600 : 400,
                                        border: active ? '0' : '1.5px solid var(--ink-200)',
                                        background: active ? color : 'transparent',
                                        color: active ? '#fff' : 'var(--ink-700)',
                                        cursor: 'pointer',
                                      }}
                                    >
                                      {opt.label}
                                    </motion.button>
                                  )
                                })}
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )
              })}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* CTA progresivo: 'Configurar' → 'Comenzar' (va a preview) */}
                <button className="btn btn-brand" onClick={() => setPhase('preview')}>
                  Vista previa →
                </button>
                <button className="btn btn-outline" onClick={() => setPhase('orders')}>
                  Editar selección
                </button>
              </div>
            </motion.div>
          )}

          {/* ── FASE 4: preview ── */}
          {phase === 'preview' && (
            <motion.div key="preview" variants={sharedAxisX} initial="initial" animate="animate" exit="exit" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <div className="h2" style={{ marginBottom: 4 }}>Confirma tu selección</div>
                <p className="sm" style={{ margin: 0 }}>
                  Estos productos se añadirán a tu protocolo activo.
                </p>
              </div>

              {/* #109: una tarjeta por producto con nombre, chip categoría, cadencia */}
              <motion.div style={{ display: 'flex', flexDirection: 'column', gap: 10 }} variants={staggerParent} initial="initial" animate="animate">
                {selList.map((name) => {
                  const entry = PEPTIDES[name]
                  const color = entry ? CATEGORY_COLOR[entry.cat] : 'var(--brand-500)'
                  const cfg = configs[name]
                  const parsedEpoch = cfg && cfg.startDate ? new Date(cfg.startDate + 'T12:00:00').getTime() : NaN
                  const startEpoch = Number.isFinite(parsedEpoch) ? parsedEpoch : Date.now()
                  const offsetDays = cfg ? lastDoseOffsetDays(cfg.lastDose) : 0
                  return (
                    <motion.div key={name} className="card" variants={staggerItem} style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 999, background: color, flexShrink: 0 }} />
                        <span className="row-label" style={{ flex: 1 }}>{name}</span>
                        {/* chip categoría */}
                        {entry && (
                          <span style={{
                            fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99,
                            background: color + '22', color,
                          }}>
                            {entry.cat}
                          </span>
                        )}
                      </div>
                      {/* Primario: cadencia. Secundario (inicio / última dosis / fase) agrupado y muted,
                          con cada par llevando su propio separador para que ningún '·' quede huérfano al envolver. */}
                      <div className="sm" style={{ color: 'var(--ink-700)', paddingLeft: 18 }}>
                        Cadencia: <b>{cadenceLabel(name)}</b>
                      </div>
                      {(cfg || entry?.phases) && (
                        <div className="sm" style={{ color: 'var(--ink-400)', paddingLeft: 18, display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 12 }}>
                          {cfg && (
                            <>
                              <span style={{ whiteSpace: 'nowrap' }}>Inicio: <b>{cfg.startDate}</b></span>
                              <span style={{ whiteSpace: 'nowrap' }}>· Última dosis: <b>{offsetDays === 0 ? 'Hoy' : `Hace ${offsetDays} día${offsetDays !== 1 ? 's' : ''}`}</b></span>
                            </>
                          )}
                          {entry?.phases && (
                            <span style={{ whiteSpace: 'nowrap' }}>· Fase estimada: <b>{estimatePhase(startEpoch, name) + 1} / {entry.phases}</b></span>
                          )}
                        </div>
                      )}
                    </motion.div>
                  )
                })}
              </motion.div>

              <Disclaimer kind="general" />

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* CTA final */}
                <button className="btn btn-brand" onClick={confirm}>
                  Comenzar {selList.length} producto{selList.length !== 1 ? 's' : ''}
                </button>
                <button className="btn btn-outline" onClick={() => setPhase('orders-config')}>
                  Editar configuración
                </button>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  )
}
