// PharmaDashboard — "Vida del péptido en el cuerpo": decaimiento multi-producto desde las dosis registradas.
// Estimación EDUCATIVA (vida media aproximada de literatura), NO consejo médico ni dosis.
// (Síntesis del equipo: investigador PK + analista de datos + dashboard + diseñador + UX.)
import { useMemo, useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useApp } from '../lib/store'
import { buildPharmaSeries, fmtApproxMg, formatHalfLife, HALF_LIFE_H, getProductNote, type Mode } from '../lib/pharma'
import { CATEGORY_COLOR, PEPTIDES } from '../lib/catalog'
import { upcomingDoses } from '../lib/calendar'
import { MultiLineChart } from './MultiLineChart'
import { Segmented } from './controls'
import { staggerParent, staggerItem } from '../lib/motion'

type Win = '24h' | '72h' | '7d'
const WIN_MS: Record<Win, number> = { '24h': 24 * 3_600_000, '72h': 72 * 3_600_000, '7d': 7 * 86_400_000 }

// Notas educativas movidas a pharma.ts (getProductNote). Ver item 151.

// SVG ojo barrado para estado vacío
const EyeOffIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--ink-300)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 8px', display: 'block' }}>
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
    <path d="M1 1l22 22" />
    <circle cx="12" cy="12" r="3" />
  </svg>
)

