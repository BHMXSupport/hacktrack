// "Tus dosis de hoy" — checklist 1-tap: cada producto programado hoy con su dosis + botón "hecho".
// Sin escribir: la dosis viene de la fase activa o de la última registrada (doseForProduct).
import { useEffect, useRef, useState, useMemo, type ReactNode } from 'react'
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion'
import { useApp, doseForProduct, nextInjectionSite, siteLabel, isoKey } from '../lib/store'
import type { InjectionSite } from '../lib/types'
import { dayProducts, doseTakenOnProduct, doseSkippedOnProduct, loggedItemsForDay, upcomingDoses } from '../lib/calendar'
import { startOfDay, fmtTime } from '../lib/cadence'
import { doseToMg } from '../lib/calc'
import { tapHaptic } from '../lib/haptics'
import { PEPTIDES, CATEGORY_COLOR } from '../lib/catalog'
import { IcCheck, IcChevron, IcDrop } from './icons'
import { Glyph } from './glyphs'
import { staggerParent, staggerItem, spring, dur, ease } from '../lib/motion'
import { SiteSelector, NoteField, EffectPicker } from './DoseInputs'
import { Confetti, WeekHeatmap, LongPressButton } from './TodayDosesParts'
import { presenceNow } from '../lib/pharma'

// ── Loop 133: microcopy contextual por franja horaria ─────────────────────────
function getTimeGreeting(): { label: string; sub: string | null } {
  const h = new Date().getHours()
  if (h < 5) return { label: 'Protocolo del día', sub: null }
  if (h < 12) return { label: 'Buenos días — tus dosis de hoy', sub: null }
  if (h < 18) return { label: 'Tarde — ¿ya tomaste todo?', sub: null }
  return { label: 'Cierre del día', sub: null }
}

// ── Item 158: chip de franja del día ─────────────────────────────────────────
function getDaySlot(): { label: string; icon: ReactNode } {
  const h = new Date().getHours()
  if (h >= 6 && h < 12) return { label: 'Mañana · 6–12h', icon: <Glyph name="amanecer" size={13} color="currentColor" style={{ verticalAlign: '-2px', marginRight: 3 }} /> }
  if (h >= 12 && h < 18) return { label: 'Tarde · 12–18h', icon: <Glyph name="sol" size={13} color="currentColor" style={{ verticalAlign: '-2px', marginRight: 3 }} /> }
  if (h >= 18) return { label: 'Noche · 18–24h', icon: <Glyph name="sueno" size={13} color="currentColor" style={{ verticalAlign: '-2px', marginRight: 3 }} /> }
  return { label: 'Madrugada · 0–6h', icon: <Glyph name="sueno" size={13} color="currentColor" style={{ verticalAlign: '-2px', marginRight: 3 }} /> }
}

// ── Loop 137: semáforo de ventana de toma (inline — no toca cadence.ts) ────────
// verde ±0 dentro de la ventana (≤30 min), naranja (31–120 min), rojo (>120 min)
function windowStatus(tsScheduled: number, nowTs: number, takenTs?: number): 'ok' | 'near' | 'late' | null {
  if (takenTs !== undefined) return null // ya tomada → ocultar
  const diffMin = Math.abs(nowTs - tsScheduled) / 60000
  if (diffMin <= 30) return 'ok'
  if (diffMin <= 120) return 'near'
  return 'late'
}
const WINDOW_COLOR: Record<'ok' | 'near' | 'late', string> = {
  ok: 'var(--success)',
  near: 'var(--warning)',
  late: 'var(--error)',
}
const WINDOW_LABEL: Record<'ok' | 'near' | 'late', string> = {
  ok: 'En ventana',
  near: '±30 min',
  late: 'Tarde',
}

