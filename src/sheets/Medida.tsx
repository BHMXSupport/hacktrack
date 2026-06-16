// MedidaSheet — sheet de registro de KPI/medida subjetiva.
// Items: 318 (fix Enter + valor 0), 319 (etiquetas semánticas), 320 (toggle input/slider),
//        329 (efecto secundario vinculado a producto), 471 (5 botones rápidos), 472 (delta instantáneo)
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sheet } from '../components/Sheet'
import { Chip, Disclaimer } from '../components/controls'
import { useApp } from '../lib/store'
import { KPIS, MEASURE_META } from '../lib/catalog'
import type { AdverseSeverity } from '../lib/types'

// Primer KPI de tipo scale como fallback canónico
const FIRST_SCALE_KEY = KPIS.find((k) => k.kind === 'scale')?.key ?? 'Energía'

// item 319: etiquetas semánticas por KPI (no "bajo/medio/alto" genérico)
const SCALE_LABELS: Record<string, [string, string, string, string, string]> = {
  'Energía':           ['Sin energía', 'Baja', 'Normal', 'Buena', 'Lleno de energía'],
  'Estado de ánimo':   ['Muy bajo', 'Bajo', 'Estable', 'Bueno', 'Excelente'],
  'Sueño':             ['Pésimo', 'Mal', 'Regular', 'Bien', 'Descansado'],
  'Dolor':             ['Sin dolor', 'Leve', 'Moderado', 'Intenso', 'Severo'],
  'Foco':              ['Sin foco', 'Poco', 'Normal', 'Claro', 'Concentrado'],
  'Libido':            ['Nulo', 'Bajo', 'Normal', 'Alto', 'Muy alto'],
  'Elasticidad piel':  ['Sin mejora', 'Poca', 'Moderada', 'Buena', 'Excelente'],
  'Recuperación muscular': ['Sin recuperar', 'Lenta', 'Normal', 'Rápida', 'Completa'],
  'Efecto secundario': ['Sin efecto', 'Leve', 'Moderado', 'Fuerte', 'Severo'],
  'Saciedad':          ['Hambre', 'Algo', 'Normal', 'Satisfecho', 'Sin hambre'],
  'Náusea':            ['Sin náusea', 'Leve', 'Moderada', 'Fuerte', 'Intensa'],
  'Inflamación':       ['Sin inflamación', 'Leve', 'Moderada', 'Notable', 'Severa'],
  'Niebla mental':     ['Clara', 'Leve niebla', 'Moderada', 'Bastante', 'Mucha niebla'],
  'Ansiedad':          ['Tranquilo', 'Leve', 'Moderada', 'Alta', 'Intensa'],
  'Memoria':           ['Muy difícil', 'Costosa', 'Normal', 'Buena', 'Excelente'],
  'Fuerza percibida':  ['Muy débil', 'Débil', 'Normal', 'Fuerte', 'Muy fuerte'],
}

const DEFAULT_LABELS: [string, string, string, string, string] = ['Muy bajo', 'Bajo', 'Medio', 'Alto', 'Muy alto']

function getLabels(name: string): [string, string, string, string, string] {
  return SCALE_LABELS[name] ?? DEFAULT_LABELS
}

// Mapeo de 5 botones a valores 1-100
const QUICK_VALUES = [10, 30, 50, 70, 90]

// Obtiene la última medida del historial
function lastMeasure(history: Record<string, { value: number; ts: number }[]>, name: string): { value: number; ts: number } | null {
  const arr = history[name]
  if (!arr || arr.length === 0) return null
  return arr[arr.length - 1]
}

function fmtDeltaNote(name: string, value: number, prev: number | null, down?: boolean): string | null {
  if (prev == null) return null
  const delta = value - prev
  if (delta === 0) return 'Sin cambio vs. anterior'
  const sign = delta > 0 ? '+' : ''
  const isGood = down ? delta < 0 : delta > 0
  const dir = isGood ? '↑ mejor' : '↓ peor'
  return `${sign}${delta.toFixed(delta % 1 === 0 ? 0 : 1)} vs. anterior · ${dir}`
}

