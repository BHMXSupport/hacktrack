// Agregar — chooser del "+". Dosis es el héroe (grande, gradiente kelp, arriba).
// Debajo: grilla 2 columnas con los KPIs del catálogo.
// Sin props, usa useApp(). Compliance: IcDrop (sin jeringas), sin venta in-app.
import { motion } from 'framer-motion'
import { Sheet } from '../components/Sheet'
import { IcDrop } from '../components/icons'
import { GlyphCircle } from '../components/glyphs'
import { useApp } from '../lib/store'
import { KPIS } from '../lib/catalog'

const stagger = { animate: { transition: { staggerChildren: 0.06 } } }
const item = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 } }

export function Agregar() {
  const { dispatch } = useApp()

  function handleKpi(k: (typeof KPIS)[number]) {
    if (k.kind === 'medidas') {
      dispatch({ t: 'sheet', sheet: 'medidas' })
    } else {
      dispatch({ t: 'sheet', sheet: 'medida', arg: k.key })
    }
  }

  return (
    <Sheet title="Agregar registro" onClose={() => dispatch({ t: 'sheet', sheet: null })}>
      <div style={{ padding: '4px 20px 40px', display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* ── HÉROE: Dosis ──────────────────────────────────────────────────── */}
        <motion.button
          variants={item}
          initial="initial"
          animate="animate"
          onClick={() => dispatch({ t: 'sheet', sheet: 'registrar' })}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 20,
            width: '100%',
            padding: '28px 24px',
            borderRadius: 20,
            background: 'linear-gradient(135deg, #0E5A52, #1B8A7D)',
            border: 'none',
            cursor: 'pointer',
            textAlign: 'left',
            boxShadow: '0 4px 24px rgba(14, 90, 82, 0.32)',
          }}
          whileTap={{ scale: 0.98 }}
        >
          {/* Ícono */}
          <div style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.18)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            color: '#fff',
          }}>
            <IcDrop size={28} />
          </div>

          {/* Texto */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span className="h2" style={{ color: '#fff', fontWeight: 700, lineHeight: 1.15 }}>
              Dosis
            </span>
            <span className="sm" style={{ color: 'rgba(255,255,255,0.75)', fontWeight: 400 }}>
              Registra tu dosis
            </span>
          </div>

          {/* Flecha decorativa */}
          <div style={{
            marginLeft: 'auto',
            color: 'rgba(255,255,255,0.6)',
            fontSize: 22,
            lineHeight: 1,
          }}>
            ›
          </div>
        </motion.button>

        {/* ── Subtítulo ─────────────────────────────────────────────────────── */}
        <motion.p
          variants={item}
          initial="initial"
          animate="animate"
          className="sm"
          style={{ color: 'var(--ink-400)', margin: 0, fontWeight: 500 }}
        >
          O registra cómo te sientes
        </motion.p>

        {/* ── Grilla 2 columnas de KPIs ─────────────────────────────────────── */}
        <motion.div
          variants={stagger}
          initial="initial"
          animate="animate"
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 12,
          }}
        >
          {KPIS.map((k) => (
            <motion.button
              key={k.key}
              variants={item}
              onClick={() => handleKpi(k)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                gap: 8,
                padding: '16px 16px',
                borderRadius: 16,
                border: '1.5px solid var(--border)',
                background: 'var(--card)',
                cursor: 'pointer',
                textAlign: 'left',
                /* acento sutil: sombra coloreada muy tenue */
                boxShadow: `0 0 0 0 ${k.color}00`,
                transition: 'box-shadow .15s, border-color .15s',
              }}
              whileTap={{ scale: 0.97 }}
              onMouseEnter={(e) => {
                ;(e.currentTarget as HTMLButtonElement).style.borderColor = k.color
                ;(e.currentTarget as HTMLButtonElement).style.boxShadow =
                  `0 2px 12px ${k.color}28`
              }}
              onMouseLeave={(e) => {
                ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)'
                ;(e.currentTarget as HTMLButtonElement).style.boxShadow = 'none'
              }}
            >
              {/* Glyph con círculo de acento */}
              <GlyphCircle name={k.icon} color={k.color} size={22} />
              {/* Label */}
              <span className="sm" style={{ color: 'var(--ink-700)', fontWeight: 600, lineHeight: 1.3 }}>
                {k.label}
              </span>
            </motion.button>
          ))}
        </motion.div>

      </div>
    </Sheet>
  )
}
