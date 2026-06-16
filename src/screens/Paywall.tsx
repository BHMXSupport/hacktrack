import { useState } from 'react'
import { motion } from 'framer-motion'
import { useApp } from '../lib/store'
import { IcClose, IcCheck } from '../components/icons'
import { Segmented } from '../components/controls'

type Plan = 'mensual' | 'anual'

// Tabla comparativa: [beneficio, gratis, plus]
// plus: true = doble check (Plus con exportación), false = ninguno (guión)
const ROWS: { label: string; gratis: boolean; plus: boolean }[] = [
  { label: 'Resumen semanal', gratis: true, plus: true },
  { label: 'Historial 30d → 90d+ y exportación', gratis: true, plus: true },
  { label: 'Multi-protocolo', gratis: false, plus: true },
]

const PLAN_OPTIONS: { value: Plan; label: string }[] = [
  { value: 'mensual', label: 'Mensual' },
  { value: 'anual', label: 'Anual' },
]

// Precios (fuente única) — el ahorro anual se DERIVA, no se hardcodea
const PRICE_MXN = { mensual: 99, anual: 799 } as const
const SAVE_PCT = Math.round((1 - PRICE_MXN.anual / (PRICE_MXN.mensual * 12)) * 100) // ≈ 33

export function Paywall() {
  const { dispatch } = useApp()
  const [plan, setPlan] = useState<Plan>('mensual')

  function close() {
    dispatch({ t: 'sheet', sheet: null })
  }

  const price = `$${PRICE_MXN[plan]}`
  const period = plan === 'mensual' ? '/mes' : '/año'

  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', stiffness: 320, damping: 32 }}
      style={{ position: 'absolute', inset: 0, background: 'var(--bg)', zIndex: 50, overflowY: 'auto' }}
    >
      {/* Cabecera */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 20px',
          height: 64,
          position: 'sticky',
          top: 0,
          background: 'var(--bg)',
          zIndex: 10,
        }}
      >
        <button
          className="iconbtn"
          aria-label="Cerrar"
          onClick={close}
          style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <IcClose size={22} />
        </button>
        {/* Spacer para centrar el icono de cierre visualmente */}
        <div style={{ width: 40 }} />
      </header>

      <main style={{ display: 'flex', flexDirection: 'column', gap: 32, padding: '0 20px 40px' }}>

        {/* Headline */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center' }}>
          <h1
            className="display-l"
            style={{
              textAlign: 'center',
              color: 'var(--brand-700)',
              margin: 0,
            }}
          >
            Eleva tu seguimiento con Plus
          </h1>

          {/* Ilustración de onda orgánica — SVG inline, nada médico */}
          <div
            style={{
              width: '100%',
              height: 192,
              borderRadius: 20,
              overflow: 'hidden',
              background: 'linear-gradient(135deg, #0e5a52 0%, #1b8a7d 40%, #b6f09c 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg
              viewBox="0 0 400 192"
              xmlns="http://www.w3.org/2000/svg"
              style={{ width: '100%', height: '100%' }}
              aria-hidden="true"
              focusable="false"
            >
              {/* Ondas orgánicas superpuestas — ninguna referencia médica */}
              <path
                d="M0 120 Q40 80 80 110 Q120 140 160 100 Q200 60 240 90 Q280 120 320 80 Q360 40 400 70 L400 192 L0 192 Z"
                fill="rgba(255,255,255,0.10)"
              />
              <path
                d="M0 140 Q50 100 100 130 Q150 160 200 120 Q250 80 300 110 Q350 140 400 100 L400 192 L0 192 Z"
                fill="rgba(255,255,255,0.12)"
              />
              <path
                d="M0 160 Q60 130 120 150 Q180 170 240 140 Q300 110 360 140 Q380 148 400 138 L400 192 L0 192 Z"
                fill="rgba(255,255,255,0.16)"
              />
              {/* Icono de hoja — neutral, no médico */}
              <g transform="translate(180, 56)" stroke="rgba(255,255,255,0.75)" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 36c8 1 14-4 16-16C10 20 5 25 4 36Z" />
                <path d="M4 36C7 30 11 27 16 25" />
              </g>
            </svg>
          </div>
        </section>

        {/* Toggle de plan + precio */}
        <section style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          {/* Segmented Mensual / Anual */}
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <Segmented<Plan>
              options={PLAN_OPTIONS}
              value={plan}
              onChange={setPlan}
            />
            {/* Badge "Ahorra {SAVE_PCT}%" sobre el botón Anual */}
            <span
              className="badge badge-mint"
              style={{
                position: 'absolute',
                top: -10,
                right: 0,
                fontSize: 10,
                fontWeight: 700,
                pointerEvents: 'none',
                whiteSpace: 'nowrap',
              }}
            >
              Ahorra {SAVE_PCT}%
            </span>
          </div>

          {/* Precio dinámico */}
          <div style={{ textAlign: 'center' }}>
            <span
              className="mono"
              style={{
                fontSize: 32,
                fontWeight: 700,
                color: 'var(--ink-900)',
                letterSpacing: '-0.01em',
              }}
            >
              {price}
            </span>
            <span
              className="body"
              style={{ color: 'var(--ink-400)', marginLeft: 2 }}
            >
              {period}
            </span>
          </div>
        </section>

        {/* Tabla comparativa Gratis vs Plus */}
        <section
          className="card"
          style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--border)' }}
        >
          {/* Cabecera de tabla */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '3fr 1fr 1fr',
              background: 'var(--ink-100)',
              padding: '10px 20px',
              borderBottom: '1px solid var(--border)',
            }}
          >
            <span className="sm" style={{ color: 'var(--ink-400)' }}>Beneficios</span>
            <span className="sm" style={{ color: 'var(--ink-400)', textAlign: 'center' }}>Gratis</span>
            <span className="sm" style={{ color: 'var(--brand-700)', textAlign: 'center', fontWeight: 700 }}>Plus</span>
          </div>

          {/* Filas */}
          {ROWS.map((row, i) => (
            <div
              key={row.label}
              style={{
                display: 'grid',
                gridTemplateColumns: '3fr 1fr 1fr',
                padding: '14px 20px',
                alignItems: 'center',
                borderBottom: i < ROWS.length - 1 ? '1px solid var(--border)' : 'none',
              }}
            >
              <span className="body" style={{ color: 'var(--ink-700)', lineHeight: 1.35 }}>{row.label}</span>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                {row.gratis ? (
                  <IcCheck size={18} style={{ color: 'var(--ink-400)' }} />
                ) : (
                  <span className="mono" style={{ color: 'var(--ink-300)', fontSize: 18, lineHeight: 1 }}>—</span>
                )}
              </div>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                {row.plus ? (
                  <IcCheck size={18} style={{ color: 'var(--brand-700)', strokeWidth: 2.5 }} />
                ) : (
                  <span className="mono" style={{ color: 'var(--ink-300)', fontSize: 18, lineHeight: 1 }}>—</span>
                )}
              </div>
            </div>
          ))}

          {/* Pie de tabla */}
          <div
            style={{
              background: 'rgba(14,90,82,0.05)',
              padding: '10px 20px',
            }}
          >
            <p
              className="sm"
              style={{ color: 'var(--ink-400)', textAlign: 'center', fontStyle: 'italic', margin: 0 }}
            >
              Y mucho más: exportación de datos, perspectivas premium.
            </p>
          </div>
        </section>

        {/* CTA cluster */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button
            className="btn btn-ember"
            style={{ width: '100%', height: 52, fontSize: 17, fontWeight: 600 }}
            onClick={() => {
              // placeholder de desbloqueo (hasta integrar pagos reales): activa Plus
              dispatch({ t: 'setSetting', key: 'premium', value: true })
              dispatch({ t: 'toast', msg: 'Plus activado' })
              dispatch({ t: 'sheet', sheet: null })
            }}
          >
            Probar Plus
          </button>

          <button
            className="btn btn-ghost"
            style={{ width: '100%', height: 52, fontSize: 17 }}
            onClick={close}
          >
            Quizás después
          </button>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <button
              className="sm"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--brand-700)',
                textDecoration: 'underline',
                textUnderlineOffset: 3,
                padding: '4px 0',
              }}
              onClick={() => dispatch({ t: 'toast', msg: 'Restaurar compra (próximamente)' })}
            >
              Restaurar compra
            </button>

            <p
              className="sm"
              style={{
                color: 'var(--ink-400)',
                textAlign: 'center',
                maxWidth: 280,
                margin: 0,
                lineHeight: 1.5,
              }}
            >
              La suscripción se renovará automáticamente.
            </p>
          </div>
        </section>

      </main>
    </motion.div>
  )
}