export function PharmaDashboard() {
  const { state, dispatch } = useApp()
  const [now, setNow] = useState(() => Date.now())
  const [win, setWin] = useState<Win>('7d')
  const [mode, setMode] = useState<Mode>('percent')
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const [showNextDose, setShowNextDose] = useState(true)
  const [showWeight, setShowWeight] = useState(false)

  // "ahora" en vivo (el punto de cada serie y la línea avanzan)
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [])

  const data = useMemo(
    () => buildPharmaSeries(state, { now, windowMs: WIN_MS[win], mode }),
    [state, now, win, mode],
  )

  const nextDose = useMemo(() => {
    const upcoming = upcomingDoses(state, new Date(now), 3, 30)
    return upcoming[0] ?? null
  }, [state, now])

  const hasGlp1 = useMemo(() =>
    data.series.some((s) => PEPTIDES[s.product]?.cat === 'Metabolismo' && (HALF_LIFE_H[s.product] ?? 0) >= 24),
    [data.series],
  )

  const weightOverlay = useMemo(() => {
    if (!hasGlp1 || !showWeight) return null
    const pts = (state.history['Peso'] ?? [])
      .filter((p) => p.ts >= data.domainX[0] && p.ts <= data.domainX[1])
      .sort((a, b) => a.ts - b.ts)
      .map((p) => [p.ts, p.value] as [number, number])
    if (pts.length < 2) return null
    const vals = pts.map((p) => p[1])
    return {
      points: pts,
      domainY2: [Math.min(...vals) - 0.5, Math.max(...vals) + 0.5] as [number, number],
      color: 'var(--ink-400)',
      label: 'kg',
    }
  }, [hasGlp1, showWeight, state.history, data.domainX])

  const toggle = (product: string) =>
    setHidden((prev) => {
      const next = new Set(prev)
      next.has(product) ? next.delete(product) : next.add(product)
      return next
    })

  const visible = data.series.filter((s) => !hidden.has(s.product))

  // Notas por producto: solo de los productos ACTIVOS (en la gráfica, consumidos sin t½, o en protocolo)
  const noteProducts = (() => {
    const set = new Set<string>()
    data.series.forEach((s) => set.add(s.product))
    data.skipped.forEach((p) => set.add(p))
    Object.keys(state.protocols).forEach((p) => set.add(p))
    const out: { product: string; color: string; text: string }[] = []
    for (const p of set) {
      const text = getProductNote(p)
      const color = data.series.find((s) => s.product === p)?.color ?? CATEGORY_COLOR[PEPTIDES[p]?.cat ?? 'Explorar'] ?? 'var(--brand-700)'
      out.push({ product: p, color, text })
    }
    return out
  })()

  const notesBlock = (
    <AnimatePresence>
      <motion.div
        key="notes-block"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{ display: 'flex', flexDirection: 'column', gap: 7 }}
      >
        {noteProducts.map((n) => (
          <div key={n.product} className="sm" style={{ color: 'var(--ink-400)', lineHeight: 1.4, display: 'flex', gap: 7 }}>
            <span style={{ width: 8, height: 8, borderRadius: 999, background: n.color, flexShrink: 0, marginTop: 5 }} />
            <span><strong style={{ color: 'var(--ink-700)', fontWeight: 600 }}>{n.product}:</strong> {n.text}</span>
          </div>
        ))}
      </motion.div>
    </AnimatePresence>
  )

  // ── Eje Y ──
  const yTicks = mode === 'percent' ? [0, 50, 100] : [0, data.domainY[1] / 2, data.domainY[1]]
  const formatY = mode === 'percent' ? (v: number) => `${Math.round(v)}%` : (v: number) => (v >= 1 ? String(Math.round(v)) : v.toFixed(1))

  // ── Eje X: 4 marcas relativas a "ahora" ──
  const xTicks = useMemo(() => {
    const [a, b] = data.domainX
    const out: { t: number; label: string }[] = []
    for (let i = 0; i < 4; i++) {
      const t = a + ((b - a) * i) / 3
      const dh = (t - now) / 3_600_000
      let label: string
      if (Math.abs(dh) < 0.5) label = 'hoy'
      else if (win === '7d') label = `${dh > 0 ? '+' : '−'}${Math.round(Math.abs(dh) / 24)}d`
      else label = `${dh > 0 ? '+' : '−'}${Math.round(Math.abs(dh))}h` // 24h / 72h → horas
      out.push({ t, label })
    }
    return out
  }, [data.domainX, now, win])

  // ── Estado vacío: sin ninguna dosis registrada ──
  if (!data.hasAnyDose) {
    return (
      <motion.div variants={staggerItem} className="card" style={{ marginTop: 16, textAlign: 'center', padding: '28px 20px' }}>
        <div className="body" style={{ fontWeight: 600, color: 'var(--ink-700)', marginBottom: 6 }}>
          Sin dosis registradas aún
        </div>
        <div className="sm" style={{ color: 'var(--ink-400)', marginBottom: 16 }}>
          Registra tu primera dosis y aquí verás cuánto sigue activo en tu cuerpo con el tiempo.
        </div>
        <button className="btn btn-brand" style={{ width: 'auto', padding: '0 18px' }} onClick={() => dispatch({ t: 'sheet', sheet: 'registrar' })}>
          Registrar dosis
        </button>
      </motion.div>
    )
  }

  // Hay dosis pero ninguna serie graficable: o todo es no-graficable (NAD+), o nada tiene
  // presencia relevante en esta ventana (p.ej. péptidos cortos inyectados hace días, ya decaídos).
  if (data.series.length === 0) {
    const noHalfLife = data.skipped.length > 0
    return (
      <motion.div variants={staggerItem} className="card" style={{ marginTop: 16, padding: 20 }}>
        <div className="body" style={{ fontWeight: 600, color: 'var(--ink-900)' }}>Vida del péptido en el cuerpo</div>
        <div className="sm" style={{ color: 'var(--ink-400)', marginTop: 8, marginBottom: 12, lineHeight: 1.4 }}>
          {noHalfLife
            ? 'Estos productos no grafican una curva de decaimiento, pero aquí tienes su contexto:'
            : 'Ningún producto tiene presencia relevante en esta ventana. Amplía el rango o registra una dosis reciente.'}
        </div>
        {noteProducts.length > 0 && notesBlock}
        {!noHalfLife && win !== '7d' && (
          <button className="btn btn-outline btn-sm" style={{ width: 'auto', padding: '0 14px', marginTop: 12 }} onClick={() => setWin('7d')}>
            Ver 7 días
          </button>
        )}
        <p className="disclaimer" style={{ borderLeft: '2px solid var(--border)', paddingLeft: 10 }}>
          Estimación educativa. No es consejo médico ni recomendación de dosis.
        </p>
      </motion.div>
    )
  }

  return (
    <motion.div variants={staggerParent} initial="initial" animate="animate">
      <motion.div variants={staggerItem} className="card" style={{ marginTop: 16, padding: 20 }}>
        {/* Cabecera */}
        <div className="body" style={{ fontWeight: 600, color: 'var(--ink-900)' }}>Vida del péptido en el cuerpo</div>
        <div className="sm" style={{ color: 'var(--ink-400)', marginTop: 2, marginBottom: 14 }}>
          Estimado de cuánto sigue activo después de cada dosis{' '}
          <span style={{ color: 'var(--ink-300)' }}>(dosis-equivalente residual, no concentración plasmática)</span>
        </div>

        {/* Controles: ventana + escala */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 160 }}>
            <Segmented<Win>
              value={win}
              onChange={setWin}
              options={[{ value: '24h', label: '24 h' }, { value: '72h', label: '72 h' }, { value: '7d', label: '7 d' }]}
            />
          </div>
          <div style={{ flex: 1, minWidth: 140 }}>
            <Segmented<Mode>
              value={mode}
              onChange={setMode}
              options={[{ value: 'percent', label: '% pico' }, { value: 'absolute', label: 'mg' }]}
            />
          </div>
          {nextDose && (
            <button
              className="chip"
              style={{ background: showNextDose ? 'var(--brand-100)' : undefined, color: showNextDose ? 'var(--brand-700)' : undefined }}
              onClick={() => setShowNextDose((v) => !v)}
            >
              Próxima dosis
            </button>
          )}
          {hasGlp1 && (
            <button
              className="chip"
              style={{ background: showWeight ? 'var(--brand-100)' : undefined, color: showWeight ? 'var(--brand-700)' : undefined }}
              onClick={() => setShowWeight((v) => !v)}
            >
              Mostrar peso
            </button>
          )}
        </div>

        {/* Mini-nota eje Y en modo mg */}
        {mode === 'absolute' && (
          <div className="sm" style={{ color: 'var(--ink-300)', marginBottom: 8, lineHeight: 1.4 }}>
            Eje Y en mg · dosis-equivalente residual (no concentración plasmática)
          </div>
        )}

        {/* Chart */}
        {visible.length > 0 ? (
          <>
            <MultiLineChart
              series={visible.map((s) => ({ ...s, dashed: s.isEstimatedOnly, halfLifeH: s.halfLifeH }))}
              mode={mode}
              domainX={data.domainX}
              domainY={data.domainY}
              nowTs={data.nowTs}
              yTicks={yTicks}
              formatY={formatY}
              xTicks={xTicks}
              refLines={
                mode === 'percent'
                  ? [{ y: 25, label: '25%' }, { y: 50, label: 't½' }]
                  : []
              }
              verticalRefs={
                showNextDose && nextDose && nextDose.date.getTime() >= data.domainX[0] && nextDose.date.getTime() <= data.domainX[1]
                  ? [{ t: nextDose.date.getTime(), label: `próxima · ${nextDose.product}`, color: 'var(--brand-700)' }]
                  : []
              }
              secondarySeries={weightOverlay ?? undefined}
              showSecondaryAxis={!!weightOverlay}
              domainY2={weightOverlay?.domainY2}
            />
            {showWeight && hasGlp1 && (
              <p className="disclaimer" style={{ borderLeft: '2px solid var(--border)', paddingLeft: 10, marginTop: 8 }}>
                Observacional — no implica causalidad entre la dosis y el cambio de peso.
              </p>
            )}
          </>
        ) : (
          <div className="sm" style={{ color: 'var(--ink-400)', textAlign: 'center', padding: '40px 0' }}>
            <EyeOffIcon />
            Toca un producto abajo para mostrar su curva.
          </div>
        )}

        {/* Leyenda: chips con mg presentes ahora + toggle de serie */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
          {data.series.map((s) => {
            const off = hidden.has(s.product)
            const displayName = s.isEstimatedOnly ? `~${s.product}` : s.product
            return (
              <motion.button
                key={s.product}
                type="button"
                onClick={() => toggle(s.product)}
                aria-pressed={!off}
                aria-label={`${s.product}: ${fmtApproxMg(s.currentMg)} ahora`}
                whileTap={{ scale: 0.93 }}
                animate={{ opacity: off ? 0.45 : 1 }}
                transition={{ duration: 0.15 }}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 7, minHeight: 40, padding: '6px 12px',
                  borderRadius: 'var(--r-sm)', cursor: 'pointer', background: 'var(--ink-100)',
                  border: `1.5px solid ${s.color}`,
                }}
              >
                <span style={{ width: 10, height: 10, borderRadius: 999, background: off ? 'var(--ink-300)' : s.color, flexShrink: 0 }} />
                <span className="sm" style={{ color: 'var(--ink-700)', fontWeight: 500 }}>
                  {displayName}
                  {s.isEstimatedOnly && (
                    <span className="sm" style={{ color: 'var(--ink-400)', fontWeight: 400 }}> (estimación)</span>
                  )}
                </span>
                <span className="sm mono" style={{ color: 'var(--ink-400)', fontWeight: 400 }}>
                  {formatHalfLife(s.halfLifeH)}
                </span>
                <span className="sm mono" style={{ color: 'var(--ink-900)', fontWeight: 600 }}>{fmtApproxMg(s.currentMg)}</span>
              </motion.button>
            )
          })}
        </div>

        <hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '16px 0' }} />

        {/* Exposición acumulada (AUC) en la ventana — barras relativas por producto */}
        {(() => {
          const withAuc = visible.filter((s) => s.aucMgH > 0)
          if (withAuc.length === 0) return null
          const maxAuc = Math.max(...withAuc.map((s) => s.aucMgH))
          const fmtAuc = (v: number) => (v < 1 ? v.toFixed(3) : v < 10 ? v.toFixed(2) : v < 100 ? v.toFixed(1) : String(Math.round(v)))
          return (
            <div>
              <div className="sm" style={{ textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--ink-400)', marginBottom: 8 }}>
                Exposición acumulada <span style={{ color: 'var(--ink-300)' }}>· en esta ventana</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {withAuc.map((s, i) => (
                  <div key={s.product} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className="sm" style={{ width: 92, flexShrink: 0, color: 'var(--ink-700)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.product}</span>
                    <div style={{ flex: 1, height: 6, background: 'var(--ink-100)', borderRadius: 999, overflow: 'hidden' }}>
                      <motion.div
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: 1 }}
                        transition={{ duration: 0.45, delay: i * 0.07, ease: 'easeOut' }}
                        style={{ width: `${(s.aucMgH / maxAuc) * 100}%`, height: '100%', background: s.color, borderRadius: 999, transformOrigin: 'left center' }}
                      />
                    </div>
                    <span className="sm mono" style={{ width: 76, textAlign: 'right', flexShrink: 0, color: 'var(--ink-900)', fontWeight: 600 }}>{fmtAuc(s.aucMgH)} mg·h</span>
                  </div>
                ))}
              </div>
              <div className="sm" style={{ color: 'var(--ink-300)', marginTop: 8, lineHeight: 1.4 }}>
                Estimación teórica de exposición (área bajo la curva), no un nivel en sangre.
              </div>
            </div>
          )
        })()}

        <hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '16px 0' }} />

        {/* Notas educativas POR PRODUCTO — solo del producto activo al que aplican */}
        {noteProducts.length > 0 && notesBlock}

        {/* Disclaimer de cumplimiento */}
        <p className="disclaimer" style={{ borderLeft: '2px solid var(--border)', paddingLeft: 10 }}>
          Estimación educativa basada en vidas medias aproximadas de la literatura científica. No representa tu
          farmacocinética individual, no es consejo médico ni recomendación de dosis.
        </p>
      </motion.div>
    </motion.div>
  )
}
