// Semana — resumen semanal, restyle "Bitácora" (LOCKED 2026-07-17).
// Sistema editorial papel-y-tinta: §-folios por sección, numerales serif (StatNumber),
// anillo ámbar de instrumento (racha integral / adherencia), barras editoriales
// (azul = datos, ámbar = energía), jerga con tap-explain (TermInfo).
// Overhaul ESTÉTICO: derivaciones, dispatches y copy de cumplimiento intactos.
//
// R42: tarjeta proyección de meta (SVG inline + ETA)
// R43: gate "Completar perfil" inline si falta edad/sexo/actividad
// R45: PremiumGate envuelve features avanzadas
//
// `embedded`: Diario la aloja tras su segmentado "Registro | Semana" — sin masthead
// ni padding propios (los pone el anfitrión). Como pantalla propia (AppV2) no cambia.
import { useMemo, useCallback, useState } from 'react'
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
  Lock,
  Target,
  Activity,
} from 'lucide-react'
import { SectionHero } from '../ui/SectionHero'
import { useApp, adherence, isoKey } from '../../lib/store'
import { weekAdherencePct } from '../../lib/calendar'
import { startOfDay } from '../../lib/cadence'
import { addDays } from '../../lib/dates'
import { rachaLabel } from '../../lib/buildFlags'
import {
  avgKcal,
  kcalSeries,
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
import { Button } from '../ui/Button'
import { Chip } from '../ui/Chip'
import { FolioLabel } from '../ui/FolioLabel'
import { TermInfo } from '../ui/TermInfo'
import { StatNumber } from '../ui/StatNumber'
import { staggerContainer, staggerItem } from '../lib/motion'
import type { Actividad, Sexo } from '../../lib/types'

// ── Helpers de formato ───────────────────────────────────────────────────────
function fmtDate(ts: number) {
  return new Date(ts).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── Clases compartidas (Bitácora) ────────────────────────────────────────────
// Alfa sobre var() no se emite en este setup (ver Button.tsx) → tintes con color-mix
// en clases arbitrarias LITERALES (el JIT necesita verlas escritas).
const MONO_LABEL = 'font-mono text-[12px] font-medium uppercase tracking-[0.12em] text-ink-2'
const INPUT_CLS = 'h-12 w-full rounded-[8px] border border-hairline bg-raised px-3 font-mono text-[15px] tabular-nums text-ink placeholder:text-ink-3 focus:outline-none focus:border-blue'

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
    lower.includes('meta') || lower.includes('variedad alta')
  )
    return 'logro'
  if (
    lower.includes('sin registro') ||
    lower.includes('cero') ||
    lower.includes('perdida') ||
    lower.includes('variedad baja') ||
    lower.includes('elevado')
  )
    return 'alerta'
  return 'info'
}

// Estado nunca color-solo: ícono (forma) + texto + color.
const INSIGHT_ICON: Record<InsightType, React.ReactNode> = {
  logro: <Star size={14} className="shrink-0 mt-0.5" />,
  alerta: <AlertTriangle size={14} className="shrink-0 mt-0.5" />,
  info: <Info size={14} className="shrink-0 mt-0.5" />,
}
const INSIGHT_COL: Record<InsightType, string> = {
  logro: 'text-ok',
  alerta: 'text-warn',
  info: 'text-ink-2',
}
const INSIGHT_BG: Record<InsightType, string> = {
  logro: 'bg-[color-mix(in_srgb,var(--ok)_10%,transparent)]',
  alerta: 'bg-[color-mix(in_srgb,var(--warn)_12%,transparent)]',
  info: 'bg-raised',
}

// ── Subcomponente: barra de progreso (medidor editorial: crece desde la base) ─
function ProgressBar({ pct, color = 'bg-blue' }: { pct: number; color?: string }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--ink)_8%,transparent)]">
      <div
        className={`h-full rounded-full transition-all duration-300 ${color}`}
        style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
      />
    </div>
  )
}

// ── Subcomponente: fila de stat con delta opcional ───────────────────────────
// Readout editorial: label mono UPPER (+ tap-explain opcional), numeral SERIF tabular en tinta,
// unidad mono pequeña. El delta nunca es color-solo (flecha + signo + texto).
function StatRow({
  label,
  info,
  value,
  sub,
  delta,
  deltaLabel,
}: {
  label: string
  info?: React.ReactNode   // TermInfo opcional junto al label (fuera del uppercase)
  value: React.ReactNode
  sub?: string
  delta?: number | null
  deltaLabel?: string
}) {
  const sign = delta != null ? (delta > 0 ? '+' : '') : null
  const deltaColor =
    delta == null
      ? ''
      : delta > 0
      ? 'text-ok'
      : delta < 0
      ? 'text-warn'
      : 'text-ink-3'
  const DeltaIcon =
    delta == null ? null : delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus

  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-1.5">
        <p className={MONO_LABEL}>{label}</p>
        {info}
      </div>
      <p className="mt-1 flex items-baseline gap-1.5">
        <span className="font-serif text-[30px] font-normal leading-none tracking-[-0.01em] tabular-nums text-ink">
          {value}
        </span>
        {sub && (
          <span className="font-mono text-[12px] text-ink-2">{sub}</span>
        )}
      </p>
      {delta != null && DeltaIcon && (
        <p className={`mt-1 flex items-center gap-1 text-[12px] font-medium ${deltaColor}`}>
          <DeltaIcon size={12} />
          {sign}{Math.abs(delta)} {deltaLabel ?? 'vs sem. anterior'}
        </p>
      )}
    </div>
  )
}

