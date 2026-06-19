// Semana — resumen semanal (rebuild v2)
// Sigue el design system "Precision × Accessible" v2:
//  - Glass para contenido/analítica
//  - bg-raised para médico-operativo (hidratación, alertas)
//  - Ring para adherencia, DataPlate para números críticos
//  - Motion: solo transform/opacity, stagger, reduced-motion aware
//  - es-MX, sin claims médicos, tap targets ≥44px
import { useMemo, useCallback } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import {
  Droplet,
  TrendingUp,
  TrendingDown,
  Minus,
  Star,
  AlertTriangle,
  Info,
  Share2,
  CheckCircle2,
  Circle,
} from 'lucide-react'
import { useApp, adherence, isoKey } from '../../lib/store'
import {
  avgKcal,
  tdee,
  compositeStreak,
  streakDetail,
  weeklyInsights,
  weightProjection,
  protocolNumbers,
  litersFromMl,
  waterGoalLiters,
} from '../../lib/nutrition'
import { Glass } from '../ui/Glass'
import { Ring } from '../ui/Ring'
import { DataPlate } from '../ui/DataPlate'
import { staggerItem, staggerParent, dur, ease } from '../../lib/motion'

// ── Constantes ──────────────────────────────────────────────────────────────
const DAY = 86_400_000

// ── Helpers de formato ───────────────────────────────────────────────────────
function fmtDate(ts: number) {
  return new Date(ts).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
}

// ── Clasificación visual de señales ─────────────────────────────────────────
type InsightType = 'logro' | 'alerta' | 'info'

function classifyInsight(text: string): InsightType {
  const lower = text.toLowerCase()
  if (
    lower.includes('cumpliste') ||
    lower.includes('bajó') ||
    lower.includes('subió') ||
    lower.includes('déficit') ||
    lower.includes('racha') ||
    lower.includes('meta')
  )
    return 'logro'
  if (
    lower.includes('sin registro') ||
    lower.includes('cero') ||
    lower.includes('perdida') ||
    lower.includes('alta') ||
    lower.includes('elevado')
  )
    return 'alerta'
  return 'info'
}

const INSIGHT_ICON: Record<InsightType, React.ReactNode> = {
  logro: <Star size={14} className="shrink-0 mt-0.5" />,
  alerta: <AlertTriangle size={14} className="shrink-0 mt-0.5" />,
  info: <Info size={14} className="shrink-0 mt-0.5" />,
}
const INSIGHT_COL: Record<InsightType, string> = {
  logro: 'text-teal',
  alerta: 'text-warn',
  info: 'text-secondary-foreground',
}
const INSIGHT_BG: Record<InsightType, string> = {
  logro: 'bg-teal/8',
  alerta: 'bg-warn/10',
  info: 'bg-white/4',
}

// ── Subcomponente: fila de stat con delta opcional ───────────────────────────
function StatRow({
  label,
  value,
  sub,
  delta,
  deltaLabel,
}: {
  label: string
  value: React.ReactNode
  sub?: string
  delta?: number | null
  deltaLabel?: string
}) {
  const sign = delta != null ? (delta > 0 ? '+' : delta < 0 ? '' : '') : null
  const deltaColor =
    delta == null
      ? ''
      : delta > 0
      ? 'text-ok'
      : delta < 0
      ? 'text-warn'
      : 'text-muted-foreground'
  const DeltaIcon =
    delta == null ? null : delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus

  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-[12px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <DataPlate className="inline-flex items-baseline gap-1.5 px-3 py-2 mt-1">
        <span className="font-mono text-[22px] font-semibold tabular-nums text-foreground leading-none">
          {value}
        </span>
        {sub && (
          <span className="text-[12px] text-muted-foreground">{sub}</span>
        )}
      </DataPlate>
      {delta != null && DeltaIcon && (
        <p className={`mt-1 flex items-center gap-1 text-[12px] font-medium ${deltaColor}`}>
          <DeltaIcon size={12} />
          {sign}{Math.abs(delta)} {deltaLabel ?? 'vs sem. anterior'}
        </p>
      )}
    </div>
  )
}

