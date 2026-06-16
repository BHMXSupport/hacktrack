// Welcome — pantalla de celebración post-onboarding. Sin claims.
// Navegación: "Ver mi plan" → dispatch finishOnboarding (→ s-app).
import { motion } from 'framer-motion'
import { useApp } from '../lib/store'
import { CATEGORY_COLOR, CATEGORY_ICON } from '../lib/catalog'
import { GlyphCircle } from '../components/glyphs'
import { spring, staggerParent, staggerItem, dur } from '../lib/motion'

export function Welcome() {
  const { state, dispatch } = useApp()
  const name = state.profile.name ?? 'Listo'
  const goal = state.curGoal
  const color = goal ? (CATEGORY_COLOR[goal] ?? 'var(--brand-500)') : 'var(--brand-500)'
  const icon = goal ? (CATEGORY_ICON[goal] ?? 'cat-explorar') : 'cat-explorar'
  const nMedidas = state.selectedMeasures.length
  const nProductos = Object.keys(state.protocols).length

  const items = [
    {
      icon,
      color,
      label: 'Objetivo',
      value: goal ?? 'Explorar',
    },
    {
      icon: 'medidas',
      color: '#1B8A7D',
      label: 'Métricas',
      value: nMedidas > 0 ? `${nMedidas} seleccionada${nMedidas !== 1 ? 's' : ''}` : 'Puedes agregar después',
    },
    {
      icon: 'dose',
      color: '#6B7BE8',
      label: 'Productos',
      value: nProductos > 0 ? `${nProductos} en seguimiento` : 'Agrega desde Protocolo',
    },
  ]

  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(160deg, var(--bg) 0%, color-mix(in srgb, var(--brand-700) 6%, var(--bg)) 100%)',
        padding: '40px 24px',
        boxSizing: 'border-box',
        maxWidth: 480,
        margin: '0 auto',
      }}
    >
      <motion.div
        variants={staggerParent}
        initial="initial"
        animate="animate"
        style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28 }}
      >
        {/* Estrella de celebración */}
        <motion.div
          variants={staggerItem}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={spring.celebrate}
        >
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: '50%',
              background: `color-mix(in srgb, ${color} 15%, var(--bg))`,
              border: `2px solid color-mix(in srgb, ${color} 30%, transparent)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <GlyphCircle name={icon} color={color} size={32} box={56} />
          </div>
        </motion.div>

        {/* Nombre + tagline */}
        <motion.div variants={staggerItem} style={{ textAlign: 'center' }}>
          <div
            className="display-l"
            style={{ color: 'var(--ink-900)', marginBottom: 8, lineHeight: 1.1 }}
          >
            {name}
          </div>
          <div className="h2" style={{ color, fontWeight: 700, marginBottom: 8 }}>
            Tu protocolo está listo
          </div>
          <div className="body" style={{ color: 'var(--ink-400)', maxWidth: 300, margin: '0 auto' }}>
            Empieza a registrar y observa tu progreso a lo largo del tiempo.
          </div>
        </motion.div>

        {/* Resumen de configuración */}
        <motion.div variants={staggerItem} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {items.map((item) => (
            <div
              key={item.label}
              className="card"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                padding: '14px 16px',
                borderRadius: 16,
                background: 'var(--card)',
                border: '1px solid var(--border)',
              }}
            >
              <GlyphCircle name={item.icon} color={item.color} size={18} box={38} />
              <div style={{ flex: 1 }}>
                <div className="sm" style={{ color: 'var(--ink-400)', marginBottom: 1 }}>
                  {item.label}
                </div>
                <div className="body" style={{ fontWeight: 600, color: 'var(--ink-900)' }}>
                  {item.value}
                </div>
              </div>
            </div>
          ))}
        </motion.div>

        {/* CTA */}
        <motion.div variants={staggerItem} style={{ width: '100%' }}>
          <motion.button
            className="btn btn-brand"
            whileTap={{ scale: 0.97 }}
            transition={spring.ui}
            onClick={() => dispatch({ t: 'finishOnboarding' })}
            style={{ height: 52, borderRadius: 16, fontSize: 16 }}
          >
            Ver mi plan
          </motion.button>
        </motion.div>
      </motion.div>
    </div>
  )
}
