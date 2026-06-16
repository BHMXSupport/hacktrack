// ResumenSemanal — recap de 7 días + perspectivas Plus (premium).
// Muestra los datos DEL USUARIO por protocolo (puede nombrar el producto). App Store: el copy no
// afirma causalidad/eficacia ni recomienda dosis; "desde que iniciaste <producto>" es solo el ancla temporal.
import { useState } from 'react'
import { motion } from 'framer-motion'
import { useApp, adherence, isoKey } from '../lib/store'
import {
  protocolNumbers, tdee, avgKcal, weightProjection, compositeStreak, weeklyInsights, kcalSeries, streakDetail, anchorProduct, protocolList, productKpis,
} from '../lib/nutrition'
import { Sparkline } from '../components/charts'
import { PremiumGate } from '../components/PremiumGate'
import type { Actividad, Sexo } from '../lib/types'
import { staggerParent, staggerItem } from '../lib/motion'

const DAY = 86_400_000
const ACT_LABEL: { v: Actividad; l: string }[] = [
  { v: 'sedentario', l: 'Sedentario' }, { v: 'ligero', l: 'Ligero' }, { v: 'moderado', l: 'Moderado' }, { v: 'activo', l: 'Activo' }, { v: 'muy-activo', l: 'Muy activo' },
]

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <motion.div variants={staggerItem} className="card">
      <div className="body" style={{ fontWeight: 600, color: 'var(--ink-900)' }}>{title}</div>
      {subtitle && <div className="sm" style={{ color: 'var(--ink-400)', marginTop: 2 }}>{subtitle}</div>}
      <div style={{ marginTop: 12 }}>{children}</div>
    </motion.div>
  )
}
const fmtDate = (ts: number) => new Date(ts).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })

// ── Tarjeta PER-PRODUCTO: cada producto que consumes con sus KPIs de categoría ──
function ProductCards() {
  const { state, dispatch } = useApp()
  const protos = protocolList(state)
  if (protos.length === 0) return null
  return (
    <>
      {protos.map((pr) => {
        const kpis = productKpis(state, pr.product)
        return (
          <motion.div key={pr.product} variants={staggerItem} className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="body" style={{ fontWeight: 600, color: 'var(--ink-900)' }}>{pr.product}</span>
              <span className="sm" style={{ background: pr.color + '18', color: pr.color, padding: '2px 9px', borderRadius: 999, fontWeight: 600 }}>{pr.cat}</span>
              <span className="sm" style={{ color: 'var(--ink-400)', marginLeft: 'auto' }}>{pr.daysActive} d activo</span>
            </div>
            <div className="sm" style={{ color: 'var(--ink-400)', margin: '2px 0 12px' }}>Tus lecturas durante este protocolo</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {kpis.map((k) => {
                const good = k.delta != null && k.delta !== 0 && ((k.down && k.delta < 0) || (!k.down && k.delta > 0))
                const bad = k.delta != null && k.delta !== 0 && !good
                const col = good ? 'var(--success)' : bad ? 'var(--warning)' : 'var(--ink-400)'
                const dUnit = k.unit.startsWith('/') ? '' : k.unit
                return (
                  <div key={k.measure} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className="sm" style={{ flex: 1, minWidth: 0, color: 'var(--ink-700)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{k.measure}</span>
                    {k.last == null ? (
                      <button className="chip" style={{ height: 28, fontSize: 12.5 }} onClick={() => dispatch({ t: 'sheet', sheet: 'medida', arg: k.measure })}>+ Registrar</button>
                    ) : (
                      <>
                        <span className="mono sm" style={{ fontWeight: 700 }}>{k.last}<span style={{ color: 'var(--ink-400)' }}>{k.unit}</span></span>
                        {k.delta != null && <span className="mono sm" style={{ width: 52, textAlign: 'right', color: col }}>{k.delta > 0 ? '+' : ''}{k.delta}{dUnit}</span>}
                        {k.points.length >= 2 && <Sparkline data={k.points} color={good ? 'var(--success)' : bad ? 'var(--warning)' : 'var(--ink-300)'} w={60} h={22} />}
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          </motion.div>
        )
      })}
    </>
  )
}

// ── Tendencias: selector de ventana con sparkline de peso, calorías/día e hidratación ──
function TrendsCard() {
  const { state } = useApp()
  const [win, setWin] = useState<number>(7)
  const kcal = kcalSeries(state, win).filter((d) => d.has)
  const kcalPts = kcal.map((d) => d.kcal)
  const waterPts = kcalSeries(state, win).map((d) => state.nutrition[isoKey(d.ts)]?.water ?? 0).filter((_, i, arr) => arr.some((w) => w > 0))
  const pesoAll = [...(state.history['Peso'] ?? [])].sort((a, b) => a.ts - b.ts)
  const pesoWin = pesoAll.filter((p) => p.ts >= state.todayTs - win * DAY)
  const pesoPts = (pesoWin.length >= 2 ? pesoWin : pesoAll).map((p) => p.value)

  const Row = ({ label, pts, unit, color }: { label: string; pts: number[]; unit: string; color: string }) => {
    if (pts.length < 2) return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span className="sm" style={{ width: 96, color: 'var(--ink-700)' }}>{label}</span>
        <span className="sm" style={{ color: 'var(--ink-300)' }}>Registra unos días más</span>
      </div>
    )
    const d = Math.round((pts[pts.length - 1] - pts[0]) * 10) / 10
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span className="sm" style={{ width: 96, color: 'var(--ink-700)' }}>{label}</span>
        <span className="sm mono" style={{ width: 64, color: 'var(--ink-400)' }}>{d > 0 ? '+' : ''}{d}{unit}</span>
        <div style={{ marginLeft: 'auto' }}><Sparkline data={pts} color={color} w={120} h={26} /></div>
      </div>
    )
  }

  return (
    <Card title="Tendencias">
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {[{ v: 7, l: '7 d' }, { v: 30, l: '30 d' }, { v: 90, l: 'Todo' }].map((o) => (
          <button key={o.v} className="chip" style={{ flex: 1, justifyContent: 'center', background: win === o.v ? 'var(--brand-700)' : undefined, color: win === o.v ? '#fff' : undefined }} onClick={() => setWin(o.v)}>{o.l}</button>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Row label="Peso" pts={pesoPts} unit=" kg" color="var(--brand-700)" />
        <Row label="Calorías/día" pts={kcalPts} unit="" color="var(--brand-500)" />
        <Row label="Hidratación" pts={waterPts} unit="" color="var(--brand-300)" />
      </div>
    </Card>
  )
}

export function ResumenSemanal() {
  const { state, dispatch } = useApp()
  const cutoff = state.todayTs - 7 * DAY

  let doses = 0, measures = 0
  for (const g of state.log) for (const it of g.items) {
    if (it.ts < cutoff) continue
    if (it.type === 'dose') doses++
    else if (it.type === 'medida') measures++
  }
  const adh = adherence(state, 7)
  let water = 0, kcalTot = 0
  for (let i = 0; i < 7; i++) {
    const d = state.nutrition[isoKey(state.todayTs - i * DAY)]
    if (!d) continue
    water += d.water; kcalTot += d.meals.reduce((s, m) => s + m.kcal, 0)
  }
  const streak = compositeStreak(state)
  const sd = streakDetail(state)

  // datos premium
  const pn = protocolNumbers(state)
  const t = tdee(state); const avg7 = avgKcal(state, 7)
  const proj = weightProjection(state)
  const insights = weeklyInsights(state)
  const p = state.profile
  const profileComplete = !!(p.edad && p.sexo && p.actividad)
  const ap = anchorProduct(state)
  const multiProto = Object.keys(state.protocols).length > 1
  const ancSub = multiProto ? 'Desde el inicio de tu seguimiento' : ap ? `Desde que iniciaste ${ap}` : 'Desde tu fecha de inicio'

  return (
    <div className="scroll has-nav">
      <motion.div variants={staggerParent} initial="initial" animate="animate" style={{ padding: '24px 20px 40px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <motion.div variants={staggerItem} style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <div>
            <h1 className="h1" style={{ margin: 0 }}>Tu semana</h1>
            <p className="sm" style={{ color: 'var(--ink-400)', marginTop: 4 }}>Últimos 7 días</p>
          </div>
          {streak > 0 && (
            <span className="sm mono" style={{ background: 'var(--brand-100)', color: 'var(--brand-700)', fontWeight: 700, padding: '6px 12px', borderRadius: 999 }}>
              🔥 {streak} {streak === 1 ? 'día' : 'días'}
            </span>
          )}
        </motion.div>

        {/* ── Stats base (gratis) ── */}
        <Card title="Adherencia" subtitle={adh ? `${adh.taken} de ${adh.due} dosis cumplidas` : 'Sin protocolo activo'}>
          <div className="mono" style={{ fontSize: 28, fontWeight: 800, color: 'var(--brand-700)', lineHeight: 1 }}>{adh ? `${adh.pct}%` : '—'}</div>
        </Card>
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1 }}><Card title="Dosis"><div className="mono" style={{ fontSize: 24, fontWeight: 800 }}>{doses}</div></Card></div>
          <div style={{ flex: 1 }}><Card title="Hidratación"><div className="mono" style={{ fontSize: 24, fontWeight: 800 }}>{water}<span className="sm" style={{ color: 'var(--ink-400)' }}> vasos</span></div></Card></div>
          <div style={{ flex: 1 }}><Card title="Calorías"><div className="mono" style={{ fontSize: 22, fontWeight: 800 }}>{kcalTot >= 1000 ? `${(kcalTot / 1000).toFixed(1)}k` : kcalTot}</div></Card></div>
        </div>

        {/* ── Perspectivas Plus (premium) ── */}
        <motion.div variants={staggerItem} style={{ marginTop: 8 }}>
          <span className="sm" style={{ textTransform: 'uppercase', letterSpacing: 0.6, color: 'var(--ink-400)' }}>Perspectivas Plus</span>
        </motion.div>

        <PremiumGate label="Perspectivas Plus — desbloquea tu progreso real">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* Perfil para perspectivas (TDEE / proyección) */}
            {!profileComplete && (
              <Card title="Completa tu perfil" subtitle="Para calcular tu gasto energético y proyección">
                <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                  <input className="field" type="number" inputMode="numeric" placeholder="Edad" defaultValue={p.edad ?? ''} onBlur={(e) => dispatch({ t: 'setProfileFields', patch: { edad: parseFloat(e.target.value) || null } })} style={{ flex: 1 }} />
                  <div style={{ display: 'flex', gap: 6, flex: 1 }}>
                    {(['H', 'M'] as Sexo[]).map((sx) => (
                      <button key={sx} className={'chip' + (p.sexo === sx ? ' chip-active' : '')} style={{ flex: 1, justifyContent: 'center', background: p.sexo === sx ? 'var(--brand-700)' : undefined, color: p.sexo === sx ? '#fff' : undefined }} onClick={() => dispatch({ t: 'setProfileFields', patch: { sexo: sx } })}>{sx === 'H' ? 'Hombre' : 'Mujer'}</button>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {ACT_LABEL.map((a) => (
                    <button key={a.v} className="chip" style={{ background: p.actividad === a.v ? 'var(--brand-700)' : undefined, color: p.actividad === a.v ? '#fff' : undefined }} onClick={() => dispatch({ t: 'setProfileFields', patch: { actividad: a.v } })}>{a.l}</button>
                  ))}
                </div>
              </Card>
            )}

            {/* Tu protocolo en números — ANCLA */}
            {pn && (pn.deltaKcal != null || pn.weightDelta != null) && (
              <Card title="Tu protocolo en números" subtitle={ancSub}>
                <div style={{ display: 'flex', gap: 20, marginBottom: 8 }}>
                  {pn.deltaKcal != null && (
                    <div><div className="mono" style={{ fontSize: 26, fontWeight: 800, color: pn.deltaKcal <= 0 ? 'var(--success)' : 'var(--ink-900)' }}>{pn.deltaKcal > 0 ? '+' : ''}{pn.deltaKcal}</div><div className="sm" style={{ color: 'var(--ink-400)' }}>kcal/día prom.</div></div>
                  )}
                  {pn.weightDelta != null && (
                    <div><div className="mono" style={{ fontSize: 26, fontWeight: 800, color: pn.weightDelta <= 0 ? 'var(--success)' : 'var(--ink-900)' }}>{pn.weightDelta > 0 ? '+' : ''}{pn.weightDelta}</div><div className="sm" style={{ color: 'var(--ink-400)' }}>kg</div></div>
                  )}
                </div>
                {pn.kcalPoints.length >= 2 && <Sparkline data={pn.kcalPoints.map((x) => x.kcal)} color="var(--brand-500)" w={280} h={36} />}
                {!pn.enoughData && <div className="sm" style={{ color: 'var(--ink-400)', marginTop: 8 }}>Registra ~14 días para una comparación más sólida.</div>}
              </Card>
            )}

            {/* Progreso por producto — todos los que consumes, con sus KPIs de categoría */}
            <ProductCards />

            {/* Margen energético (TDEE) */}
            {t != null && (
              <Card title="Margen energético" subtitle="Tu consumo vs tu gasto estimado">
                <div style={{ display: 'flex', gap: 20 }}>
                  <div><div className="mono" style={{ fontSize: 22, fontWeight: 800 }}>{t}</div><div className="sm" style={{ color: 'var(--ink-400)' }}>kcal gasto est.</div></div>
                  <div><div className="mono" style={{ fontSize: 22, fontWeight: 800 }}>{avg7 ?? '—'}</div><div className="sm" style={{ color: 'var(--ink-400)' }}>kcal consumo 7d</div></div>
                  {avg7 != null && (() => { const m = avg7 - t; return (
                    <div><div className="mono" style={{ fontSize: 22, fontWeight: 800, color: m < 0 ? 'var(--brand-700)' : 'var(--warning)' }}>{m > 0 ? '+' : ''}{m}</div><div className="sm" style={{ color: 'var(--ink-400)' }}>{m < 0 ? 'déficit' : 'superávit'}</div></div>
                  ) })()}
                </div>
              </Card>
            )}

            {/* Proyección de meta */}
            {state.profile.metaPesoKg == null ? (
              <Card title="Proyección de meta">
                <div className="sm" style={{ color: 'var(--ink-400)', marginBottom: 10 }}>Define tu peso objetivo para ver tu proyección.</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input className="field" type="number" inputMode="decimal" placeholder="Meta (kg)" onBlur={(e) => { const v = parseFloat(e.target.value); if (v > 0) dispatch({ t: 'setProfileFields', patch: { metaPesoKg: v } }) }} style={{ flex: 1 }} />
                </div>
              </Card>
            ) : proj ? (
              <Card title="Proyección de meta" subtitle={`Meta: ${proj.goal} kg · a tu ritmo registrado`}>
                {(() => {
                  const total = Math.abs(proj.goal - proj.points[0])
                  const done = Math.abs(proj.current - proj.points[0])
                  const pct = total > 0 ? Math.min(100, (done / total) * 100) : 0
                  return (
                    <>
                      <div style={{ height: 8, background: 'var(--ink-100)', borderRadius: 999, overflow: 'hidden', marginBottom: 8 }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: 'var(--brand-700)', borderRadius: 999 }} />
                      </div>
                      <div className="sm" style={{ color: 'var(--ink-700)' }}>
                        {proj.current} kg → {proj.goal} kg · {proj.etaTs ? `~${fmtDate(proj.etaTs)}` : 'tendencia aún no apunta a la meta'}
                      </div>
                    </>
                  )
                })()}
              </Card>
            ) : (
              <Card title="Proyección de meta"><div className="sm" style={{ color: 'var(--ink-400)' }}>Registra tu peso unos días más para construir tu tendencia.</div></Card>
            )}

            {/* Racha y hitos */}
            <Card title="Racha y hitos" subtitle="Días seguidos con dosis, agua y comida">
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
                <span className="mono" style={{ fontSize: 30, fontWeight: 800, color: 'var(--brand-700)' }}>{sd.streak}</span>
                <span className="sm" style={{ color: 'var(--ink-400)' }}>{sd.streak === 1 ? 'día' : 'días'} de racha</span>
              </div>
              {/* condiciones de hoy */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                {([['Dosis', sd.today.dose], ['Agua', sd.today.water], ['Comida', sd.today.meal]] as const).map(([lbl, ok]) => (
                  <span key={lbl} className="sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 999, background: ok ? 'var(--brand-100)' : 'var(--ink-100)', color: ok ? 'var(--brand-700)' : 'var(--ink-400)', fontWeight: 600 }}>
                    {ok ? '✓' : '○'} {lbl}
                  </span>
                ))}
              </div>
              {/* progreso al siguiente hito */}
              {sd.nextMilestone != null && (() => {
                const span = sd.nextMilestone - sd.prevMilestone
                const pct = span > 0 ? ((sd.streak - sd.prevMilestone) / span) * 100 : 0
                return (
                  <>
                    <div style={{ height: 7, background: 'var(--ink-100)', borderRadius: 999, overflow: 'hidden', marginBottom: 6 }}>
                      <div style={{ width: `${Math.max(0, Math.min(100, pct))}%`, height: '100%', background: 'var(--brand-700)', borderRadius: 999 }} />
                    </div>
                    <div className="sm" style={{ color: 'var(--ink-700)' }}>Próximo hito: {sd.nextMilestone} días · faltan {sd.nextMilestone - sd.streak}</div>
                  </>
                )
              })()}
            </Card>

            {/* Tendencias */}
            <TrendsCard />

            {/* Señales de la semana */}
            {insights.length > 0 && (
              <Card title="Señales de la semana">
                <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {insights.map((s, i) => (<li key={i} className="sm" style={{ color: 'var(--ink-700)', lineHeight: 1.4 }}>{s}</li>))}
                </ul>
              </Card>
            )}

          </div>
        </PremiumGate>

        <motion.p variants={staggerItem} className="sm" style={{ color: 'var(--ink-300)', lineHeight: 1.4, borderLeft: '2px solid var(--border)', paddingLeft: 10, marginTop: 4 }}>
          Resumen de tu registro personal. La adherencia mide tu consistencia, no la eficacia ni un resultado clínico.
        </motion.p>
      </motion.div>
    </div>
  )
}