// ── R45: PremiumGate ─────────────────────────────────────────────────────────
// Envuelve features avanzadas; si premium=false muestra overlay "Hacktrack Plus".
// Overlay opaco por color-mix (sin backdrop-filter decorativo — elevación = reglas).
function PremiumGate({
  isPremium,
  onUnlock,
  children,
}: {
  isPremium: boolean
  onUnlock: () => void
  children: React.ReactNode
}) {
  if (isPremium) return <>{children}</>

  return (
    <div className="relative">
      {/* Contenido atenuado en el fondo (filter estático, no animado) */}
      <div className="pointer-events-none select-none blur-[3px] opacity-40" aria-hidden>
        {children}
      </div>
      {/* Overlay */}
      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 rounded-sm border border-hairline bg-[color-mix(in_srgb,var(--paper)_86%,transparent)] px-6 py-8 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full border border-[color-mix(in_srgb,var(--amber)_35%,transparent)] bg-amber-soft">
          <Lock size={22} className="text-amber" />
        </div>
        <div>
          <p className="mb-1 font-serif text-[22px] font-normal text-ink">Hacktrack Plus</p>
          <p className="text-[14px] leading-snug text-ink-2">
            Proyección de meta, TDEE y protocolo en números. Gratis durante la beta.
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          className="min-w-[160px]"
          onClick={onUnlock}
        >
          Toca para desbloquear
        </Button>
      </div>
    </div>
  )
}

// ── R43: Gate "Completar perfil" ──────────────────────────────────────────────
// Si falta edad/sexo/actividad muestra formulario inline y bloquea las secciones
// que dependen de TDEE/proyección.
const ACT_LABEL: { v: Actividad; l: string }[] = [
  { v: 'sedentario', l: 'Sedentario' },
  { v: 'ligero', l: 'Ligero' },
  { v: 'moderado', l: 'Moderado' },
  { v: 'activo', l: 'Activo' },
  { v: 'muy-activo', l: 'Muy activo' },
]

function ProfileGate({
  profileComplete,
  dispatch,
  profile,
  children,
}: {
  profileComplete: boolean
  dispatch: (a: any) => void
  profile: { edad?: number | null; sexo?: Sexo | null; actividad?: Actividad | null }
  children: React.ReactNode
}) {
  const [edad, setEdad] = useState(profile.edad ?? null)

  if (profileComplete) return <>{children}</>

  return (
    <Glass className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[color-mix(in_srgb,var(--blue)_25%,transparent)] bg-[color-mix(in_srgb,var(--blue)_10%,transparent)]">
          <Activity size={18} className="text-blue" />
        </div>
        <div>
          <p className="text-[15px] font-semibold text-ink">Completar perfil</p>
          <p className="text-[12px] text-ink-2">
            Necesitamos tu edad, sexo y nivel de actividad para calcular TDEE y proyecciones.
          </p>
        </div>
      </div>

      {/* Edad */}
      <div className="flex flex-col gap-1">
        <label htmlFor="semana-edad" className={MONO_LABEL}>
          Edad
        </label>
        <input
          id="semana-edad"
          type="number"
          inputMode="numeric"
          placeholder="Años"
          min={10}
          max={120}
          className={INPUT_CLS}
          defaultValue={profile.edad ?? ''}
          onBlur={(e) => {
            const v = parseFloat(e.target.value)
            if (Number.isFinite(v) && v >= 10 && v <= 120) {
              setEdad(v)
              dispatch({ t: 'setProfileFields', patch: { edad: v } })
              e.target.setCustomValidity('')
            } else if (e.target.value !== '') {
              e.target.setCustomValidity('Introduce una edad entre 10 y 120')
              e.target.reportValidity()
            }
          }}
        />
      </div>

      {/* Sexo */}
      <div className="flex flex-col gap-1">
        <p className={MONO_LABEL}>Sexo</p>
        <div className="flex gap-2">
          {(['H', 'M'] as Sexo[]).map((sx) => (
            <button
              key={sx}
              className={`h-12 flex-1 rounded-[8px] border text-[14px] font-semibold transition-colors ${
                profile.sexo === sx
                  ? 'border-blue bg-[color-mix(in_srgb,var(--blue)_10%,transparent)] text-blue'
                  : 'border-hairline bg-transparent text-ink-2 hover:bg-raised'
              }`}
              onClick={() => dispatch({ t: 'setProfileFields', patch: { sexo: sx } })}
              aria-pressed={profile.sexo === sx}
            >
              {sx === 'H' ? 'Hombre' : 'Mujer'}
            </button>
          ))}
        </div>
      </div>

      {/* Actividad */}
      <div className="flex flex-col gap-1">
        <p className={MONO_LABEL}>Actividad</p>
        <div className="flex flex-wrap gap-2">
          {ACT_LABEL.map((a) => (
            <Chip
              key={a.v}
              active={profile.actividad === a.v}
              onClick={() => dispatch({ t: 'setProfileFields', patch: { actividad: a.v } })}
            >
              {a.l}
            </Chip>
          ))}
        </div>
      </div>

      {/* Hint */}
      <p className="border-l-2 border-hairline pl-3 text-[12px] leading-snug text-ink-3">
        Completa los tres campos para habilitar el TDEE y la proyección de meta.
      </p>
    </Glass>
  )
}

