import { useMemo } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Shield, Droplet, ChevronRight, Check, Clock } from 'lucide-react'
import { useApp } from '../../lib/store'
import { startOfDay } from '../../lib/cadence'
import { upcomingDoses, protocolStreak, dayProducts, doseTakenOnProduct } from '../../lib/calendar'
import { Glass } from '../ui/Glass'
import { DataPlate } from '../ui/DataPlate'
import { Ring } from '../ui/Ring'
import { Button } from '../ui/Button'
import heroSrc from '../../assets/rebuild/hero-precision.mp4'

const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const keyOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

function countdown(at: Date, now: Date): string {
  const mins = Math.max(0, Math.round((at.getTime() - now.getTime()) / 60000))
  if (mins < 1) return 'es ahora'
  if (mins < 60) return `en ${mins} min`
  const h = Math.floor(mins / 60)
  if (h < 48) return mins % 60 === 0 ? `en ${h}h` : `en ${h}h ${mins % 60}m`
  const d = Math.floor(h / 24)
  return h % 24 === 0 ? `en ${d} d` : `en ${d} d ${h % 24}h`
}

const fade = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0, 0, 0, 1] as [number, number, number, number] } },
}

export function Inicio({ onRegistrar }: { onRegistrar: () => void }) {
  const { state, dispatch } = useApp()
  const reduce = useReducedMotion()
  const now = new Date()

  const next = useMemo(() => upcomingDoses(state, now, 1)[0] ?? null, [state])
  const streak = useMemo(() => protocolStreak(state, now), [state])
  const today = startOfDay(now)

  const adh = useMemo(() => {
    let due = 0
    let taken = 0
    for (let i = 0; i < 30; i++) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      for (const p of dayProducts(state, d)) {
        due++
        if (doseTakenOnProduct(state, d, p)) taken++
      }
    }
    return { due, taken, pct: due ? Math.round((taken / due) * 100) : 0 }
  }, [state])

  const todayDoses = useMemo(
    () => dayProducts(state, today).map((p) => ({ product: p, done: doseTakenOnProduct(state, today, p) })),
    [state],
  )

  const measures = state.selectedMeasures.slice(0, 2).map((m) => ({ m, v: state.measureValues[m] }))
  const water = state.nutrition[keyOf(today)]?.water ?? 0
  const waterGoal = 2000
  const name = state.profile.name?.split(' ')[0] ?? ''
  const fecha = `${DIAS[now.getDay()]}, ${now.getDate()} ${MES[now.getMonth()]}`

  return (
    <motion.div
      className="flex flex-col gap-4 px-4 pb-32 pt-[max(20px,env(safe-area-inset-top))]"
      initial={reduce ? false : 'hidden'}
      animate="show"
      variants={{ show: { transition: { staggerChildren: 0.07 } } }}
    >
      {/* Header */}
      <motion.div variants={fade} className="flex items-start justify-between">
        <div>
          <p className="text-[13px] text-muted-foreground">{fecha}</p>
          <h1 className="text-[28px] font-bold leading-tight text-foreground">
            Hola{name ? `, ${name}` : ''}
          </h1>
        </div>
        <span className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-teal/25 bg-teal/10 px-3 py-1.5 text-[12px] font-medium text-teal">
          <Shield size={13} /> Tus datos son tuyos
        </span>
      </motion.div>

      {/* HERO — próxima toma con video en movimiento + readout en data-plate */}
      <motion.div variants={fade}>
        <Glass className="relative overflow-hidden p-0">
          {!reduce && (
            <video
              src={heroSrc}
              autoPlay
              muted
              loop
              playsInline
              aria-hidden
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
                <p className="mt-2 text-[12px] text-muted-foreground">
                  {next.date.toLocaleDateString('es-MX', { weekday: 'long', hour: '2-digit', minute: '2-digit' })}
                </p>
              </>
            ) : (
              <>
                <h2 className="mb-2 text-[18px] font-bold text-foreground">Sin tomas programadas</h2>
                <p className="text-[13px] text-muted-foreground">Crea un protocolo para ver tu cuenta regresiva.</p>
              </>
            )}
            <Button size="full" className="mt-4" onClick={onRegistrar}>
              Registrar dosis
            </Button>
          </div>
        </Glass>
      </motion.div>

      {/* Adherencia + racha */}
      <motion.div variants={fade}>
        <Glass className="flex items-center gap-5">
          <Ring value={adh.pct} goal={100} unit="%" label="adherencia" sub={streak > 0 ? `racha ${streak} d` : undefined} size={132} stroke={11} />
          <div className="flex-1">
            <p className="text-[12px] uppercase tracking-wider text-muted-foreground">Este mes</p>
            <p className="font-mono text-[26px] font-semibold tabular-nums text-foreground">
              {adh.taken}<span className="text-muted-foreground"> / {adh.due}</span>
            </p>
            <p className="text-[13px] text-secondary-foreground">dosis registradas</p>
          </div>
        </Glass>
      </motion.div>

      {/* Tus dosis de hoy */}
      {todayDoses.length > 0 && (
        <motion.div variants={fade}>
          <p className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">Tus dosis de hoy</p>
          <Glass className="flex flex-col gap-1 p-2">
            {todayDoses.map(({ product, done }) => (
              <div key={product} className="flex items-center gap-3 rounded-md px-3 py-3">
                <span
                  className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border ${done ? 'border-teal bg-teal text-primary-foreground' : 'border-white/20 text-transparent'}`}
                >
                  <Check size={14} strokeWidth={3} />
                </span>
                <span className="flex-1 font-medium text-foreground">{product}</span>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${done ? 'bg-ok/15 text-ok' : 'bg-warn/15 text-warn'}`}
                >
                  {done ? <Check size={11} /> : <Clock size={11} />}
                  {done ? 'Hecha' : 'Pendiente'}
                </span>
              </div>
            ))}
          </Glass>
        </motion.div>
      )}

      {/* KPIs */}
      {measures.length > 0 && (
        <motion.div variants={fade} className="grid grid-cols-2 gap-3">
          {measures.map(({ m, v }) => (
            <Glass key={m} className="p-4">
              <p className="text-[12px] text-muted-foreground">{m}</p>
              <p className="mt-1 font-mono text-[24px] font-semibold tabular-nums text-foreground">
                {v != null ? v : '—'}
              </p>
            </Glass>
          ))}
        </motion.div>
      )}

      {/* Hidratación (médica/operativa → superficie sólida, no vidrio) */}
      <motion.div variants={fade}>
        <div className="rounded-lg border border-white/8 bg-raised p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="flex items-center gap-2 font-medium text-foreground">
              <Droplet size={16} className="text-teal" /> Hidratación hoy
            </span>
            <span className="font-mono tabular-nums text-foreground">
              {(water / 1000).toFixed(1)}<span className="text-muted-foreground"> / {(waterGoal / 1000).toFixed(0)} L</span>
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-teal" style={{ width: `${Math.min(100, (water / waterGoal) * 100)}%` }} />
          </div>
          <button
            onClick={() => dispatch({ t: 'tab', tab: 'comida' })}
            className="mt-3 inline-flex items-center gap-1 text-[13px] font-medium text-teal"
          >
            Registrar agua en Comida <ChevronRight size={14} />
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
