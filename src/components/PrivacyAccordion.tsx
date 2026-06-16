// PrivacyAccordion — acordeón colapsable de privacidad con toggle de analíticas.
// Abre/cierra con animación height+opacity. Cumplimiento LFPDPPP.
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Toggle } from './controls'

export function PrivacyAccordion() {
  const [open, setOpen] = useState(false)
  const [analytics, setAnalytics] = useState(true)

  return (
    <div
      style={{
        border: '1px solid var(--border)',
        borderRadius: 14,
        overflow: 'hidden',
        background: 'var(--card)',
      }}
    >
      {/* Cabecera — siempre visible */}
      <button
        aria-expanded={open}
        aria-controls="privacy-body"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '14px 16px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        {/* Ícono candado */}
        <svg
          width={18}
          height={18}
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--brand-700)"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          style={{ flexShrink: 0 }}
        >
          <rect x="3" y="11" width="18" height="11" rx="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          <circle cx="12" cy="16" r="1" fill="var(--brand-700)" stroke="none" />
        </svg>

        <span className="body" style={{ flex: 1, fontWeight: 600, color: 'var(--ink-900)' }}>
          Datos que guardamos
        </span>

        {/* Chevron animado */}
        <motion.svg
          width={18}
          height={18}
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--ink-400)"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </motion.svg>
      </button>

      {/* Cuerpo desplegable */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id="privacy-body"
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.24, ease: [0.2, 0, 0, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ padding: '4px 16px 16px' }}>
              {/* Bullets de datos guardados */}
              <ul
                style={{
                  listStyle: 'none',
                  margin: 0,
                  padding: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  marginBottom: 16,
                }}
              >
                {[
                  'Tus registros viven en tu dispositivo',
                  'Tu nombre para personalizar',
                ].map((text) => (
                  <li
                    key={text}
                    className="sm"
                    style={{ display: 'flex', alignItems: 'flex-start', gap: 8, color: 'var(--ink-700)' }}
                  >
                    <svg
                      width={14}
                      height={14}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="var(--brand-500)"
                      strokeWidth={2.5}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                      style={{ flexShrink: 0, marginTop: 2 }}
                    >
                      <circle cx="12" cy="12" r="9" />
                      <path d="m9 12 2 2 4-4" />
                    </svg>
                    {text}
                  </li>
                ))}

                {/* Bullet de analíticas con toggle inline */}
                <li
                  className="sm"
                  style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--ink-700)' }}
                >
                  <svg
                    width={14}
                    height={14}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="var(--brand-500)"
                    strokeWidth={2.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                    style={{ flexShrink: 0 }}
                  >
                    <circle cx="12" cy="12" r="9" />
                    <path d="m9 12 2 2 4-4" />
                  </svg>
                  <span style={{ flex: 1 }}>Estadísticas anónimas</span>
                  <Toggle
                    on={analytics}
                    onChange={setAnalytics}
                    label={analytics ? 'Desactivar analíticas anónimas' : 'Activar analíticas anónimas'}
                  />
                </li>
              </ul>

              {/* Párrafo LFPDPPP */}
              <p
                className="disclaimer"
                style={{ margin: 0 }}
              >
                Tus datos personales son tratados conforme a la Ley Federal de Protección de Datos
                Personales en Posesión de los Particulares (LFPDPPP). Hacktrack no comparte ni vende
                tu información a terceros.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
