// Baseline — pantalla conversacional de datos biométricos (peso, meta, altura).
// Onboarding step 2 de 4. Navegación: atrás → s-goal, Continuar/Saltar → s-measures.
import { useState } from 'react'
import { motion } from 'framer-motion'
import { useApp } from '../lib/store'
import { IcBack } from '../components/icons'
import { OnboardingProgress } from '../components/OnboardingProgress'
import { Disclaimer } from '../components/controls'
import { staggerParent, staggerItem } from '../lib/motion'

export function Baseline() {
  const { dispatch } = useApp()
  const [peso, setPeso] = useState('')
  const [meta, setMeta] = useState('')
  const [est, setEst] = useState('')

  function handleContinuar() {
    dispatch({
      t: 'setBaseline',
      peso: peso ? parseFloat(peso) : undefined,
      metaPesoKg: meta ? parseFloat(meta) : undefined,
      est: est ? parseFloat(est) : undefined,
    })
    dispatch({ t: 'go', screen: 's-measures' })
  }

  function handleSaltar() {
    dispatch({ t: 'go', screen: 's-measures' })
  }

  return (
    <div
      className="scroll"
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100dvh',
        boxSizing: 'border-box',
        maxWidth: 480,
        margin: '0 auto',
      }}
    >
      {/* Header fijo */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 40,
          background: 'var(--bg)',
          borderBottom: '1px solid transparent',
          padding: '12px 18px 8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
          <button
            className="iconbtn"
            aria-label="Atrás"
            onClick={() => dispatch({ t: 'go', screen: 's-goal' })}
          >
            <IcBack size={22} />
          </button>
          <div style={{ flex: 1, padding: '0 12px' }}>
            <OnboardingProgress step={2} total={4} />
          </div>
          <div style={{ width: 36 }} />
        </div>
      </header>

      {/* Contenido con stagger */}
      <motion.div
        variants={staggerParent}
        initial="initial"
        animate="animate"
        style={{ flex: 1, padding: '24px 20px 40px', display: 'flex', flexDirection: 'column', gap: 28 }}
      >
        {/* Título */}
        <motion.div variants={staggerItem}>
          <div className="h1" style={{ color: 'var(--ink-900)', marginBottom: 6 }}>
            Cuéntame un poco sobre ti
          </div>
          <div className="body" style={{ color: 'var(--ink-400)' }}>
            Solo para personalizar tu experiencia. Puedes omitir cualquier campo.
          </div>
        </motion.div>

        {/* Campo: peso actual */}
        <motion.div variants={staggerItem}>
          <label className="label" htmlFor="ht-peso">
            Peso actual (kg)
          </label>
          <input
            id="ht-peso"
            className="field"
            type="number"
            inputMode="numeric"
            placeholder="ej. 78"
            min={20}
            max={300}
            value={peso}
            onChange={(e) => setPeso(e.target.value)}
            style={{ fontSize: 22, fontWeight: 600, height: 58 }}
          />
        </motion.div>

        {/* Campo: meta de peso */}
        <motion.div variants={staggerItem}>
          <label className="label" htmlFor="ht-meta">
            Meta de peso (kg) — opcional
          </label>
          <input
            id="ht-meta"
            className="field"
            type="number"
            inputMode="numeric"
            placeholder="ej. 70"
            min={20}
            max={300}
            value={meta}
            onChange={(e) => setMeta(e.target.value)}
            style={{ fontSize: 22, fontWeight: 600, height: 58 }}
          />
        </motion.div>

        {/* Campo: altura */}
        <motion.div variants={staggerItem}>
          <label className="label" htmlFor="ht-est">
            Altura (cm) — opcional
          </label>
          <input
            id="ht-est"
            className="field"
            type="number"
            inputMode="numeric"
            placeholder="ej. 170"
            min={100}
            max={250}
            value={est}
            onChange={(e) => setEst(e.target.value)}
            style={{ fontSize: 22, fontWeight: 600, height: 58 }}
          />
        </motion.div>

        {/* CTAs */}
        <motion.div variants={staggerItem} style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 'auto' }}>
          <button className="btn btn-brand" onClick={handleContinuar}>
            Continuar
          </button>
          <button
            className="btn btn-ghost"
            onClick={handleSaltar}
            style={{ color: 'var(--ink-400)', fontSize: 15 }}
          >
            Saltar por ahora
          </button>
          <Disclaimer kind="general" />
        </motion.div>
      </motion.div>
    </div>
  )
}
