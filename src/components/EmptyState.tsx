// EmptyState — vacío con calidez: glyph en círculo con acento de categoría + copy + CTA opcional.
// Reusable y coherente (Diario, etc.). (Diseñador del equipo multiagente — Loop 08.)
import { motion } from 'framer-motion'
import { GlyphCircle } from './glyphs'
import { staggerItem } from '../lib/motion'

export function EmptyState({
  glyph, title, subtitle, color = 'var(--brand-700)', cta,
}: {
  glyph: string
  title: string
  subtitle?: string
  color?: string
  cta?: { label: string; onClick: () => void }
}) {
  return (
    <motion.div
      variants={staggerItem}
      initial="initial"
      animate="animate"
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '44px 24px', gap: 10, textAlign: 'center' }}
    >
      <GlyphCircle name={glyph} color={color} size={26} box={64} />
      <div className="body" style={{ fontWeight: 600, color: 'var(--ink-700)', marginTop: 4 }}>{title}</div>
      {subtitle && <div className="sm" style={{ color: 'var(--ink-400)', maxWidth: 260, lineHeight: 1.4 }}>{subtitle}</div>}
      {cta && (
        <button className="btn btn-outline btn-sm" style={{ width: 'auto', padding: '0 18px', marginTop: 6 }} onClick={cta.onClick}>
          {cta.label}
        </button>
      )}
    </motion.div>
  )
}
