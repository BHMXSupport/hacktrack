// Agregar — chooser del "+". Dosis es el héroe (grande, gradiente kelp, arriba).
// Items: 315 (stack multi-producto), 327 (KPIs recientes), 328 (banner de brecha de datos),
//        437 (buscador fusionado arriba)
// Sin props, usa useApp(). Compliance: IcDrop (sin jeringas), sin venta in-app.
import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sheet } from '../components/Sheet'
import { IcDrop } from '../components/icons'
import { GlyphCircle, Glyph } from '../components/glyphs'
import { Chip } from '../components/controls'
import { useApp } from '../lib/store'
import { loggableKpisForState, MEASURE_ICON } from '../lib/catalog'
import type { KpiDef } from '../lib/catalog'

const stagger = { animate: { transition: { staggerChildren: 0.06 } } }
const item = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 } }

// item 327: obtiene los últimos 3 KPIs registrados (no dosis)
function recentKpis(
  log: ReturnType<typeof useApp>['state']['log'],
  kpis: KpiDef[],
): KpiDef[] {
  const seen = new Set<string>()
  const out: KpiDef[] = []
  for (const group of log) {
    for (const it of group.items) {
      if (it.type === 'dose') continue
      const kpi = kpis.find((k) => k.key === it.n || k.key === it.product)
      if (kpi && !seen.has(kpi.key)) {
        seen.add(kpi.key)
        out.push(kpi)
      }
      if (out.length >= 3) return out
    }
  }
  return out
}

// item 315: productos activos para el stack
function activeProductsList(state: ReturnType<typeof useApp>['state']): string[] {
  return Object.keys(state.protocols).filter((p) => !state.protocols[p]?.archived)
}

// item 328: tiempo desde el último registro de medida (ms)
function msLastMeasure(log: ReturnType<typeof useApp>['state']['log']): number | null {
  for (const group of log) {
    for (const it of group.items) {
      if (it.type !== 'dose') return Date.now() - it.ts
    }
  }
  return null
}