// ── Componente: barra de progreso ────────────────────────────────────────────
function ProgressBar({ pct, color = 'bg-teal' }: { pct: number; color?: string }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
      <div
        className={`h-full rounded-full transition-all duration-300 ${color}`}
        style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
      />
    </div>
  )
}

// ── Pantalla principal ───────────────────────────────────────────────────────
export function Semana() {
  const { state, dispatch } = useApp()
  const reduce = useReducedMotion()

  // ── Derivaciones semanales ────────────────────────────────────────────────
  const cutoff = state.todayTs - 7 * DAY

  // Dosis registradas en la ventana de 7 días
  const doses = useMemo(() => {
    let count = 0
    for (const g of state.log)
      for (const it of g.items) {
        if (it.ts < cutoff) continue
        if (it.type === 'dose') count++
      }
    return count
  }, [state.log, cutoff])

  // Adherencia 7 días y delta vs semana previa
  const adh = adherence(state, 7)
  const hasProtocol = Object.values(state.protocols).some((p) => !p.archived)

  const adhPrevOnly = useMemo(() => {
    let taken = 0, due = 0
    const now = new Date(state.todayTs)
    for (let i = 7; i < 14; i++) {
      const d = new Date(now)
      d.setDate(now.getDate() - i)
      const k = isoKey(d.getTime())
      const g = state.log.find((x) => x.dateKey === k)
      const hasDose = !!g?.items.some((it) => it.type === 'dose')
      const proto = Object.values(state.protocols)[0]
      if (proto && d.getTime() >= proto.startDate) {
        due++
        if (hasDose) taken++
      }
    }
    return due > 0 ? Math.round((taken / due) * 100) : null
  }, [state.todayTs, state.log, state.protocols])

  const adhDelta =
    adh && adhPrevOnly != null ? adh.pct - adhPrevOnly : null

  // Calorías promedio y TDEE
  const avg7 = avgKcal(state, 7)
  const tdeeVal = useMemo(() => tdee(state), [state.profile])
  const caloricDelta = avg7 != null && tdeeVal != null ? avg7 - tdeeVal : null
  const severeDeficit = caloricDelta != null && caloricDelta < -500
  const veryDeficit = caloricDelta != null && caloricDelta < -1000

  // Hidratación — SÓLIDA (no vidrio), ya que es dato médico-operativo
  const waterDays = useMemo(() => {
    const result: number[] = []
    for (let i = 0; i < 7; i++) {
      const d = state.nutrition[isoKey(state.todayTs - i * DAY)]
      if (d) result.push(d.water)
    }
    return result
  }, [state.nutrition, state.todayTs])

  const waterPrevDays = useMemo(() => {
    const result: number[] = []
    for (let i = 7; i < 14; i++) {
      const d = state.nutrition[isoKey(state.todayTs - i * DAY)]
      if (d) result.push(d.water)
    }
    return result
  }, [state.nutrition, state.todayTs])

  const waterAvgRaw =
    waterDays.length
      ? waterDays.reduce((a, b) => a + b, 0) / waterDays.length
      : 0
  const waterAvgL = litersFromMl(waterAvgRaw)
  const waterGoalL = waterGoalLiters(state.profile.peso)
  const waterPrevAvgRaw =
    waterPrevDays.length
      ? waterPrevDays.reduce((a, b) => a + b, 0) / waterPrevDays.length
      : null
  const waterDeltaL =
    waterPrevAvgRaw != null
      ? Math.round((waterAvgL - litersFromMl(waterPrevAvgRaw)) * 10) / 10
      : null
  const waterPct = waterGoalL > 0 ? (waterAvgL / waterGoalL) * 100 : 0

  // Racha + condiciones de hoy
  const streak = compositeStreak(state)
  const sd = streakDetail(state)

  // Proyección de meta
  const proj = useMemo(() => weightProjection(state), [state.history, state.profile])
  const pn = useMemo(() => protocolNumbers(state), [state.nutrition, state.history, state.protocols])

  // Señales de la semana
  const rawInsights = useMemo(
    () => weeklyInsights(state),
    [state.nutrition, state.history, state.protocols, state.macroGoals],
  )
  const classifiedInsights = useMemo(
    () => rawInsights.map((text) => ({ type: classifyInsight(text), text })),
    [rawInsights],
  )

  // ── Wellness score (ponderado idéntico a ResumenSemanal) ──────────────────
  const kcalDays = useMemo(() => {
    const result: number[] = []
    for (let i = 0; i < 7; i++) {
      const d = state.nutrition[isoKey(state.todayTs - i * DAY)]
      if (d?.meals.length) result.push(d.meals.reduce((s, m) => s + m.kcal, 0))
    }
    return result
  }, [state.nutrition, state.todayTs])

  const wellnessScore = useMemo(() => {
    const adhScore = adh ? adh.pct * 0.4 : 0
    const waterScore =
      (waterDays.filter((g) => litersFromMl(g) >= waterGoalL).length / 7) * 100 * 0.25
    const mealScore = (kcalDays.length / 7) * 100 * 0.2
    let weightScore = 0
    if (proj?.slopePerDay != null && state.profile.metaPesoKg != null) {
      const good =
        Math.sign(proj.slopePerDay) ===
        Math.sign(state.profile.metaPesoKg - proj.current)
      weightScore = good ? 15 : 0
    }
    return Math.round(adhScore + waterScore + mealScore + weightScore)
  }, [adh, waterDays, kcalDays, proj, state.profile, waterGoalL])

  // ── Compartir (Web Share API) ─────────────────────────────────────────────
  const handleShare = useCallback(async () => {
    const text = `Racha de ${streak} ${streak === 1 ? 'día' : 'días'} · ${adh ? adh.pct + '%' : '—'} adherencia · ${avg7 != null ? avg7 + ' kcal/día' : '—'} — via Hacktrack`
    try {
      if (navigator.share && navigator.canShare?.({ title: 'Mi semana en Hacktrack', text })) {
        await navigator.share({ title: 'Mi semana en Hacktrack', text })
      } else {
        await navigator.clipboard.writeText(text)
        dispatch({ t: 'toast', msg: 'Copiado al portapapeles' })
      }
    } catch {
      // cancelado — ignorar
    }
  }, [streak, adh, avg7, dispatch])

  const canShare = streak > 0 || (adh?.pct ?? 0) > 0

  // ── Variantes de animación ────────────────────────────────────────────────
  const parentVars = {
    animate: {
      transition: { staggerChildren: reduce ? 0 : 0.06 },
    },
  }
  const itemVars = reduce
    ? {}
    : staggerItem

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <motion.div
      className="flex flex-col gap-4 px-4 pb-32 pt-[max(20px,env(safe-area-inset-top))]"
      variants={parentVars}
      initial="initial"
      animate="animate"
    >
      {/* ── Header ── */}
      <motion.div variants={itemVars} className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h1 className="text-[26px] font-bold leading-tight text-foreground">Tu semana</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">Últimos 7 días</p>
        </div>
        {/* Wellness ring — analítica, puede ir en vidrio */}
        <div className="shrink-0">
          <Ring
            value={wellnessScore}
            goal={100}
            unit=""
            label="semana"
            sub={streak > 0 ? `racha ${streak}d` : undefined}
            size={88}
            stroke={8}
          />
        </div>
      </motion.div>

      {/* ── Botón compartir ── */}
      {canShare && (
        <motion.div variants={itemVars}>
          <button
            onClick={handleShare}
            className="inline-flex items-center gap-2 h-11 rounded-full border border-white/10 px-4 text-[13px] font-semibold text-secondary-foreground bg-white/5 hover:bg-white/10 transition-colors"
            aria-label="Compartir resumen semanal"
          >
            <Share2 size={15} />
            Compartir semana
          </button>
        </motion.div>
      )}

      {/* ── KPIs en Glass ── */}

      {/* Adherencia con Ring */}
      <motion.div variants={itemVars}>
        <Glass className="flex items-center gap-5">
          <Ring
            value={adh?.pct ?? 0}
            goal={100}
            unit="%"
            label="adherencia"
            sub={
              adh
                ? `${adh.taken} de ${adh.due} dosis`
                : hasProtocol
                ? 'sin dosis esta semana'
                : 'sin protocolo'
            }
            size={120}
            stroke={10}
          />
          <div className="flex-1 min-w-0 flex flex-col gap-3">
            {/* Delta vs semana anterior */}
            {adhDelta != null && Math.abs(adhDelta) >= 1 && (
              <div
                className={`flex items-center gap-1.5 text-[13px] font-medium ${
                  adhDelta >= 0 ? 'text-ok' : 'text-warn'
                }`}
              >
                {adhDelta >= 0 ? (
                  <TrendingUp size={14} />
                ) : (
                  <TrendingDown size={14} />
                )}
                {adhDelta >= 0 ? '+' : ''}{adhDelta} pp vs sem. anterior
              </div>
            )}
            {/* Dosis registradas */}
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">
                Dosis registradas
              </p>
              <DataPlate className="inline-flex items-baseline gap-1 px-3 py-2">
                <span className="font-mono text-[24px] font-semibold tabular-nums text-foreground leading-none">
                  {doses}
                </span>
                <span className="text-[12px] text-muted-foreground">esta semana</span>
              </DataPlate>
            </div>
          </div>
        </Glass>
      </motion.div>

      {/* Calorías promedio en Glass */}
      <motion.div variants={itemVars}>
        <Glass>
          <p className="text-[12px] uppercase tracking-wider text-muted-foreground mb-2">
            Calorías promedio
          </p>
          {avg7 != null ? (
            <div className="flex items-baseline gap-3 flex-wrap">
              <DataPlate className="inline-flex items-baseline gap-1 px-3 py-2">
                <span className="font-mono text-[26px] font-semibold tabular-nums text-foreground leading-none">
                  {avg7 >= 1000 ? `${(avg7 / 1000).toFixed(1)}k` : avg7}
                </span>
                <span className="text-[12px] text-muted-foreground">kcal/día</span>
              </DataPlate>
              {caloricDelta != null && (
                <span
                  className={`font-mono text-[13px] font-semibold ${
                    caloricDelta < 0 ? 'text-ok' : 'text-warn'
                  }`}
                >
                  {caloricDelta > 0 ? '+' : ''}{caloricDelta}{' '}
                  {caloricDelta < 0 ? 'déficit' : 'superávit'}
                </span>
              )}
            </div>
          ) : (
            <p className="text-[13px] text-muted-foreground">Sin registros esta semana</p>
          )}
        </Glass>
      </motion.div>

      {/* ── Hidratación — SÓLIDA (dato médico-operativo) ── */}
      <motion.div variants={itemVars}>
        <div className="rounded-lg border border-white/8 bg-raised p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-[14px] font-semibold text-foreground">
              <Droplet size={15} className="text-teal shrink-0" />
              Hidratación promedio/día
            </span>
            <span className="font-mono tabular-nums text-[14px] text-foreground shrink-0">
              {waterAvgL.toFixed(1)}
              <span className="text-muted-foreground"> / {waterGoalL} L</span>
            </span>
          </div>
          <ProgressBar pct={waterPct} />
          {waterDeltaL != null && Math.abs(waterDeltaL) >= 0.1 && (
            <p
              className={`mt-2 flex items-center gap-1 text-[12px] font-medium ${
                waterDeltaL >= 0 ? 'text-ok' : 'text-warn'
              }`}
            >
              {waterDeltaL >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {waterDeltaL >= 0 ? '+' : ''}{Math.abs(waterDeltaL)} L vs sem. anterior
            </p>
          )}
          <button
            onClick={() => dispatch({ t: 'tab', tab: 'comida' })}
            className="mt-3 inline-flex min-h-[44px] items-center text-[13px] font-medium text-teal"
          >
            Registrar agua en Comida →
          </button>
        </div>
      </motion.div>

      {/* ── Señales de la semana — Glass (analítica/insights) ── */}
      <motion.div variants={itemVars}>
        <Glass>
          <p className="text-[12px] uppercase tracking-wider text-muted-foreground mb-3">
            Señales de la semana
          </p>
          {classifiedInsights.length > 0 ? (
            <div className="flex flex-col gap-2">
              {classifiedInsights.map((ins, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-2.5 rounded-md px-3 py-2.5 ${INSIGHT_BG[ins.type]}`}
                >
                  <span className={INSIGHT_COL[ins.type]}>
                    {INSIGHT_ICON[ins.type]}
                  </span>
                  <span className={`text-[13px] leading-snug ${INSIGHT_COL[ins.type]}`}>
                    {ins.text}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[13px] text-muted-foreground">
              Registra comidas, agua y peso durante la semana para ver observaciones personalizadas.
            </p>
          )}
        </Glass>
      </motion.div>

      {/* ── Racha semanal: condiciones de hoy (SÓLIDA — operativo/acción) ── */}
      <motion.div variants={itemVars}>
        <div className="rounded-lg border border-white/8 bg-raised p-4">
          <p className="text-[12px] uppercase tracking-wider text-muted-foreground mb-3">
            Racha y hábitos de hoy
          </p>
          <div className="flex items-baseline gap-2 mb-3">
            <span className="font-mono text-[30px] font-bold tabular-nums text-[var(--teal-bright)] leading-none">
              {sd.streak}
            </span>
            <span className="text-[13px] text-muted-foreground">
              {sd.streak === 1 ? 'día' : 'días'} de racha
            </span>
          </div>
          <div className="flex flex-wrap gap-2 mb-3">
            {(
              [
                ['Dosis', sd.today.dose],
                ['Agua', sd.today.water],
                ['Comida', sd.today.meal],
              ] as const
            ).map(([lbl, ok]) => (
              <span
                key={lbl}
                className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-full px-3 text-[12px] font-semibold ${
                  ok
                    ? 'bg-teal/15 text-teal'
                    : 'bg-white/6 text-muted-foreground'
                }`}
              >
                {ok ? <CheckCircle2 size={13} /> : <Circle size={13} />}
                {lbl}
              </span>
            ))}
          </div>
          {/* CTA si hay algo pendiente hoy — mínimo 44px */}
          {!(sd.today.dose && sd.today.water && sd.today.meal) && (
            <button
              onClick={() =>
                dispatch({
                  t: 'tab',
                  tab: !sd.today.dose
                    ? 'protocolo'
                    : !sd.today.meal
                    ? 'comida'
                    : 'inicio',
                })
              }
              className="mt-1 inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-white/15 px-4 text-[13px] font-semibold text-foreground hover:bg-white/8 transition-colors"
            >
              Ir a registrar →
            </button>
          )}
        </div>
      </motion.div>

      {/* ── Proyección de meta — Glass (analítica) ── */}
      {proj && (
        <motion.div variants={itemVars}>
          <Glass>
            <p className="text-[12px] uppercase tracking-wider text-muted-foreground mb-2">
              Proyección de meta
            </p>
            <div className="flex items-baseline gap-2 mb-3">
              <span className="font-mono text-[13px] text-foreground">
                {proj.current} kg
              </span>
              <span className="text-muted-foreground text-[12px]">→</span>
              <span className="font-mono text-[13px] font-semibold text-foreground">
                {proj.goal} kg
              </span>
            </div>
            {(() => {
              const total = Math.abs(proj.goal - proj.points[0])
              const done = Math.abs(proj.current - proj.points[0])
              const pct = total > 0 ? Math.min(100, (done / total) * 100) : 0
              return (
                <>
                  <ProgressBar pct={pct} />
                  <p className="mt-2 text-[13px] text-secondary-foreground">
                    {proj.etaTs
                      ? `Llegada estimada: ~${fmtDate(proj.etaTs)}`
                      : 'Tendencia aún no apunta a la meta — sigue registrando.'}
                  </p>
                </>
              )
            })()}
          </Glass>
        </motion.div>
      )}

      {/* ── Margen energético (TDEE) — Glass (analítica numérica) ── */}
      {tdeeVal != null && avg7 != null && (
        <motion.div variants={itemVars}>
          <Glass>
            <p className="text-[12px] uppercase tracking-wider text-muted-foreground mb-3">
              Margen energético
            </p>
            <div className="flex gap-4 flex-wrap">
              <StatRow label="TDEE est." value={tdeeVal} sub="kcal" />
              <StatRow label="Consumo 7d" value={avg7} sub="kcal/día" />
              {caloricDelta != null && (
                <StatRow
                  label={caloricDelta < 0 ? 'Déficit' : 'Superávit'}
                  value={
                    <span
                      className={
                        caloricDelta < 0 ? 'text-ok' : 'text-warn'
                      }
                    >
                      {Math.abs(caloricDelta)}
                    </span>
                  }
                  sub="kcal"
                />
              )}
            </div>
            {/* Alerta déficit agresivo — SÓLIDA (salud/alerta) */}
            {severeDeficit && (
              <div
                className={`mt-3 rounded-md border px-3 py-2.5 ${
                  veryDeficit
                    ? 'border-alert/40 bg-alert/10'
                    : 'border-warn/30 bg-warn/10'
                }`}
              >
                <p
                  className={`flex items-start gap-2 text-[13px] font-medium ${
                    veryDeficit ? 'text-alert' : 'text-warn'
                  }`}
                >
                  <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                  {veryDeficit
                    ? `Déficit muy elevado (>${Math.abs(caloricDelta!)} kcal) — solo como dato de registro.`
                    : `Déficit elevado (${Math.abs(caloricDelta!)} kcal/día) — solo como dato de registro.`}
                </p>
              </div>
            )}
          </Glass>
        </motion.div>
      )}

      {/* ── Protocolo en números (resumen) — Glass ── */}
      {pn && (pn.deltaKcal != null || pn.weightDelta != null) && (
        <motion.div variants={itemVars}>
          <Glass>
            <p className="text-[12px] uppercase tracking-wider text-muted-foreground mb-3">
              Tu protocolo en números
            </p>
            <div className="flex gap-4 flex-wrap">
              {pn.deltaKcal != null && (
                <StatRow
                  label="Δ kcal/día prom."
                  value={
                    <span
                      className={pn.deltaKcal <= 0 ? 'text-ok' : 'text-foreground'}
                    >
                      {pn.deltaKcal > 0 ? '+' : ''}{pn.deltaKcal}
                    </span>
                  }
                  sub="kcal"
                />
              )}
              {pn.weightDelta != null && (
                <StatRow
                  label="Δ peso"
                  value={
                    <span
                      className={pn.weightDelta <= 0 ? 'text-ok' : 'text-foreground'}
                    >
                      {pn.weightDelta > 0 ? '+' : ''}{pn.weightDelta}
                    </span>
                  }
                  sub="kg"
                />
              )}
            </div>
            {!pn.enoughData && (
              <p className="mt-3 text-[12px] text-muted-foreground">
                Registra ~14 días para una comparación más sólida.
              </p>
            )}
          </Glass>
        </motion.div>
      )}

      {/* ── Aviso legal observacional ── */}
      <motion.div variants={itemVars}>
        <p className="border-l-2 border-white/10 pl-3 text-[12px] leading-relaxed text-muted-foreground">
          Resumen de tu registro personal. La adherencia mide tu consistencia, no la eficacia ni un resultado clínico. Tu historial se guarda solo en tu dispositivo.
        </p>
      </motion.div>
    </motion.div>
  )
}
