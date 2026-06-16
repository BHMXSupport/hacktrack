// PharmaDashboard — "Vida del péptido en el cuerpo": decaimiento multi-producto desde las dosis registradas.
// Estimación EDUCATIVA (vida media aproximada de literatura), NO consejo médico ni dosis.
// (Síntesis del equipo: investigador PK + analista de datos + dashboard + diseñador + UX.)
import { useMemo, useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useApp } from '../lib/store'
import { buildPharmaSeries, fmtApproxMg, HALF_LIFE_H, type Mode } from '../lib/pharma'
import { CATEGORY_COLOR, PEPTIDES } from '../lib/catalog'
import { MultiLineChart } from './MultiLineChart'
import { Segmented } from './controls'
import { staggerParent, staggerItem } from '../lib/motion'

type Win = '24h' | '72h' | '7d'
const WIN_MS: Record<Win, number> = { '24h': 24 * 3_600_000, '72h': 72 * 3_600_000, '7d': 7 * 86_400_000 }

// Notas educativas por producto (se muestran SOLO debajo del producto al que aplican y cuando está activo)
const GLP1 = new Set(['Retatrutide', 'Tirzepatida', 'Semaglutida'])
const NOTE = {
  glp1: 'Vida media larga (~varios días): la curva arranca alta y baja lento; sigue presente días después de la inyección.',
  slu: 'Sin farmacocinética humana publicada — su curva es una estimación de referencia, no un dato clínico.',
  nohl: 'Sin vida media de eliminación estándar — no se grafica su decaimiento.',
}