export function Agregar() {
  const { state, dispatch } = useApp()
  // incluye las medidas elegidas + las de la categoría de cada producto activo (= las de "por producto" en Semana)
  const kpis = loggableKpisForState(state)

  // item 437: buscador fusionado
  const [query, setQuery] = useState('')
  const [showSearch, setShowSearch] = useState(false)

  // item 315: stack multi-producto
  const [stackMode, setStackMode] = useState(false)
  const [stackSelected, setStackSelected] = useState<Set<string>>(new Set())
  const [stackDoses, setStackDoses] = useState<Record<string, string>>({})

  // item 328: banner de brecha de datos
  const msLast = msLastMeasure(state.log)
  const gapH = msLast != null ? msLast / 3600000 : null
  const [dismissedGap, setDismissedGap] = useState(false)
  const showGapBanner = !dismissedGap && gapH != null && gapH > 48

  const recentKpiList = useMemo(() => recentKpis(state.log, kpis), [state.log, kpis])
  const activeProducts = activeProductsList(state)

  function handleKpi(k: KpiDef) {
    if (k.kind === 'medidas') dispatch({ t: 'sheet', sheet: 'medidas' })
    else dispatch({ t: 'sheet', sheet: 'medida', arg: k.key })
  }

  // item 437: resultados de búsqueda fusionados
  const searchResults = useMemo(() => {
    const q = query.toLowerCase().trim()
    if (!q) return []
    const results: { label: string; sub: string; action: () => void; color: string; icon: string }[] = []

    // protocolos del usuario
    for (const p of activeProducts) {
      if (p.toLowerCase().includes(q)) {
        results.push({
          label: p, sub: 'Registrar dosis',
          action: () => dispatch({ t: 'sheet', sheet: 'registrar', arg: p }),
          color: 'var(--brand-700)', icon: 'hidratacion',
        })
      }
    }
    // KPIs
    for (const k of kpis) {
      if (k.label.toLowerCase().includes(q) || k.key.toLowerCase().includes(q)) {
        results.push({
          label: k.label, sub: 'Registrar medida',
          action: () => handleKpi(k),
          color: k.color, icon: k.icon,
        })
      }
    }
    return results.slice(0, 6)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, activeProducts, kpis])

  // item 315: confirmar stack
  function handleStackSave() {
    for (const p of stackSelected) {
      const val = parseFloat(stackDoses[p] ?? '')
      dispatch({ t: 'logDose', product: p, value: isNaN(val) ? null : val, unit: 'mg' })
    }
    dispatch({ t: 'toast', msg: `${stackSelected.size} dosis registradas` })
    dispatch({ t: 'sheet', sheet: null })
  }

  function toggleStack(p: string) {
    setStackSelected((prev) => {
      const next = new Set(prev)
      if (next.has(p)) next.delete(p)
      else if (next.size < 5) next.add(p)
      return next
    })
  }

  return (
    <Sheet title="Agregar registro" onClose={() => dispatch({ t: 'sheet', sheet: null })}>
      <div style={{ padding: '4px 20px 40px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* item 437: buscador fusionado */}
        <div>
          {!showSearch ? (
            <button className="btn-ghost sm"
              style={{ width: '100%', textAlign: 'left', padding: '8px 12px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)', color: 'var(--ink-400)', background: 'var(--card)' }}
              onClick={() => setShowSearch(true)}>
              <Glyph name="buscar" size={13} color="currentColor" style={{ verticalAlign: '-2px', marginRight: 3 }} /> Buscar dosis, medida…
            </button>
          ) : (
            <div style={{ position: 'relative' }}>
              <input
                type="search" className="field" autoFocus
                placeholder="BPC 157, Energía, Sueño…"
                value={query} onChange={(e) => setQuery(e.target.value)}
                onBlur={() => { if (!query) setShowSearch(false) }}
                style={{ paddingRight: 36 }}
              />
              <button onClick={() => { setQuery(''); setShowSearch(false) }}
                aria-label="Limpiar búsqueda"
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-400)', display: 'flex' }}>
                <Glyph name="cross" size={14} color="currentColor" />
              </button>
            </div>
          )}

          {/* Resultados de búsqueda */}
          <AnimatePresence>
            {query.trim() && (
              <motion.div
                initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6 }}
              >
                {searchResults.length > 0 ? searchResults.map((r, i) => (
                  <button key={i} onClick={r.action}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 14px', borderRadius: 'var(--r-sm)',
                      background: 'var(--card)', border: '1px solid var(--border)',
                      cursor: 'pointer', textAlign: 'left',
                    }}>
                    <GlyphCircle name={r.icon} color={r.color} size={16} box={32} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p className="sm" style={{ margin: 0, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.label}</p>
                      <p className="sm" style={{ margin: 0, color: 'var(--ink-400)' }}>{r.sub}</p>
                    </div>
                  </button>
                )) : (
                  <p className="sm" style={{ color: 'var(--ink-400)', margin: 0, padding: '4px 0' }}>Sin resultados</p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* item 328: banner de brecha de datos de KPI */}
        <AnimatePresence>
          {showGapBanner && (
            <motion.div
              initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}
              style={{
                padding: '4px 2px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10,
                borderBottom: '1px solid var(--border)',
              }}
            >
              <p className="sm" style={{ margin: 0, color: 'var(--ink-400)', flex: 1, minWidth: 0 }}>
                No registras cómo te sientes en {gapH != null ? Math.round(gapH / 24) : '2'} días — tus tendencias se desactualizan.
              </p>
              <button className="btn-ghost sm" style={{ flexShrink: 0, color: 'var(--ink-400)', height: 'auto', padding: '0 4px' }}
                onClick={() => setDismissedGap(true)} aria-label="Ocultar aviso">
                <Glyph name="cross" size={13} color="currentColor" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* item 327: KPIs recientes */}
        {recentKpiList.length > 0 && (
          <div>
            <p className="sm" style={{ margin: '0 0 8px', color: 'var(--ink-400)', fontWeight: 500 }}>Registros recientes</p>
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
              {recentKpiList.map((k) => (
                <button key={k.key} onClick={() => handleKpi(k)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
                    borderRadius: 99, border: '1.5px solid var(--border)',
                    background: 'var(--card)', cursor: 'pointer', flexShrink: 0,
                  }}>
                  <GlyphCircle name={k.icon} color={k.color} size={14} box={22} />
                  <span className="sm" style={{ fontWeight: 600, color: 'var(--ink-700)' }}>{k.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── HÉROE: Dosis ── */}
        <motion.button
          variants={item} initial="initial" animate="animate"
          onClick={() => dispatch({ t: 'sheet', sheet: 'registrar' })}
          style={{
            display: 'flex', alignItems: 'center', gap: 20, width: '100%',
            padding: '28px 24px', borderRadius: 20,
            background: 'linear-gradient(135deg, #0E5A52, #1B8A7D)',
            border: 'none', cursor: 'pointer', textAlign: 'left',
            boxShadow: '0 4px 24px rgba(14, 90, 82, 0.32)',
          }}
          whileTap={{ scale: 0.98 }}
        >
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#fff' }}>
            <IcDrop size={28} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span className="h2" style={{ color: '#fff', fontWeight: 700, lineHeight: 1.15 }}>Dosis</span>
            <span className="sm" style={{ color: 'rgba(255,255,255,0.75)', fontWeight: 400 }}>Registra tu dosis</span>
          </div>
          <div style={{ marginLeft: 'auto', color: 'rgba(255,255,255,0.6)', fontSize: 22, lineHeight: 1 }}>›</div>
        </motion.button>

        {/* item 315: registrar stack */}
        {activeProducts.length >= 2 && (
          <div>
            <button className="btn btn-outline btn-sm"
              style={{ width: '100%' }}
              onClick={() => setStackMode((v) => !v)}>
              {stackMode ? 'Cancelar stack' : 'Registrar stack (2-5 productos)'}
            </button>
            <AnimatePresence>
              {stackMode && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                  style={{ overflow: 'hidden' }}
                >
                  <div style={{ paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <p className="sm" style={{ margin: 0, color: 'var(--ink-400)' }}>
                      Elige hasta 5 productos — se registran con un solo «Guardar».
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {activeProducts.map((p) => (
                        <Chip key={p} label={p} active={stackSelected.has(p)}
                          onClick={() => toggleStack(p)} />
                      ))}
                    </div>
                    {/* Dosis por producto del stack */}
                    {stackSelected.size > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                        {[...stackSelected].map((p) => (
                          <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span className="sm" style={{ flex: 1, minWidth: 0, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p}</span>
                            <input className="field mono" type="number" inputMode="decimal" placeholder="dosis (mg)"
                              value={stackDoses[p] ?? ''}
                              onChange={(e) => setStackDoses((d) => ({ ...d, [p]: e.target.value }))}
                              style={{ width: 100, flexShrink: 0, fontSize: 14, textAlign: 'right' }} />
                            <span className="sm" style={{ color: 'var(--ink-400)', width: 24, flexShrink: 0 }}>mg</span>
                          </div>
                        ))}
                        <button className="btn btn-brand"
                          disabled={stackSelected.size === 0}
                          onClick={handleStackSave}>
                          Guardar {stackSelected.size} dosis
                        </button>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Subtítulo */}
        <motion.p variants={item} initial="initial" animate="animate"
          className="sm" style={{ color: 'var(--ink-400)', margin: 0, fontWeight: 500 }}>
          O registra cómo te sientes
        </motion.p>

        {/* Grilla 2 columnas de KPIs */}
        <motion.div variants={stagger} initial="initial" animate="animate"
          style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {kpis.map((k) => (
            <motion.button key={k.key} variants={item} onClick={() => handleKpi(k)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8,
                padding: '16px 16px', borderRadius: 16,
                border: '1.5px solid var(--border)', background: 'var(--card)',
                cursor: 'pointer', textAlign: 'left',
                boxShadow: `0 0 0 0 ${k.color}00`,
                transition: 'box-shadow .15s, border-color .15s',
              }}
              whileTap={{ scale: 0.97 }}
              onMouseEnter={(e) => {
                ;(e.currentTarget as HTMLButtonElement).style.borderColor = k.color
                ;(e.currentTarget as HTMLButtonElement).style.boxShadow = `0 2px 12px ${k.color}28`
              }}
              onMouseLeave={(e) => {
                ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)'
                ;(e.currentTarget as HTMLButtonElement).style.boxShadow = 'none'
              }}>
              <GlyphCircle name={k.icon} color={k.color} size={22} />
              <span className="sm" style={{ color: 'var(--ink-700)', fontWeight: 600, lineHeight: 1.3 }}>{k.label}</span>
            </motion.button>
          ))}
        </motion.div>

      </div>
    </Sheet>
  )
}
