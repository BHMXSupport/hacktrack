// Tab 'inicio' — dashboard de wellness premium "Quiet Signal".
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { motion, useReducedMotion, useMotionValue, animate, AnimatePresence } from 'framer-motion'
import { useApp, adherenceMonth, isoKey, computeStreak, injectionZoneRecency } from '../lib/store'
import { CATEGORY_COLOR, MEASURE_ICON, MEASURE_META, WDS, PEPTIDES, MEDIDAS_ONLY_MEASURES } from '../lib/catalog'
import { AdherenceRing } from '../components/AdherenceRing'
import { Disclaimer } from '../components/controls'
import { Sparkline, SparkBar } from '../components/charts'
import { Glyph } from '../components/glyphs'
import { IcClose, IcChevron } from '../components/icons'
import { UserAvatar, TrustChip } from '../components/identity'
import { TodayDoses } from '../components/TodayDoses'
import { ActiveNowChips } from '../components/ActiveNowChips'
import { InjectionMap } from '../components/InjectionMap'
import { LastDoseLine } from '../components/LastDoseLine'
import { dayProducts, upcomingDoses, productStreak, weekAdherencePctLast8, dayStatusEx, doseTakenOnProduct } from '../lib/calendar'
import { startOfDay, fmtTime } from '../lib/cadence'
import { presenceNow, collectDosesByProduct, HALF_LIFE_H, nextDoseWindow } from '../lib/pharma'
import { dur, ease, spring, staggerParent, staggerItem } from '../lib/motion'
import { weightProjection, weeklyInsights, protocolStartTs, litersFromMl, waterGoalLiters } from '../lib/nutrition'
import { vialDaysLeft, vialExpiryStatus, vialMgConsumed, vialMgRemaining, vialDosesRemaining } from '../lib/calc'
import { VIAL_SHELF_DAYS, DEFAULT_SHELF_DAYS } from '../lib/catalog'
import { StreakChip, ProductStreakBadge } from '../components/StreakChip'
import { CycleStatusCard } from '../components/CycleStatusCard'

// ── helpers ──────────────────────────────────────────────────────────────────

/** Diferencia en minutos entre dos fechas (at − now). */
function diffMinutes(at: Date, now: Date): number {
  return Math.round((at.getTime() - now.getTime()) / 60000)
}

