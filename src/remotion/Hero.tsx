import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion'

/**
 * Hero "Quiet Signal" — composición Remotion embebible (Remotion Player) o renderizable a video.
 * Anima: el trazo de la señal/pulso dibujándose + el wordmark Hacktrack apareciendo.
 */
export const Hero: React.FC<{ label?: string }> = ({ label = 'tu progreso, en una sola pantalla' }) => {
  const frame = useCurrentFrame()
  const { fps, width } = useVideoConfig()

  const dash = 240
  const draw = interpolate(frame, [6, 48], [dash, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const wordIn = spring({ frame: frame - 38, fps, config: { damping: 14 } })
  const subIn = interpolate(frame, [55, 75], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const glow = interpolate(frame, [40, 60, 90], [0, 0.5, 0.25], { extrapolateRight: 'clamp' })

  return (
    <AbsoluteFill style={{ background: 'linear-gradient(160deg,#0B1220,#063B36)', alignItems: 'center', justifyContent: 'center', fontFamily: 'Bricolage Grotesque, sans-serif' }}>
      <svg width={width * 0.5} height={width * 0.5} viewBox="0 0 76 76" style={{ filter: `drop-shadow(0 0 ${glow * 40}px rgba(95,201,184,${glow}))` }}>
        <circle cx="38" cy="38" r="34" fill="none" stroke="#1B8A7D" strokeWidth="2" opacity="0.4" />
        <path d="M14 38 H28 L33 24 L41 52 L46 38 H62" fill="none" stroke="#5FC9B8" strokeWidth="3.5"
          strokeLinecap="round" strokeLinejoin="round" strokeDasharray={dash} strokeDashoffset={draw} />
      </svg>
      <div style={{ marginTop: 24, fontWeight: 800, fontSize: width * 0.085, color: '#fff', letterSpacing: -1, opacity: wordIn, transform: `translateY(${(1 - wordIn) * 16}px)` }}>
        Hack<span style={{ color: '#5FC9B8' }}>track</span>
      </div>
      <div style={{ marginTop: 12, fontFamily: 'Inter, sans-serif', fontSize: width * 0.032, color: '#9AA6BF', opacity: subIn }}>{label}</div>
    </AbsoluteFill>
  )
}