// ── R42: Tarjeta proyección de meta ──────────────────────────────────────────
// Sin meta → input para definirla + gráfica placeholder + ETA.
// Con meta + datos → gráfica SVG de tendencia + ETA + R².
function ProyeccionMetaCard({
  proj,
  metaPesoKg,
  dispatch,
}: {
  proj: ReturnType<typeof weightProjection>
  metaPesoKg?: number | null
  dispatch: (a: any) => void
}) {
  // ── R² simple inline (no requiere importar calcR2 de parts) ──
  function calcR2(data: number[]): number {
    const n = data.length
    if (n < 3) return 0
    const mean = data.reduce((a, b) => a + b, 0) / n
    let sx = 0, sy = 0, sxx = 0, sxy = 0
    for (let i = 0; i < n; i++) { sx += i; sy += data[i]; sxx += i * i; sxy += i * data[i] }
    const den = n * sxx - sx * sx
    if (!den) return 0
    const sl = (n * sxy - sx * sy) / den
    const ic = (sy - sl * sx) / n
    let ssTot = 0, ssRes = 0
    for (let i = 0; i < n; i++) {
      ssTot += (data[i] - mean) ** 2
      ssRes += (data[i] - (ic + sl * i)) ** 2
    }
    return ssTot > 0 ? Math.max(0, Math.min(1, 1 - ssRes / ssTot)) : 1
  }

  // Gráfica SVG inline simple (sin dependencias de charts).
  // Colores Bitácora: datos = tinta muda, tendencia = azul (dato), meta + "ahora" = ámbar (energía).
  function TrendSVG({ points, goal }: { points: number[]; goal: number }) {
    const W = 280, H = 64
    if (points.length < 2) return null
    const min = Math.min(...points, goal) - 0.5
    const max = Math.max(...points, goal) + 0.5
    const range = max - min || 1
    const px = (i: number) => (i / (points.length - 1)) * W
    const py = (v: number) => H - ((v - min) / range) * H

    // Línea de datos
    const d = points
      .map((v, i) => `${i === 0 ? 'M' : 'L'}${px(i).toFixed(1)},${py(v).toFixed(1)}`)
      .join(' ')

    // Regresión lineal para línea de tendencia
    const n = points.length
    const mx = (n - 1) / 2
    const my = points.reduce((a, b) => a + b, 0) / n
    let num = 0, den = 0
    for (let i = 0; i < n; i++) { num += (i - mx) * (points[i] - my); den += (i - mx) ** 2 }
    const slope = den === 0 ? 0 : num / den
    const ic = my - slope * mx
    const trend = `M${px(0).toFixed(1)},${py(ic).toFixed(1)} L${px(n - 1).toFixed(1)},${py(ic + slope * (n - 1)).toFixed(1)}`

    // Línea de meta
    const goalY = py(goal).toFixed(1)

    return (
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        aria-hidden
        className="overflow-visible"
        style={{ maxWidth: '100%' }}
      >
        {/* Meta (ámbar punteado — tu objetivo/energía) */}
        <line
          x1={0} y1={goalY} x2={W} y2={goalY}
          stroke="var(--amber)"
          strokeOpacity={0.55}
          strokeWidth={1}
          strokeDasharray="4 3"
        />
        {/* Datos (tinta muda) */}
        <path d={d} fill="none" stroke="var(--ink-3)" strokeOpacity={0.5} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
        {/* Tendencia (azul = dato) */}
        <path d={trend} fill="none" stroke="var(--blue)" strokeWidth={2} strokeLinecap="round" opacity={0.9} />
        {/* Punto actual ("ahora" = ámbar) */}
        <circle
          cx={px(n - 1)}
          cy={py(points[n - 1])}
          r={4}
          fill="var(--amber)"
        />
      </svg>
    )
  }

  const r2 = proj ? calcR2(proj.points) : 0
  const r2Color = r2 >= 0.7 ? 'text-ok' : r2 >= 0.4 ? 'text-warn' : 'text-ink-3'

  // Sin meta definida → input + gráfica placeholder + CTA
  if (metaPesoKg == null || metaPesoKg == undefined) {
    return (
      <Glass className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Target size={15} className="shrink-0 text-blue" />
          <p className={MONO_LABEL}>
            Proyección de meta
          </p>
        </div>
        <p className="text-[13px] text-ink-2">
          Define tu peso objetivo para ver tu trayectoria proyectada y ETA estimada.
        </p>
        {/* Gráfica placeholder tenue */}
        <div className="opacity-25 pointer-events-none" aria-hidden>
          <svg width={280} height={64} viewBox="0 0 280 64" style={{ maxWidth: '100%' }}>
            <path
              d="M0,50 C40,45 80,35 140,28 C180,22 230,20 280,18"
              fill="none"
              stroke="var(--ink-3)"
              strokeWidth={1.5}
            />
            <line x1={0} y1={16} x2={280} y2={16} stroke="var(--amber)" strokeOpacity={0.6} strokeWidth={1} strokeDasharray="4 3" />
          </svg>
        </div>
        {/* Input meta */}
        <div className="flex flex-col gap-1">
          <label htmlFor="semana-meta-kg" className={MONO_LABEL}>
            Meta de peso (kg)
          </label>
          <div className="flex gap-2">
            <input
              id="semana-meta-kg"
              type="number"
              inputMode="decimal"
              placeholder="ej. 72"
              min={30}
              max={300}
              className={`${INPUT_CLS} flex-1`}
              onBlur={(e) => {
                const v = parseFloat(e.target.value)
                if (Number.isFinite(v) && v >= 30 && v <= 300) {
                  dispatch({ t: 'setProfileFields', patch: { metaPesoKg: v } })
                  e.target.setCustomValidity('')
                } else if (e.target.value !== '') {
                  e.target.setCustomValidity('Introduce un peso entre 30 y 300 kg')
                  e.target.reportValidity()
                }
              }}
            />
          </div>
        </div>
      </Glass>
    )
  }

  // Con meta pero sin suficientes datos de peso
  if (!proj) {
    return (
      <Glass className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Target size={15} className="shrink-0 text-blue" />
          <p className={MONO_LABEL}>
            Proyección de meta
          </p>
        </div>
        <DataPlate className="inline-flex items-baseline gap-2 px-3 py-2 self-start">
          <span className="text-[18px] font-normal tabular-nums">
            Meta: {metaPesoKg} kg
          </span>
        </DataPlate>
        <p className="text-[13px] text-ink-2">
          Registra al menos 5 pesajes para construir tu tendencia y calcular el ETA.
        </p>
      </Glass>
    )
  }

  // Con meta + proyección completa
  const total = Math.abs(proj.goal - proj.points[0])
  const done = Math.abs(proj.current - proj.points[0])
  const pct = total > 0 ? Math.min(100, (done / total) * 100) : 0
  const towardGoal =
    proj.slopePerDay !== 0 &&
    Math.sign(proj.slopePerDay) === Math.sign(proj.goal - proj.current)

  return (
    <Glass className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Target size={15} className="shrink-0 text-blue" />
          <p className={MONO_LABEL}>
            Proyección de meta
          </p>
        </div>
        {/* R² chip + tap-explain (jerga a la mano) */}
        <span className="flex items-center gap-1.5">
          <span
            className={`rounded-full border px-2 py-0.5 font-mono text-[12px] font-medium tabular-nums ${r2Color} border-current/20 bg-current/5`}
            title={`Coeficiente de determinación R² = ${r2.toFixed(2)}`}
          >
            R² {r2.toFixed(2)}
          </span>
          <TermInfo term="R²">Qué tan bien la tendencia se ajusta a tus pesajes (1.00 = exacto).</TermInfo>
        </span>
      </div>

      {/* Peso actual → meta (placa de instrumento, numerales serif; meta en ámbar) */}
      <div className="flex items-baseline gap-2 flex-wrap">
        <DataPlate className="inline-flex items-baseline gap-1 px-3 py-2">
          <span className="text-[22px] font-normal leading-none tabular-nums">
            {proj.current}
          </span>
          <span className="font-mono text-[12px] opacity-70">kg</span>
        </DataPlate>
        <span className="text-[13px] text-ink-3">→</span>
        <DataPlate className="inline-flex items-baseline gap-1 px-3 py-2">
          <span className="text-[22px] font-normal leading-none tabular-nums text-amber">
            {proj.goal}
          </span>
          <span className="font-mono text-[12px] opacity-70">kg meta</span>
        </DataPlate>
      </div>

      {/* Gráfica SVG de tendencia */}
      <TrendSVG points={proj.points} goal={proj.goal} />

      {/* Barra de progreso */}
      <div className="flex flex-col gap-1">
        <ProgressBar pct={pct} color={towardGoal ? 'bg-blue' : 'bg-warn'} />
        <div className="flex justify-between font-mono text-[12px] tabular-nums text-ink-3">
          <span>{proj.points[0]} kg inicio</span>
          <span>{Math.round(pct)}% completado</span>
        </div>
      </div>

      {/* ETA */}
      <div
        className={`rounded-[8px] px-3 py-2 text-[13px] font-medium ${
          towardGoal
            ? 'bg-[color-mix(in_srgb,var(--blue)_10%,transparent)] text-blue'
            : 'bg-[color-mix(in_srgb,var(--warn)_12%,transparent)] text-warn'
        }`}
      >
        {proj.etaTs ? (
          <>
            ETA estimada:{' '}
            <span className="font-semibold">
              {proj.etaLabel ?? fmtDate(proj.etaTs)}
            </span>
            {proj.weeksLeft != null && (
              <span className="ml-1 text-[12px] opacity-75">
                (~{proj.weeksLeft} {proj.weeksLeft === 1 ? 'semana' : 'semanas'})
              </span>
            )}{' '}
            <TermInfo term="ETA">Fecha estimada de llegada a tu meta, según tu tendencia reciente.</TermInfo>
          </>
        ) : towardGoal ? (
          'Tendencia favorable — sigue registrando para calcular el ETA.'
        ) : (
          'La tendencia actual no apunta a la meta — revisa tu registro.'
        )}
      </div>
    </Glass>
  )
}