export function PharmaDashboard() {
  const { state, dispatch } = useApp()
  const [now, setNow] = useState(() => Date.now())
  const [win, setWin] = useState<Win>('7d')
  const [mode, setMode] = useState<Mode>('percent')
  const [hidden, setHidden] = useState<Set<string>>(new Set())

  // "ahora" en vivo (el punto de cada serie y la línea avanzan)
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [])

  const data = useMemo(
    () => buildPharmaSeries(state, { now, windowMs: WIN_MS[win], mode }),
    [state, now, win, mode],
  )

  const toggle = (product: string) =>
    setHidden((prev) => {
      const next = new Set(prev)
      next.has(product) ? next.delete(product) : next.add(product)
      return next
    })

  const visible = data.series.filter((s) => !hidden.has(s.product))

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
        <div className="sm" style={{ color: 'var(--ink-400)', marginTop: 8, lineHeight: 1.4 }}>
          {noHalfLife
            ? `${data.skipped.join(', ')}: sin vida media de eliminación estándar — no se pueden graficar todavía.`
            : 'Ningún producto tiene presencia relevante en esta ventana. Amplía el rango o registra una dosis reciente.'}
        </div>
        {!noHalfLife && win !== '7d' && (
          <button className="btn btn-outline btn-sm" style={{ width: 'auto', padding: '0 14px', marginTop: 12 }} onClick={() => setWin('7d')}>
            Ver 7 días
          </button>
        )}
        <p className="sm" style={{ color: 'var(--ink-300)', marginTop: 14, lineHeight: 1.4, borderLeft: '2px solid var(--border)', paddingLeft: 10 }}>
          Estimación educativa. No es consejo médico ni recomendación de dosis.
        </p>
      </motion.div>
    )
  }

  // Notas por producto: solo de los productos ACTIVOS (en la gráfica, consumidos sin t½, o en protocolo)
  const noteProducts = (() => {
    const set = new Set<string>()
    data.series.forEach((s) => set.add(s.product))
    data.skipped.forEach((p) => set.add(p))
    Object.keys(state.protocols).forEach((p) => set.add(p))
    const out: { product: string; color: string; text: string }[] = []
    for (const p of set) {
      let text: string | null = null
      if (HALF_LIFE_H[p] == null) text = NOTE.nohl
      else if (GLP1.has(p)) text = NOTE.glp1
      else if (p === 'SLU-PP-332') text = NOTE.slu
      if (!text) continue
      const color = data.series.find((s) => s.product === p)?.color ?? CATEGORY_COLOR[PEPTIDES[p]?.cat ?? 'Explorar'] ?? 'var(--brand-700)'
      out.push({ product: p, color, text })
    }
    return out
  })()

  return (
    <motion.div variants={staggerParent} initial="initial" animate="animate">
      <motion.div variants={staggerItem} className="card" style={{ marginTop: 16, padding: 20 }}>
        {/* Cabecera */}
        <div className="body" style={{ fontWeight: 600, color: 'var(--ink-900)' }}>Vida del péptido en el cuerpo</div>
        <div className="sm" style={{ color: 'var(--ink-400)', marginTop: 2 }}>
          Estimado de cuánto sigue activo después de cada dosis
        </div>
        <div className="sm" style={{ color: 'var(--ink-300)', marginTop: 2, marginBottom: 14 }}>
          Toca el chart para ver el detalle en cualquier momento.
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
        </div>

        {/* Chart */}
        {visible.length > 0 ? (
          <MultiLineChart
            series={visible}
            domainX={data.domainX}
            domainY={data.domainY}
            nowTs={data.nowTs}
            yTicks={yTicks}
            formatY={formatY}
            xTicks={xTicks}
            refLines={mode === 'percent' ? [{ y: 25, label: '25%' }] : []}
          />
        ) : (
          <div className="sm" style={{ color: 'var(--ink-300)', textAlign: 'center', padding: '40px 0' }}>
            Toca un producto abajo para mostrar su curva.
          </div>
        )}

        {/* Leyenda: chips con mg presentes ahora + toggle de serie */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
          {data.series.map((s) => {
            const off = hidden.has(s.product)
            return (
              <button
                key={s.product}
                type="button"
                onClick={() => toggle(s.product)}
                aria-pressed={!off}
                aria-label={`${s.product}: ${fmtApproxMg(s.currentMg)} ahora`}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 7, minHeight: 40, padding: '6px 12px',
                  borderRadius: 'var(--r-sm)', cursor: 'pointer', background: 'var(--border)',
                  border: `1px solid ${off ? 'var(--border)' : s.color}`, opacity: off ? 0.5 : 1,
                }}
              >
                <span style={{ width: 9, height: 9, borderRadius: 999, background: off ? 'var(--ink-300)' : s.color, flexShrink: 0 }} />
                <span className="sm" style={{ color: 'var(--ink-700)', fontWeight: 500 }}>{s.product}</span>
                <span className="sm mono" style={{ color: 'var(--ink-900)', fontWeight: 600 }}>{fmtApproxMg(s.currentMg)}</span>
              </button>
            )
          })}
        </div>

        {/* Exposición acumulada (AUC) en la ventana — barras relativas por producto */}
        {(() => {
          const withAuc = visible.filter((s) => s.aucMgH > 0)
          if (withAuc.length === 0) return null
          const maxAuc = Math.max(...withAuc.map((s) => s.aucMgH))
          const fmtAuc = (v: number) => (v < 1 ? v.toFixed(3) : v < 10 ? v.toFixed(2) : v < 100 ? v.toFixed(1) : String(Math.round(v)))
          return (
            <div style={{ marginTop: 18 }}>
              <div className="sm" style={{ textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--ink-400)', marginBottom: 8 }}>
                Exposición acumulada <span style={{ color: 'var(--ink-300)' }}>· en esta ventana</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {withAuc.map((s) => (
                  <div key={s.product} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className="sm" style={{ width: 92, flexShrink: 0, color: 'var(--ink-700)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.product}</span>
                    <div style={{ flex: 1, height: 6, background: 'var(--ink-100)', borderRadius: 999, overflow: 'hidden' }}>
                      <div style={{ width: `${(s.aucMgH / maxAuc) * 100}%`, height: '100%', background: s.color, borderRadius: 999 }} />
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

        {/* Notas educativas POR PRODUCTO — solo del producto activo al que aplican */}
        {noteProducts.length > 0 && (
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 7 }}>
            {noteProducts.map((n) => (
              <div key={n.product} className="sm" style={{ color: 'var(--ink-400)', lineHeight: 1.4, display: 'flex', gap: 7 }}>
                <span style={{ width: 8, height: 8, borderRadius: 999, background: n.color, flexShrink: 0, marginTop: 5 }} />
                <span><strong style={{ color: 'var(--ink-700)', fontWeight: 600 }}>{n.product}:</strong> {n.text}</span>
              </div>
            ))}
          </div>
        )}

        {/* Disclaimer de cumplimiento */}
        <p className="sm" style={{ color: 'var(--ink-300)', marginTop: 14, lineHeight: 1.4, borderLeft: '2px solid var(--border)', paddingLeft: 10 }}>
          Estimación educativa basada en vidas medias aproximadas de la literatura científica. No representa tu
          farmacocinética individual, no es consejo médico ni recomendación de dosis.
        </p>
      </motion.div>
    </motion.div>
  )
}
