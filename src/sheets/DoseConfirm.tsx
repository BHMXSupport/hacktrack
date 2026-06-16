// Popup al marcar una dosis programada con desfase ≥1h respecto a la hora actual:
// pregunta si se aplicó a la hora programada o justo ahora, y registra en el diario la hora elegida.
// Loop 138: campo de nota opcional previo a la confirmación.
// Loop 139: paso de efecto/síntoma post-dosis (no bloqueante — "Omitir" cierra sin guardar efecto).
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sheet } from '../components/Sheet'
import { useApp } from '../lib/store'
import { fmtTime } from '../lib/cadence'
import { tapHaptic } from '../lib/haptics'
import { EFFECT_OPTIONS } from '../lib/catalog'
import { dur, ease } from '../lib/motion'

interface Payload {
  product: string
  value: number | null
  unit: string
  doseMg?: number
  scheduledTs: number
  nowTs: number
  suggestedSite?: import('../lib/types').InjectionSite
}

// Paso 1 ─ elige hora + nota
// Paso 2 ─ elige efecto/síntoma (o lo omite)
type Step = 'time' | 'effect'

export function DoseConfirm() {
  const { state, dispatch } = useApp()
  const close = () => dispatch({ t: 'sheet', sheet: null })

  let p: Payload | null = null
  try { p = state.sheetArg ? (JSON.parse(state.sheetArg) as Payload) : null } catch { p = null }
  if (!p) return <Sheet title="Registrar dosis" onClose={close}><div style={{ padding: '0 20px 32px' }} /></Sheet>

  const { product, value, unit, doseMg, scheduledTs, nowTs, suggestedSite } = p

  // loop 138: nota opcional
  const [note, setNote] = useState('')
  // estado de paso (time → effect)
  const [step, setStep] = useState<Step>('time')
  // ts elegido (guardado para usarlo en el paso de efecto)
  const [chosenTs, setChosenTs] = useState<number | null>(null)
  // loop 139: texto libre "Otro"
  const [showOtro, setShowOtro] = useState(false)
  const [customEffect, setCustomEffect] = useState('')

  function logWithTime(ts: number) {
    tapHaptic()
    const rawNote = note.trim().slice(0, 120) || undefined
    // keepSheet: true → el sheet permanece abierto para el paso de efecto (paso 2 cierra con close())
    dispatch({ t: 'logDose', product, value, unit, ts, doseMg, site: suggestedSite, note: rawNote, keepSheet: true })
    setChosenTs(ts)
    setStep('effect')
  }

  function commitEffect(effect: string) {
    tapHaptic()
    // buscar el item recién registrado por producto + ts más reciente
    let itemId: string | undefined
    for (const g of state.log) {
      for (const it of g.items) {
        if (it.type === 'dose' && it.product === product) {
          if (!itemId) itemId = it.id
          // comparar con el ts elegido (puede ser scheduledTs o nowTs)
          if (chosenTs != null && Math.abs(it.ts - chosenTs) < 2000) { itemId = it.id; break }
        }
      }
    }
    if (itemId) dispatch({ t: 'setLogEffect', id: itemId, effect })
    close()
  }

  function skipEffect() {
    tapHaptic()
    close()
  }

  const btn = {
    height: 60, borderRadius: 16, display: 'flex', flexDirection: 'column' as const,
    alignItems: 'center', justifyContent: 'center', gap: 2,
  }

  return (
    <Sheet title={step === 'time' ? '¿A qué hora te la aplicaste?' : '¿Cómo te sientes?'} onClose={close}>
      <AnimatePresence mode="wait" initial={false}>
        {step === 'time' ? (
          <motion.div
            key="step-time"
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 12 }}
            transition={{ duration: dur.base, ease: ease.decelerate }}
            style={{ padding: '0 20px 32px', display: 'flex', flexDirection: 'column', gap: 16 }}
          >
            <p className="body" style={{ margin: 0, color: 'var(--ink-700)' }}>
              <strong>{product}</strong>{value != null ? ` · ${value} ${unit}` : ''}. Tu hora programada no coincide con la hora actual — elige cuándo te la pusiste.
            </p>

            {/* Loop 138: campo de nota opcional */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <label className="sm" style={{ color: 'var(--ink-400)', fontWeight: 500 }} htmlFor="dc-note">
                Nota opcional
              </label>
              <input
                id="dc-note"
                type="text"
                maxLength={120}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="ej: abdomen, náusea leve, energía…"
                aria-label="Nota de la dosis (máx. 120 caracteres)"
                style={{
                  padding: '7px 10px',
                  borderRadius: 'var(--r-sm)',
                  border: '1.5px solid var(--border)',
                  background: 'var(--bg)',
                  color: 'var(--ink-900)',
                  fontSize: 13,
                  outline: 'none',
                  fontFamily: 'inherit',
                  width: '100%',
                  boxSizing: 'border-box',
                }}
              />
              {note.length > 100 && (
                <span className="sm" style={{ color: 'var(--ink-300)', textAlign: 'right' }}>
                  {note.length}/120
                </span>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button className="btn btn-brand" style={btn} onClick={() => logWithTime(scheduledTs)}>
                <span style={{ fontSize: 16, fontWeight: 700 }}>A mi hora programada</span>
                <span className="sm mono" style={{ opacity: 0.85 }}>{fmtTime(new Date(scheduledTs))}</span>
              </button>
              <button className="btn btn-outline" style={btn} onClick={() => logWithTime(nowTs)}>
                <span style={{ fontSize: 16, fontWeight: 700 }}>Ahora mismo</span>
                <span className="sm mono" style={{ color: 'var(--ink-400)' }}>{fmtTime(new Date(nowTs))}</span>
              </button>
            </div>
          </motion.div>
        ) : (
          /* Loop 139: paso de efecto/síntoma — dato observacional, sin claims de eficacia */
          <motion.div
            key="step-effect"
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: dur.base, ease: ease.decelerate }}
            style={{ padding: '0 20px 32px', display: 'flex', flexDirection: 'column', gap: 14 }}
          >
            <p className="body" style={{ margin: 0, color: 'var(--ink-700)' }}>
              Dosis registrada. ¿Cómo te sientes?
              <span className="sm" style={{ display: 'block', color: 'var(--ink-400)', marginTop: 4 }}>
                Dato personal observacional — no es una promesa de resultado.
              </span>
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {EFFECT_OPTIONS.filter((o) => o !== 'Otro').map((opt) => (
                <button
                  key={opt}
                  onClick={() => commitEffect(opt)}
                  style={{
                    height: 36, padding: '0 14px', borderRadius: 999,
                    fontSize: 13, fontWeight: 500, cursor: 'pointer',
                    border: '1.5px solid var(--border)',
                    background: 'transparent',
                    color: 'var(--ink-700)',
                    transition: 'all 0.12s ease',
                  }}
                >
                  {opt}
                </button>
              ))}
              <button
                onClick={() => { tapHaptic(); setShowOtro((v) => !v) }}
                style={{
                  height: 36, padding: '0 14px', borderRadius: 999,
                  fontSize: 13, fontWeight: 500, cursor: 'pointer',
                  border: showOtro ? '1.5px solid var(--brand-500)' : '1.5px solid var(--border)',
                  background: showOtro ? 'color-mix(in srgb, var(--brand-500) 10%, transparent)' : 'transparent',
                  color: showOtro ? 'var(--brand-700)' : 'var(--ink-700)',
                  transition: 'all 0.12s ease',
                }}
              >
                Otro
              </button>
            </div>

            {/* Campo de texto "Otro" */}
            <AnimatePresence initial={false}>
              {showOtro && (
                <motion.div
                  key="otro"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.18, ease: 'easeOut' }}
                  style={{ overflow: 'hidden' }}
                >
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      type="text"
                      maxLength={80}
                      value={customEffect}
                      onChange={(e) => setCustomEffect(e.target.value)}
                      placeholder="Describe cómo te sientes…"
                      aria-label="Efecto personalizado"
                      autoFocus
                      style={{
                        flex: 1,
                        padding: '7px 10px',
                        borderRadius: 'var(--r-sm)',
                        border: '1.5px solid var(--border)',
                        background: 'var(--bg)',
                        color: 'var(--ink-900)',
                        fontSize: 13,
                        outline: 'none',
                        fontFamily: 'inherit',
                      }}
                    />
                    <button
                      onClick={() => { if (customEffect.trim()) commitEffect(customEffect.trim()) }}
                      disabled={!customEffect.trim()}
                      style={{
                        height: 36, padding: '0 12px', borderRadius: 'var(--r-sm)',
                        fontSize: 13, fontWeight: 600, cursor: customEffect.trim() ? 'pointer' : 'not-allowed',
                        border: 'none', background: 'var(--brand-700)', color: 'var(--ink-0)',
                        opacity: customEffect.trim() ? 1 : 0.4,
                        transition: 'opacity 0.12s ease',
                        flexShrink: 0,
                      }}
                    >
                      Guardar
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <button
              onClick={skipEffect}
              className="btn btn-outline"
              style={{ height: 44, borderRadius: 12, fontWeight: 500, fontSize: 14 }}
            >
              Omitir
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </Sheet>
  )
}
