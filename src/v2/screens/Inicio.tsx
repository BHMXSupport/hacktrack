import { useMemo, useState, useEffect } from 'react'
import { motion, useReducedMotion, AnimatePresence } from 'framer-motion'
import {
  Shield, Droplet, ChevronRight, Check, Clock, X, ChevronDown, ChevronUp, SkipForward, AlertTriangle,
} from 'lucide-react'
import { useApp, nextInjectionSite, doseForProduct, adherenceMonth } from '../../lib/store'
import type { InjectionSite } from '../../lib/types'
import { startOfDay } from '../../lib/cadence'
import { doseToMg } from '../../lib/calc'
import { CadenciaChip } from './ProtocoloEditSheet'
import { upcomingDoses, protocolStreak, dayProducts, doseTakenOnProduct, doseSkippedOnProduct } from '../../lib/calendar'
import { Glass } from '../ui/Glass'
import { DataPlate } from '../ui/DataPlate'
import { Ring } from '../ui/Ring'
import { Button } from '../ui/Button'
import { InjectionMap } from '../ui/InjectionMap'
import { AutoVideo } from '../ui/AutoVideo'
import heroSrc from '../../assets/rebuild/hero-precision.mp4'
import posterSrc from '../../assets/rebuild/hero-poster.webp'

const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const keyOf = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

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

const fade = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: [0, 0, 0, 1] as [number, number, number, number] },
  },
}