export function MedidaSheet() {
  const { state, dispatch } = useApp()

  const name: string = state.sheetArg ?? FIRST_SCALE_KEY
  const isEfecto = name === 'Efecto secundario'
  const meta = MEASURE_META[name]
  const maxVal = meta?.max ?? 100
  const isScale = meta?.kind === 'scale' || (!meta && true)

  const [value, setValue] = useState<number>(Math.round(maxVal / 2))
  const [nota, setNota] = useState<string>('')
  const [touched, setTouched] = useState(false)
  const [numStr, setNumStr] = useState('')
  const [dirty, setDirty] = useState(false) // item 318: 0 es valor válido

  // item 320 + 471: modo de entrada — 'buttons' (5 niveles), 'slider' (preciso), 'num' (input numérico)
  // 'buttons' = acceso 1 toque (item 471); 'num' = teclear 73/100 (item 320); 'slider' = arrastrar
  const STORAGE_KEY = 'medida-input-mode'
  const [inputMode, setInputMode] = useState<'slider' | 'buttons' | 'num'>(() => {
    try { return (localStorage.getItem(STORAGE_KEY) as 'slider' | 'buttons' | 'num') ?? 'buttons' } catch { return 'buttons' }
  })
  // item 320: input numérico compacto para escala (valor entre 1 y maxVal)
  const [scaleNumStr, setScaleNumStr] = useState('')
  function cycleInputMode() {
    const order: Array<'buttons' | 'slider' | 'num'> = ['buttons', 'slider', 'num']
    const next = order[(order.indexOf(inputMode as 'buttons' | 'slider' | 'num') + 1) % order.length]
    setInputMode(next)
    try { localStorage.setItem(STORAGE_KEY, next) } catch {}
  }
  const modeLabel = inputMode === 'buttons' ? '≡ Slider' : inputMode === 'slider' ? '# Número' : '⊞ 5 niveles'

  // item 329: producto vinculado al efecto secundario
  const activeProducts = Object.keys(state.protocols).filter((p) => !state.protocols[p]?.archived)
  const [linkedProduct, setLinkedProduct] = useState<string | null>(null)

  // item 472: delta instantáneo al guardar
  const [savedDelta, setSavedDelta] = useState<string | null>(null)

  // item 471: botones rápidos (5 niveles)
  const labels = getLabels(name)
  const quickLabels = labels

  function onSlide(v: number) {
    setValue(v)
    setTouched(true)
    setDirty(true)
  }

  function onQuickBtn(v: number) {
    setValue(v)
    setTouched(true)
    setDirty(true)
  }

  // item 320: confirmar valor desde input numérico de escala
  function onScaleNumConfirm() {
    const v = parseInt(scaleNumStr, 10)
    if (!isNaN(v) && v >= 1 && v <= maxVal) {
      setValue(v)
      setTouched(true)
    }
  }

  // Color del track fill
  const fillPct = ((value - 1) / (maxVal - 1)) * 100
  const scaleLabel = isEfecto ? 'Severidad' : 'Nivel'
  const isDown = meta?.down

  // item 329: severity para efectos adversos
  const severity: AdverseSeverity = value <= 33 ? 'leve' : value <= 66 ? 'moderado' : 'severo'

  function handleSave() {
    // item 472: calcular delta antes de guardar
    const prev = lastMeasure(state.history as Record<string, { value: number; ts: number }[]>, name)
    const delta = fmtDeltaNote(name, value, prev?.value ?? null, isDown)

    if (isEfecto) {
      // item 329: usar logAdverseEffect con producto vinculado
      if (linkedProduct !== null) {
        dispatch({ t: 'logAdverseEffect', product: linkedProduct || undefined, severity, description: nota.trim() || `Nivel ${value}` })
      }
      dispatch({ t: 'saveMeasure', name, value, nota: nota.trim() || undefined })
    } else {
      dispatch({ t: 'saveMeasure', name, value, nota: nota.trim() || undefined })
    }

    if (delta) {
      setSavedDelta(delta)
      setTimeout(() => {
        setSavedDelta(null)
        dispatch({ t: 'sheet', sheet: null })
      }, 1800)
    } else {
      dispatch({ t: 'sheet', sheet: null })
    }
  }

  // ── Medida NUMÉRICA ──────────────────────────────────────────────────────
  if (meta?.kind === 'num') {
    const v = parseFloat(numStr)
    const isValid = dirty && !isNaN(v) && v >= 0
    const prev = lastMeasure(state.history as Record<string, { value: number; ts: number }[]>, name)

    // item 318: fix Enter + valor 0 válido
    const saveNum = () => {
      if (!isValid) return
      // item 472: delta antes de cerrar
      const prevVal = prev?.value ?? null
      const delta = fmtDeltaNote(name, v, prevVal, meta?.down)
      dispatch({ t: 'saveMeasure', name, value: v })
      if (delta) {
        setSavedDelta(delta)
        setTimeout(() => { setSavedDelta(null); dispatch({ t: 'sheet', sheet: null }) }, 1800)
      } else {
        dispatch({ t: 'sheet', sheet: null })
      }
    }

    return (
      <Sheet title={name} onClose={() => dispatch({ t: 'sheet', sheet: null })}>
        <div style={{ padding: '0 20px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* item 321 placeholder: último valor como hint */}
          {prev && (
            <p className="sm" style={{ margin: 0, color: 'var(--ink-400)' }}>
              Último: <strong>{prev.value} {meta.unit}</strong>
            </p>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input
              className="field mono" type="number" inputMode="decimal" step="any" min="0" autoFocus
              placeholder="0" value={numStr}
              onChange={(e) => { setNumStr(e.target.value); setDirty(true) }}
              // item 318: Enter guarda
              onKeyDown={(e) => { if (e.key === 'Enter') saveNum() }}
              style={{ flex: 1, fontSize: 28, fontWeight: 700, textAlign: 'center' }}
            />
            {meta.unit && <span className="body" style={{ color: 'var(--ink-400)', fontWeight: 600 }}>{meta.unit}</span>}
          </div>
          {/* item 318: 0 es válido — solo deshabilitar cuando no tocó */}
          <button className="btn btn-brand" disabled={!isValid} onClick={saveNum}
            style={{ opacity: isValid ? 1 : 0.45 }}>
            Guardar
          </button>
          {/* item 472: delta feedback */}
          <AnimatePresence>
            {savedDelta && (
              <motion.div
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                style={{ textAlign: 'center', fontWeight: 600, color: 'var(--brand-700)' }}
                className="sm"
              >
                {savedDelta}
              </motion.div>
            )}
          </AnimatePresence>
          <Disclaimer kind="general" />
        </div>
      </Sheet>
    )
  }

  const prevMeasure = lastMeasure(state.history as Record<string, { value: number; ts: number }[]>, name)

  return (
    <Sheet title={name} onClose={() => dispatch({ t: 'sheet', sheet: null })}>
      <div style={{ padding: '0 20px 32px', display: 'flex', flexDirection: 'column', gap: 28 }}>

        {/* Valor actual + etiqueta semántica (item 319) */}
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }}
          style={{ textAlign: 'center', paddingTop: 8 }}
        >
          <span className="mono"
            style={{ fontSize: 72, fontWeight: 700, lineHeight: 1, color: 'var(--brand-700)', display: 'block' }}>
            {value}
          </span>
          {touched && (
            <motion.span
              key={value}
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              className="sm"
              style={{
                display: 'inline-block', marginTop: 6, padding: '3px 12px',
                borderRadius: 99, background: 'var(--card)', border: '1px solid var(--border)',
                color: 'var(--ink-700)', fontWeight: 500,
                textTransform: 'uppercase', letterSpacing: '0.04em',
              }}
            >
              {/* item 319: etiqueta semántica según bucket */}
              {quickLabels[Math.min(4, Math.floor((value / maxVal) * 5))]}
            </motion.span>
          )}
        </motion.div>

        {/* item 320+471: ciclo de modo de entrada */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn-ghost sm" style={{ color: 'var(--brand-700)' }} onClick={cycleInputMode}>
            {modeLabel}
          </button>
        </div>

        {/* item 471: 5 botones rápidos */}
        {inputMode === 'buttons' && (
          <section>
            <p className="label" style={{ marginBottom: 12, textAlign: 'center', color: 'var(--ink-400)' }}>
              {scaleLabel} — elige
            </p>
            <div style={{ display: 'flex', gap: 6 }}>
              {QUICK_VALUES.map((v, i) => (
                <button key={v} onClick={() => onQuickBtn(v)}
                  style={{
                    flex: 1, padding: '10px 4px',
                    borderRadius: 'var(--r-sm)',
                    border: value === v && touched ? '2px solid var(--brand-700)' : '1.5px solid var(--border)',
                    background: value === v && touched ? 'color-mix(in srgb, var(--brand-700) 12%, transparent)' : 'var(--card)',
                    cursor: 'pointer', textAlign: 'center',
                    display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center',
                    transition: 'all .12s',
                  }}>
                  <span className="mono sm" style={{ fontWeight: 700, color: value === v && touched ? 'var(--brand-700)' : 'var(--ink-700)' }}>
                    {v}
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--ink-400)', lineHeight: 1.2, fontWeight: 500 }}>
                    {quickLabels[i]}
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* item 320: input numérico compacto para valor preciso (ej. 73/100) */}
        {inputMode === 'num' && (
          <section>
            <p className="label" style={{ marginBottom: 10, textAlign: 'center', color: 'var(--ink-400)' }}>
              {scaleLabel} · teclea un valor entre <span className="mono">1</span>–<span className="mono">{maxVal}</span>
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input
                className="field mono"
                type="number" inputMode="numeric" min={1} max={maxVal} step={1}
                placeholder={String(Math.round(maxVal / 2))}
                value={scaleNumStr}
                autoFocus
                onChange={(e) => {
                  setScaleNumStr(e.target.value)
                  const v = parseInt(e.target.value, 10)
                  if (!isNaN(v) && v >= 1 && v <= maxVal) { setValue(v); setTouched(true) }
                }}
                onKeyDown={(e) => { if (e.key === 'Enter') onScaleNumConfirm() }}
                style={{ flex: 1, fontSize: 28, fontWeight: 700, textAlign: 'center' }}
                aria-label={`${scaleLabel} de ${name}, 1 a ${maxVal}`}
              />
              <span className="sm" style={{ color: 'var(--ink-400)', fontWeight: 600 }}>/ {maxVal}</span>
            </div>
          </section>
        )}

        {/* Slider principal (item 320: modo alternativo de slider) */}
        {inputMode === 'slider' && (
          <section>
            <p className="label" style={{ marginBottom: 12, textAlign: 'center', color: 'var(--ink-400)' }}>
              {scaleLabel} · <span className="mono">1</span> — <span className="mono">{maxVal}</span>
            </p>
            <div style={{ position: 'relative' }}>
              <div aria-hidden="true" style={{
                position: 'absolute', top: '50%', left: 0, right: 0,
                transform: 'translateY(-50%)', height: 10, borderRadius: 5,
                background: `linear-gradient(to right, var(--brand-700) ${fillPct}%, var(--ink-100) ${fillPct}%)`,
                pointerEvents: 'none',
              }} />
              <input type="range" min={1} max={maxVal} step={1} value={value}
                onChange={(e) => onSlide(Number(e.target.value))}
                aria-label={`${scaleLabel} de ${name}, valor ${value}`}
                style={{ WebkitAppearance: 'none', appearance: 'none', width: '100%', height: 44, background: 'transparent', cursor: 'pointer', position: 'relative', zIndex: 1 }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
              <span className="sm" style={{ color: 'var(--ink-400)' }}>{isEfecto ? 'Leve' : quickLabels[0]}</span>
              <span className="sm" style={{ color: 'var(--ink-400)' }}>{isEfecto ? 'Severo' : quickLabels[4]}</span>
            </div>
          </section>
        )}

        {/* Nota — todos los KPIs pueden tener nota (item 301) */}
        <section>
          <p className="label" style={{ marginBottom: 8 }}>
            {isEfecto ? 'Describe el efecto' : 'Nota (opcional)'}
          </p>
          <textarea
            className="field"
            rows={isEfecto ? 3 : 2}
            maxLength={200}
            placeholder={isEfecto ? 'Describe el efecto secundario observado…' : 'Nota libre sobre este registro…'}
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            style={{ width: '100%', resize: 'vertical', fontFamily: 'DM Sans, sans-serif', fontSize: 15, borderRadius: 10, padding: '10px 14px', background: 'var(--card)', border: '1.5px solid var(--border)', color: 'var(--ink-900)', boxSizing: 'border-box' }}
            aria-label={isEfecto ? 'Nota sobre el efecto secundario' : 'Nota opcional'}
          />
        </section>

        {/* item 329: producto vinculado (solo efecto secundario) */}
        {isEfecto && activeProducts.length > 0 && (
          <section>
            <p className="label" style={{ marginBottom: 8 }}>Vinculado a producto <span style={{ color: 'var(--ink-400)', fontWeight: 400 }}>(opcional)</span></p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              <Chip label="Sin determinar" active={linkedProduct === null} onClick={() => setLinkedProduct(null)} />
              {activeProducts.map((p) => (
                <Chip key={p} label={p} active={linkedProduct === p} onClick={() => setLinkedProduct(p)} />
              ))}
            </div>
          </section>
        )}

        {/* item 472: delta feedback al guardar */}
        <AnimatePresence>
          {savedDelta && (
            <motion.div
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{ textAlign: 'center', fontWeight: 600, color: 'var(--brand-700)', padding: '8px 0' }}
              className="body"
            >
              {savedDelta}
            </motion.div>
          )}
        </AnimatePresence>

        {/* CTA */}
        <button className="btn btn-brand"
          onClick={handleSave}
          disabled={!touched}
          style={{ marginTop: 4, opacity: touched ? 1 : 0.45, cursor: touched ? 'pointer' : 'not-allowed' }}>
          {touched
            ? 'Guardar'
            : inputMode === 'buttons'
            ? 'Elige un nivel'
            : inputMode === 'num'
            ? 'Ingresa un valor'
            : 'Mueve para elegir tu valor'}
        </button>

        <Disclaimer kind="measure" />
      </div>
    </Sheet>
  )
}