export function TodayDoses() {
  const { state, dispatch } = useApp()
  const today = startOfDay(new Date(state.todayTs))
  const prods = dayProducts(state, today)
  const [tick, setTick] = useState(0)

  // Loop 137: 30s ticker for window status refresh
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000)
    return () => clearInterval(id)
  }, [])

  // Loop 133: greeting computed once per render (hour changes rarely mid-session)
  const greeting = getTimeGreeting()

  // doneCount/allDone + hooks ANTES de cualquier early-return (regla de hooks de React)
  // Los productos con skip intencional se excluyen del denominador y no cuentan como pendientes.
  const skippedProds = prods.filter((p) => doseSkippedOnProduct(state, today, p))
  const activeProds = prods.filter((p) => !doseSkippedOnProduct(state, today, p))
  const doneCount = activeProds.filter((p) => doseTakenOnProduct(state, today, p)).length
  const allDone = activeProds.length > 0 && doneCount === activeProds.length
  const collapseKey = `hacktrack-doses-collapsed-${today.toISOString().slice(0, 10)}`
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return sessionStorage.getItem(collapseKey) === '1' } catch { return false }
  })
  // loop 140: producto esperando selección de zona de inyección
  const [pendingSiteProduct, setPendingSiteProduct] = useState<string | null>(null)
  // "Marcar todo" guiado: cola de productos pendientes de elegir sitio (uno a la vez, en el mismo flujo)
  const [siteQueue, setSiteQueue] = useState<string[]>([])
  const [siteQueueTotal, setSiteQueueTotal] = useState(0) // total inicial de la cola (para "dosis X de Y")
  // loop 138: nota borrador por producto (se mantiene hasta que se registra la dosis)
  const [noteByProduct, setNoteByProduct] = useState<Record<string, string>>({})
  // loop 139: producto cuya dosis recién registrada espera selección de efecto
  // (el id real se resuelve al despachar el efecto buscando el item más reciente de ese producto hoy)
  const [pendingEffectProduct, setPendingEffectProduct] = useState<string | null>(null)
  // Un solo efecto para la transición allDone (antes eran dos con refs separados → riesgo de doble disparo):
  // al completar todas las dosis, colapsa Y dispara la celebración una sola vez.
  const [showCelebration, setShowCelebration] = useState(false)
  const prevAllDone = useRef(allDone)
  useEffect(() => {
    if (allDone && !prevAllDone.current) {
      try { sessionStorage.setItem(collapseKey, '1') } catch { /* storage no disponible */ }
      setCollapsed(true)
      setShowCelebration(true)
      prevAllDone.current = allDone
      const t = setTimeout(() => setShowCelebration(false), 3000)
      return () => clearTimeout(t)
    }
    prevAllDone.current = allDone
  }, [allDone, collapseKey])

  // item 36: estado vacío diferenciado
  if (prods.length === 0) {
    const hasProtocols = Object.keys(state.protocols).length > 0
    if (!hasProtocols) return null
    // hay protocolos activos pero hoy no toca ninguna dosis
    const next = upcomingDoses(state, new Date(), 1)[0]
    return (
      <div className="card" style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, textAlign: 'center' }}>
        <Glyph name="sueno" size={28} color="var(--ink-300)" />
        <span className="body" style={{ fontWeight: 600, color: 'var(--ink-900)' }}>Hoy no toca ninguna dosis</span>
        {next && (
          <span className="sm" style={{ color: 'var(--ink-400)' }}>
            Próxima: <strong>{next.product}</strong> el {next.date.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' })}
          </span>
        )}
      </div>
    )
  }

  // ts de la toma a la hora reminderTime DE ESE producto (cada uno puede tener la suya)
  function tsFor(product: string): number {
    const rt = state.protocols[product]?.reminderTime || state.protocol?.reminderTime || '08:00'
    const [hh, mm] = rt.split(':').map(Number)
    const at = new Date(today)
    at.setHours(hh || 0, mm || 0, 0, 0)
    return at.getTime()
  }

  // n°434: 1-tap registra directo; solo long-press (500ms) abre DoseConfirm
  function markDone(product: string, force = false) {
    tapHaptic()
    const dose = doseForProduct(state, product)
    if (!dose) { dispatch({ t: 'sheet', sheet: 'registrar', arg: product }); return }
    if (force) {
      // long-press → abrir DoseConfirm siempre (para backfill o corrección horaria)
      const rec = state.productRecon[product]
      const doseMg = doseToMg(dose.value, dose.unit, rec?.vialMg, rec?.aguaMl) ?? undefined
      const scheduledTs = tsFor(product)
      const nowTs = Date.now()
      const suggestedSite = nextInjectionSite(state.lastInjectionSite?.[product])
      dispatch({ t: 'sheet', sheet: 'dose-confirm', arg: JSON.stringify({ product, value: dose.value, unit: dose.unit, doseMg, scheduledTs, nowTs, suggestedSite }) })
    } else {
      // tap normal → muestra selector de zona antes de registrar (sin forzar confirm)
      setPendingSiteProduct(product)
    }
  }

  // "Marcar todo" GUIADO: inicia un flujo donde eliges el sitio de inyección de CADA dosis, una a una.
  // No registra de golpe ni asigna un sitio random: pone en cola todas las dosis pendientes y abre el
  // selector de sitio de la primera; al elegir/omitir, commitDose registra esa dosis y avanza a la siguiente.
  function markAllDone() {
    tapHaptic()
    const pending = activeProds.filter(
      (p) => !doseTakenOnProduct(state, today, p) && doseForProduct(state, p) !== null,
    )
    if (pending.length === 0) return
    setSiteQueue(pending)
    setSiteQueueTotal(pending.length)
    setPendingSiteProduct(pending[0])
  }

  // loop 140 + 138 + 139: registra la dosis con o sin sitio/nota, luego pide efecto
  function commitDose(product: string, site?: InjectionSite) {
    const dose = doseForProduct(state, product)
    if (!dose) return
    const rec = state.productRecon[product]
    const doseMg = doseToMg(dose.value, dose.unit, rec?.vialMg, rec?.aguaMl) ?? undefined
    const scheduledTs = tsFor(product)
    const note = noteByProduct[product]?.trim() || undefined  // loop 138
    dispatch({ t: 'logDose', product, value: dose.value, unit: dose.unit, ts: scheduledTs, doseMg, site, note })
    // limpiar el borrador de nota de este producto
    setNoteByProduct((prev) => { const n = { ...prev }; delete n[product]; return n })
    if (siteQueue.length > 0) {
      // Flujo "Marcar todo" guiado: avanza al siguiente sitio (sin abrir el picker de efecto, para no cortar el flujo)
      const rest = siteQueue.filter((p) => p !== product)
      setSiteQueue(rest)
      setPendingSiteProduct(rest.length > 0 ? rest[0] : null)
    } else {
      // Flujo individual: cierra el selector y ofrece registrar el efecto post-dosis (loop 139)
      setPendingSiteProduct(null)
      setPendingEffectProduct(product)
    }
  }

  // loop 139: guarda el efecto en el logItem recién registrado para este producto
  function commitEffect(product: string, effect: string) {
    // busca el LogItem de dosis más reciente de hoy para este producto
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    const group = state.log.find((g) => g.dateKey === todayKey)
    const item = group?.items.find((it) => it.type === 'dose' && it.product === product)
    if (item) dispatch({ t: 'setLogEffect', id: item.id, effect })
    setPendingEffectProduct(null)
  }
  function undo(product: string) {
    tapHaptic()
    const item = loggedItemsForDay(state, today).find((it) => it.type === 'dose' && it.product === product)
    if (item) dispatch({ t: 'deleteLog', id: item.id })
  }
  function skipDose(product: string) {
    tapHaptic()
    dispatch({ t: 'logSkip', product })
  }
  function undoSkip(product: string) {
    tapHaptic()
    const item = loggedItemsForDay(state, today).find((it) => it.type === 'skip' && it.product === product)
    if (item) dispatch({ t: 'deleteLog', id: item.id })
  }

  // n°419: presencia farmacológica actual para cada producto
  const presenceByProduct = useMemo(() => {
    const map: Record<string, number> = {}
    try {
      const pres = presenceNow(state, Date.now())
      for (const p of pres) map[p.product] = p.pct
    } catch { /* pharma fallback */ }
    return map
  }, [state.log, state.protocols]) // eslint-disable-line react-hooks/exhaustive-deps

  // n°484: CTA "Retomar protocolo" cuando hay ≥3 dosis perdidas consecutivas (rango 7 días)
  const missedStreakCount = useMemo(() => {
    let missed = 0
    const todayD = startOfDay(new Date(state.todayTs))
    for (let i = 1; i <= 7; i++) {
      const d = new Date(todayD.getTime() - i * 86400000)
      const hasAnyDue = prods.length > 0
      if (!hasAnyDue) break
      const anyTaken = prods.some((p) => doseTakenOnProduct(state, d, p))
      const anySkipped = prods.some((p) => doseSkippedOnProduct(state, d, p))
      if (!anyTaken && !anySkipped) missed++
      else break
    }
    return missed
  }, [state.log, state.protocols, state.todayTs, prods]) // eslint-disable-line react-hooks/exhaustive-deps

  // color de la primera categoría activa para la barra de progreso
  const firstCat = PEPTIDES[prods[0]]?.cat ?? 'Explorar'
  const progressColor = allDone ? 'var(--success)' : (CATEGORY_COLOR[firstCat] ?? 'var(--brand-700)')

  // timestamp of last taken dose today (for done-state summary line)
  const lastDoneTs = (() => {
    if (!allDone) return null
    const items = loggedItemsForDay(state, today).filter((it) => it.type === 'dose')
    if (!items.length) return null
    return Math.max(...items.map((it) => it.ts))
  })()

  const prefersReduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  return (
    <LayoutGroup id="today-doses">
      <motion.section
        layout
        variants={staggerParent}
        initial="initial"
        animate="animate"
        className="card"
        style={{ padding: 0, overflow: 'hidden', position: 'relative' }}
      >
        {/* Loop 135: confetti overlay during celebration */}
        <AnimatePresence>
          {showCelebration && <Confetti key="confetti" />}
        </AnimatePresence>

        {/* Loop 133 + Loop 135: Header — celebrate or greeting */}
        <motion.div layout="position" style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '14px 16px 8px' }}>
          <AnimatePresence mode="wait" initial={false}>
            {showCelebration ? (
              <motion.span
                key="celebrate"
                className="sm"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                transition={{ duration: dur.base, ease: ease.decelerate }}
                style={{ fontWeight: 700, color: 'var(--success)', textTransform: 'uppercase', letterSpacing: 0.6 }}
              >
                ¡Todo listo por hoy!
              </motion.span>
            ) : allDone ? (
              <motion.span
                key="alldone"
                className="sm"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                transition={{ duration: dur.base, ease: ease.decelerate }}
                style={{ textTransform: 'uppercase', letterSpacing: 0.6, color: 'var(--success)', fontWeight: 700 }}
              >
                ¡Todo en orden hoy!
              </motion.span>
            ) : (
              // Loop 133: franja horaria
              <motion.span
                key="greeting"
                className="sm"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                transition={{ duration: dur.base, ease: ease.decelerate }}
                style={{ textTransform: 'uppercase', letterSpacing: 0.6, color: 'var(--ink-400)', fontWeight: 700 }}
              >
                {greeting.label}
              </motion.span>
            )}
          </AnimatePresence>
          <span className="sm mono" style={{ color: allDone ? 'var(--success)' : 'var(--ink-400)' }}>
            {doneCount}/{activeProds.length}
            {skippedProds.length > 0 && (
              <span style={{ color: 'var(--ink-300)', marginLeft: 4 }}>
                +{skippedProds.length} saltada{skippedProds.length !== 1 ? 's' : ''}
              </span>
            )}
          </span>
        </motion.div>

        {/* Item 158: Chip de franja del día — solo cuando aporta señal extra (dosis nocturna pendiente);
            de lo contrario es redundante con el saludo horario de la cabecera. */}
        {!allDone && (() => {
          const slot = getDaySlot()
          const nightSlot = slot.label.startsWith('Noche')
          const hasNocturnalDue = prods.some((p) => {
            const rt = state.protocols[p]?.reminderTime || state.protocol?.reminderTime
            if (!rt) return false
            const [hh] = rt.split(':').map(Number)
            return hh >= 18
          })
          if (!(nightSlot && hasNocturnalDue)) return null
          return (
            <div style={{ padding: '0 16px 8px' }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 99,
                background: 'var(--ink-100)', color: 'var(--ink-400)',
                border: '1.5px solid var(--brand-300)',
              }}>
                {slot.icon} {slot.label}
              </span>
            </div>
          )
        })()}

        {/* Loop 169: mini-heatmap 7×1 by product — only when expanded */}
        <AnimatePresence initial={false}>
          {!collapsed && (
            <motion.div
              key="heatmap"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: dur.base, ease: ease.decelerate }}
              style={{ overflow: 'hidden', padding: '0 16px 6px', display: 'flex', flexDirection: 'column', gap: 4 }}
            >
              {prods.map((product) => (
                <div key={product} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 9, color: 'var(--ink-400)', minWidth: 56, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{product}</span>
                  <WeekHeatmap product={product} state={state} today={today} />
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Barra de progreso */}
        <motion.div layout="position"
          role="progressbar"
          aria-valuenow={doneCount}
          aria-valuemax={activeProds.length}
          style={{ height: 3, background: 'var(--border)', margin: '0 0 2px' }}
        >
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: activeProds.length > 0 ? `${(doneCount / activeProds.length) * 100}%` : '0%' }}
            transition={prefersReduced ? { duration: 0 } : { duration: 0.4, ease: 'easeOut' }}
            style={{ height: '100%', background: progressColor, borderRadius: 999 }}
          />
        </motion.div>

        {/* Loop 134: Done-state colapsado */}
        <AnimatePresence initial={false}>
          {allDone && collapsed ? (
            <motion.div
              key="collapsed"
              layout
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: dur.base, ease: ease.decelerate }}
              style={{ overflow: 'hidden' }}
            >
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 16px', borderTop: '1px solid var(--border)',
              }}>
                <span className="sm" style={{ color: 'var(--success)', fontWeight: 600 }}>
                  {activeProds.length}/{activeProds.length} completadas
                  {lastDoneTs ? ` · hoy a las ${fmtTime(new Date(lastDoneTs))}` : ''}
                  {skippedProds.length > 0 ? ` · ${skippedProds.length} saltada${skippedProds.length !== 1 ? 's' : ''}` : ''}
                </span>
                <button
                  onClick={() => {
                    tapHaptic()
                    setCollapsed(false)
                    try { sessionStorage.removeItem(collapseKey) } catch {}
                  }}
                  aria-label="Ver dosis del día"
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--ink-400)', fontSize: 13, padding: '0 4px',
                    display: 'flex', alignItems: 'center', gap: 4,
                  }}
                >
                  <span style={{ display: 'inline-flex', transform: 'rotate(90deg)' }}><IcChevron size={13} /></span> Ver
                </button>
              </div>
            </motion.div>
          ) : (
            // Loop 136: LayoutGroup animation + Loop 137: semáforo
            // variants/initial/animate re-establecen la cascada de stagger: si no, al expandir con "Ver"
            // las tarjetas (variants=staggerItem) se quedan en initial (opacity 0) = en blanco hasta refrescar.
            <motion.div key="rows" variants={staggerParent} initial="initial" animate="animate">
              {/* Item 121: Registrar todo 1-tap */}
              {doneCount === 0 && siteQueue.length === 0 && activeProds.length > 0 && activeProds.every((p) => doseForProduct(state, p) !== null) && (
                <div style={{ padding: '10px 16px 6px', borderTop: '1px solid var(--border)' }}>
                  <button
                    onClick={markAllDone}
                    aria-label="Marcar todas las dosis de hoy como hechas"
                    style={{
                      width: '100%', height: 36, borderRadius: 999,
                      border: '1.5px solid var(--brand-300)',
                      background: 'color-mix(in srgb, var(--brand-500) 8%, transparent)',
                      color: 'var(--brand-700)', fontWeight: 600, fontSize: 13, cursor: 'pointer',
                    }}
                  >
                    Marcar todo como hecho · {activeProds.length} dosis
                  </button>
                </div>
              )}
              {prods
                .slice()
                .sort((a, b) => {
                  // done/skipped rows sink to bottom
                  const aResolved = (doseTakenOnProduct(state, today, a) || doseSkippedOnProduct(state, today, a)) ? 1 : 0
                  const bResolved = (doseTakenOnProduct(state, today, b) || doseSkippedOnProduct(state, today, b)) ? 1 : 0
                  return aResolved - bResolved
                })
                .map((product) => {
                  const taken = doseTakenOnProduct(state, today, product)
                  const skipped = doseSkippedOnProduct(state, today, product)
                  const dose = doseForProduct(state, product)
                  const cat = PEPTIDES[product]?.cat ?? 'Explorar'
                  const color = CATEGORY_COLOR[cat] ?? 'var(--brand-700)'

                  // item 32: hora de recordatorio
                  const hasReminder = !!(state.protocols[product]?.reminderTime || state.protocol?.reminderTime)
                  const reminderLabel = hasReminder ? fmtTime(new Date(tsFor(product))) : null

                  // Loop 137: window status (refreshes on 30s tick — tick used as render trigger)
                  void tick
                  const scheduled = tsFor(product)
                  const win = (!skipped && !taken) ? windowStatus(scheduled, Date.now(), undefined) : null

                  // loop 140: sitio sugerido para este producto
                  const suggestedSite = nextInjectionSite(state.lastInjectionSite?.[product])
                  const showSiteSelector = pendingSiteProduct === product && !taken && !skipped
                  // Sitio donde se inyectó la dosis de HOY (de la propia toma registrada, no del estado lastInjectionSite)
                  const doseSiteToday = taken
                    ? state.log.find((g) => g.dateKey === isoKey(state.todayTs))?.items
                        .find((it) => it.type === 'dose' && it.product === product && it.site)?.site
                    : undefined
                  // loop 139: mostrar picker de efecto si esta dosis acaba de ser registrada
                  const showEffectPicker = pendingEffectProduct === product && taken

                  // n°419: presencia estimada del péptido (solo si > 0 y no tomada hoy)
                  const presencePct = presenceByProduct[product] ?? 0

                  // n°433: swipe horizontal para marcar/desmarcar (estado local por producto)
                  // Se gestiona con drag inline en el botón Marcar

                  return (
                    <motion.div
                      key={product}
                      layout="position"   // Loop 136
                      layoutId={`dose-row-${product}`}
                      variants={staggerItem}
                      transition={spring.ui}
                      style={{
                        display: 'flex', flexDirection: 'column',
                        borderTop: '1px solid var(--border)',
                        // Loop 137: left-border semáforo; skip muestra borde neutro atenuado
                        borderLeft: skipped
                          ? '3px solid var(--border)'
                          : (!taken && win && hasReminder) ? `3px solid ${WINDOW_COLOR[win!]}` : '3px solid transparent',
                        // item 34 / skip: atenuar fila si tomada o saltada
                        opacity: (taken || skipped) ? 0.55 : 1,
                        transition: 'opacity 0.25s ease, border-left-color 0.3s ease',
                        position: 'relative', overflow: 'hidden',
                      }}
                    >
                      {/* Envoltura swipe: paneles + fila draggable juntos, para que el panel verde
                          (bottom:0, posicionado) NO se estire ni se pinte sobre los campos expandidos
                          (nota / sitio de inyección) que van debajo. */}
                      <div style={{ position: 'relative', overflow: 'hidden' }}>
                      {/* n°433: swipe-reveal panels */}
                      {!taken && !skipped && (
                        <div aria-hidden="true" style={{
                          position: 'absolute', left: 0, top: 0, bottom: 0, width: 72,
                          background: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 0,
                        }}>
                          <span style={{ color: '#fff', display: 'flex' }}><IcCheck size={22} /></span>
                        </div>
                      )}
                      {taken && (
                        <div aria-hidden="true" style={{
                          position: 'absolute', right: 0, top: 0, bottom: 0, width: 72,
                          background: 'var(--warning)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 0,
                        }}>
                          <span style={{ color: '#fff', fontWeight: 700, fontSize: 11 }}>Deshacer</span>
                        </div>
                      )}

                      {/* fila principal: icono + info + botones — draggable (n°433) */}
                      <motion.div
                        drag={!skipped ? 'x' : false}
                        dragConstraints={{ left: taken ? -80 : 0, right: taken ? 0 : 80 }}
                        dragElastic={0.12}
                        onDragEnd={(_, info) => {
                          if (!taken && info.offset.x > 48) { markDone(product) }
                          else if (taken && info.offset.x < -48) { undo(product) }
                        }}
                        style={{ position: 'relative', zIndex: 1, background: 'var(--card, var(--surface))' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px' }}>
                          {/* item 31: pill de categoría (gris si skip) */}
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, flexShrink: 0 }}>
                            <span style={{ width: 6, height: 6, borderRadius: 999, background: skipped ? 'var(--ink-300)' : color }} />
                            <span style={{ fontSize: 9, color: 'var(--ink-400)', lineHeight: 1, textAlign: 'center', maxWidth: 36, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cat}</span>
                          </div>

                          <div style={{ flex: 1, minWidth: 0 }}>
                            {/* item 34 / skip: line-through y texto diferenciado */}
                            <div className="body" style={{ fontWeight: 600, color: skipped ? 'var(--ink-400)' : 'var(--ink-900)', textDecoration: (taken || skipped) ? 'line-through' : 'none' }}>{product}</div>
                            <div className="sm mono" style={{ color: 'var(--ink-400)', display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', columnGap: 6, rowGap: 2, minWidth: 0 }}>
                              <span style={{ whiteSpace: 'nowrap' }}>
                                {skipped
                                  ? 'Saltada hoy (intencional)'
                                  : dose ? `${dose.value} ${dose.unit}` : 'Establece tu dosis'}
                              </span>
                              {/* item 32: hora del recordatorio (solo si no saltada) */}
                              {!skipped && reminderLabel && (
                                <span style={{ whiteSpace: 'nowrap' }}>· {reminderLabel}</span>
                              )}
                              {/* Loop 137: label de ventana */}
                              {!skipped && !taken && win && hasReminder && (
                                <span style={{ whiteSpace: 'nowrap', color: WINDOW_COLOR[win!], fontWeight: 600 }}>
                                  · {WINDOW_LABEL[win!]}
                                </span>
                              )}
                            </div>
                            {/* Sitio de inyección de hoy — visible en Inicio cuando la dosis está marcada */}
                            {taken && doseSiteToday && (
                              <div className="sm" style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 3, color: 'var(--ink-400)' }}>
                                <IcDrop size={12} />
                                <span style={{ whiteSpace: 'nowrap' }}>Inyectado en {siteLabel(doseSiteToday)}</span>
                              </div>
                            )}
                            {/* Item 119: badge ¡Perdida! cuando reminderTime ya pasó y no se ha tomado */}
                            {!taken && !skipped && hasReminder && Date.now() > tsFor(product) && (
                              <span style={{ display: 'inline-block', fontSize: 10, fontWeight: 700, background: 'color-mix(in srgb, var(--warning) 15%, transparent)', color: 'var(--warning)', padding: '1px 7px', borderRadius: 99, marginTop: 3 }}>¡Perdida!</span>
                            )}
                            {/* n°419: badge de presencia estimada (solo si hay presencia y no tomada hoy) */}
                            {!taken && !skipped && presencePct > 2 && (
                              <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                                <div style={{ width: 40, height: 3, borderRadius: 2, background: 'var(--ink-100)', overflow: 'hidden' }}>
                                  <div style={{ height: '100%', width: `${Math.min(100, presencePct)}%`, background: color, borderRadius: 2 }} />
                                </div>
                                <span style={{ fontSize: 9, color: 'var(--ink-400)' }}>
                                  {presencePct >= 50 ? 'presente' : presencePct >= 20 ? 'disminuyendo' : 'casi eliminado'} ~{Math.round(presencePct)}%
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Botones de acción: taken → deshacer; skipped → deshacer skip; pending → "Marcar" + "No hoy" */}
                          {skipped ? (
                            <button
                              onClick={() => undoSkip(product)}
                              aria-label={`Deshacer saltar ${product}`}
                              style={{
                                display: 'flex', alignItems: 'center', gap: 6, height: 34, padding: '0 12px', borderRadius: 999,
                                cursor: 'pointer', flexShrink: 0, fontWeight: 500, fontSize: 12,
                                border: '1.5px solid var(--border)', background: 'transparent', color: 'var(--ink-300)',
                              }}
                            >
                              Deshacer
                            </button>
                          ) : !dose ? (
                            // Protocolo recién agregado SIN dosis: una sola acción clara (configurar),
                            // en vez de "Marcar"/"No hoy" que se encimaban con "Establece tu dosis".
                            <button
                              onClick={() => dispatch({ t: 'sheet', sheet: 'registrar', arg: product })}
                              aria-label={`Configurar dosis de ${product}`}
                              style={{
                                flexShrink: 0, height: 36, padding: '0 14px', borderRadius: 999, cursor: 'pointer',
                                fontWeight: 600, fontSize: 13, border: '1.5px solid var(--brand-500)',
                                background: 'color-mix(in srgb, var(--brand-500) 8%, transparent)', color: 'var(--brand-700)',
                              }}
                            >
                              Configurar
                            </button>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                              {/* n°434: botón Marcar: tap directo; long-press 500ms → DoseConfirm */}
                              <LongPressButton
                                onTap={() => taken ? undo(product) : markDone(product)}
                                onLongPress={() => taken ? undo(product) : markDone(product, true)}
                                ariaLabel={taken ? `Deshacer ${product}` : `Marcar ${product} como hecho`}
                                active={taken}
                                color={color}
                              />
                            {!taken && (
                              <button
                                onClick={() => skipDose(product)}
                                aria-label={`No tomar ${product} hoy (intencional)`}
                                style={{
                                  height: 34, padding: '0 10px', borderRadius: 999,
                                  cursor: 'pointer', fontWeight: 500, fontSize: 12,
                                  border: '1.5px solid var(--border)', background: 'transparent', color: 'var(--ink-300)',
                                }}
                              >
                                No hoy
                              </button>
                            )}
                          </div>
                        )}
                        </div>
                      </motion.div>
                      </div>{/* /envoltura swipe */}

                      {/* Loop 138 + Loop 140: campo de nota + selector de zona (aparecen tras pulsar "Marcar") */}
                      <AnimatePresence>
                        {showSiteSelector && (
                          <>
                            <NoteField
                              key={`note-${product}`}
                              value={noteByProduct[product] ?? ''}
                              onChange={(v) => setNoteByProduct((prev) => ({ ...prev, [product]: v }))}
                            />
                            <SiteSelector
                              key={`site-${product}`}
                              suggested={suggestedSite}
                              onSelect={(site) => commitDose(product, site)}
                              onSkip={() => commitDose(product)}
                              progress={siteQueue.length > 0 ? { index: siteQueueTotal - siteQueue.length + 1, total: siteQueueTotal } : undefined}
                            />
                          </>
                        )}
                      </AnimatePresence>

                      {/* Loop 139: picker de efecto/síntoma post-dosis (aparece tras registrar) */}
                      <AnimatePresence>
                        {showEffectPicker && (
                          <EffectPicker
                            key={`effect-${product}`}
                            onSelect={(effect) => commitEffect(product, effect)}
                            onSkip={() => setPendingEffectProduct(null)}
                          />
                        )}
                      </AnimatePresence>
                    </motion.div>
                  )
                })}
            </motion.div>
          )}
        </AnimatePresence>

        {/* n°484: CTA "Retomar protocolo" cuando hay ≥3 dosis perdidas consecutivas */}
        <AnimatePresence>
          {missedStreakCount >= 3 && !allDone && (
            <motion.div
              key="retomar-cta"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              style={{ overflow: 'hidden' }}
            >
              <div style={{
                padding: '10px 16px', borderTop: '1px solid var(--border)',
                background: 'color-mix(in srgb, var(--warning) 6%, transparent)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <span className="sm" style={{ color: 'var(--warning)', fontWeight: 600 }}>
                  {missedStreakCount} días sin dosis registradas
                </span>
                <button
                  onClick={() => dispatch({ t: 'tab', tab: 'protocolo' })}
                  aria-label="Ir a la sección de protocolo para retomar"
                  style={{
                    marginLeft: 8, color: 'var(--brand-700)', fontWeight: 700, fontSize: 12,
                    background: 'none', border: '1.5px solid var(--brand-300)',
                    borderRadius: 999, padding: '3px 10px', cursor: 'pointer',
                    transition: 'background 0.15s ease',
                    display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0,
                  }}
                >
                  Retomar protocolo <IcChevron size={13} />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.section>
    </LayoutGroup>
  )
}