// ── Pantalla principal ───────────────────────────────────────────────────────
export function Semana({ embedded = false }: { embedded?: boolean } = {}) {
  const { state, dispatch } = useApp()
  const reduce = useReducedMotion()

  // ── Derivaciones semanales ────────────────────────────────────────────────
  // MISMA ventana de 7 días calendario que adherence(state, 7): hoy-6 … hoy. Antes el corte era
  // todayTs - 7·DAY (8 días calendario) → el conteo crudo y la adherencia hablaban de ventanas distintas.
  const cutoff = addDays(state.todayTs, -6).getTime()

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

  // Adherencia de la semana PREVIA — MISMA fuente que `adherence`/`tallyDoses` (cadencia-aware). Antes era un
  // cálculo a mano que sumaba `due++` por cada protocolo CADA día ignorando la cadencia (contaba días de
  // descanso como debidos) → divergía del % de la semana en curso. Ahora usa weekAdherencePct (vía tallyDoses).
  const adhPrevOnly = useMemo(() => {
    const today = startOfDay(new Date(state.todayTs))
    const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 13)) // días -13..-7
    return weekAdherencePct(state, days, new Date())
  }, [state])

  const adhDelta =
    adh && adhPrevOnly != null ? adh.pct - adhPrevOnly : null

  // #10: el bloque calórico solo aplica a objetivos metabólicos/composición
  const metabolic =
    state.curGoal === 'Metabolismo' || state.curGoal === 'Crecimiento' ||
    (state.secondaryGoals ?? []).some((g) => g === 'Metabolismo' || g === 'Crecimiento')

  // #65: para objetivo de Crecimiento (muscle gain) un superávit es positivo → señal invertida
  const isGrowth =
    state.curGoal === 'Crecimiento' ||
    (state.secondaryGoals ?? []).some((g) => g === 'Crecimiento')
  // Calorías promedio y TDEE
  const avg7 = avgKcal(state, 7)
  const tdeeVal = useMemo(() => tdee(state), [state.profile])
  // #14: no mostrar déficit/superávit con datos insuficientes (1-2 días registrados dan un
  // "promedio" engañoso y un déficit alarmante). Requiere ≥3 días con comidas en la ventana.
  const kcalLoggedDays = useMemo(() => kcalSeries(state, 7).filter((d) => d.has).length, [state])
  const caloricDelta = avg7 != null && tdeeVal != null && kcalLoggedDays >= 3 ? avg7 - tdeeVal : null
  const severeDeficit = caloricDelta != null && caloricDelta < -500
  const veryDeficit = caloricDelta != null && caloricDelta < -1000

  // Hidratación
  const waterDays = useMemo(() => {
    const result: number[] = []
    for (let i = 0; i < 7; i++) {
      const d = state.nutrition[isoKey(addDays(state.todayTs, -i).getTime())]
      if (d) result.push(d.water)
    }
    return result
  }, [state.nutrition, state.todayTs])

  const waterPrevDays = useMemo(() => {
    const result: number[] = []
    for (let i = 7; i < 14; i++) {
      const d = state.nutrition[isoKey(addDays(state.todayTs, -i).getTime())]
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

  // Proyección de meta (R42/R45)
  const proj = useMemo(() => weightProjection(state), [state.history, state.profile])
  const pn = useMemo(
    () => protocolNumbers(state),
    [state.nutrition, state.history, state.protocols],
  )

  // Señales de la semana
  const rawInsights = useMemo(
    () => weeklyInsights(state),
    [state.nutrition, state.history, state.protocols, state.macroGoals],
  )
  const classifiedInsights = useMemo(
    () => rawInsights.map((text) => ({ type: classifyInsight(text), text })),
    [rawInsights],
  )

  // Calorías con registro
  const kcalDays = useMemo(() => {
    const result: number[] = []
    for (let i = 0; i < 7; i++) {
      const d = state.nutrition[isoKey(addDays(state.todayTs, -i).getTime())]
      if (d?.meals.length) result.push(d.meals.reduce((s, m) => s + m.kcal, 0))
    }
    return result
  }, [state.nutrition, state.todayTs])

  // Wellness score (R42 usa proj — ponderado igual que ResumenSemanal)
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

  // R43: ¿perfil completo?
  const p = state.profile
  const profileComplete = !!(p.edad && p.sexo && p.actividad)

  // R45: ¿premium?
  const isPremium = state.settings.premium

  // ── Compartir (Web Share API) ─────────────────────────────────────────────
  const handleShare = useCallback(async () => {
    // rachaLabel: en tienda dice "Racha integral de registro" (Apple 1.4.3); PWA sin cambio
    const text = `${rachaLabel('Racha integral')} de ${streak} ${streak === 1 ? 'día' : 'días'} · ${adh ? adh.pct + '%' : '—'} adherencia · ${avg7 != null ? avg7 + ' kcal/día' : '—'} — vía Hacktrack`
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

  // Botón compartir (masthead o cabecera embebida)
  const shareBtn = canShare ? (
    <button
      onClick={handleShare}
      className="inline-flex h-11 items-center gap-2 rounded-full border border-hairline px-4 font-mono text-[12px] font-medium uppercase tracking-[0.12em] text-blue transition-colors hover:bg-raised"
      aria-label="Compartir resumen semanal"
    >
      <Share2 size={15} />
      Compartir
    </button>
  ) : undefined

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <motion.div
      className={
        embedded
          ? 'flex flex-col gap-4'
          : 'flex flex-col gap-4 px-4 pb-32 pt-[max(20px,env(safe-area-inset-top))]'
      }
      variants={staggerContainer}
      initial={reduce ? false : 'hidden'}
      animate="show"
    >
      {/* ── Cabecera ── */}
      {embedded ? (
        <motion.div variants={staggerItem} className="flex items-center gap-3">
          {/* Kicker corto: nombra la ventana (regla de la ref) y cabe en UNA línea junto al botón
              Compartir — el texto largo envolvía a 2 líneas y desalineaba el tick ámbar. */}
          <FolioLabel className="min-w-0 flex-1">Últimos 7 días</FolioLabel>
          {shareBtn}
        </motion.div>
      ) : (
        <motion.div variants={staggerItem}>
          <SectionHero
            eyebrow="Bitácora · Semana"
            title="Tu semana"
            subtitle="Últimos 7 días"
            action={shareBtn}
          />
        </motion.div>
      )}

      {/* ── § 01 · Semana en un vistazo — anillo ámbar (racha integral) ── */}
      {!embedded && (
        <motion.div variants={staggerItem}>
          <FolioLabel n={1}>Semana en un vistazo</FolioLabel>
        </motion.div>
      )}
      <motion.div variants={staggerItem}>
        <Glass className="flex flex-col items-center gap-2 py-5">
          <Ring
            value={wellnessScore}
            goal={100}
            unit=""
            label="semana"
            sub={streak > 0 ? `${rachaLabel('racha integral')} ${streak}d` : undefined}
            size={120}
            stroke={10}
          />
          <p className="max-w-[30ch] text-center text-[12px] leading-snug text-ink-3">
            Índice de tu semana: adherencia, agua, comidas y peso.
          </p>
        </Glass>
      </motion.div>

      {/* ── § 02 · Adherencia ── */}
      <motion.div variants={staggerItem}>
        <FolioLabel n={embedded ? 1 : 2}>Adherencia</FolioLabel>
      </motion.div>
      <motion.div variants={staggerItem}>
        <Glass className="flex items-center gap-5">
          <Ring
            value={adh?.pct ?? 0}
            goal={100}
            unit="%"
            label="adherencia"
            sub={
              <span className="flex max-w-[180px] items-center justify-center gap-1 text-center text-[12px] leading-tight text-ink-2">
                {adh
                  ? `${adh.taken} de ${adh.due} dosis`
                  : hasProtocol
                  ? 'sin dosis esta semana'
                  : 'sin protocolo'}
                {/* jerga a la mano (Ley 2) */}
                <TermInfo term="adherencia">Qué tanto vas al día con las tomas de tu protocolo.</TermInfo>
              </span>
            }
            size={120}
            stroke={10}
          />
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            {adhDelta != null && Math.abs(adhDelta) >= 1 && (
              <div
                className={`flex items-center gap-1.5 font-mono text-[13px] font-medium tabular-nums ${
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
            <div>
              <StatNumber
                label="Dosis registradas"
                value={doses}
                size={30}
                deltaLabel="esta semana"
              />
              <p className="mt-1 text-[12px] text-ink-3">
                Incluye dosis fuera de cadencia.
              </p>
            </div>
          </div>
        </Glass>
      </motion.div>

      {/* ── § 03 · Nutrición ── */}
      <motion.div variants={staggerItem}>
        <FolioLabel n={embedded ? 2 : 3}>Nutrición · 7 días</FolioLabel>
      </motion.div>

      {/* Calorías promedio — #10: solo objetivos metabólicos/composición */}
      {metabolic && (
      <motion.div variants={staggerItem}>
        <Glass>
          <p className={`${MONO_LABEL} mb-2`}>
            Calorías promedio
          </p>
          {avg7 != null ? (
            <div className="flex items-baseline gap-3 flex-wrap">
              <span className="flex items-baseline gap-1.5">
                <span className="font-serif text-[30px] font-normal leading-none tracking-[-0.01em] tabular-nums text-ink">
                  {avg7 >= 1000 ? `${(avg7 / 1000).toFixed(1)}k` : avg7}
                </span>
                <span className="font-mono text-[12px] text-ink-2">kcal/día</span>
              </span>
              {caloricDelta != null && (
                <span
                  className={`font-mono text-[13px] font-semibold tabular-nums ${
                    isGrowth
                      ? caloricDelta > 0 ? 'text-ok' : 'text-warn'
                      : caloricDelta < 0 ? 'text-ok' : 'text-warn'
                  }`}
                >
                  {caloricDelta > 0 ? '+' : ''}{caloricDelta}{' '}
                  {caloricDelta < 0 ? 'déficit' : 'superávit'}
                </span>
              )}
            </div>
          ) : (
            <p className="text-[13px] text-ink-2">Sin registros esta semana</p>
          )}
        </Glass>
      </motion.div>
      )}

      {/* Hidratación — SÓLIDA (dato médico-operativo; fila/pozo, no columna) */}
      <motion.div variants={staggerItem}>
        <div className="rounded-sm border border-hairline bg-raised p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-[15px] font-semibold text-ink">
              <Droplet size={15} className="shrink-0 text-blue" />
              Hidratación promedio/día
            </span>
            <span className="shrink-0 font-mono text-[14px] font-semibold tabular-nums text-ink">
              {waterAvgL.toFixed(1)}
              <span className="font-normal text-ink-3"> / {waterGoalL} L</span>
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
            className="mt-3 inline-flex min-h-[44px] items-center text-[13px] font-medium text-blue"
          >
            Registrar agua en Comida →
          </button>
        </div>
      </motion.div>

      {/* ── § 04 · Señales de la semana ── */}
      <motion.div variants={staggerItem}>
        <FolioLabel n={embedded ? 3 : 4}>Señales de la semana</FolioLabel>
      </motion.div>
      <motion.div variants={staggerItem}>
        <Glass>
          {classifiedInsights.length > 0 ? (
            <div className="flex flex-col gap-2">
              {classifiedInsights.map((ins, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-2.5 rounded-[8px] px-3 py-2.5 ${INSIGHT_BG[ins.type]}`}
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
            <p className="text-[13px] text-ink-2">
              Registra comidas, agua y peso durante la semana para ver observaciones personalizadas.
            </p>
          )}
        </Glass>
      </motion.div>

      {/* ── § 05 · Racha integral: condiciones de hoy (SÓLIDA — operativo/acción) ──
          Concepto DISTINTO de la racha oficial del protocolo (Inicio/Diario/Progreso):
          esta exige dosis + comida + agua el mismo día. Etiquetarla siempre "integral". */}
      <motion.div variants={staggerItem}>
        <FolioLabel n={embedded ? 4 : 5}>{rachaLabel('Racha integral')}</FolioLabel>
      </motion.div>
      <motion.div variants={staggerItem}>
        <div className="rounded-sm border border-hairline bg-raised p-4">
          <p className="mb-3 text-[12px] text-ink-3">
            Dosis + comida + agua el mismo día.
          </p>
          <div className="mb-3 flex items-baseline gap-2">
            <span className="font-serif text-[34px] font-normal leading-none tracking-[-0.01em] tabular-nums text-ink">
              {sd.streak}
            </span>
            <span className="text-[13px] text-ink-2">
              {sd.streak === 1 ? 'día' : 'días'} de {rachaLabel('racha integral')}
            </span>
          </div>
          <div className="mb-3 flex flex-wrap gap-2">
            {(
              [
                ['Dosis', sd.today.dose],
                ['Agua', sd.today.water],
                ['Comida', sd.today.meal],
              ] as const
            ).map(([lbl, ok]) => (
              <span
                key={lbl}
                className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-full border px-3 font-mono text-[12px] font-medium ${
                  ok
                    ? 'border-[color-mix(in_srgb,var(--ok)_25%,transparent)] bg-[color-mix(in_srgb,var(--ok)_12%,transparent)] text-ok'
                    : 'border-hairline bg-transparent text-ink-3'
                }`}
              >
                {ok ? <CheckCircle2 size={13} /> : <Circle size={13} />}
                {lbl}
              </span>
            ))}
          </div>
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
              className="mt-1 inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-blue bg-[color-mix(in_srgb,var(--blue)_8%,transparent)] px-4 text-[13px] font-semibold text-blue transition-colors hover:bg-[color-mix(in_srgb,var(--blue)_14%,transparent)]"
            >
              Ir a registrar →
            </button>
          )}
        </div>
      </motion.div>

      {/* ══ § 06 · SECCIÓN PREMIUM (R45) ════════════════════════════════════ */}
      <motion.div variants={staggerItem}>
        <FolioLabel n={embedded ? 5 : 6}>Perspectivas avanzadas</FolioLabel>
      </motion.div>

      <motion.div variants={staggerItem}>
        <PremiumGate
          isPremium={isPremium}
          onUnlock={() => dispatch({ t: 'sheet', sheet: 'paywall' })}
        >
          <div className="flex flex-col gap-4">

            {/* R43: gate perfil — bloquea TDEE + proyección si perfil incompleto */}
            <ProfileGate
              profileComplete={profileComplete}
              dispatch={dispatch}
              profile={p}
            >
              {/* R42: Proyección de meta — #10: solo objetivos metabólicos/composición (peso) */}
              {metabolic && (
                <ProyeccionMetaCard
                  proj={proj}
                  metaPesoKg={p.metaPesoKg}
                  dispatch={dispatch}
                />
              )}

              {/* Margen energético (TDEE) — #10: solo objetivos metabólicos/composición */}
              {metabolic && tdeeVal != null && avg7 != null && (
                <Glass>
                  <p className={`${MONO_LABEL} mb-3`}>
                    Margen energético
                  </p>
                  <div className="flex gap-4 flex-wrap">
                    <StatRow
                      label="TDEE est."
                      info={<TermInfo term="TDEE">Calorías que tu cuerpo gasta al día, estimadas con tu perfil.</TermInfo>}
                      value={tdeeVal}
                      sub="kcal"
                    />
                    <StatRow label="Consumo 7d" value={avg7} sub="kcal/día" />
                    {caloricDelta != null && (
                      <StatRow
                        label={caloricDelta < 0 ? 'Déficit' : 'Superávit'}
                        value={
                          <span className={
                            isGrowth
                              ? caloricDelta > 0 ? 'text-ok' : 'text-warn'
                              : caloricDelta < 0 ? 'text-ok' : 'text-warn'
                          }>
                            {Math.abs(caloricDelta)}
                          </span>
                        }
                        sub="kcal"
                      />
                    )}
                  </div>
                  {severeDeficit && (
                    <div
                      className={`mt-3 rounded-[8px] border px-3 py-2.5 ${
                        veryDeficit
                          ? 'border-[color-mix(in_srgb,var(--alert)_40%,transparent)] bg-[color-mix(in_srgb,var(--alert)_10%,transparent)]'
                          : 'border-[color-mix(in_srgb,var(--warn)_30%,transparent)] bg-[color-mix(in_srgb,var(--warn)_10%,transparent)]'
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
              )}
            </ProfileGate>

            {/* Protocolo en números — independiente del perfil */}
            {pn && (pn.deltaKcal != null || pn.weightDelta != null) && (
              <Glass>
                <p className={`${MONO_LABEL} mb-3`}>
                  Tu protocolo en números
                </p>
                <div className="flex gap-4 flex-wrap">
                  {pn.deltaKcal != null && (
                    <StatRow
                      label="Δ kcal/día prom."
                      value={
                        <span className={pn.deltaKcal <= 0 ? 'text-ok' : 'text-ink'}>
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
                        <span className={pn.weightDelta <= 0 ? 'text-ok' : 'text-ink'}>
                          {pn.weightDelta > 0 ? '+' : ''}{pn.weightDelta}
                        </span>
                      }
                      sub="kg"
                    />
                  )}
                </div>
                {!pn.enoughData && (
                  <p className="mt-3 text-[12px] text-ink-3">
                    Registra ~14 días para una comparación más sólida.
                  </p>
                )}
              </Glass>
            )}

          </div>
        </PremiumGate>
      </motion.div>

      {/* ── Aviso legal observacional ── */}
      <motion.div variants={staggerItem}>
        <p className="border-l-2 border-hairline pl-3 text-[12px] leading-relaxed text-ink-3">
          Resumen de tu registro personal. La adherencia mide tu consistencia, no la eficacia ni un resultado clínico. Tu historial se guarda solo en tu dispositivo.
        </p>
      </motion.div>
    </motion.div>
  )
}
