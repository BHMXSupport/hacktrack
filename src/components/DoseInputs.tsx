// Pickers inline del registro de dosis (sitio / nota / efecto) — extraídos de TodayDoses.tsx (split).
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { SITE_OPTIONS_FULL } from '../lib/store'
import type { InjectionSite } from '../lib/types'
import { tapHaptic } from '../lib/haptics'
import { EFFECT_OPTIONS } from '../lib/catalog'
import { IcCheck } from './icons'

// ── Loop 140: selector de sitio de inyección ─────────────────────────────────
// Nombres completos centralizados (store.SITE_OPTIONS_FULL): "Abdomen izquierdo", etc.
const SITE_OPTIONS = SITE_OPTIONS_FULL

interface SiteSelectorProps {
  suggested: InjectionSite
  onSelect: (site: InjectionSite) => void
  onSkip: () => void
  progress?: { index: number; total: number } // "Marcar todo" guiado: dosis X de Y
}

export function SiteSelector({ suggested, onSelect, onSkip, progress }: SiteSelectorProps) {
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      style={{ overflow: 'hidden', padding: '8px 16px 10px', borderTop: '1px solid var(--border)' }}
    >
      <div className="sm" style={{ color: 'var(--ink-400)', marginBottom: 6, fontWeight: 500, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <span>Zona de inyección</span>
        {progress && (
          <span style={{ color: 'var(--brand-700)', fontWeight: 700 }}>Dosis {progress.index} de {progress.total}</span>
        )}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
        {SITE_OPTIONS.map((opt) => {
          const isSuggested = opt.value === suggested
          return (
            <button
              key={opt.value}
              onClick={() => { tapHaptic(); onSelect(opt.value) }}
              aria-label={`${opt.label}${isSuggested ? ' (sugerida)' : ''}`}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                height: 30, padding: '0 10px', borderRadius: 999, maxWidth: '100%',
                fontSize: 12, fontWeight: isSuggested ? 700 : 500, cursor: 'pointer',
                border: isSuggested ? '1.5px solid var(--brand-500)' : '1.5px solid var(--border)',
                background: isSuggested ? 'color-mix(in srgb, var(--brand-500) 12%, transparent)' : 'transparent',
                color: isSuggested ? 'var(--brand-700)' : 'var(--ink-400)',
                transition: 'all 0.15s ease',
              }}
            >
              {opt.label}{isSuggested && <IcCheck size={13} />}
            </button>
          )
        })}
      </div>
      <button
        onClick={() => { tapHaptic(); onSkip() }}
        style={{
          height: 28, padding: '0 10px', borderRadius: 999, fontSize: 11,
          cursor: 'pointer', border: '1px solid var(--border)',
          background: 'transparent', color: 'var(--ink-300)', fontWeight: 400,
        }}
      >
        Omitir zona
      </button>
    </motion.div>
  )
}

// ── Loop 138: campo de nota opcional pegada al registro de dosis ──────────────
interface NoteFieldProps {
  value: string
  onChange: (v: string) => void
}

export function NoteField({ value, onChange }: NoteFieldProps) {
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      style={{ overflow: 'hidden', padding: '8px 16px 10px', borderTop: '1px solid var(--border)' }}
    >
      <div className="sm" style={{ color: 'var(--ink-400)', marginBottom: 5, fontWeight: 500 }}>
        Nota opcional
      </div>
      <input
        type="text"
        maxLength={120}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="ej: abdomen, náusea leve, energía…"
        aria-label="Nota de la dosis (máx. 120 caracteres)"
        style={{
          width: '100%',
          boxSizing: 'border-box',
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
      {value.length > 100 && (
        <div className="sm" style={{ color: 'var(--ink-300)', textAlign: 'right', marginTop: 3 }}>
          {value.length}/120
        </div>
      )}
    </motion.div>
  )
}

// ── Loop 139: mini-sheet inline de efecto/síntoma post-dosis ──────────────────
// Dato observacional del usuario — no implica eficacia ni consejo médico.
interface EffectPickerProps {
  onSelect: (effect: string) => void
  onSkip: () => void
}

export function EffectPicker({ onSelect, onSkip }: EffectPickerProps) {
  const [customText, setCustomText] = useState('')
  const [showOtro, setShowOtro] = useState(false)

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.24, ease: 'easeOut' }}
      style={{ overflow: 'hidden', padding: '10px 16px 12px', borderTop: '1px solid var(--border)', background: 'color-mix(in srgb, var(--brand-500) 4%, transparent)' }}
    >
      <div className="sm" style={{ color: 'var(--ink-700)', marginBottom: 7, fontWeight: 600 }}>
        ¿Cómo te sientes?
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: showOtro ? 8 : 10 }}>
        {EFFECT_OPTIONS.filter((o) => o !== 'Otro').map((opt) => (
          <button
            key={opt}
            onClick={() => { tapHaptic(); onSelect(opt) }}
            aria-label={opt}
            style={{
              height: 30, padding: '0 11px', borderRadius: 999,
              fontSize: 12, fontWeight: 500, cursor: 'pointer',
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
          aria-label="Otro efecto (texto libre)"
          style={{
            height: 30, padding: '0 11px', borderRadius: 999,
            fontSize: 12, fontWeight: 500, cursor: 'pointer',
            border: showOtro ? '1.5px solid var(--brand-500)' : '1.5px solid var(--border)',
            background: showOtro ? 'color-mix(in srgb, var(--brand-500) 10%, transparent)' : 'transparent',
            color: showOtro ? 'var(--brand-700)' : 'var(--ink-700)',
            transition: 'all 0.12s ease',
          }}
        >
          Otro
        </button>
      </div>

      {/* Campo de texto libre para "Otro" */}
      <AnimatePresence initial={false}>
        {showOtro && (
          <motion.div
            key="otro-input"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            style={{ overflow: 'hidden', marginBottom: 8 }}
          >
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                type="text"
                maxLength={80}
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                placeholder="Describe cómo te sientes…"
                aria-label="Efecto personalizado"
                autoFocus
                style={{
                  flex: 1,
                  padding: '6px 10px',
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
                onClick={() => { tapHaptic(); if (customText.trim()) onSelect(customText.trim()) }}
                disabled={!customText.trim()}
                style={{
                  height: 34, padding: '0 12px', borderRadius: 'var(--r-sm)',
                  fontSize: 12, fontWeight: 600, cursor: customText.trim() ? 'pointer' : 'not-allowed',
                  border: 'none', background: 'var(--brand-700)', color: 'var(--ink-0)',
                  opacity: customText.trim() ? 1 : 0.4,
                  transition: 'opacity 0.12s ease',
                }}
              >
                Guardar
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={() => { tapHaptic(); onSkip() }}
        style={{
          height: 28, padding: '0 10px', borderRadius: 999, fontSize: 11,
          cursor: 'pointer', border: '1px solid var(--border)',
          background: 'transparent', color: 'var(--ink-300)', fontWeight: 400,
        }}
      >
        Omitir
      </button>
    </motion.div>
  )
}

