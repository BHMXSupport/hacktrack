// Inicio "Bitácora" — el reporte de hoy, maquetado como la ref canónica (docs/design-refs/inicio-*.html):
// masthead editorial + dial ámbar con numeral serif + §-folios + columnas impresas. Overhaul ESTÉTICO:
// todos los dispatches, derivaciones y semántica de adherencia son los mismos de antes.
import { useMemo, useState, useEffect } from 'react'
import { motion, useReducedMotion, AnimatePresence } from 'framer-motion'
import {
  Droplet, ChevronRight, Check, Clock, X, ChevronDown, ChevronUp, SkipForward, AlertTriangle, Ruler, Flame, Info,
} from 'lucide-react'
import { useApp, nextInjectionSite, doseForProduct, adherenceMonth, tallyDoses, SITE_LABEL } from '../../lib/store'
import type { InjectionSite, MeasureSample } from '../../lib/types'
import { startOfDay, dayDiff } from '../../lib/cadence'
import { doseToMg } from '../../lib/calc'
import { CadenciaChip } from './ProtocoloEditSheet'
import {
  upcomingDoses, protocolStreak, protocolStreakStart, dayProducts, doseTakenOnProduct, doseSkippedOnProduct,
  pendingDoses, loggedDoseTs,
} from '../../lib/calendar'
import { MEASURE_META } from '../../lib/catalog'
import { tdee } from '../../lib/nutrition'
import { rachaLabel } from '../../lib/buildFlags'
import { Glass } from '../ui/Glass'
import { Sheet } from '../ui/Sheet'
import { Switch } from '../ui/Switch'
import { Ring } from '../ui/Ring'
import { Button } from '../ui/Button'
import { InjectionMap } from '../ui/InjectionMap'
import { FolioLabel } from '../ui/FolioLabel'
import { TrustChip } from '../ui/TrustChip'
import { AutoVideo } from '../ui/AutoVideo'
import heroVideo from '../../assets/rebuild/hero-precision.mp4'
import heroPoster from '../../assets/rebuild/hero-poster.webp'
import { StatNumber } from '../ui/StatNumber'
import { TermInfo } from '../ui/TermInfo'
import { useCountUp } from '../lib/useCountUp'
import { EASE, DUR, fadeUp, staggerContainer } from '../lib/motion'

// #107: sufijo de unidad para las KPI de medidas (scale → "/100", num → "kg"/"cm"/"%")
function measureSuffix(name: string): string {
  const meta = MEASURE_META[name]
  if (!meta) return ''
  if (meta.kind === 'scale') return `/${meta.max ?? 100}`
  return meta.unit ?? ''
}

// Grupos del editor "Mis medidas" — cada medida vive en UN grupo, por dominio. Las sensibles
// (Libido, Función / excitación…) quedan juntas bajo "Íntimo". IMC se omite (derivado de peso/altura).
const MEASURE_GROUPS: Array<{ title: string; items: string[] }> = [
  { title: 'Cuerpo',        items: ['Peso', 'Altura', 'Cintura', '% grasa', '% músculo', 'Glucosa ayunas'] },
  { title: 'Bienestar',     items: ['Energía', 'Estado de ánimo', 'Sueño', 'Foco'] },
  { title: 'Metabolismo',   items: ['Apetito', 'Saciedad', 'Náusea'] },
  { title: 'Recuperación',  items: ['Dolor', 'Recuperación muscular', 'Movilidad', 'Inflamación', 'Resistencia'] },
  { title: 'Piel',          items: ['Hidratación', 'Elasticidad piel', 'Textura piel', 'Firmeza', 'Manchas / tono', 'Cicatrices'] },
  { title: 'Mente',         items: ['Memoria', 'Niebla mental', 'Ansiedad'] },
  { title: 'Crecimiento',   items: ['Fuerza percibida', 'Retención hídrica'] },
  { title: 'Íntimo',        items: ['Libido', 'Función / excitación', 'Frecuencia sexual', 'Rubor post-dosis'] },
  { title: 'Otras',         items: ['Efecto secundario'] },
]

// Editor de "mis medidas": agregar/quitar las métricas que sigues (post-onboarding). Toggle por medida
// → setMeasures (mismo dispatch de siempre); solo cambió la piel (tokens Papel/Tinta).
function ManageMeasuresSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, dispatch } = useApp()
  const selected = new Set(state.selectedMeasures)
  function toggle(m: string) {
    const next = new Set(selected)
    if (next.has(m)) next.delete(m)
    else next.add(m)
    dispatch({ t: 'setMeasures', measures: [...next] })
  }
  return (
    <Sheet open={open} onClose={onClose} title="Mis medidas">
      <p className="-mt-1 mb-4 text-[13px] leading-relaxed text-ink-2">
        Elige qué medidas quieres seguir. Aparecen en Inicio para registrarlas; cada una puede tener su propio recordatorio.
      </p>
      <div className="flex flex-col gap-4">
        {MEASURE_GROUPS.map((g) => {
          const items = g.items.filter((m) => MEASURE_META[m]) // defensivo ante cambios del catálogo
          if (!items.length) return null
          const activeInGroup = items.filter((m) => selected.has(m)).length
          return (
            <section key={g.title}>
              <div className="mb-1.5 flex items-center justify-between px-1">
                <h3 className="font-mono text-[12px] font-medium uppercase tracking-[0.14em] text-ink-3">{g.title}</h3>
                {activeInGroup > 0 ? <span className="font-mono text-[12px] font-semibold text-blue">{activeInGroup} activa{activeInGroup === 1 ? '' : 's'}</span> : null}
              </div>
              <div className="overflow-hidden rounded-sm border border-hairline bg-surface">
                {items.map((m, i) => {
                  const meta = MEASURE_META[m]
                  const sub = meta.kind === 'scale' ? `1–${meta.max ?? 100}` : (meta.unit ?? '')
                  const on = selected.has(m)
                  return (
                    <div key={m} className={`flex items-center justify-between gap-3 px-3 py-2.5 ${i > 0 ? 'border-t border-hairline' : ''}`}>
                      <span className={`text-[14px] ${on ? 'text-ink' : 'text-ink-2'}`}>
                        {m}{sub ? <span className="text-ink-3"> · {sub}</span> : null}
                      </span>
                      <Switch checked={on} onChange={() => toggle(m)} label={`Seguir ${m}`} />
                    </div>
                  )
                })}
              </div>
            </section>
          )
        })}
      </div>
    </Sheet>
  )
}