/** Formatea la cuenta regresiva en texto legible. */
function fmtCountdown(at: Date, now: Date): string {
  const mins = diffMinutes(at, now)
  if (mins <= 0) return 'es ahora'
  if (mins < 60) return `en ${mins} min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h < 48) return m === 0 ? `en ${h}h` : `en ${h}h ${m}m`
  // ≥48h → mostrar en días (evita "en 8298h" / "en 138h")
  const d = Math.floor(h / 24)
  const rh = h % 24
  return rh === 0 ? `en ${d} d` : `en ${d} d ${rh}h`
}

/** ETA de la ventana de dosificación (PK): relativa, para que no parezca "hoy" cuando faltan días.
 *  La ventana del 25 % del pico de un péptido de vida media larga cae a varios días → mostrar solo la
 *  hora (fmtTime) era engañoso ("9:00 AM" parecía mañana cuando faltaban ~14 días). */
function fmtDoseWindowEta(ts: number, now: number = Date.now()): string {
  const ms = ts - now
  const days = Math.round(ms / 86_400_000)
  if (days >= 1) return `en ~${days} ${days === 1 ? 'día' : 'días'}`
  const h = Math.round(ms / 3_600_000)
  if (h >= 1) return `en ~${h} h`
  return `hoy ${fmtTime(new Date(ts))}`
}

/** Número hero para KPI card. */
function kpiHero(name: string, vals: Record<string, number>): string {
  const v = vals[name]
  if (v == null) return '—'
  return String(v)
}

/** Unidad para KPI card. */
function kpiUnit(name: string, vals: Record<string, number>): string {
  const v = vals[name]
  if (v == null) return ''
  const meta = MEASURE_META[name]
  if (!meta) return ''
  if (meta.kind === 'scale') return `/ ${meta.max}`
  return meta.unit ?? ''
}

/** Calcula los minutos totales hasta `at` desde `now` como número entero. */
function countdownMinutes(at: Date | null, now: Date): number {
  if (!at) return 0
  return Math.max(0, diffMinutes(at, now))
}

/** Count-up animado para un valor numérico: hook que retorna un motion.span. */
function useCountUp(value: number, skip: boolean) {
  const mv = useMotionValue(skip ? value : 0)
  const displayRef = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (skip) { mv.set(value); return }
    const ctrl = animate(mv, value, { duration: dur.slow, ease: ease.decelerate })
    const unsub = mv.on('change', (v) => {
      if (displayRef.current) displayRef.current.textContent = String(Math.round(v))
    })
    return () => { ctrl.stop(); unsub() }
  }, [value, skip]) // eslint-disable-line react-hooks/exhaustive-deps
  return displayRef
}

/** Delta KPI: diferencia entre los dos últimos valores de la serie. */
function kpiDelta(
  name: string,
  history: Record<string, { ts: number; value: number }[]>,
): { diff: number; positive: boolean } | null {
  const series = history[name]
  if (!series || series.length < 2) return null
  const sorted = [...series].sort((a, b) => a.ts - b.ts)
  const last = sorted[sorted.length - 1].value
  const prev = sorted[sorted.length - 2].value
  const diff = Math.round((last - prev) * 10) / 10
  if (diff === 0) return null
  const meta = MEASURE_META[name]
  const down = meta?.down ?? false
  // "positive" = buena dirección (verde); si down=true, positivo cuando diff<0
  const positive = down ? diff < 0 : diff > 0
  return { diff, positive }
}

/** Delta KPI desde inicio del protocolo. */
function kpiDeltaStart(
  name: string,
  history: Record<string, { ts: number; value: number }[]>,
  startTs: number | null,
): { diff: number; positive: boolean } | null {
  if (!startTs) return null
  const series = history[name]
  if (!series || series.length < 2) return null
  const sorted = [...series].sort((a, b) => a.ts - b.ts)
  const last = sorted[sorted.length - 1].value
  // primer valor desde el inicio del protocolo (o el más cercano antes)
  const fromStart = sorted.find((s) => s.ts >= startTs) ?? sorted[0]
  if (fromStart.ts === sorted[sorted.length - 1].ts) return null // solo una muestra
  const diff = Math.round((last - fromStart.value) * 10) / 10
  if (diff === 0) return null
  const meta = MEASURE_META[name]
  const down = meta?.down ?? false
  const positive = down ? diff < 0 : diff > 0
  return { diff, positive }
}

// ── componente ───────────────────────────────────────────────────────────────

export function Home() {
  const { state, dispatch } = useApp()
  const reduce = useReducedMotion() ?? false

  // Cuenta regresiva en tiempo real (refresca cada 30 s)
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(id)
  }, [])

  // ── Loop 163: Pull-to-refresh ────────────────────────────────────────────
  const [refreshing, setRefreshing] = useState(false)
  const pullY = useMotionValue(0)
  const scrollRef = useRef<HTMLDivElement>(null)
  const PULL_THRESHOLD = 60
  const handlePanStart = useCallback(() => { pullY.set(0) }, [pullY])
  const handlePan = useCallback((_e: PointerEvent, info: { delta: { y: number } }) => {
    // El scroller REAL es .scroll (overflow-y:auto), NO la ventana. window.scrollY siempre era 0 →
    // el guard nunca cortaba y el pull se procesaba a MITAD de página (acumulaba pullY al scrollear
    // hacia arriba) → disparaba refresh + re-render pesado = scroll "congelado". Ahora: solo en el tope.
    if (!scrollRef.current || scrollRef.current.scrollTop > 0) return
    const next = Math.max(0, Math.min(PULL_THRESHOLD * 1.5, pullY.get() + info.delta.y))
    pullY.set(next)
  }, [pullY])
  const handlePanEnd = useCallback(() => {
    if (pullY.get() >= PULL_THRESHOLD && !refreshing) {
      setRefreshing(true)
      pullY.set(0)
      // recomputar todayTs para forzar re-render de derivados
      dispatch({ t: 'tick' })
      setTimeout(() => setRefreshing(false), 800)
    } else {
      animate(pullY, 0, { duration: dur.fast })
    }
  }, [pullY, refreshing, dispatch])

  const today = new Date(state.todayTs)

  // Saludo
  const name = state.profile.name
  const greeting = name ? `Hola, ${name}` : 'Hola'

  // Fecha formateada
  const todayStr = today.toLocaleDateString('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  // Color de categoría activa
  const catColor = state.curGoal ? CATEGORY_COLOR[state.curGoal] : 'var(--brand-700)'

  // ¿hay dosis programadas hoy? → muestra el checklist "hecho hoy" en vez del countdown
  const hasDosesToday = dayProducts(state, startOfDay(now)).length > 0
  // Próxima toma con cuenta regresiva real — la MÁS CERCANA entre TODOS los productos activos
  const upNext = upcomingDoses(state, now, 1)[0]
  const at = upNext?.date ?? null
  const nextProduct = upNext?.product ?? ''
  const countdownText = at ? fmtCountdown(at, now) : null
  const isNow = at ? diffMinutes(at, now) <= 0 : false

  // ── Loop 152: count-up del countdown en minutos ──────────────────────────
  const countdownMins = countdownMinutes(at, now)
  // El count-up debe animar el NÚMERO MOSTRADO (días/horas/min), no los minutos crudos
  // (bug: animaba minutos en el slot de horas → "8298h" en vez de "5 d 18 h").
  const cdDays = Math.floor(countdownMins / 1440)
  const cdHours = Math.floor(countdownMins / 60)
  const countdownDisplay = countdownMins >= 2880 ? cdDays : countdownMins >= 60 ? cdHours : countdownMins
  const countdownRef = useCountUp(countdownDisplay, reduce || !at)

  // Adherencia real del MES (multi-producto: todas las dosis que tocarían este mes)
  const adh = adherenceMonth(state, now)

  // Tira semanal (L Ma Mi J V S D)
  const weekLabels = WDS.map(([l]) => l)
  // índice del día de hoy en WDS (L=0..D=6); getDay: 0=Dom→6, 1=Lun→0, 2=Mar→1, …, 6=Sáb→5
  // (bug previo: [1,2,3,4,5,6,0] desfasaba +2 → miércoles marcaba viernes)
  const todayWdsIdx = [6, 0, 1, 2, 3, 4, 5][today.getDay()]

  // KPI cards: máx 4 medidas seleccionadas
  // Excluye 'Altura' (estática) y % grasa/% músculo (se registran en "Cambio de medidas", no como card suelta).
  const kpiMeasures = state.selectedMeasures
    .filter((m) => m !== 'Altura' && !MEDIDAS_ONLY_MEASURES.includes(m))
    .slice(0, 4)

  // Estado para decidir si hay protocolo o no
  const hasProtocol = !!state.protocol

  // ── Loop 144 + 145: deltas KPI ───────────────────────────────────────────
  const protoStartTs = protocolStartTs(state)

  // ── Loop 148: modo compacto si >2 medidas ────────────────────────────────
  const compactMode = kpiMeasures.length > 2

  // ── Loop 159: Resumen semana colapsable ──────────────────────────────────
  const [weekSummaryOpen, setWeekSummaryOpen] = useState(false)
  // Densidad: historial largo + detalle secundario detrás de "Más detalle" (colapsado por defecto)
  const [moreDetailOpen, setMoreDetailOpen] = useState(false)
  // pip activo del carrusel de KPIs (compactMode) — reactivo al scroll (antes estaba hardcodeado a 0)
  const [kpiPip, setKpiPip] = useState(0)
  // memoizados: no dependen de `now`, así que no deben recalcular en cada tick de 30s
  const insights = useMemo(() => weeklyInsights(state), [state])
  const weekAdh = adh ? Math.round(adh.pct) : null

  // ── Loop 160: Card proyección de peso ────────────────────────────────────
  const proj = useMemo(() => weightProjection(state), [state])
  const showProjection = proj !== null && proj.etaTs !== null

  // ── Loop 161: Widget hidratación ─────────────────────────────────────────
  const todayKey = isoKey(state.todayTs)
  const waterTodayMl = state.nutrition[todayKey]?.water ?? 0  // ahora en MILILITROS (volumen)
  // hidratación en LITROS — Inicio es solo lectura; se registra desde Comida
  const waterL = litersFromMl(waterTodayMl)
  const waterGoalL = waterGoalLiters(state.profile.peso)
  const waterPct = waterGoalL > 0 ? (waterL / waterGoalL) * 100 : 0

  // ── Item 124: Glucosa en ayunas widget ───────────────────────────────────
  const hasMetabolismo = Object.values(state.protocols).some(
    (p) => PEPTIDES[p.product]?.cat === 'Metabolismo'
  )
  const glucosaHoy = useMemo(() => {
    const series = state.history['Glucosa ayunas']
    if (!series || series.length === 0) return null
    const sorted = [...series].sort((a, b) => b.ts - a.ts)
    const d = new Date(sorted[0].ts)
    const todayD = new Date(state.todayTs)
    if (d.toDateString() === todayD.toDateString()) return sorted[0].value
    return null
  }, [state.history, state.todayTs])
  // serie de glucosa para el chart (Inicio solo muestra; se registra en Comida)
  const glucosaSeries = useMemo(
    () => [...(state.history['Glucosa ayunas'] ?? [])].sort((a, b) => a.ts - b.ts),
    [state.history],
  )
  // recencia por zona de inyección (memoizada; recomputa al cambiar el log o el día)
  const injectionZones = useMemo(() => injectionZoneRecency(state), [state.log, state.todayTs])
  const hasInjectionUse = useMemo(
    () => state.log.some((g) => g.items.some((it) => it.type === 'dose' && it.site)),
    [state.log],
  )

  // ── Item 156: sugerencia post-dosis Metabolismo ───────────────────────────
  const [showPesoSuggestion, setShowPesoSuggestion] = useState(false)
  const prevLogLenRef = useRef(0)
  useEffect(() => {
    const currentLen = state.log.reduce((s, g) => s + g.items.length, 0)
    if (currentLen <= prevLogLenRef.current) {
      prevLogLenRef.current = currentLen
      return
    }
    prevLogLenRef.current = currentLen
    // Check if the latest item is a Metabolismo dose
    const latest = state.log[0]?.items[0]
    if (!latest || latest.type !== 'dose') return
    const cat = PEPTIDES[latest.product ?? '']?.cat
    if (cat !== 'Metabolismo') return
    // Check last Peso entry
    const pesoSeries = state.history['Peso'] ?? []
    if (pesoSeries.length === 0) return
    const lastPesoTs = Math.max(...pesoSeries.map((s) => s.ts))
    const daysSincePeso = (Date.now() - lastPesoTs) / 86400000
    if (daysSincePeso < 6) return
    // Max once per 7 days (use sessionStorage to avoid multiple)
    try {
      const key = 'peso-suggest-ts'
      const last = sessionStorage.getItem(key)
      if (last && Date.now() - Number(last) < 7 * 86400000) return
      sessionStorage.setItem(key, String(Date.now()))
    } catch { /* noop */ }
    setShowPesoSuggestion(true)
  }, [state.log])

  // ── Loop 166: Widget de nivel de vial ────────────────────────────────────
  // Para cada producto trackeado que tenga reconstitución + reconDate registradas,
  // estima mg restantes y dosis restantes. Solo aparece si hay reconstitución registrada.
  const vialWidgets = useMemo(() => {
    return state.importedProducts.flatMap((product) => {
      const recon = state.productRecon?.[product]
      if (!recon?.vialMg || !recon?.aguaMl || !recon?.reconDate) return []
      const { vialMg, reconDate } = recon
      const shelfDays = VIAL_SHELF_DAYS[product] ?? DEFAULT_SHELF_DAYS
      const daysLeft = vialDaysLeft(reconDate, shelfDays)
      const consumed = vialMgConsumed(state.log, product, reconDate)
      const remaining = vialMgRemaining(vialMg, consumed)
      const fillPct = Math.max(0, Math.min(100, (remaining / vialMg) * 100))
      // Dosis típica: la doseMg del registro más reciente para este producto después de reconDate
      let lastDoseMg: number | null = null
      let lastDoseTs = -1
      for (const g of state.log) {
        for (const it of g.items) {
          if (it.type === 'dose' && it.product === product && it.ts >= reconDate && it.doseMg != null && it.doseMg > 0) {
            if (it.ts > lastDoseTs) { lastDoseTs = it.ts; lastDoseMg = it.doseMg }
          }
        }
      }
      const dosesLeft = vialDosesRemaining(remaining, lastDoseMg ?? 0)
      // Fecha estimada de próxima reconstitución: reconDate + shelfDays, o cuando se agote (si antes)
      const expiryTs = reconDate + shelfDays * 86_400_000
      const expiryDate = new Date(expiryTs)
      const expiryStr = expiryDate.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
      const expiryStatus = vialExpiryStatus(daysLeft)
      return [{ product, vialMg, remaining, fillPct, dosesLeft, expiryStr, expiryStatus, daysLeft }]
    })
  }, [state.productRecon, state.log, state.importedProducts, state.todayTs]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Item 131: racha global compositeStreak ───────────────────────────────
  const compositeStreak = useMemo(() => computeStreak(state.log, today), [state.log, state.todayTs]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Item 132: racha por producto (para los chips de protocolo) ───────────
  const productStreaks = useMemo(() =>
    state.importedProducts.reduce<Record<string, number>>((acc, p) => {
      acc[p] = productStreak(state, p, today)
      return acc
    }, {}),
  [state.log, state.protocols, state.todayTs]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Item 155: tira semanal con dayStatusEx (rest vs missed) ─────────────
  const weekStatusEx = useMemo(() =>
    Array.from({ length: 7 }, (_, idx) => {
      const dayOffset = idx - todayWdsIdx
      const d = new Date(today)
      d.setDate(today.getDate() + dayOffset)
      return dayStatusEx(state, d, now)
    }),
  [state.log, state.protocols, state.todayTs, now]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Item 157: sparkbar adherencia últimas 8 semanas ─────────────────────
  const weekAdh8 = useMemo(() => weekAdherencePctLast8(state, today),
    [state.log, state.protocols, state.todayTs]) // eslint-disable-line react-hooks/exhaustive-deps
  const hasWeekAdh8 = weekAdh8.some((v) => v !== null)

  // ── Item 154: ciclo on/off — protocolos con cadencia tipo ciclo ──────────
  const cycleProtocols = useMemo(() =>
    Object.values(state.protocols).filter((p) => p.cadence.mode === 'ciclo'),
  [state.protocols])

  // ── Loop 153: Barra de ventana de toma ───────────────────────────────────
  // Ventana de ±30min alrededor del horario de toma
  const windowMinutes = 30
  const minsUntilDose = at ? diffMinutes(at, now) : null
  const inWindow = minsUntilDose !== null && Math.abs(minsUntilDose) <= windowMinutes
  // posición 0..1 dentro de la barra: 0=–window, 0.5=exact, 1=+window
  const barPos = minsUntilDose !== null
    ? Math.max(0, Math.min(1, (windowMinutes - minsUntilDose) / (windowMinutes * 2)))
    : 0

  // ── n°366: banner de ventana horaria típica por patrón real del log ──────
  // Detecta la hora modal de toma de cada producto; si ya pasó sin registro, muestra banner.
  const typicalWindowAlert = useMemo((): { product: string; minsAgo: number } | null => {
    const todayD = startOfDay(new Date(state.todayTs))
    for (const product of state.importedProducts) {
      // Si ya se tomó hoy → skip
      if (doseTakenOnProduct(state, todayD, product)) continue
      // Recopilar horas (en minutos desde medianoche) del historial de este producto
      const doses: number[] = []
      for (const g of state.log) {
        for (const it of g.items) {
          if (it.type === 'dose' && it.product === product && it.ts) {
            const d = new Date(it.ts)
            const dDate = startOfDay(d)
            if (dDate.getTime() !== todayD.getTime()) {
              doses.push(d.getHours() * 60 + d.getMinutes())
            }
          }
        }
      }
      if (doses.length < 3) continue // necesita al menos 3 registros para detectar patrón
      // Calcular hora modal: redondear al bloque de 30 min y tomar la más frecuente
      const buckets: Record<number, number> = {}
      for (const m of doses) { const b = Math.round(m / 30) * 30; buckets[b] = (buckets[b] ?? 0) + 1 }
      const [modalBucket] = Object.entries(buckets).sort((a, b) => b[1] - a[1])[0]
      const typicalMins = Number(modalBucket)
      const nowMins = now.getHours() * 60 + now.getMinutes()
      const minsAgo = nowMins - typicalMins
      if (minsAgo >= 30 && minsAgo <= 240) { // ventana: 30 min–4h después de la hora habitual
        return { product, minsAgo }
      }
    }
    return null
  }, [state.log, state.importedProducts, state.todayTs, now]) // eslint-disable-line react-hooks/exhaustive-deps
  const [dismissedWindowAlert, setDismissedWindowAlert] = useState<string | null>(null)

  // ── n°394: Cierre del día — tarjeta inline a las 22:00+ si hay ≥1 dosis ─
  // (Omite notificaciones nativas; muestra inline cuando el usuario abre la app)
  const nowH = now.getHours()
  const loggedToday = useMemo(() => {
    const todayD = startOfDay(new Date(state.todayTs))
    return state.log.some((g) =>
      g.items.some((it) => it.type === 'dose' && doseTakenOnProduct(state, todayD, it.product ?? ''))
    )
  }, [state.log, state.todayTs]) // eslint-disable-line react-hooks/exhaustive-deps
  const showDayClosure = nowH >= 22 && loggedToday
  const [dayClosed, setDayClosed] = useState(false)
  const [dayNote, setDayNote] = useState('')

  // ── n°420: Semáforo de seguridad anti-doble-dosis ─────────────────────────
  // Para cada producto activo: tiempo desde última dosis + ventana next dose (PK)
  const dosingSemaphores = useMemo(() => {
    const results: Array<{
      product: string
      lastDoseTs: number | null
      nextSafeTs: number | null
      status: 'red' | 'yellow' | 'green'
    }> = []
    const dosesByProduct = collectDosesByProduct(state)
    for (const product of state.importedProducts) {
      const doses = dosesByProduct.get(product) ?? []
      const lastDose = doses.length > 0 ? [...doses].sort((a, b) => b.ts - a.ts)[0] : null
      const hl = HALF_LIFE_H[product]
      const halfMs = hl ? hl * 3600000 : null
      let nextSafeTs: number | null = null
      if (halfMs && doses.length > 0) {
        try { nextSafeTs = nextDoseWindow(doses as any, halfMs) } catch { /* skip */ }
      }
      const nowTs = Date.now()
      let status: 'red' | 'yellow' | 'green' = 'green'
      if (nextSafeTs !== null) {
        const minsUntilSafe = (nextSafeTs - nowTs) / 60000
        if (minsUntilSafe > 60) status = 'red'
        else if (minsUntilSafe > 0) status = 'yellow'
        else status = 'green'
      } else if (lastDose) {
        // sin PK data: compara con interval de cadencia
        const prot = state.protocols[product]
        const intervalH = prot?.cadence?.mode === 'cadaN' ? (prot.cadence.n ?? 24) : 24
        const hSinceLastDose = (nowTs - lastDose.ts) / 3600000
        if (hSinceLastDose < intervalH * 0.5) status = 'red'
        else if (hSinceLastDose < intervalH * 0.8) status = 'yellow'
        else status = 'green'
      }
      results.push({ product, lastDoseTs: lastDose?.ts ?? null, nextSafeTs, status })
    }
    return results
  }, [state.log, state.importedProducts, state.protocols]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── n°427: Atajo a CalcSheet si algún producto tiene reconstitución ────────
  const hasRecon = state.importedProducts.some((p) => {
    const r = state.productRecon?.[p]
    return r?.vialMg && r?.aguaMl
  })

  // ── n°455: Heatmap 13 semanas × 7 días ────────────────────────────────────
  const heatmapData = useMemo(() => {
    const todayD = startOfDay(new Date(state.todayTs))
    const rows: Array<{ date: Date; count: number; isFuture: boolean }[]> = []
    for (let w = 12; w >= 0; w--) {
      const week: { date: Date; count: number; isFuture: boolean }[] = []
      for (let d = 0; d < 7; d++) {
        const offset = -(w * 7 + (6 - d))
        const date = new Date(todayD.getTime() + offset * 86400000)
        const isFuture = date > todayD
        let count = 0
        if (!isFuture) {
          for (const g of state.log) {
            for (const it of g.items) {
              if (it.ts) {
                const itDate = startOfDay(new Date(it.ts))
                if (itDate.getTime() === date.getTime()) count++
              }
            }
          }
        }
        week.push({ date, count, isFuture })
      }
      rows.push(week)
    }
    return rows
  }, [state.log, state.todayTs]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── n°466: Cockpit de stack completo ──────────────────────────────────────
  const stackCockpit = useMemo(() => {
    try {
      const presences = presenceNow(state, Date.now())
      const presMap: Record<string, number> = {}
      for (const p of presences) presMap[p.product] = p.pct
      return state.importedProducts.map((product) => {
        const prot = state.protocols[product]
        const cat = PEPTIDES[product]?.cat ?? '—'
        const catColor2 = CATEGORY_COLOR[cat] ?? 'var(--brand-500)'
        const pct = presMap[product] ?? 0
        const upcoming = upcomingDoses(state, now, 1).find((u) => u.product === product)
        return { product, cat, catColor: catColor2, pct, nextDose: upcoming?.date ?? null }
      })
    } catch { return [] }
  }, [state.protocols, state.log, state.importedProducts, state.todayTs]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── n°470: Mini-check matutino (primeras 2h del día, sin registros aún) ───
  const [morningCheckDone, setMorningCheckDone] = useState(false)
  const [morningAnswers, setMorningAnswers] = useState<Record<string, number>>({})
  const isEarlyMorning = nowH < 10  // hasta las 10 AM
  const morningCheckMeasures = state.selectedMeasures.filter((m) => m !== 'Altura').slice(0, 3)
  const hasMorningData = morningCheckMeasures.every((m) => {
    const series = state.history[m] ?? []
    if (series.length === 0) return false
    const last = Math.max(...series.map((s) => s.ts))
    const todayD = startOfDay(new Date(state.todayTs))
    return new Date(last) >= todayD
  })
  const showMorningCheck = isEarlyMorning && !hasMorningData && morningCheckMeasures.length > 0 && !morningCheckDone

  return (
    <div className="scroll has-nav" ref={scrollRef}>
      {/* ── Loop 163: Pull-to-refresh spinner ─────────────────────────────── */}
      <AnimatePresence>
        {refreshing && (
          <motion.div
            key="ptr-spinner"
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: dur.fast }}
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: 8,
              left: 0,
              right: 0,
              display: 'flex',
              justifyContent: 'center',
              gap: 6,
              zIndex: 10,
              pointerEvents: 'none',
            }}
          >
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                animate={{ scale: [1, 1.4, 1], opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: 'var(--brand-500)',
                  display: 'block',
                }}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        variants={staggerParent}
        initial="initial"
        animate="animate"
        onPanStart={handlePanStart}
        onPan={handlePan as Parameters<typeof motion.div>[0]['onPan']}
        onPanEnd={handlePanEnd as Parameters<typeof motion.div>[0]['onPanEnd']}
        style={{ padding: '24px 20px 40px', display: 'flex', flexDirection: 'column', gap: 20 }}
      >

        {/* Item 156: Sugerencia contextual de Peso tras dosis Metabolismo */}
        <AnimatePresence>
          {showPesoSuggestion && (
            <motion.div
              key="peso-suggestion"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              style={{
                background: 'color-mix(in srgb, var(--brand-500) 10%, transparent)',
                border: '1px solid var(--brand-300)',
                borderRadius: 'var(--r-md)', padding: '10px 14px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
              }}
            >
              <p className="sm" style={{ margin: 0, color: 'var(--ink-700)', flex: 1 }}>
                ¿Anotas tu peso hoy? Llevas varios días sin medirlo.
              </p>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button
                  className="sm"
                  style={{ fontWeight: 600, color: 'var(--brand-700)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px' }}
                  onClick={() => {
                    dispatch({ t: 'sheet', sheet: 'medida' })
                    setShowPesoSuggestion(false)
                  }}
                >
                  Registrar
                </button>
                <button
                  className="sm"
                  style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--ink-400)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px' }}
                  onClick={() => setShowPesoSuggestion(false)}
                  aria-label="Cerrar sugerencia"
                >
                  <IcClose size={14} />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── 1. Cabecera: saludo + avatar + trust chip ────────────────── */}
        <motion.section
          variants={staggerItem}
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
            <p
              className="sm"
              style={{ color: 'var(--ink-400)', textTransform: 'capitalize', margin: 0 }}
            >
              {todayStr}
            </p>
            <h1
              className="h1"
              style={{ margin: 0, lineHeight: 1.1, wordBreak: 'break-word' }}
            >
              {greeting}
            </h1>
            {/* Micro-chip de confianza + racha global (item 131) */}
            <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <TrustChip onClick={() => dispatch({ t: 'sheet', sheet: 'perfil' })} />
              <StreakChip streak={compositeStreak} />
            </div>
          </div>

          {/* Avatar — desplazado a la izquierda para no chocar con el engranaje global */}
          <div style={{ marginRight: 44, flexShrink: 0 }}>
            <UserAvatar size={48} tone="filled" />
          </div>
        </motion.section>

        {/* ── 1a. Adherencia (primero) — 30 días + tira semanal ───────────────── */}
        <motion.section
          variants={staggerItem}
          className="card"
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '28px 20px 20px' }}
        >
          <h2
            className="body"
            style={{ fontWeight: 600, color: 'var(--ink-700)', marginBottom: 20, textAlign: 'center' }}
          >
            Adherencia · este mes
          </h2>

          {adh && adh.due === 0 ? (
            <div
              style={{
                width: 152, height: 152, borderRadius: '50%', border: '11px solid var(--ink-100)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, textAlign: 'center',
              }}
            >
              <span className="h2" style={{ margin: 0 }}>{adh.scheduled}</span>
              <span className="sm" style={{ color: 'var(--ink-400)', maxWidth: 110, lineHeight: 1.3 }}>
                dosis este mes · aún sin vencer
              </span>
            </div>
          ) : adh ? (
            <>
              <AdherenceRing
                value={adh.pct}
                goal={100}
                size={152}
                stroke={11}
                label="adherencia"
                unit="%"
              />
              <p className="sm" style={{ color: 'var(--ink-400)', textAlign: 'center', marginTop: 10 }}>
                {adh.taken} de {adh.due} tomadas · {adh.scheduled} este mes
              </p>
              {(adh.missed > 0 || adh.upcoming > 0) && (
                <div style={{ display: 'flex', gap: 14, marginTop: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                  {adh.missed > 0 && (
                    <span className="sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--error)' }}>
                      <span style={{ width: 7, height: 7, borderRadius: 999, background: 'var(--error)' }} />
                      {adh.missed} perdida{adh.missed === 1 ? '' : 's'}
                    </span>
                  )}
                  {adh.upcoming > 0 && (
                    <span className="sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--ink-400)' }}>
                      <span style={{ width: 7, height: 7, borderRadius: 999, background: 'var(--ink-300)' }} />
                      {adh.upcoming} próxima{adh.upcoming === 1 ? '' : 's'}
                    </span>
                  )}
                </div>
              )}
            </>
          ) : (
            <div
              style={{
                width: 152, height: 152, borderRadius: '50%', border: '11px solid var(--ink-100)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
              }}
            >
              <span className="sm" style={{ color: 'var(--ink-300)', textAlign: 'center', maxWidth: 100, lineHeight: 1.3 }}>
                Sin protocolo aún
              </span>
            </div>
          )}

          {/* ── Tira semanal — Loop 156 + Item 155: rest vs missed ──────── */}
          <div
            style={{ display: 'flex', gap: 6, marginTop: 24, justifyContent: 'center', width: '100%' }}
          >
            {weekLabels.map((label, idx) => {
              const stEx = weekStatusEx[idx]
              const filled = stEx === 'taken'
              const isToday = idx === todayWdsIdx
              const dayOffset = idx - todayWdsIdx
              const dayDate = new Date(today)
              dayDate.setDate(today.getDate() + dayOffset)
              const dayStr = dayDate.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })
              // 'rest' = día de descanso por cadencia; 'missed' = tocaba y faltó
              const isRest = stEx === 'rest'
              const isMissed = stEx === 'missed'
              const estado = filled
                ? 'completado'
                : isRest
                ? 'descanso'
                : isMissed
                ? 'incompleto'
                : isToday
                ? 'hoy, sin completar'
                : 'sin completar'
              // colores: tomado=catColor, descanso=ink-100(muy tenue), incompleto=warning tenue, hoy=catColor 30%
              const dotBg = filled
                ? catColor
                : isMissed
                ? 'color-mix(in srgb, var(--warning) 35%, transparent)'
                : isRest
                ? 'var(--ink-100)'
                : isToday
                ? `color-mix(in srgb, ${catColor} 30%, transparent)`
                : 'var(--ink-100)'
              const dotBorder = isMissed
                ? 'color-mix(in srgb, var(--warning) 60%, transparent)'
                : isToday
                ? catColor
                : 'transparent'
              return (
                <div
                  key={label}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, flex: 1, minWidth: 0 }}
                >
                  <span
                    className="sm"
                    style={{ fontSize: 10, fontWeight: isToday ? 700 : 400, color: isToday ? catColor : 'var(--ink-400)', letterSpacing: 0.2 }}
                  >
                    {label}
                  </span>
                  <div
                    style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, paddingBottom: 8 }}
                    aria-label={`${dayStr} — ${estado}`}
                  >
                    {/* Loop 156: spring celebrate cuando el día actual se completa; stagger fade-in días pasados */}
                    <motion.div
                      animate={{
                        backgroundColor: dotBg,
                        scale: (isToday && filled && !reduce) ? [0.6, 1.12, 1] : (idx < todayWdsIdx && filled && !reduce) ? [0.8, 1] : 1,
                      }}
                      transition={isToday && filled ? spring.celebrate : { duration: dur.fast }}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: '50%',
                        border: `2px solid ${dotBorder}`,
                      }}
                    />
                    {isToday && filled && (
                      <div
                        aria-hidden="true"
                        style={{ width: 4, height: 4, borderRadius: '50%', background: '#fff', position: 'absolute', bottom: 0 }}
                      />
                    )}
                    {/* punto de descanso — guión muy pequeño */}
                    {isRest && !isToday && (
                      <div
                        aria-hidden="true"
                        style={{ width: 6, height: 2, borderRadius: 999, background: 'var(--ink-200)', position: 'absolute', bottom: 1 }}
                      />
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* ── Leyenda rest/missed (solo si hay protocolo con cadencia no-diaria) ── */}
          {hasProtocol && (
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 10, flexWrap: 'wrap' }} aria-hidden="true">
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--ink-300)' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--ink-100)', border: '1px solid var(--ink-200)', display: 'block' }} />
                descanso
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--ink-400)' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'color-mix(in srgb, var(--warning) 35%, transparent)', border: '1px solid color-mix(in srgb, var(--warning) 60%, transparent)', display: 'block' }} />
                incompleto
              </span>
            </div>
          )}

          {/* ── Item 157: Sparkbar de adherencia últimas 8 semanas ─────── */}
          {hasWeekAdh8 && (
            <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <p className="sm" style={{ margin: 0, color: 'var(--ink-400)', fontSize: 10, letterSpacing: 0.3 }}>
                Adherencia · últimas 8 semanas
              </p>
              <SparkBar data={weekAdh8} color={catColor} barW={11} barMaxH={32} gap={4} />
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }} aria-hidden="true">
                <span style={{ fontSize: 9, color: 'var(--ink-300)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: catColor, display: 'block' }} />≥80%
                </span>
                <span style={{ fontSize: 9, color: 'var(--ink-300)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--warning)', display: 'block' }} />50-79%
                </span>
                <span style={{ fontSize: 9, color: 'var(--ink-300)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--error)', display: 'block' }} />&lt;50%
                </span>
              </div>
            </div>
          )}
        </motion.section>

        {/* ── Densidad: toggle único para el detalle secundario / historial largo ── */}
        {(state.importedProducts.length > 1 || heatmapData.length > 0) && (
          <motion.div variants={staggerItem}>
            <motion.button
              onClick={() => setMoreDetailOpen((v) => !v)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'var(--surface)',
                border: '1px solid var(--ink-100)',
                borderRadius: 'var(--r-md)',
                padding: '14px 16px',
                cursor: 'pointer',
                boxShadow: 'var(--e1)',
              }}
              whileTap={{ scale: 0.99 }}
              transition={spring.ui}
              aria-expanded={moreDetailOpen}
            >
              <span className="sm" style={{ fontWeight: 600, color: 'var(--ink-700)' }}>
                Más detalle
              </span>
              <motion.span
                animate={{ rotate: moreDetailOpen ? 270 : 90 }}
                transition={{ duration: dur.fast }}
                style={{ display: 'inline-flex', color: 'var(--ink-400)', lineHeight: 1 }}
                aria-hidden="true"
              >
                <IcChevron size={16} />
              </motion.span>
            </motion.button>
          </motion.div>
        )}

        {/* ── Item 132: rachas por producto (cuando hay >1 producto) — dentro de "Más detalle" ──── */}
        {moreDetailOpen && state.importedProducts.length > 1 && (
          <motion.div
            variants={staggerItem}
            className="card"
            style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
          >
            <p className="sm" style={{ margin: 0, fontWeight: 600, color: 'var(--ink-700)' }}>
              Racha por producto
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {state.importedProducts.map((p) => {
                const s = productStreaks[p] ?? 0
                return (
                  <div key={p} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="sm" style={{ color: 'var(--ink-700)', fontWeight: 500 }}>{p}</span>
                    {s > 0
                      ? <ProductStreakBadge streak={s} />
                      : <span className="sm" style={{ color: 'var(--ink-300)', fontSize: 11 }}>sin racha</span>
                    }
                  </div>
                )
              })}
            </div>
          </motion.div>
        )}

        {/* ── 1b. Checklist "Tus dosis de hoy" (1-tap, sin escribir) ──── */}
        <motion.div variants={staggerItem}>
          <TodayDoses />
        </motion.div>

        {/* ── 1b-2. Mapa de zonas de inyección (recencia: rojo<1d, ámbar<2d, verde<3d) ── */}
        {(hasInjectionUse || Object.keys(state.protocols).length > 0) && (
          <motion.div variants={staggerItem}>
            <InjectionMap zones={injectionZones} />
          </motion.div>
        )}

        {/* ── 1c. "Activo ahora": péptidos con presencia estimada → Cuerpo ── */}
        <motion.div variants={staggerItem}>
          <ActiveNowChips />
        </motion.div>

        {/* ── Loop 166: Nivel de vial reconstituido ────────────────────────── */}
        {vialWidgets.length > 0 && (
          <motion.div
            variants={staggerItem}
            style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
          >
            {vialWidgets.map((w) => {
              const barColor = w.expiryStatus === 'expired'
                ? 'var(--error)'
                : w.expiryStatus === 'soon'
                ? 'var(--warning)'
                : w.fillPct > 30
                ? 'var(--brand-500)'
                : 'var(--warning)'
              const labelColor = w.expiryStatus === 'expired'
                ? 'var(--error)'
                : w.expiryStatus === 'soon'
                ? 'var(--warning)'
                : 'var(--ink-400)'
              // reconstitución próxima = cuando expire o cuando se agote (guía de manejo)
              const nextReconLabel = w.expiryStatus === 'expired'
                ? 'Reconstitución recomendada'
                : `Próxima reconstitución ~${w.expiryStr}`
              return (
                <div
                  key={w.product}
                  className="card"
                  style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
                  aria-label={`Nivel de vial de ${w.product}: ${Math.round(w.fillPct)}% restante. ${nextReconLabel}. Guía de manejo, no consejo médico.`}
                >
                  {/* Cabecera: nombre del producto + dosis restantes */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <p className="sm" style={{ margin: 0, fontWeight: 600, color: 'var(--ink-700)' }}>
                      {w.product} · vial
                    </p>
                    <p className="sm mono" style={{ margin: 0, color: labelColor, fontWeight: 700 }}>
                      {w.dosesLeft != null
                        ? `~${w.dosesLeft} dosis restante${w.dosesLeft === 1 ? '' : 's'}`
                        : `~${Math.round(w.remaining * 100) / 100} mg`}
                    </p>
                  </div>

                  {/* Barra de nivel */}
                  <div
                    role="meter"
                    aria-valuenow={Math.round(w.fillPct)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`Nivel de vial: ${Math.round(w.fillPct)}%`}
                    style={{ height: 5, borderRadius: 999, background: 'var(--ink-100)', overflow: 'hidden' }}
                  >
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${w.fillPct}%`, background: barColor }}
                      transition={spring.ui}
                      style={{ height: '100%', borderRadius: 999 }}
                    />
                  </div>

                  {/* Pie: mg usados / totales + próxima reconstitución */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 4 }}>
                    <p className="sm" style={{ margin: 0, color: 'var(--ink-400)', fontSize: 10 }}>
                      {Math.round((w.vialMg - w.remaining) * 100) / 100} / {w.vialMg} mg usados
                    </p>
                    <p className="sm" style={{ margin: 0, color: labelColor, fontSize: 10, fontWeight: w.expiryStatus !== 'ok' ? 700 : 400 }}>
                      {nextReconLabel}
                    </p>
                  </div>
                </div>
              )
            })}
          </motion.div>
        )}

        {/* ── Item 154: CycleStatusCard — solo si hay protocolo(s) con ciclo on/off ── */}
        {cycleProtocols.length > 0 && (
          <motion.div variants={staggerItem} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {cycleProtocols.map((p) => (
              <CycleStatusCard key={p.product} protocol={p} today={today} />
            ))}
          </motion.div>
        )}

        {/* ── Loop 161: Widget de hidratación ───────────────────────────── */}
        <motion.div
          variants={staggerItem}
          className="card"
          style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
            <p className="sm" style={{ margin: 0, fontWeight: 600, color: 'var(--ink-700)' }}>
              Hidratación hoy
            </p>
            <p className="sm mono" style={{ margin: 0 }}>
              <span style={{ color: waterPct >= 100 ? 'var(--success)' : 'var(--ink-900)', fontWeight: 700 }}>{waterL}</span>
              <span style={{ color: 'var(--ink-400)' }}> / {waterGoalL} L{waterPct >= 100 ? ' ✓' : ''}</span>
            </p>
          </div>
          {/* progreso en LITROS (no en vasos: el tamaño del vaso varía) */}
          <div
            role="progressbar"
            aria-valuenow={waterL}
            aria-valuemin={0}
            aria-valuemax={waterGoalL}
            aria-label={`Hidratación: ${waterL} de ${waterGoalL} litros`}
            style={{ height: 8, borderRadius: 999, background: 'var(--ink-100)', overflow: 'hidden' }}
          >
            <div style={{
              width: `${Math.min(100, waterPct)}%`, height: '100%', borderRadius: 999,
              background: waterPct >= 100 ? 'var(--success)' : 'var(--brand-500)',
              transition: `width ${dur.base}s ease, background ${dur.base}s ease`,
            }} />
          </div>
          {/* Inicio solo muestra; se registra desde Comida */}
          <button
            className="btn-link sm"
            style={{ alignSelf: 'flex-start' }}
            onClick={() => dispatch({ t: 'tab', tab: 'comida' })}
          >
            Registrar agua en Comida →
          </button>
        </motion.div>

        {/* Item 124: Widget glucosa en ayunas (solo con protocolo Metabolismo) */}
        {hasMetabolismo && (
          <motion.div
            variants={staggerItem}
            className="card"
            style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p className="sm" style={{ margin: 0, fontWeight: 600, color: 'var(--ink-700)' }}>
                Glucosa en ayunas
              </p>
              {glucosaHoy !== null && (
                <p className="sm mono" style={{ margin: 0, color: 'var(--brand-700)', fontWeight: 700 }}>
                  {glucosaHoy} mg/dL hoy
                </p>
              )}
            </div>
            {/* Inicio solo MUESTRA la tendencia; el registro de glucosa se hace en Comida */}
            {glucosaSeries.length >= 2 ? (
              <Sparkline data={glucosaSeries.map((s) => s.value)} color="var(--brand-700)" w={280} h={48} animKey="glucosa" interactive />
            ) : (
              <p className="sm" style={{ margin: 0, color: 'var(--ink-400)' }}>
                {glucosaSeries.length === 1 ? `Último: ${glucosaSeries[0].value} mg/dL. ` : ''}Registra tu glucosa en Comida para ver la tendencia.
              </p>
            )}
            <button className="btn-link sm" style={{ alignSelf: 'flex-start' }} onClick={() => dispatch({ t: 'tab', tab: 'comida' })}>
              Registrar glucosa en Comida →
            </button>
            <p className="sm" style={{ margin: 0, color: 'var(--ink-300)', fontSize: 10 }}>
              Registro personal — no es consejo médico.
            </p>
          </motion.div>
        )}

        {/* ── 1d. "Última toma": evita la duda de doble-dosis ── */}
        <motion.div variants={staggerItem}>
          <LastDoseLine />
        </motion.div>

        {/* ── n°366: Banner "hora habitual pasó — ¿ya tomaste?" ─────── */}
        <AnimatePresence>
          {typicalWindowAlert && dismissedWindowAlert !== typicalWindowAlert.product && (
            <motion.div
              key={`window-alert-${typicalWindowAlert.product}`}
              variants={staggerItem}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              style={{
                background: 'color-mix(in srgb, var(--warning) 10%, transparent)',
                border: '1px solid var(--warning)',
                borderRadius: 'var(--r-md)', padding: '10px 14px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
              }}
            >
              <p className="sm" style={{ margin: 0, color: 'var(--ink-700)', flex: 1 }}>
                Tu hora habitual de <strong>{typicalWindowAlert.product}</strong> fue hace{' '}
                {typicalWindowAlert.minsAgo < 60
                  ? `${typicalWindowAlert.minsAgo} min`
                  : `${Math.round(typicalWindowAlert.minsAgo / 60 * 10) / 10}h`} — ¿ya lo tomaste?
              </p>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button
                  className="sm"
                  style={{ fontWeight: 600, color: 'var(--brand-700)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px' }}
                  onClick={() => dispatch({ t: 'sheet', sheet: 'registrar', arg: typicalWindowAlert.product })}
                >
                  Registrar
                </button>
                <button
                  className="sm"
                  style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--ink-400)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px' }}
                  onClick={() => setDismissedWindowAlert(typicalWindowAlert.product)}
                  aria-label="Cerrar alerta"
                >
                  <IcClose size={14} />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── n°420: Semáforo de seguridad anti-doble-dosis ──────────── */}
        {dosingSemaphores.length > 0 && (
          <motion.div
            variants={staggerItem}
            className="card"
            style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
          >
            <p className="sm" style={{ margin: 0, fontWeight: 600, color: 'var(--ink-700)' }}>
              Ventana de dosificación
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {dosingSemaphores.map(({ product, lastDoseTs, nextSafeTs, status }) => {
                const statusColor = status === 'green' ? 'var(--success)' : status === 'yellow' ? 'var(--warning)' : 'var(--error)'
                const statusLabel = status === 'green' ? 'Ok para tomar' : status === 'yellow' ? 'Pronto disponible' : 'Espera aún'
                const lastDoseLabel = lastDoseTs ? `Última: ${fmtTime(new Date(lastDoseTs))}` : 'Sin dosis reciente'
                const nextLabel = nextSafeTs && nextSafeTs > Date.now()
                  ? `Próxima ventana: ${fmtDoseWindowEta(nextSafeTs)}`
                  : ''
                return (
                  <div key={product} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: statusColor, flexShrink: 0, marginTop: 5 }} aria-hidden="true" />
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                        <span className="sm" style={{ fontWeight: 600, color: 'var(--ink-900)', wordBreak: 'break-word', minWidth: 0 }}>{product}</span>
                        <span className="sm" style={{ color: statusColor, fontWeight: 700, flexShrink: 0 }}>{statusLabel}</span>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0 10px' }}>
                        <span className="sm" style={{ color: 'var(--ink-400)' }}>{lastDoseLabel}</span>
                        {nextLabel && <span className="sm" style={{ color: 'var(--ink-400)' }}>{nextLabel}</span>}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            <p className="sm" style={{ margin: 0, color: 'var(--ink-300)', fontSize: 10 }}>
              Guía educativa basada en PK estimada — no es consejo médico.
            </p>
          </motion.div>
        )}

        {/* ── n°427: Atajo a CalcSheet cuando hay reconstituciones ─── */}
        {hasRecon && (
          <motion.div variants={staggerItem}>
            <motion.button
              className="btn"
              style={{ width: '100%', height: 40, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--brand-700)', fontWeight: 600, fontSize: 13, borderRadius: 'var(--r-md)' }}
              whileTap={{ scale: 0.97 }}
              transition={spring.ui}
              onClick={() => dispatch({ t: 'sheet', sheet: 'calc' })}
              aria-label="Abrir calculadora de reconstitución"
            >
              <Glyph name="calculadora" size={13} color="currentColor" style={{ verticalAlign: '-2px', marginRight: 3 }} /> Calculadora de reconstitución
            </motion.button>
          </motion.div>
        )}

        {/* ── n°470: Mini-check matutino (3 preguntas rápidas) ───────── */}
        <AnimatePresence>
          {showMorningCheck && (
            <motion.div
              key="morning-check"
              variants={staggerItem}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8, height: 0 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className="card"
              style={{ display: 'flex', flexDirection: 'column', gap: 12, borderLeft: '3px solid var(--brand-500)' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p className="sm" style={{ margin: 0, fontWeight: 600, color: 'var(--ink-700)' }}>3 preguntas rápidas — buenos días</p>
                <button onClick={() => setMorningCheckDone(true)} aria-label="Omitir chequeo matutino"
                  style={{ display: 'inline-flex', alignItems: 'center', background: 'none', border: 'none', color: 'var(--ink-300)', cursor: 'pointer', lineHeight: 1 }}><IcClose size={16} /></button>
              </div>
              {morningCheckMeasures.map((m) => {
                const meta = MEASURE_META[m]
                const v = morningAnswers[m] ?? ''
                return (
                  <div key={m} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <label className="sm" style={{ color: 'var(--ink-400)', fontWeight: 500 }}>{m}{meta?.unit ? ` (${meta.unit})` : ''}</label>
                    {meta?.kind === 'scale' ? (
                      <div style={{ display: 'flex', gap: 6 }}>
                        {Array.from({ length: (meta.max ?? 10) }, (_, i) => {
                          const val = i + 1
                          const selected = morningAnswers[m] === val
                          return (
                            <button key={val}
                              onClick={() => setMorningAnswers((prev) => ({ ...prev, [m]: val }))}
                              aria-label={`${m}: ${val}`}
                              style={{
                                width: 34, height: 34, borderRadius: '50%', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13,
                                background: selected ? 'var(--brand-500)' : 'var(--ink-100)',
                                color: selected ? '#fff' : 'var(--ink-700)',
                              }}>
                              {val}
                            </button>
                          )
                        })}
                      </div>
                    ) : (
                      <input type="number" inputMode="decimal" value={v}
                        onChange={(e) => setMorningAnswers((prev) => ({ ...prev, [m]: Number(e.target.value) }))}
                        placeholder={meta?.unit ?? ''}
                        aria-label={`${m} valor`}
                        style={{ height: 40, padding: '0 12px', borderRadius: 'var(--r-sm)', border: '1.5px solid var(--border)', background: 'var(--bg)', color: 'var(--ink-900)', fontSize: 16, fontFamily: 'inherit', outline: 'none' }}
                      />
                    )}
                  </div>
                )
              })}
              <motion.button
                className="btn btn-brand"
                style={{ height: 44, width: '100%' }}
                whileTap={{ scale: 0.97 }}
                transition={spring.ui}
                onClick={() => {
                  for (const [name, value] of Object.entries(morningAnswers)) {
                    if (value != null && !isNaN(Number(value)) && Number(value) !== 0) {
                      dispatch({ t: 'saveMeasure', name, value: Number(value) })
                    }
                  }
                  setMorningCheckDone(true)
                  setMorningAnswers({})
                }}
              >
                Guardar y cerrar
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── n°466: Cockpit de mi stack completo ──────────────────── */}
        {stackCockpit.length > 0 && (
          <motion.div
            variants={staggerItem}
            className="card"
            style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
          >
            <p className="sm" style={{ margin: 0, fontWeight: 600, color: 'var(--ink-700)' }}>
              Mi stack activo
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {stackCockpit.map(({ product, cat, catColor: cc, pct, nextDose }) => (
                <div key={product} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: cc, flexShrink: 0, marginTop: 5 }} aria-hidden="true" />
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
                    <span className="sm" style={{ fontWeight: 600, color: 'var(--ink-900)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>{product}</span>
                    <span className="sm" style={{ color: 'var(--ink-400)' }}>{cat}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    {pct > 2 && (
                      <span className="sm mono" style={{ fontSize: 10, whiteSpace: 'nowrap', color: pct >= 50 ? 'var(--success)' : 'var(--warning)' }}>
                        ~{Math.round(pct)}%
                      </span>
                    )}
                    {nextDose && (
                      <span className="sm" style={{ fontSize: 10, whiteSpace: 'nowrap', color: 'var(--ink-400)' }}>
                        próx. {fmtTime(nextDose)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <p className="sm" style={{ margin: 0, color: 'var(--ink-300)', fontSize: 9 }}>
              Presencia estimada: educativo, no clínico.
            </p>
          </motion.div>
        )}

        {/* ── 2. HÉROE: próxima toma con cuenta regresiva real ────────── */}
        {!state.logged && !hasProtocol && (
          <motion.div
            variants={staggerItem}
            className="card"
            style={{
              background: 'linear-gradient(135deg, #0E5A52 0%, #1B8A7D 100%)',
              border: 0,
              boxShadow: 'var(--e2)',
              color: '#fff',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                right: -28,
                top: -28,
                width: 120,
                height: 120,
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.06)',
                pointerEvents: 'none',
              }}
            />
            <p
              className="sm"
              style={{
                color: '#acefe4',
                fontWeight: 700,
                letterSpacing: 0.8,
                textTransform: 'uppercase',
                margin: '0 0 6px',
              }}
            >
              Empieza aquí
            </p>
            <h2
              className="h2"
              style={{ color: '#fff', margin: '0 0 16px', fontWeight: 700 }}
            >
              Registra tu primer dato hoy
            </h2>
            <motion.button
              className="btn btn-ember"
              style={{ height: 48, width: '100%' }}
              whileTap={{ scale: 0.96 }}
              transition={spring.ui}
              onClick={() => dispatch({ t: 'sheet', sheet: 'registrar' })}
            >
              Registrar ahora
            </motion.button>
          </motion.div>
        )}

        {/* Sin protocolo pero ya tiene registros → CTA crear protocolo */}
        {!hasProtocol && state.logged && (
          <motion.div
            variants={staggerItem}
            className="card"
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              borderLeft: `3px solid ${catColor}`,
            }}
          >
            <p className="body" style={{ margin: 0, fontWeight: 600, color: 'var(--ink-700)' }}>
              Sin protocolo activo
            </p>
            <p className="sm" style={{ margin: 0, color: 'var(--ink-400)' }}>
              Crea tu protocolo para ver la cuenta regresiva y tu adherencia.
            </p>
            <motion.button
              className="btn btn-brand"
              style={{ width: '100%', height: 44 }}
              whileTap={{ scale: 0.96 }}
              transition={spring.ui}
              onClick={() => dispatch({ t: 'tab', tab: 'protocolo' })}
            >
              Crear protocolo
            </motion.button>
          </motion.div>
        )}

        {/* Protocolo activo SIN dosis hoy → cuenta regresiva */}
        {hasProtocol && !hasDosesToday && (
          <motion.div
            variants={staggerItem}
            className="card"
            style={{
              position: 'relative',
              overflow: 'hidden',
              borderLeft: `3px solid ${catColor}`,
            }}
          >
            {/* Decoración cuadrante */}
            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                right: 0,
                top: 0,
                width: 100,
                height: 100,
                background: catColor,
                opacity: 0.05,
                borderBottomLeftRadius: '100%',
                pointerEvents: 'none',
              }}
            />

            {/* Etiqueta + ícono de dosis */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <Glyph name="dose" color={catColor} size={20} />
              <span
                className="sm mono"
                style={{ fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase', color: catColor }}
              >
                Próxima toma
              </span>
            </div>

            {/* Producto + racha por-producto (item 132) */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
              <h2 className="h2" style={{ margin: 0, color: 'var(--ink-900)' }}>
                {nextProduct || state.protocol?.product}
              </h2>
              {(nextProduct || state.protocol?.product) && (
                <ProductStreakBadge streak={productStreaks[nextProduct || state.protocol?.product || ''] ?? 0} />
              )}
            </div>

            {/* ── Loop 152: cuenta regresiva con count-up animado ───────── */}
            {countdownText && (
              <motion.div
                key={countdownText}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: dur.base, ease: ease.decelerate }}
                aria-live="polite"
                aria-atomic="true"
                aria-label={`Próxima toma de ${nextProduct || state.protocol?.product}: ${countdownText}`}
                style={{ margin: '0 0 8px' }}
              >
                {isNow ? (
                  <p
                    className="display-l mono"
                    style={{ margin: 0, letterSpacing: -0.5, lineHeight: 1, color: catColor }}
                  >
                    es ahora
                  </p>
                ) : (
                  <p
                    className="display-l mono"
                    style={{ margin: 0, letterSpacing: -0.5, lineHeight: 1, color: 'var(--ink-700)' }}
                  >
                    {/* count-up del número mostrado; unidades estáticas. ≥48h → días+horas */}
                    {countdownMins >= 2880 ? (
                      <>
                        en <span ref={countdownRef}>{cdDays}</span> d{countdownMins % 1440 >= 60 ? ` ${Math.floor((countdownMins % 1440) / 60)}h` : ''}
                      </>
                    ) : countdownMins >= 60 ? (
                      <>
                        en{' '}
                        <span ref={countdownRef}>{cdHours}</span>
                        h{countdownMins % 60 > 0 ? ` ${countdownMins % 60}m` : ''}
                      </>
                    ) : (
                      <>
                        en <span ref={countdownRef}>{countdownMins}</span> min
                      </>
                    )}
                  </p>
                )}
              </motion.div>
            )}
            {!countdownText && (
              <p className="sm" style={{ margin: '0 0 8px', color: 'var(--ink-400)' }}>
                Según tu cadencia
              </p>
            )}

            {/* ── Loop 153: Barra de ventana de toma ───────────────────── */}
            {at && (
              <div
                style={{ position: 'relative', height: 4, borderRadius: 999, background: 'var(--ink-100)', marginBottom: 20, overflow: 'hidden' }}
                aria-hidden="true"
              >
                {/* zona verde = ventana de toma */}
                <div
                  style={{
                    position: 'absolute',
                    left: '25%',
                    right: '25%',
                    top: 0,
                    bottom: 0,
                    background: inWindow ? catColor : 'var(--ink-300)',
                    opacity: 0.4,
                    borderRadius: 999,
                    transition: `background ${dur.base}s`,
                  }}
                />
                {/* marcador de posición actual */}
                <motion.div
                  animate={{ left: `${barPos * 100}%` }}
                  transition={{ duration: dur.base, ease: ease.decelerate }}
                  style={{
                    position: 'absolute',
                    top: -2,
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: inWindow ? catColor : 'var(--ink-400)',
                    transform: 'translateX(-50%)',
                    transition: `background ${dur.base}s`,
                  }}
                />
              </div>
            )}
            {!at && <div style={{ marginBottom: 20 }} />}

            <motion.button
              className="btn btn-brand"
              style={{ width: '100%', height: 48 }}
              whileTap={{ scale: 0.96 }}
              transition={spring.ui}
              onClick={() => dispatch({ t: 'sheet', sheet: 'registrar' })}
            >
              Registrar
            </motion.button>
          </motion.div>
        )}

        {/* ── 4. KPI cards (máx 4, datos reales) ─────────────────────── */}
        {kpiMeasures.length > 0 && (
          <>
            {/* ── Loop 148: modo compacto (>2 medidas) vs grid 2×2 ─────── */}
            {compactMode ? (
              /* Scroll horizontal de chips compactos */
              <motion.div variants={staggerItem} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div
                  onScroll={(e) => {
                    // card ≈ minWidth 120 + gap 10 = 130 → índice activo del pip
                    const idx = Math.round(e.currentTarget.scrollLeft / 130)
                    setKpiPip(Math.max(0, Math.min(idx, kpiMeasures.length - 1)))
                  }}
                  style={{
                    display: 'flex',
                    gap: 10,
                    overflowX: 'auto',
                    scrollSnapType: 'x mandatory',
                    WebkitOverflowScrolling: 'touch',
                    paddingBottom: 4,
                    paddingRight: 4, // margen de "peek" → la última tarjeta no queda pegada/cortada al borde
                    scrollbarWidth: 'none',
                  }}
                  role="list"
                  aria-label="Métricas"
                >
                  {kpiMeasures.map((m) => {
                    const hasValue = state.measureValues[m] != null
                    const hero = kpiHero(m, state.measureValues)
                    const unit = kpiUnit(m, state.measureValues)
                    const iconMeta = MEASURE_ICON[m]
                    const accentColor = iconMeta?.cat ?? catColor
                    const delta = hasValue ? kpiDelta(m, state.history) : null

                    return (
                      <motion.button
                        key={m}
                        role="listitem"
                        whileHover={!reduce ? { scale: 1.02 } : undefined}
                        whileTap={!reduce ? { scale: 0.97 } : undefined}
                        transition={spring.ui}
                        // n°313: Peso → directo a entrada; resto → detalle
                        onClick={() => m === 'Peso'
                          ? dispatch({ t: 'sheet', sheet: 'medida', arg: 'Peso' })
                          : dispatch({ t: 'sheet', sheet: 'medida-detail', arg: m })
                        }
                        aria-label={m === 'Peso' ? `${m}: ${hero}${unit ? ' ' + unit : ''}. Toca para registrar.` : `${m}: ${hero}${unit ? ' ' + unit : ''}. Toca para ver detalle.`}
                        style={{
                          scrollSnapAlign: 'start',
                          flexShrink: 0,
                          minWidth: 120,
                          height: 72,
                          borderRadius: 'var(--r-md)',
                          background: 'var(--surface)',
                          border: '1px solid var(--ink-100)',
                          boxShadow: 'var(--e1)',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'center',
                          padding: '0 14px',
                          gap: 3,
                          cursor: 'pointer',
                          textAlign: 'left',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          {iconMeta && <Glyph name={iconMeta.icon} color={accentColor} size={13} />}
                          <span className="sm" style={{ color: 'var(--ink-400)', fontWeight: 500, fontSize: 11 }}>{m}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
                          <span className="mono" style={{ fontSize: 22, fontWeight: 700, lineHeight: 1, color: hasValue ? 'var(--ink-900)' : 'var(--ink-300)' }}>
                            {hero}
                          </span>
                          {unit && hasValue && <span style={{ fontSize: 11, color: 'var(--ink-400)' }}>{unit}</span>}
                          {delta && (
                            <span style={{ fontSize: 10, fontWeight: 600, color: delta.positive ? 'var(--success)' : 'var(--error)', marginLeft: 2 }}>
                              {delta.diff > 0 ? '+' : ''}{delta.diff}
                            </span>
                          )}
                        </div>
                      </motion.button>
                    )
                  })}
                </div>
                {/* pip-indicator de puntos */}
                <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }} aria-hidden="true">
                  {kpiMeasures.map((_, i) => (
                    <div key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: i === kpiPip ? 'var(--brand-500)' : 'var(--ink-100)', transition: 'background .15s' }} />
                  ))}
                </div>
              </motion.div>
            ) : (
              /* Grid 2×2 original — Loop 147: whileHover/whileTap + deltas 144/145 */
              <motion.section
                variants={staggerParent}
                initial="initial"
                animate="animate"
                style={{
                  display: 'grid',
                  gridTemplateColumns: kpiMeasures.length === 1 ? '1fr' : '1fr 1fr',
                  gap: 12,
                }}
              >
                {kpiMeasures.map((m) => {
                  const hasValue = state.measureValues[m] != null
                  const hero = kpiHero(m, state.measureValues)
                  const unit = kpiUnit(m, state.measureValues)
                  const realSeries = (state.history[m] ?? []).map((s) => s.value)
                  const sparkData = realSeries.length >= 2 ? realSeries : null
                  const iconMeta = MEASURE_ICON[m]
                  const accentColor = iconMeta?.cat ?? catColor
                  // Loop 144: delta vs anterior
                  const delta = hasValue ? kpiDelta(m, state.history) : null
                  // Loop 145: delta desde inicio del protocolo
                  const deltaStart = hasValue ? kpiDeltaStart(m, state.history, protoStartTs) : null
                  const firstSample = (state.history[m] ?? []).length === 1

                  return (
                    <motion.div
                      key={m}
                      variants={staggerItem}
                      className="card"
                      role="button"
                      tabIndex={0}
                      whileHover={!reduce ? { scale: 1.02 } : undefined}
                      whileTap={!reduce ? { scale: 0.97 } : undefined}
                      transition={spring.ui}
                      // n°313: toca Peso → abre MedidaSheet directo (sin pasar por grilla KPIs)
                      onClick={() => m === 'Peso'
                        ? dispatch({ t: 'sheet', sheet: 'medida', arg: 'Peso' })
                        : dispatch({ t: 'sheet', sheet: 'medida-detail', arg: m })
                      }
                      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ')
                        ? (m === 'Peso'
                          ? dispatch({ t: 'sheet', sheet: 'medida', arg: 'Peso' })
                          : dispatch({ t: 'sheet', sheet: 'medida-detail', arg: m }))
                        : undefined
                      }
                      aria-label={m === 'Peso' ? `${m}: ${hero}${unit ? ' ' + unit : ''}. Toca para registrar peso.` : `${m}: ${hero}${unit ? ' ' + unit : ''}. Toca para ver detalle.`}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        padding: '16px 14px',
                        minHeight: 120,
                        position: 'relative',
                        overflow: 'hidden',
                        cursor: 'pointer',
                      }}
                    >
                      {/* Etiqueta + ícono */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                        {iconMeta && <Glyph name={iconMeta.icon} color={accentColor} size={16} />}
                        <p
                          className="sm"
                          style={{ color: 'var(--ink-400)', fontWeight: 500, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        >
                          {m}
                        </p>
                      </div>

                      {/* Número hero con color semántico (Loop 144) */}
                      <AnimatePresence mode="wait">
                        {hasValue ? (
                          <motion.div
                            key="has-value"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: dur.fast }}
                            style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 'auto' }}
                          >
                            <span
                              className="mono"
                              style={{
                                fontSize: 30,
                                fontWeight: 700,
                                lineHeight: 1,
                                color: delta
                                  ? delta.positive ? 'var(--success)' : 'var(--error)'
                                  : 'var(--ink-900)',
                                transition: `color ${dur.base}s`,
                              }}
                            >
                              {hero}
                            </span>
                            {unit && (
                              <span className="sm" style={{ color: 'var(--ink-400)' }}>{unit}</span>
                            )}
                          </motion.div>
                        ) : (
                          <motion.div
                            key="no-value"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: dur.fast }}
                            style={{ marginBottom: 'auto' }}
                          >
                            <span className="mono" style={{ fontSize: 30, fontWeight: 700, lineHeight: 1, color: 'var(--ink-300)' }}>—</span>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Loop 144: delta vs medición anterior */}
                      {delta && (
                        <p className="sm" style={{ margin: '4px 0 0', color: delta.positive ? 'var(--success)' : 'var(--error)', fontWeight: 600 }}>
                          {delta.diff > 0 ? '+' : '−'}{Math.abs(delta.diff)} vs. anterior
                        </p>
                      )}
                      {!delta && hasValue && !firstSample && (
                        <p className="sm" style={{ margin: '4px 0 0', color: 'var(--ink-300)' }}>sin cambio</p>
                      )}
                      {firstSample && (
                        <p className="sm" style={{ margin: '4px 0 0', color: 'var(--ink-300)' }}>— primera medición</p>
                      )}

                      {/* Loop 145: delta desde inicio del protocolo */}
                      {deltaStart && (
                        <p className="sm" style={{ margin: '2px 0 0', color: deltaStart.positive ? 'var(--success)' : 'var(--ink-300)', fontSize: 11 }}>
                          desde inicio: {deltaStart.diff > 0 ? '+' : ''}{deltaStart.diff}{unit ? ` ${unit}` : ''}
                        </p>
                      )}

                      {/* Mini sparkline */}
                      {sparkData && (
                        <div style={{ marginTop: 10, alignSelf: 'flex-start' }}>
                          <Sparkline data={sparkData} color={accentColor} w={72} h={26} />
                        </div>
                      )}

                      {/* Estado inicial si no hay dato */}
                      {!hasValue && (
                        <p className="sm" style={{ color: 'var(--ink-300)', margin: '6px 0 0', fontSize: 11 }}>
                          Toca para registrar
                        </p>
                      )}
                    </motion.div>
                  )
                })}
              </motion.section>
            )}
          </>
        )}

        {/* ── Loop 160: Proyección de peso ──────────────────────────────── */}
        {showProjection && proj && (
          <motion.div
            variants={staggerItem}
            className="card"
            style={{ display: 'flex', flexDirection: 'column', gap: 6, borderLeft: '3px solid var(--brand-300)' }}
          >
            <p className="sm" style={{ margin: 0, fontWeight: 600, color: 'var(--ink-700)' }}>
              Proyección de peso
            </p>
            <p className="body" style={{ margin: 0, color: 'var(--ink-900)' }}>
              A este ritmo llegarías a{' '}
              <span style={{ fontWeight: 700 }}>{proj.goal} kg</span>{' '}
              en{' '}
              <span style={{ fontWeight: 700 }}>
                {Math.ceil((proj.etaTs! - state.todayTs) / (1000 * 60 * 60 * 24 * 7))} semanas
              </span>
            </p>
            <p className="sm" style={{ margin: 0, color: 'var(--ink-400)' }}>
              Proyección lineal de tus propios datos — no es consejo médico.
            </p>
            <motion.button
              className="btn"
              style={{ width: '100%', height: 40, marginTop: 4, background: 'var(--ink-100)', color: 'var(--ink-700)' }}
              whileTap={{ scale: 0.97 }}
              transition={spring.ui}
              onClick={() => dispatch({ t: 'tab', tab: 'semana' })}
            >
              Ver proyección completa
            </motion.button>
          </motion.div>
        )}

        {/* ── Loop 159: Resumen semana colapsable ──────────────────────── */}
        {(insights.length > 0 || weekAdh !== null) && (
          <motion.div variants={staggerItem}>
            <motion.button
              onClick={() => setWeekSummaryOpen((v) => !v)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'var(--surface)',
                border: '1px solid var(--ink-100)',
                borderRadius: 'var(--r-md)',
                padding: '14px 16px',
                cursor: 'pointer',
                boxShadow: 'var(--e1)',
              }}
              whileTap={{ scale: 0.99 }}
              transition={spring.ui}
              aria-expanded={weekSummaryOpen}
            >
              <span className="sm" style={{ fontWeight: 600, color: 'var(--ink-700)' }}>
                Esta semana
              </span>
              <motion.span
                animate={{ rotate: weekSummaryOpen ? 270 : 90 }}
                transition={{ duration: dur.fast }}
                style={{ display: 'inline-flex', color: 'var(--ink-400)', lineHeight: 1 }}
                aria-hidden="true"
              >
                <IcChevron size={16} />
              </motion.span>
            </motion.button>

            <AnimatePresence>
              {weekSummaryOpen && (
                <motion.div
                  key="week-summary"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: dur.base, ease: ease.decelerate }}
                  style={{ overflow: 'hidden' }}
                >
                  <div
                    className="card"
                    style={{ borderTopLeftRadius: 0, borderTopRightRadius: 0, borderTop: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}
                  >
                    {weekAdh !== null && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="sm" style={{ color: 'var(--ink-400)', minWidth: 90 }}>Adherencia</span>
                        <span className="sm mono" style={{ fontWeight: 700, color: weekAdh >= 80 ? 'var(--success)' : weekAdh >= 50 ? 'var(--warning)' : 'var(--error)' }}>
                          {weekAdh}%
                        </span>
                      </div>
                    )}
                    {insights.map((txt, i) => (
                      <p key={i} className="sm" style={{ margin: 0, color: 'var(--ink-700)', lineHeight: 1.5 }}>
                        {txt}
                      </p>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* ── n°378: Indicador de fase de titulación (el estado de ciclo on/off lo cubre CycleStatusCard, arriba) ── */}
        {Object.values(state.protocols).filter((p) =>
          p.cadence.mode !== 'ciclo' && p.progOn && p.progN > 1
        ).map((prot) => {
          const key = prot.product
          if (prot.progOn && prot.progN > 1 && prot.startDate) {
            // Titulación por fases: curPhase (0-based), progN = total de fases
            const totalPhases = prot.progN
            const curPhase = prot.curPhase ?? 0
            const start = new Date(prot.startDate)
            const weeksSinceStart = Math.max(0, Math.floor((today.getTime() - start.getTime()) / (7 * 86400000)))
            // Estimar semanas por fase: 4 semanas por defecto
            const weeksPerPhase = 4
            const weekInPhase = (weeksSinceStart % weeksPerPhase) + 1
            return (
              <motion.div key={key} variants={staggerItem} className="card"
                style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <p className="sm" style={{ margin: 0, fontWeight: 600, color: 'var(--ink-700)' }}>
                    {prot.product} · Fase {curPhase + 1} de {totalPhases}
                  </p>
                  <span className="sm mono" style={{ color: 'var(--brand-700)' }}>
                    Semana {weekInPhase} de {weeksPerPhase}
                  </span>
                </div>
                <div style={{ height: 4, borderRadius: 999, background: 'var(--ink-100)', overflow: 'hidden' }}>
                  <motion.div
                    animate={{ width: `${((curPhase) / totalPhases) * 100}%` }}
                    transition={spring.ui}
                    style={{ height: '100%', borderRadius: 999, background: 'var(--brand-500)' }}
                  />
                </div>
              </motion.div>
            )
          }
          return null
        })}

        {/* ── n°455: Heatmap 13 semanas (estilo GitHub) — dentro de "Más detalle" ───────────── */}
        {moreDetailOpen && heatmapData.length > 0 && (
          <motion.div
            variants={staggerItem}
            className="card"
            style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
          >
            <p className="sm" style={{ margin: 0, fontWeight: 600, color: 'var(--ink-700)' }}>
              Adherencia · 13 semanas
            </p>
            <div
              style={{ overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}
              role="img"
              aria-label="Heatmap de adherencia de las últimas 13 semanas"
            >
              <div style={{ display: 'flex', gap: 3, minWidth: 'max-content' }}>
                {heatmapData.map((week, wi) => (
                  <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {week.map(({ date, count, isFuture }, di) => {
                      const opacity = isFuture ? 0.15 : count === 0 ? 0.08 : Math.min(1, 0.25 + count * 0.25)
                      const isToday = date.toDateString() === today.toDateString()
                      return (
                        <motion.button
                          key={di}
                          title={`${date.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })} — ${count} registro${count !== 1 ? 's' : ''}`}
                          aria-label={`${date.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}: ${count} registros`}
                          onClick={() => !isFuture && dispatch({ t: 'sheet', sheet: 'day-detail', arg: date.toISOString().slice(0, 10) })}
                          whileTap={!reduce && !isFuture ? { scale: 1.3 } : undefined}
                          style={{
                            width: 10, height: 10, borderRadius: 2, border: 'none',
                            background: count > 0 ? catColor : isFuture ? 'var(--ink-100)' : 'var(--ink-100)',
                            opacity,
                            cursor: isFuture ? 'default' : 'pointer',
                            outline: isToday ? `1.5px solid ${catColor}` : 'none',
                            outlineOffset: 1,
                          }}
                        />
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="sm" style={{ color: 'var(--ink-400)', fontSize: 10 }}>Hace 13 semanas</span>
              <span className="sm" style={{ color: 'var(--ink-400)', fontSize: 10 }}>Hoy</span>
            </div>
          </motion.div>
        )}

        {/* ── n°394: Cierre del día (22:00+, si hay dosis hoy) ─────── */}
        <AnimatePresence>
          {showDayClosure && !dayClosed && (
            <motion.div
              key="day-closure"
              variants={staggerItem}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10, height: 0 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="card"
              style={{ display: 'flex', flexDirection: 'column', gap: 12, borderLeft: '3px solid var(--brand-500)' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p className="sm" style={{ margin: 0, fontWeight: 600, color: 'var(--ink-700)' }}>Cierre del día <Glyph name="sueno" size={13} color="currentColor" style={{ verticalAlign: '-2px', marginRight: 3 }} /></p>
                <button onClick={() => setDayClosed(true)} aria-label="Cerrar resumen del día"
                  style={{ display: 'inline-flex', alignItems: 'center', background: 'none', border: 'none', color: 'var(--ink-300)', cursor: 'pointer', lineHeight: 1 }}><IcClose size={16} /></button>
              </div>
              <p className="sm" style={{ margin: 0, color: 'var(--ink-400)' }}>
                ¿Cómo te sentiste hoy? (opcional, 120 char max)
              </p>
              <input
                type="text"
                maxLength={120}
                value={dayNote}
                onChange={(e) => setDayNote(e.target.value)}
                placeholder="ej: energía alta, recuperación buena, sin efectos adversos…"
                aria-label="Nota subjetiva del día"
                style={{
                  height: 40, padding: '0 12px', borderRadius: 'var(--r-sm)',
                  border: '1.5px solid var(--border)', background: 'var(--bg)',
                  color: 'var(--ink-900)', fontSize: 14, fontFamily: 'inherit', outline: 'none',
                }}
              />
              <motion.button
                className="btn btn-brand"
                style={{ height: 44, width: '100%' }}
                whileTap={{ scale: 0.97 }}
                transition={spring.ui}
                onClick={() => {
                  if (dayNote.trim()) {
                    // Guarda como nota diaria en el store (dayNotes[dateKey])
                    const dateKey = new Date(state.todayTs).toISOString().slice(0, 10)
                    dispatch({ t: 'setDayNote', dateKey, text: dayNote.trim() })
                  }
                  setDayClosed(true)
                  setDayNote('')
                }}
              >
                Guardar y cerrar
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── n°483: Modo "Día de inyección" — placeholder web ────── */}
        {/* Full fullscreen flow (L effort) omitido; implementado como CTA a 1-tap */}
        {hasDosesToday && (
          <motion.div variants={staggerItem}>
            <motion.button
              className="btn"
              style={{
                width: '100%', height: 40,
                background: 'transparent',
                border: 'none',
                color: 'var(--ink-400)', fontWeight: 600, fontSize: 13,
                borderRadius: 'var(--r-md)',
              }}
              whileTap={{ scale: 0.97 }}
              transition={spring.ui}
              onClick={() => dispatch({ t: 'sheet', sheet: 'registrar' })}
              aria-label="Iniciar flujo de día de inyección"
            >
              <Glyph name="dose" size={13} color="currentColor" style={{ verticalAlign: '-2px', marginRight: 3 }} /> Flujo de hoy — dosis + KPI + peso
            </motion.button>
          </motion.div>
        )}

        {/* ── 5. Disclaimer ────────────────────────────────────────────── */}
        <motion.div variants={staggerItem}>
          <Disclaimer kind="general" />
        </motion.div>
      </motion.div>
    </div>
  )
}