export function Inicio({ onRegistrar }: { onRegistrar: () => void }) {
  const { state, dispatch } = useApp()
  const reduce = useReducedMotion()
  const playHero = !reduce
  // #15: reloj propio que tickea cada 30 s — antes `now` solo se recalculaba al re-renderizar
  // (cuenta regresiva y semáforo se congelaban si el reducer de 'tick' no cambiaba el estado).
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(id)
  }, [])
  const nowTs = now.getTime()

  const next = useMemo(() => upcomingDoses(state, now, 1)[0] ?? null, [state])
  const streak = useMemo(() => protocolStreak(state, now), [state])
  const today = startOfDay(now)

  // #2/#3: una sola fuente de verdad (tallyDoses vía adherenceMonth) — respeta cadencia real
  // (semanal/cadaN/ciclo/por-uso) y solo cuenta dosis VENCIDAS en el denominador. null = nada que medir.
  const adh = useMemo(() => adherenceMonth(state, now), [state])

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

  // ts de toma programada por producto (reminderTime)
  function tsFor(product: string): number {
    const rt = state.protocols[product]?.reminderTime || state.protocol?.reminderTime || '08:00'
    const [hh, mm] = rt.split(':').map(Number)
    const at = new Date(today)
    at.setHours(hh || 0, mm || 0, 0, 0)
    return at.getTime()
  }

  const measures = state.selectedMeasures.slice(0, 4).map((m) => ({ m, v: state.measureValues[m] }))
  const water = state.nutrition[keyOf(today)]?.water ?? 0
  const waterGoal = 2000
  const name = state.profile.name?.split(' ')[0] ?? ''
  const fecha = `${DIAS[now.getDay()]}, ${now.getDate()} ${MES[now.getMonth()]}`

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

  // R27/#18: onSelect del mapa → abrir Registrar con el sitio YA pre-seleccionado.
  // Se pasa por draftDose.site (RegistrarSheet lo consume) — antes la selección del mapa
  // era decorativa y no llegaba al registro.
  function handleMapSelect(site: InjectionSite) {
    setSelectedSite(site)
    dispatch({ t: 'setDraftDose', draft: { site } })
    const pending = todayDoses.find((d) => !d.done && !d.skipped)
    if (pending) {
      dispatch({ t: 'setActiveProduct', product: pending.product })
      dispatch({ t: 'sheet', sheet: 'registrar', arg: pending.product })
    } else {
      dispatch({ t: 'sheet', sheet: 'registrar' })
    }
  }

  return (
    <motion.div
      className="flex flex-col gap-4 px-4 pb-32 pt-[max(20px,env(safe-area-inset-top))]"
      initial={reduce ? false : 'hidden'}
      animate="show"
      variants={{ show: { transition: { staggerChildren: 0.07 } } }}
    >
      {/* Header */}
      <motion.div variants={fade} className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] text-muted-foreground">{fecha}</p>
          <h1 className="truncate text-[28px] font-bold leading-tight text-foreground">
            Hola{name ? `, ${name}` : ''}
          </h1>
        </div>
        <span className="mt-1 inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-teal/25 bg-teal/10 px-3 py-1.5 text-[12px] font-medium text-teal">
          <Shield size={13} /> Tus datos son tuyos
        </span>
      </motion.div>

      {/* HERO — próxima toma con video en movimiento + readout en data-plate */}
      <motion.div variants={fade}>
        <Glass className="relative overflow-hidden p-0">
          <img
            src={posterSrc}
            alt=""
            aria-hidden
            className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-45"
          />
          {playHero && (
            <AutoVideo
              src={heroSrc}
              poster={posterSrc}
              className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-50"
            />
          )}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0D1117] via-[#0D1117]/70 to-transparent" />
          <div className="relative p-5">
            <p className="mb-3 flex items-center gap-2 font-mono text-[12px] font-semibold uppercase tracking-[0.12em] text-teal">
              <Clock size={14} /> Próxima toma
            </p>
            {next ? (
              <>
                <h2 className="mb-3 text-[20px] font-bold text-foreground">{next.product}</h2>
                <DataPlate className="inline-flex px-4 py-2.5">
                  <span className="font-mono text-readout font-light text-[var(--teal-bright)]">
                    {countdown(next.date, now)}
                  </span>
                </DataPlate>
                <p className="mt-2 text-[12px] text-secondary-foreground">
                  {next.date.toLocaleDateString('es-MX', {
                    weekday: 'long',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </>
            ) : (
              <>
                <h2 className="mb-2 text-[18px] font-bold text-foreground">Sin tomas programadas</h2>
                <p className="text-[13px] text-secondary-foreground">
                  Crea un protocolo para ver tu cuenta regresiva.
                </p>
              </>
            )}
            <Button size="full" className="mt-4" onClick={onRegistrar}>
              Registrar dosis
            </Button>
          </div>
        </Glass>
      </motion.div>

      {/* Adherencia + racha — #4: si no hay nada que medir aún, bienvenida (no un "0% fracaso") */}
      <motion.div variants={fade}>
        {adh && adh.due > 0 ? (
          <Glass className="flex items-center gap-5">
            <Ring
              value={adh.pct}
              goal={100}
              unit="%"
              label="adherencia"
              sub={streak > 0 ? `racha ${streak} d` : undefined}
              size={132}
              stroke={11}
            />
            <div className="flex-1">
              <p className="text-[12px] uppercase tracking-wider text-muted-foreground">Este mes</p>
              <p className="font-mono text-[26px] font-semibold tabular-nums text-foreground">
                {adh.taken}
                <span className="text-muted-foreground"> / {adh.due}</span>
              </p>
              <p className="text-[13px] text-secondary-foreground">dosis registradas</p>
            </div>
          </Glass>
        ) : (
          <Glass className="flex items-center gap-4">
            <span aria-hidden className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-teal/12 text-teal">
              <Check size={22} strokeWidth={2.5} />
            </span>
            <div className="flex-1">
              <p className="text-[15px] font-semibold text-foreground">Todo listo para empezar</p>
              <p className="mt-0.5 text-[13px] text-secondary-foreground">
                Marca tu primera dosis y tu adherencia empezará a medirse aquí.
              </p>
            </div>
          </Glass>
        )}
      </motion.div>

      {/* ── #45: Aviso de stock bajo del vial ── */}
      {lowStock.length > 0 && (
        <motion.div variants={fade}>
          <div className="flex items-start gap-2.5 rounded-xl border border-warn/30 bg-warn/[0.08] px-3 py-2.5">
            <AlertTriangle size={15} className="mt-0.5 shrink-0 text-warn" aria-hidden />
            <p className="text-[12px] leading-relaxed text-secondary-foreground">
              <span className="font-semibold text-foreground">Stock bajo:</span>{' '}
              {lowStock.map((l) => `${l.product} (~${Math.round(l.remainingMg)} mg)`).join(' · ')}.
              {' '}Considera preparar un vial nuevo.
            </p>
          </div>
        </motion.div>
      )}

      {/* ── Tus dosis de hoy — ACCIONABLE (R24, R27, M9) ── */}
      {todayDoses.length > 0 && (
        <motion.div variants={fade}>
          <p className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
            Tus dosis de hoy
          </p>
          <Glass className="flex flex-col gap-0 p-0 overflow-hidden">
            {todayDoses.map(({ product, done, skipped }, idx) => {
              const ts = tsFor(product)
              const win = !done && !skipped ? windowStatus(ts, nowTs) : null
              const isLast = idx === todayDoses.length - 1

              return (
                <div
                  key={product}
                  className={`flex items-center gap-3 px-3 py-3 min-h-[56px]${!isLast ? ' border-b border-white/[0.07]' : ''}`}
                  style={{
                    // Borde izquierdo semáforo solo en pendientes
                    borderLeft: win ? `3px solid ${WIN_COLOR[win]}` : '3px solid transparent',
                    opacity: skipped ? 0.55 : 1,
                  }}
                >
                  {/* Indicador estado */}
                  <span
                    aria-hidden
                    className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border ${
                      done
                        ? 'border-teal bg-teal text-primary-foreground'
                        : skipped
                          ? 'border-white/20 text-white/30'
                          : 'border-white/20 text-transparent'
                    }`}
                  >
                    {done ? <Check size={14} strokeWidth={3} /> : skipped ? <X size={12} /> : null}
                  </span>

                  {/* Nombre + ventana */}
                  <div className="flex flex-1 flex-col min-w-0">
                    <span
                      className="font-medium text-foreground text-[14px] leading-snug truncate"
                      style={{ textDecoration: done || skipped ? 'line-through' : 'none', opacity: done || skipped ? 0.6 : 1 }}
                    >
                      {product}
                    </span>
                    {win && !done && !skipped && (
                      <span
                        className="mt-0.5 flex items-center gap-1 text-[11px] font-semibold"
                        style={{ color: WIN_COLOR[win] }}
                      >
                        {/* #53: forma distinta por estado para no depender solo del color (daltonismo) */}
                        <span aria-hidden className="font-mono leading-none">
                          {win === 'late' ? '●' : win === 'near' ? '◐' : '○'}
                        </span>
                        {WIN_LABEL[win]}
                      </span>
                    )}
                    {done && (
                      <span className="text-[11px] text-ok mt-0.5 font-medium">Hecha</span>
                    )}
                    {skipped && (
                      <span className="text-[11px] text-muted-foreground mt-0.5">Saltada hoy</span>
                    )}
                    {/* M2: cadencia del protocolo — toca para editar días/cadencia */}
                    {state.protocols[product]?.cadence && (
                      <button
                        type="button"
                        onClick={() => editProtocol(product)}
                        aria-label={`Editar protocolo de ${product}`}
                        className="mt-1 self-start rounded-full transition-opacity active:opacity-60"
                      >
                        <CadenciaChip cad={state.protocols[product]?.cadence} />
                      </button>
                    )}
                  </div>

                  {/* Botones de acción */}
                  {!done && !skipped ? (
                    <div className="flex items-center gap-2 shrink-0">
                      {/* Confirmación rápida (dose-confirm): hora + efecto, dosis/sitio pre-cargados */}
                      <button
                        type="button"
                        onClick={() => markDose(product)}
                        aria-label={`Marcar dosis de ${product}`}
                        className="flex items-center justify-center gap-1.5 rounded-full px-3 h-[44px] min-w-[44px] font-semibold text-[12px] transition-colors"
                        style={{
                          background: 'color-mix(in srgb, var(--teal) 15%, transparent)',
                          border: '1.5px solid var(--teal)',
                          color: 'var(--teal-bright)',
                        }}
                      >
                        <Check size={13} strokeWidth={2.5} />
                        <span>Marcar</span>
                      </button>
                      {/* "No hoy" — saltar el día (no penaliza adherencia). #13: claramente tocable */}
                      <button
                        type="button"
                        onClick={() => skipDose(product)}
                        aria-label={`Saltar dosis de ${product} hoy`}
                        className="flex items-center justify-center gap-1.5 rounded-full h-[44px] min-w-[44px] px-3 font-semibold text-[12px] transition-colors active:opacity-70"
                        style={{
                          border: '1.5px solid rgba(255,255,255,0.28)',
                          background: 'rgba(255,255,255,0.06)',
                          color: 'var(--secondary-foreground)',
                        }}
                      >
                        <SkipForward size={13} strokeWidth={2.5} />
                        <span>No hoy</span>
                      </button>
                    </div>
                  ) : (
                    // Badge solo informativo cuando ya está resuelta
                    <span
                      className="inline-flex items-center gap-1 rounded-full px-2.5 h-[32px] text-[11px] font-semibold shrink-0"
                      style={{
                        background: done
                          ? 'color-mix(in srgb, var(--ok) 15%, transparent)'
                          : 'color-mix(in srgb, var(--muted-foreground) 10%, transparent)',
                        color: done ? 'var(--ok)' : 'var(--muted-foreground)',
                      }}
                    >
                      {done ? <Check size={11} /> : <X size={11} />}
                      {done ? 'Hecha' : 'Saltada'}
                    </span>
                  )}
                </div>
              )
            })}
          </Glass>
        </motion.div>
      )}

      {/* ── KPIs de medidas (M10: tap abre MedidaSheet) ── */}
      {measures.length > 0 && (
        <motion.div variants={fade} className="grid grid-cols-2 gap-3">
          {measures.map(({ m, v }) => (
            <button
              key={m}
              type="button"
              onClick={() => openMedida(m)}
              aria-label={`Registrar medida: ${m}`}
              className="text-left rounded-xl"
            >
              <Glass className="p-4 h-full transition-opacity active:opacity-70">
                <p className="text-[12px] text-muted-foreground">{m}</p>
                <p className="mt-1 font-mono text-[24px] font-semibold tabular-nums text-foreground">
                  {v != null ? v : '—'}
                </p>
                <p className="mt-1 text-[10px] text-teal font-medium">Toca para registrar</p>
              </Glass>
            </button>
          ))}
        </motion.div>
      )}

      {/* Hidratación */}
      <motion.div variants={fade}>
        <div className="rounded-lg border border-white/8 bg-raised p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="flex items-center gap-2 font-medium text-foreground">
              <Droplet size={16} className="text-teal" /> Hidratación hoy
            </span>
            <span className="font-mono tabular-nums text-foreground">
              {(water / 1000).toFixed(1)}
              <span className="text-muted-foreground"> / {(waterGoal / 1000).toFixed(0)} L</span>
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-teal"
              style={{ width: `${Math.min(100, (water / waterGoal) * 100)}%` }}
            />
          </div>
          <button
            onClick={() => dispatch({ t: 'tab', tab: 'comida' })}
            className="mt-3 inline-flex items-center gap-1 text-[13px] font-medium text-teal"
          >
            Registrar agua en Comida <ChevronRight size={14} />
          </button>
        </div>
      </motion.div>

      {/* ── R27: Mapa de inyección colapsable ── */}
      <motion.div variants={fade}>
        <button
          type="button"
          onClick={() => setMapOpen((o) => !o)}
          aria-expanded={mapOpen}
          aria-controls="injection-map-section"
          className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-raised px-4 py-3 text-left"
        >
          <span className="flex items-center gap-2 font-semibold text-[14px] text-foreground">
            <span
              aria-hidden
              className="grid h-5 w-5 place-items-center rounded-full font-mono text-[10px]"
              style={{ background: 'color-mix(in srgb, var(--teal) 15%, transparent)', color: 'var(--teal)' }}
            >
              ◎
            </span>
            Rotación de sitios
          </span>
          {mapOpen ? (
            <ChevronUp size={16} className="text-muted-foreground" />
          ) : (
            <ChevronDown size={16} className="text-muted-foreground" />
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
              transition={reduce ? { duration: 0 } : { duration: 0.28, ease: [0.25, 0, 0, 1] }}
              style={{ overflow: 'hidden' }}
            >
              <div className="mt-2">
                <InjectionMap
                  selected={selectedSite}
                  onSelect={handleMapSelect}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  )
}