const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const DIAS_ABR = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
const keyOf = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`

function countdown(at: Date, now: Date): string {
  const mins = Math.max(0, Math.round((at.getTime() - now.getTime()) / 60000))
  if (mins < 1) return 'es ahora'
  if (mins < 60) return `en ${mins} min`
  const h = Math.floor(mins / 60)
  if (h < 48) return mins % 60 === 0 ? `en ${h}h` : `en ${h}h ${mins % 60}m`
  const d = Math.floor(h / 24)
  return h % 24 === 0 ? `en ${d} d` : `en ${d} d ${h % 24}h`
}

// Semáforo de ventana de toma (verde ±0 ≤30 min, ámbar 31–120 min, rojo >120 min)
function windowStatus(tsScheduled: number, nowTs: number): 'ok' | 'near' | 'late' {
  // #16: diferencia CON SIGNO (antes usaba Math.abs → marcaba "Tarde" tanto antes como después).
  // Solo es "Tarde" si la hora ya pasó por >2 h; cerca de la hora = en ventana; lo demás = próxima.
  const diffMin = (nowTs - tsScheduled) / 60000 // + = ya pasó la hora programada
  if (diffMin > 120) return 'late'
  if (Math.abs(diffMin) <= 30) return 'ok'
  return 'near'
}

const WIN_COLOR: Record<'ok' | 'near' | 'late', string> = {
  ok: 'var(--ok)',
  near: 'var(--warn)',
  late: 'var(--alert)',
}
const WIN_LABEL: Record<'ok' | 'near' | 'late', string> = {
  ok: 'En ventana',
  near: 'Próxima',
  late: 'Tarde',
}
// #53: forma distinta por estado para no depender solo del color (daltonismo)
const WIN_GLYPH: Record<'ok' | 'near' | 'late', string> = { ok: '○', near: '◐', late: '●' }

// Serie de la medida en la ventana de 7 días (para sparkline + delta). Solo lectura de state.history.
function sparkSeries(hist: MeasureSample[] | undefined, nowTs: number): number[] {
  if (!hist?.length) return []
  const cut = nowTs - 7 * 86_400_000
  return hist
    .filter((s) => s.ts >= cut)
    .sort((a, b) => a.ts - b.ts)
    .map((s) => s.value)
}

// Sparkline azul (datos = azul-tinta) con draw-on izq→der (pathLength, GPU). Decorativa (aria-hidden);
// el valor y el delta en texto son los que informan.
function Sparkline({ values, reduce }: { values: number[]; reduce: boolean }) {
  const W = 84
  const H = 20
  const P = 2
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const pts = values
    .map((v, i) => {
      const x = values.length === 1 ? W / 2 : (i / (values.length - 1)) * W
      const y = P + (1 - (v - min) / span) * (H - P * 2)
      return `${Math.round(x * 10) / 10},${Math.round(y * 10) / 10}`
    })
    .join(' ')
  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden className="mt-2">
      <motion.polyline
        points={pts}
        fill="none"
        stroke="var(--blue)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={reduce ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: DUR.draw, ease: EASE }}
      />
    </svg>
  )
}

// Barra de progreso editorial (nutrición): crece con scaleX origen-izquierda (GPU), color por vía.
function TrackBar({ pct, color, reduce }: { pct: number; color: string; reduce: boolean }) {
  return (
    <div className="mt-2 h-2 overflow-hidden rounded-full bg-raised">
      <motion.div
        className="h-full origin-left rounded-full"
        style={{ background: color, width: `${Math.min(100, Math.max(0, pct))}%` }}
        initial={reduce ? false : { scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: DUR.draw, ease: EASE }}
      />
    </div>
  )
}

export function Inicio({ onRegistrar }: { onRegistrar: () => void }) {
  const { state, dispatch } = useApp()
  const reduce = useReducedMotion()
  // #15: reloj propio que tickea cada 30 s — antes `now` solo se recalculaba al re-renderizar
  // (cuenta regresiva y semáforo se congelaban si el reducer de 'tick' no cambiaba el estado).
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(id)
  }, [])
  const nowTs = now.getTime()

  // next = la dosis más próxima (mismo horizonte de 1 día que antes). sameTimeCount = cuántas tomas caen
  // en el MISMO minuto (varios protocolos a las 08:00) → el hero ya no oculta las coincidentes. (#60)
  const { next, sameTimeCount } = useMemo(() => {
    const all = upcomingDoses(state, now, 1)
    const anchor = all[0] ?? null
    if (!anchor) return { next: null, sameTimeCount: 0 }
    const t0 = anchor.date.getTime()
    return { next: anchor, sameTimeCount: all.filter((u) => Math.abs(u.date.getTime() - t0) < 60_000).length }
  }, [state, now])
  const today = startOfDay(now)
  // Convención (calendar.ts): today = identidad del día, now = reloj real — ambos explícitos.
  const streak = useMemo(() => protocolStreak(state, today, now), [state, now]) // eslint-disable-line react-hooks/exhaustive-deps
  // Fecha de inicio de la racha → el chip explica "desde {fecha}" en vez de un número crudo. (#70)
  const streakStart = useMemo(() => (streak > 0 ? protocolStreakStart(state, today, now) : null), [state, streak, now]) // eslint-disable-line react-hooks/exhaustive-deps

  // #2/#3: una sola fuente de verdad (tallyDoses vía adherenceMonth) — respeta cadencia real
  // (semanal/cadaN/ciclo/por-uso) y solo cuenta dosis VENCIDAS en el denominador. null = nada que medir.
  const adh = useMemo(() => adherenceMonth(state, now), [state])

  // Adherencia del MES PASADO (mes calendario completo, mismo motor tallyDoses, solo lectura) →
  // habilita el chip "▲ x pts vs. jun" de la ref cuando es derivable; null = sin dato, sin chip.
  const prevMonth = useMemo(() => {
    const active = Object.values(state.protocols).filter((p) => !p.archived)
    if (!active.length) return null
    const prevStart = new Date(today.getFullYear(), today.getMonth() - 1, 1)
    const prevEnd = new Date(today.getFullYear(), today.getMonth(), 0)
    // Mismo criterio #9 que adherenceMonth: no medir antes del arranque más temprano.
    const earliest = Math.min(...active.map((p) => p.startDate))
    const from = Math.max(prevStart.getTime(), startOfDay(new Date(earliest)).getTime())
    if (from > prevEnd.getTime()) return null
    const t = tallyDoses(state, from, prevEnd.getTime(), now)
    const due = t.taken + t.missed
    if (due === 0) return null
    // Sin dosis REGISTRADAS el mes pasado = el usuario aún no usaba la app ese mes (p.ej. protocolo
    // con startDate retroactivo) → comparar contra ese 0% artificial engaña; sin chip.
    if (t.taken === 0) return null
    return { pct: Math.round((t.taken / due) * 100), label: MES[prevStart.getMonth()] }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, now])

  // ¿el usuario YA registró alguna dosis? (cualquiera: programada, off-cadencia, tarde) → si la adherencia
  // aún no tiene nada PROGRAMADO que medir (due=0), igual reconocemos que "ya hiciste algo" en vez de seguir
  // diciendo "marca tu primera dosis" (incoherencia: registró dosis y la tarjeta decía que no había empezado).
  const dosesLogged = useMemo(
    () => state.log.reduce((n, g) => n + g.items.filter((it) => it.type === 'dose').length, 0),
    [state.log]
  )

  // Dosis de hoy con estado tomada/saltada/pendiente
  const todayDoses = useMemo(
    () =>
      dayProducts(state, today).map((p) => ({
        product: p,
        done: doseTakenOnProduct(state, today, p),
        skipped: doseSkippedOnProduct(state, today, p),
      })),
    [state],
  )

  // #45: productos con stock de vial bajo (≤15% restante) para avisar antes de quedarse sin material
  const lowStock = useMemo(() => {
    const out: { product: string; remainingMg: number }[] = []
    for (const [product, p] of Object.entries(state.protocols)) {
      const vs = p.vialStock
      if (p.archived || !vs || !(vs.totalMg > 0)) continue
      const remaining = vs.totalMg - vs.usedMg
      if (remaining <= 0 || remaining / vs.totalMg < 0.15) out.push({ product, remainingMg: Math.max(0, remaining) })
    }
    return out
  }, [state.protocols])

  // #52: dosis VENCIDAS de días anteriores (el viajero que vuelve atrasado) — pendingDoses ya las
  // detecta hasta 30 días atrás; excluimos las de hoy (ya salen en "Tus dosis de hoy").
  const pending = useMemo(() => {
    const todayMs = today.getTime()
    return pendingDoses(state, now).filter((p) => startOfDay(p.date).getTime() < todayMs)
  }, [state, now, today])
  const [pendingOpen, setPendingOpen] = useState(false)
  const daysAgo = (d: Date) => {
    // dayDiff (round) y no floor sobre ms fijos: un tramo con cambio de horario (23/25 h) no debe
    // desfasar la etiqueta (deuda #69, misma clase)
    const n = dayDiff(today, d)
    return n === 1 ? 'ayer' : `hace ${n} días`
  }

  // ts de toma programada por producto (reminderTime)
  function tsFor(product: string): number {
    const rt = state.protocols[product]?.reminderTime || state.protocol?.reminderTime || '08:00'
    const [hh, mm] = rt.split(':').map(Number)
    const at = new Date(today)
    at.setHours(hh || 0, mm || 0, 0, 0)
    return at.getTime()
  }

  // TODAS las métricas seleccionadas con la MISMA importancia (mismo tamaño de card)
  const measures = state.selectedMeasures.map((m) => ({ m, v: state.measureValues[m] }))
  const [manageOpen, setManageOpen] = useState(false) // editor de "mis medidas"
  const water = state.nutrition[keyOf(today)]?.water ?? 0
  const waterGoal = 2000
  // Energía del día (kcal registradas) + meta derivable (kcalGoal del usuario, o TDEE estimado como en Comida).
  const kcalToday = useMemo(
    () => (state.nutrition[keyOf(today)]?.meals ?? []).reduce((n, m) => n + (m.kcal || 0), 0),
    [state.nutrition, today], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const kcalGoal = state.kcalGoal ?? tdee(state)
  const name = state.profile.name?.split(' ')[0] ?? ''
  const fecha = `${DIAS_ABR[now.getDay()]} ${now.getDate()} ${MES[now.getMonth()]}`

  // Numerales de nutrición con cuenta (todo readout cuenta — sistema number-motion)
  const waterL = Math.round(water / 100) / 10
  const waterAnim = useCountUp(waterL, { decimals: 1, reduced: !!reduce })
  const kcalAnim = useCountUp(kcalToday, { decimals: 0, reduced: !!reduce })

  // R27: estado colapsable del mapa de inyección
  const [mapOpen, setMapOpen] = useState(false)
  const [selectedSite, setSelectedSite] = useState<InjectionSite | null>(null)

  // M9: abrir Registrar pre-poblado con el producto
  function openRegistrarForProduct(product: string) {
    dispatch({ t: 'setActiveProduct', product })
    dispatch({ t: 'sheet', sheet: 'registrar', arg: product })
  }

  // "Marcar" — confirmación rápida (hora + efecto) con dosis/sitio pre-cargados.
  // Si no hay dosis recordada, cae al Registrar completo. (idea del flujo previo, diseño v2)
  function markDose(product: string) {
    const dose = doseForProduct(state, product)
    if (!dose) {
      openRegistrarForProduct(product)
      return
    }
    const rec = state.productRecon[product]
    const doseMg = doseToMg(dose.value, dose.unit, rec?.vialMg, rec?.aguaMl) ?? undefined
    const scheduledTs = tsFor(product)
    const suggestedSite = nextInjectionSite(state.lastInjectionSite?.[product])
    dispatch({
      t: 'sheet',
      sheet: 'dose-confirm',
      arg: JSON.stringify({ product, value: dose.value, unit: dose.unit, doseMg, scheduledTs, nowTs: Date.now(), suggestedSite }),
    })
  }

  // M2: editar cadencia/protocolo de un producto
  function editProtocol(product: string) {
    dispatch({ t: 'sheet', sheet: 'protocolo-edit', arg: product })
  }

  // "No hoy" — saltar el día (no penaliza adherencia) + feedback explícito
  function skipDose(product: string) {
    dispatch({ t: 'logSkip', product })
    dispatch({ t: 'toast', msg: `${product}: saltada hoy · no afecta tu adherencia` })
  }

  // M10: KPI card → abrir MedidaSheet pre-seleccionada con esa medida
  function openMedida(measureName: string) {
    dispatch({ t: 'sheet', sheet: 'medida', arg: measureName })
  }

  // En Inicio el mapa es SOLO un visor interactivo: tocar una zona la selecciona para ver su
  // detalle (recencia/última vez), NO navega a Registrar. (El registro del sitio se hace dentro
  // de Registrar dosis, donde el mapa sí elige el sitio de la dosis.)
  function handleMapSelect(site: InjectionSite) {
    setSelectedSite((prev) => (prev === site ? null : site))
  }

  // Datos de "Lo siguiente" derivados (solo lectura): sitio sugerido por rotación + dosis recordada.
  const nextSite = next ? nextInjectionSite(state.lastInjectionSite?.[next.product]) : null
  const nextDose = next ? doseForProduct(state, next.product) : null
  const nextIsToday = next ? dayDiff(startOfDay(next.date), today) === 0 : false
  const nextDayLabel = next
    ? (() => {
        const d = dayDiff(startOfDay(next.date), today)
        return d === 0 ? 'Hoy' : d === 1 ? 'Mañana' : DIAS_ABR[next.date.getDay()]
      })()
    : ''

  // §-folios secuenciales — se numeran en orden de render (las secciones condicionales corren la cuenta).
  let folio = 0
  const nf = () => ++folio

  return (
    <motion.div
      className="flex flex-col gap-5 px-4 pb-32 pt-[max(20px,env(safe-area-inset-top))]"
      initial={reduce ? false : 'hidden'}
      animate="show"
      variants={staggerContainer}
    >
      {/* ── Masthead editorial: kicker mono + fecha, saludo serif, Diario ›, TrustChip ── */}
      <motion.header variants={fadeUp} className="flex flex-col">
        <div className="border-b-[1.5px] border-b-ink pb-3">
          {/* pr-14 despeja el engrane flotante de Ajustes (AppV2) — sin él, la fecha quedaba tapada */}
          <div className="flex items-center justify-between gap-3 whitespace-nowrap pr-14 font-mono text-[12px] font-medium uppercase tracking-[0.1em] text-ink-3">
            <span>Hacktrack · Tu bitácora</span>
            <span>{fecha}</span>
          </div>
          <div className="mt-2 flex items-end justify-between gap-3">
            <h1 className="min-w-0 truncate font-serif text-[34px] font-normal leading-none tracking-[-0.01em] text-ink">
              Hola{name ? `, ${name}` : ''}
            </h1>
            <button
              type="button"
              onClick={() => dispatch({ t: 'tab', tab: 'diario' })}
              aria-label="Abrir tu Diario"
              className="flex min-h-[44px] shrink-0 items-end pb-0.5 font-mono text-[12px] font-medium uppercase tracking-[0.04em] text-blue active:opacity-70"
            >
              Diario ›
            </button>
          </div>
        </div>
        {/* Graft del veredicto: señal de confianza → abre Perfil y privacidad (el resumen ARCO vive ahí) */}
        <TrustChip className="mt-1.5 self-start" onOpen={() => dispatch({ t: 'sheet', sheet: 'perfil' })} />
        {/* Hero de fondo restaurado (Jan 2026-07-18) como placa editorial, re-coloreado a oro
            vía .hero-media (filtro estático). Reduced-motion → solo el poster. */}
        <figure className="mt-3 overflow-hidden rounded-sm border border-hairline" aria-hidden>
          {reduce ? (
            <img src={heroPoster} alt="" loading="lazy" decoding="async" className="hero-media block h-auto w-full" />
          ) : (
            <AutoVideo src={heroVideo} poster={heroPoster} className="hero-media block h-auto w-full" />
          )}
        </figure>
      </motion.header>

      {/* ── § Adherencia — dial ámbar + numeral serif héroe. #4: sin nada que medir, bienvenida (no "0% fracaso") ── */}
      <motion.section variants={fadeUp} className="flex flex-col gap-3">
        <FolioLabel n={nf()}>Adherencia · {MES[today.getMonth()]}</FolioLabel>
        {adh && adh.due > 0 ? (
          <Glass className="flex items-center gap-4 p-4">
            <Ring value={adh.pct} goal={100} unit="%" label="al día" size={140} stroke={11} />
            <div className="min-w-0 flex-1">
              <p className="font-mono text-[12px] font-medium uppercase tracking-[0.1em] text-ink-3">Este mes</p>
              <StatNumber value={adh.taken} unit={`/ ${adh.due} dosis`} decimals={0} size={29} className="mt-1.5" />
              <p className="mt-1 flex items-center gap-1.5 text-[14px] leading-snug text-ink-2">
                al día de tu protocolo
                <TermInfo term="adherencia">
                  Porcentaje de las tomas programadas ya vencidas que sí registraste. Las futuras no cuentan.
                </TermInfo>
              </p>
              <div className="mt-3 flex flex-col items-start gap-2">
                {prevMonth != null && adh.pct !== prevMonth.pct && (
                  <span
                    className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 font-mono text-[12px] font-medium ${
                      adh.pct > prevMonth.pct
                        ? 'border-[color-mix(in_srgb,var(--ok)_24%,transparent)] bg-[color-mix(in_srgb,var(--ok)_9%,transparent)] text-ok'
                        : 'border-[color-mix(in_srgb,var(--alert)_24%,transparent)] bg-[color-mix(in_srgb,var(--alert)_8%,transparent)] text-alert'
                    }`}
                  >
                    <span aria-hidden>{adh.pct > prevMonth.pct ? '▲' : '▼'}</span>
                    {Math.abs(adh.pct - prevMonth.pct)} pts vs. {prevMonth.label}
                  </span>
                )}
                {prevMonth != null && adh.pct === prevMonth.pct && (
                  <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-hairline px-2.5 py-1 font-mono text-[12px] font-medium text-ink-2">
                    <span aria-hidden>→</span> igual que {prevMonth.label}
                  </span>
                )}
                {streak > 0 && (
                  <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-[color-mix(in_srgb,var(--amber)_28%,transparent)] bg-amber-soft px-2.5 py-1 font-mono text-[12px] font-medium text-ink-2">
                    <span aria-hidden className="text-amber-ink">◆</span>
                    {/* rachaLabel: en tienda dice "racha de registro" (Apple 1.4.3); PWA sin cambio */}
                    {rachaLabel()} {streak} d
                    {streakStart ? (
                      <span className="text-ink-3">
                        · desde {streakStart.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
                      </span>
                    ) : null}
                  </span>
                )}
              </div>
            </div>
          </Glass>
        ) : dosesLogged > 0 ? (
          <Glass className="flex items-center gap-4">
            <span aria-hidden className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[color-mix(in_srgb,var(--blue)_12%,transparent)] text-blue">
              <Check size={22} strokeWidth={2.5} />
            </span>
            <div className="flex-1">
              <p className="text-[15px] font-semibold text-ink">
                {dosesLogged} {dosesLogged === 1 ? 'dosis registrada' : 'dosis registradas'}
              </p>
              <p className="mt-0.5 text-[13px] leading-relaxed text-ink-2">
                Ya están en tu calendario y diario. Tu % de adherencia aparece en cuanto venza una toma programada de tu protocolo.
              </p>
            </div>
          </Glass>
        ) : (
          <Glass className="flex items-center gap-4">
            <span aria-hidden className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[color-mix(in_srgb,var(--blue)_12%,transparent)] text-blue">
              <Check size={22} strokeWidth={2.5} />
            </span>
            <div className="flex-1">
              <p className="text-[15px] font-semibold text-ink">Todo listo para empezar</p>
              <p className="mt-0.5 text-[13px] leading-relaxed text-ink-2">
                Marca tu primera dosis y tu adherencia empezará a medirse aquí.
              </p>
            </div>
          </Glass>
        )}
      </motion.section>

      {/* ── § Lo siguiente — próxima toma: bloque de hora serif + producto + cuenta regresiva ── */}
      <motion.section variants={fadeUp} className="flex flex-col gap-3">
        <FolioLabel n={nf()}>Lo siguiente</FolioLabel>
        {next ? (
          <Glass className="p-0">
            <div className="flex items-start gap-3.5 px-4 pb-2 pt-4">
              <div className="min-w-[70px] shrink-0 border-r-[1.5px] border-r-hairline pr-3.5 text-center">
                <p className="font-serif text-[29px] font-normal leading-none tabular-nums text-ink">{hhmm(next.date)}</p>
                <p className="mt-1.5 font-mono text-[12px] font-medium uppercase tracking-[0.12em] text-ink-3">{nextDayLabel}</p>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="min-w-0 truncate font-serif text-[21px] font-normal leading-tight text-ink">{next.product}</h2>
                  <span className="shrink-0 whitespace-nowrap rounded-md border border-[color-mix(in_srgb,var(--amber)_26%,transparent)] bg-amber-soft px-2 py-1 font-mono text-[12px] font-medium text-ink-2">
                    {countdown(next.date, now)}
                  </span>
                </div>
                {sameTimeCount > 1 && (
                  <span className="mt-1 inline-flex rounded-full bg-raised px-2 py-0.5 font-mono text-[12px] text-ink-2">
                    +{sameTimeCount - 1} más a esta hora
                  </span>
                )}
                {nextSite && (
                  <p className="mt-1.5 flex items-start gap-2 font-mono text-[13px] text-ink-2">
                    <span
                      aria-hidden
                      className="mt-[3px] inline-block h-2.5 w-2.5 shrink-0 rotate-45 bg-blue"
                      style={{ borderRadius: '50% 50% 50% 0' }}
                    />
                    {/* Sin truncate: los sitios largos ("Glúteo izquierdo") envuelven a 2 líneas
                        en vez de cortarse con "…" (la ref muestra la línea completa). */}
                    <span className="min-w-0 leading-snug">{SITE_LABEL[nextSite]} · tu rotación</span>
                  </p>
                )}
                {nextDose && (
                  <p className="mt-1 text-[13px] text-ink-3">
                    {nextDose.value} {nextDose.unit} · tu registro
                  </p>
                )}
              </div>
            </div>
            <div className="flex gap-2.5 px-4 pb-4 pt-2">
              <Button size="md" className="flex-1" onClick={onRegistrar}>
                Registrar dosis
              </Button>
              {nextIsToday && (
                <Button variant="ghost" size="md" className="w-[104px]" onClick={() => skipDose(next.product)}>
                  Hoy no
                </Button>
              )}
            </div>
          </Glass>
        ) : (
          <Glass className="p-4">
            <h2 className="text-[17px] font-semibold text-ink">Sin tomas programadas</h2>
            <p className="mt-1 text-[13px] leading-relaxed text-ink-2">
              Crea un protocolo para ver tu cuenta regresiva.
            </p>
            <Button size="full" className="mt-4" onClick={onRegistrar}>
              Registrar dosis
            </Button>
          </Glass>
        )}
      </motion.section>

      {/* ── § Quedó pendiente — #52: dosis vencidas de días anteriores (colapsable, filo rojo) ── */}
      {pending.length > 0 && (
        <motion.section variants={fadeUp} className="flex flex-col gap-3">
          <FolioLabel n={nf()}>Quedó pendiente</FolioLabel>
          <div
            className="glass overflow-hidden rounded-sm"
            style={{ borderLeftWidth: 3, borderLeftColor: 'var(--alert)' }}
          >
            <button
              type="button"
              onClick={() => setPendingOpen((o) => !o)}
              aria-expanded={pendingOpen}
              className="flex min-h-[44px] w-full items-center gap-2.5 px-3.5 py-3 text-left"
            >
              <Clock size={18} className="shrink-0 text-alert" aria-hidden />
              <span className="flex-1 text-[14px] font-semibold text-ink">
                {pending.length} {pending.length === 1 ? 'dosis pendiente' : 'dosis pendientes'} de días anteriores
              </span>
              {pendingOpen ? <ChevronUp size={16} className="text-ink-3" /> : <ChevronDown size={16} className="text-ink-3" />}
            </button>
            {pendingOpen && (
              <div className="flex flex-col">
                {pending.map((p, i) => (
                  <div key={`${p.product}-${i}`} className="flex items-center gap-3 border-t border-t-hairline px-3.5 py-3">
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate font-serif text-[16px] font-medium leading-tight text-ink">{p.product}</span>
                      <span className="mt-0.5 font-mono text-[12px] text-ink-3">
                        {daysAgo(p.date)} · {hhmm(p.date)} — no se registró
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      onClick={() => {
                        dispatch({ t: 'setDraftDose', draft: { ts: p.date.getTime(), overdue: true } })
                        dispatch({ t: 'setActiveProduct', product: p.product })
                        dispatch({ t: 'sheet', sheet: 'registrar', arg: p.product })
                      }}
                    >
                      Registrar (atrasada)
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.section>
      )}

      {/* ── § Tus dosis de hoy — ACCIONABLE (R24, R27, M9): semáforo de ventana ●◐○ + texto ── */}
      {todayDoses.length > 0 && (
        <motion.section variants={fadeUp} className="flex flex-col gap-3">
          <FolioLabel n={nf()}>Tus dosis de hoy</FolioLabel>
          <Glass className="flex flex-col gap-0 overflow-hidden p-0">
            {todayDoses.map(({ product, done, skipped }, idx) => {
              const ts = tsFor(product)
              const win = !done && !skipped ? windowStatus(ts, nowTs) : null
              const isLast = idx === todayDoses.length - 1
              const logTs = done ? loggedDoseTs(state, today, product) : null

              return (
                <div
                  key={product}
                  className={`flex flex-col gap-2 px-3.5 py-3${!isLast ? ' border-b border-b-hairline' : ''}`}
                  style={{
                    // Borde izquierdo semáforo solo en pendientes
                    borderLeft: win ? `3px solid ${WIN_COLOR[win]}` : '3px solid transparent',
                    opacity: skipped ? 0.55 : 1,
                  }}
                >
                  {/* Fila 1: indicador + nombre serif + badge de estado */}
                  <div className="flex items-center gap-3">
                    <span
                      aria-hidden
                      className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border-[1.5px] ${
                        done ? 'border-blue bg-blue text-primary-foreground' : skipped ? 'border-hairline text-ink-3' : 'border-hairline text-transparent'
                      }`}
                    >
                      {done ? <Check size={14} strokeWidth={3} /> : skipped ? <X size={12} /> : null}
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span
                        className={`truncate font-serif text-[17px] font-normal leading-tight ${done || skipped ? 'text-ink-3 line-through' : 'text-ink'}`}
                      >
                        {product}
                      </span>
                      <span className="mt-0.5 flex items-center gap-1.5 font-mono text-[12px] text-ink-3">
                        {done
                          ? `registrada${logTs ? ` · ${hhmm(new Date(logTs))}` : ''}`
                          : skipped
                            ? 'saltada hoy'
                            : hhmm(new Date(ts))}
                      </span>
                      {/* M2: cadencia del protocolo — toca para editar días/cadencia */}
                      {state.protocols[product]?.cadence && (
                        <button
                          type="button"
                          onClick={() => editProtocol(product)}
                          aria-label={`Editar protocolo de ${product}`}
                          // padding + margen negativo compensatorio: área táctil ≥44px sin mover el layout (chip visual intacto; antes: mt-1)
                          className="-mx-2 -mt-1 -mb-2 self-start rounded-full px-2 py-2 transition-opacity active:opacity-60"
                        >
                          <CadenciaChip cad={state.protocols[product]?.cadence} />
                        </button>
                      )}
                    </div>
                    {(done || skipped) && (
                      <span
                        className="inline-flex h-8 shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2.5 font-mono text-[12px] font-semibold"
                        style={{
                          background: done
                            ? 'color-mix(in srgb, var(--ok) 12%, transparent)'
                            : 'color-mix(in srgb, var(--ink-3) 12%, transparent)',
                          color: done ? 'var(--ok)' : 'var(--ink-3)',
                        }}
                      >
                        {done ? <Check size={12} strokeWidth={2.6} /> : <X size={11} />}
                        {done ? 'Hecha' : 'Saltada'}
                      </span>
                    )}
                  </div>

                  {/* Fila 2 (solo pendientes): semáforo de ventana + acciones */}
                  {!done && !skipped && win && (
                    <div className="flex items-center justify-between gap-2 pl-9">
                      <span
                        className="flex items-center gap-1.5 font-mono text-[12px] font-semibold"
                        style={{ color: WIN_COLOR[win] }}
                      >
                        <span aria-hidden className="leading-none">{WIN_GLYPH[win]}</span>
                        {WIN_LABEL[win]}
                      </span>
                      <div className="flex shrink-0 items-center gap-2">
                        {/* Confirmación rápida (dose-confirm): hora + efecto, dosis/sitio pre-cargados */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => markDose(product)}
                          aria-label={`Marcar dosis de ${product}`}
                          className="gap-1.5 px-3 text-[13px]"
                        >
                          <Check size={13} strokeWidth={2.5} />
                          Marcar
                        </Button>
                        {/* "No hoy" — saltar el día (no penaliza adherencia). #13: claramente tocable */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => skipDose(product)}
                          aria-label={`Saltar dosis de ${product} hoy`}
                          className="gap-1.5 px-3 text-[13px]"
                        >
                          <SkipForward size={13} strokeWidth={2.5} />
                          No hoy
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </Glass>
        </motion.section>
      )}

      {/* ── #45 / veredicto v2: card "Stock bajo" — derivación de vialStock, copy honesto, SIN verbos de compra ── */}
      {lowStock.length > 0 && (
        <motion.div variants={fadeUp}>
          <Glass className="flex items-start gap-3 p-3.5" style={{ borderLeftWidth: 3, borderLeftColor: 'var(--warn)' }}>
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-warn" aria-hidden />
            <p className="text-[13px] leading-relaxed text-ink-2">
              <span className="font-semibold text-ink">Stock bajo:</span>{' '}
              {lowStock.map((l) => `${l.product} (~${Math.round(l.remainingMg)} mg restantes)`).join(' · ')}.
              {' '}Considera preparar un vial nuevo.
            </p>
          </Glass>
        </motion.div>
      )}

      {/* ── § Tus señales — small multiples: numeral serif + sparkline + delta con unidad (M10) ── */}
      {/* Encabezado + "Gestionar" SIEMPRE visibles (también con 0 medidas, para poder agregar). */}
      <motion.section variants={fadeUp} className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <FolioLabel n={nf()} className="min-w-0 flex-1">Tus señales · 7 días</FolioLabel>
          <button
            type="button"
            onClick={() => setManageOpen(true)}
            aria-label="Gestionar mis medidas"
            className="flex min-h-[44px] shrink-0 items-center font-mono text-[12px] font-semibold uppercase tracking-[0.04em] text-blue active:opacity-70"
          >
            Gestionar
          </button>
        </div>

        {/* "Cambio de medidas" — slab fijo (no removible), ancho completo. Abre la misma captura compuesta
            del onboarding (peso/altura/%grasa/%músculo) → agrega un registro nuevo al diario, no sobreescribe. */}
        <button
          type="button"
          onClick={() => dispatch({ t: 'sheet', sheet: 'medidas' })}
          aria-label="Cambio de medidas: registrar peso, altura, % grasa y % músculo juntos"
          className="flex w-full items-center gap-3 rounded-sm border border-[color-mix(in_srgb,var(--blue)_30%,transparent)] bg-[color-mix(in_srgb,var(--blue)_8%,transparent)] px-3.5 py-2.5 text-left transition-opacity active:opacity-70"
        >
          <span aria-hidden className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[color-mix(in_srgb,var(--blue)_14%,transparent)] text-blue">
            <Ruler size={16} />
          </span>
          <span className="flex flex-col">
            <span className="text-[14px] font-semibold text-ink">Cambio de medidas</span>
            <span className="text-[12px] text-ink-3">Peso, altura, % grasa y músculo de una vez</span>
          </span>
          <ChevronRight size={18} className="ml-auto shrink-0 text-blue" />
        </button>

        {measures.length > 0 ? (
          <>
            <div className="grid grid-cols-2 gap-2.5">
              {measures.map(({ m, v }) => {
                const serie = sparkSeries(state.history[m], nowTs)
                const rawDelta = serie.length >= 2 ? serie[serie.length - 1] - serie[0] : null
                const delta = rawDelta != null ? Math.round(rawDelta * 10) / 10 : null
                const meta = MEASURE_META[m]
                const unit = meta?.kind === 'num' ? (meta.unit ?? '') : ''
                // Tono por dirección deseada (down: bajar es mejorar) — nunca solo color: ▲▼→ + texto.
                const good = delta != null && delta !== 0 && (meta?.down ? delta < 0 : delta > 0)
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => openMedida(m)}
                    aria-label={`Registrar medida: ${m}`}
                    className="rounded-sm text-left"
                  >
                    <Glass className="flex h-full flex-col p-3 transition-opacity active:opacity-70">
                      <p className="truncate font-mono text-[12px] font-medium uppercase tracking-[0.1em] text-ink-3">{m}</p>
                      {v != null ? (
                        <StatNumber
                          value={v}
                          unit={measureSuffix(m) || undefined}
                          decimals={Number.isInteger(v) ? 0 : 1}
                          size={27}
                          className="mt-2"
                        />
                      ) : (
                        <p aria-hidden className="mt-2 font-serif text-[27px] leading-none text-ink-3">—</p>
                      )}
                      {serie.length >= 2 && <Sparkline values={serie} reduce={!!reduce} />}
                      {delta != null && (
                        <p
                          className={`mt-1.5 font-mono text-[12px] font-medium ${
                            delta === 0 ? 'text-ink-3' : good ? 'text-ok' : 'text-alert'
                          }`}
                        >
                          {delta === 0 ? (
                            <>→ estable</>
                          ) : (
                            <>
                              <span aria-hidden>{delta > 0 ? '▲' : '▼'}</span> {Math.abs(delta)}
                              {unit ? ` ${unit}` : ''}
                            </>
                          )}
                        </p>
                      )}
                    </Glass>
                  </button>
                )
              })}
            </div>
            <p className="text-[13px] text-ink-3">Toca una tarjeta para registrar esa medida.</p>
          </>
        ) : (
          <p className="text-[13px] text-ink-2">
            Aún no sigues métricas. Toca <span className="font-semibold text-blue">Gestionar</span> para elegir las que quieres seguir.
          </p>
        )}
      </motion.section>

      {/* ── § Nutrición de hoy — hidratación (azul) + energía kcal (ámbar), todo tu registro ── */}
      <motion.section variants={fadeUp} className="flex flex-col gap-3">
        <FolioLabel n={nf()}>Nutrición de hoy</FolioLabel>
        <Glass className="p-4">
          <div>
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-[15px] font-semibold text-ink">
                <Droplet size={16} className="text-blue" aria-hidden /> Hidratación
              </span>
              <span className="font-mono text-[13px] tabular-nums text-ink-2">
                <span className="text-[16px] font-semibold text-ink">{waterAnim.toFixed(1)}</span> / {(waterGoal / 1000).toFixed(1)} L
              </span>
            </div>
            <TrackBar pct={(water / waterGoal) * 100} color="var(--blue)" reduce={!!reduce} />
            <button
              type="button"
              onClick={() => dispatch({ t: 'tab', tab: 'comida' })}
              className="mt-1 inline-flex min-h-[44px] items-center gap-1 text-[13px] font-medium text-blue active:opacity-70"
            >
              Registrar agua en Comida <ChevronRight size={14} aria-hidden />
            </button>
          </div>
          <div className="mt-3 border-t border-t-hairline pt-4">
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-[15px] font-semibold text-ink">
                <Flame size={16} className="text-amber" aria-hidden /> Energía (kcal)
              </span>
              <span className="font-mono text-[13px] tabular-nums text-ink-2">
                <span className="text-[16px] font-semibold text-ink">{Math.round(kcalAnim).toLocaleString('es-MX')}</span>
                {kcalGoal != null ? ` / ${kcalGoal.toLocaleString('es-MX')} kcal` : ' kcal registradas'}
              </span>
            </div>
            {kcalGoal != null && <TrackBar pct={(kcalToday / kcalGoal) * 100} color="var(--amber)" reduce={!!reduce} />}
          </div>
        </Glass>
      </motion.section>

      {/* ── § Rotación de sitios — R27: mapa colapsable, SOLO visor (el registro del sitio vive en Registrar) ── */}
      <motion.section variants={fadeUp} className="flex flex-col gap-3">
        <FolioLabel n={nf()}>Rotación de sitios</FolioLabel>
        <div className="glass overflow-hidden rounded-sm">
          <button
            type="button"
            onClick={() => setMapOpen((o) => !o)}
            aria-expanded={mapOpen}
            aria-controls="injection-map-section"
            className="flex min-h-[48px] w-full items-center justify-between px-4 py-3 text-left"
          >
            <span className="flex items-center gap-2.5 text-[14px] font-semibold text-ink">
              <span aria-hidden className="font-mono text-[13px] leading-none text-amber-ink">◎</span>
              Mapa de sitios
            </span>
            {mapOpen ? (
              <ChevronUp size={16} className="text-ink-3" />
            ) : (
              <ChevronDown size={16} className="text-ink-3" />
            )}
          </button>

          <AnimatePresence initial={false}>
            {mapOpen && (
              <motion.div
                id="injection-map-section"
                key="map"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={reduce ? { duration: 0 } : { duration: 0.28, ease: EASE }}
                style={{ overflow: 'hidden' }}
              >
                <div className="border-t border-t-hairline p-3">
                  <InjectionMap
                    selected={selectedSite}
                    onSelect={handleMapSelect}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.section>

      {/* Cierre editorial: la bitácora es tu registro — no recomendación de dosis ni consejo médico. */}
      <motion.div variants={fadeUp} className="flex gap-2.5 rounded-sm border border-hairline bg-raised px-3.5 py-3">
        <Info size={16} className="mt-0.5 shrink-0 text-ink-3" aria-hidden />
        <p className="text-[12px] leading-relaxed text-ink-2">
          Tu bitácora personal. Los valores son <span className="font-semibold text-ink">tu registro</span>, no una
          recomendación de dosis ni consejo médico.
        </p>
      </motion.div>

      {/* Editor de "mis medidas" (agregar/quitar las que sigues) */}
      <ManageMeasuresSheet open={manageOpen} onClose={() => setManageOpen(false)} />
    </motion.div>
  )
}
