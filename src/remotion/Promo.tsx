import {
  AbsoluteFill,
  Audio,
  Img,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
  staticFile,
} from 'remotion'

// ── Promo Hacktrack — 9:16, 30fps · marco de teléfono + pantallas reales + captions + VO es-MX ──
// Funciones mostradas: 1 protocolo/dosis · 2 adherencia/calendario · 4 calculadora · 5 Vida/PK · 6 nutrición · 7 bienestar
const TEAL = '#5FC9B8'
const TEAL_BRIGHT = '#6FE3CD'
const FG = '#E8EDF2'
const MUTED = '#9DB0C7'
const MONO = "'JetBrains Mono', ui-monospace, 'SFMono-Regular', monospace"
const SANS = "'Inter', -apple-system, 'Segoe UI', system-ui, sans-serif"

type Beat = {
  key: string
  dur: number
  screen: string | null
  vo: string
  label: string
  headline: string
  sub?: string
  logo?: boolean
  cta?: boolean
}

export const BEATS: Beat[] = [
  { key: 'hook', dur: 132, screen: 'promo/screen-inicio.png', vo: 'promo/hook.wav', label: 'HACKTRACK', headline: 'Tu protocolo,\nbajo control' },
  { key: 'f1', dur: 204, screen: 'promo/screen-registrar.png', vo: 'promo/f1.wav', label: '01 · REGISTRO', headline: 'Registra cada dosis', sub: 'diario · semanal · ciclos · por uso' },
  { key: 'f2', dur: 144, screen: 'promo/screen-calendario.png', vo: 'promo/f2.wav', label: '02 · ADHERENCIA', headline: 'Tu racha, en vivo', sub: 'calendario claro + anillo de adherencia' },
  { key: 'f4', dur: 156, screen: 'promo/screen-calc.png', vo: 'promo/f4.wav', label: '03 · CÁLCULO', headline: 'Calculadora de\nreconstitución', sub: 'agua · concentración · unidades' },
  { key: 'f5', dur: 138, screen: 'promo/screen-vida.png', vo: 'promo/f5.wav', label: '04 · FARMACOCINÉTICA', headline: 'Presencia en\ntu cuerpo', sub: 'hora a hora' },
  { key: 'f6', dur: 147, screen: 'promo/screen-comida.png', vo: 'promo/f6.wav', label: '05 · NUTRICIÓN', headline: 'Calorías, macros\ny ayuno', sub: 'electrolitos · hidratación' },
  { key: 'f7', dur: 102, screen: 'promo/screen-medida.png', vo: 'promo/f7.wav', label: '06 · BIENESTAR', headline: 'Cómo te sientes', sub: 'peso · energía · sueño · ánimo' },
  { key: 'close', dur: 102, screen: null, vo: 'promo/close.wav', label: '', headline: 'Hacktrack', sub: 'Instálala gratis', logo: true, cta: true },
]

export const PROMO_TOTAL = BEATS.reduce((a, b) => a + b.dur, 0)

const Ambient: React.FC = () => {
  const frame = useCurrentFrame()
  const drift = Math.sin(frame / 70) * 40
  const drift2 = Math.cos(frame / 90) * 50
  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', top: 120 + drift, left: -160, width: 720, height: 720, borderRadius: '50%', background: `radial-gradient(circle, ${TEAL}22, transparent 65%)`, filter: 'blur(40px)' }} />
      <div style={{ position: 'absolute', bottom: 40 + drift2, right: -200, width: 760, height: 760, borderRadius: '50%', background: `radial-gradient(circle, ${TEAL}1c, transparent 68%)`, filter: 'blur(50px)' }} />
    </AbsoluteFill>
  )
}

const Phone: React.FC<{ src: string; enter: number; float: number }> = ({ src, enter, float }) => {
  const scale = interpolate(enter, [0, 1], [0.9, 1])
  const ty = interpolate(enter, [0, 1], [60, 0]) + float
  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        top: 548,
        transform: `translateX(-50%) translateY(${ty}px) scale(${scale})`,
        width: 524,
        padding: 12,
        borderRadius: 62,
        background: 'linear-gradient(180deg,#222c39,#10151d)',
        boxShadow: `0 40px 90px rgba(0,0,0,0.55), 0 0 0 2px rgba(255,255,255,0.05), 0 0 60px ${TEAL}1f`,
      }}
    >
      <div style={{ position: 'relative', borderRadius: 50, overflow: 'hidden', background: '#0b0f16' }}>
        <Img src={staticFile(src)} style={{ width: '100%', display: 'block' }} />
        {/* dynamic island */}
        <div style={{ position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)', width: 118, height: 34, borderRadius: 20, background: '#05080c' }} />
      </div>
    </div>
  )
}

const Caption: React.FC<{ b: Beat; enter: number }> = ({ b, enter }) => {
  const ty = interpolate(enter, [0, 1], [40, 0])
  const op = interpolate(enter, [0, 1], [0, 1])
  return (
    <div style={{ position: 'absolute', top: 132, left: 0, right: 0, padding: '0 84px', textAlign: 'center', transform: `translateY(${ty}px)`, opacity: op }}>
      {b.label ? (
        <div style={{ fontFamily: MONO, fontSize: 27, letterSpacing: 6, color: TEAL, fontWeight: 600, marginBottom: 22 }}>{b.label}</div>
      ) : null}
      <div style={{ fontFamily: SANS, fontSize: 74, lineHeight: 1.04, fontWeight: 800, color: FG, whiteSpace: 'pre-line', letterSpacing: -1.5 }}>{b.headline}</div>
      {b.sub ? (
        <div style={{ fontFamily: SANS, fontSize: 31, color: MUTED, marginTop: 26, fontWeight: 500 }}>{b.sub}</div>
      ) : null}
    </div>
  )
}

const CloseCard: React.FC<{ enter: number }> = ({ enter }) => {
  const scale = interpolate(enter, [0, 1], [0.8, 1])
  const op = interpolate(enter, [0, 1], [0, 1])
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', transform: `scale(${scale})`, opacity: op }}>
        <Img src={staticFile('pwa-512.png')} style={{ width: 230, height: 230, borderRadius: 54, boxShadow: `0 30px 80px rgba(0,0,0,0.5), 0 0 70px ${TEAL}33` }} />
        <div style={{ fontFamily: SANS, fontSize: 92, fontWeight: 800, color: FG, marginTop: 54, letterSpacing: -2 }}>Hacktrack</div>
        <div style={{ fontFamily: MONO, fontSize: 34, color: TEAL_BRIGHT, marginTop: 14, letterSpacing: 1 }}>Instálala gratis</div>
        <div style={{ fontFamily: MONO, fontSize: 24, color: MUTED, marginTop: 40, letterSpacing: 3 }}>TUS DATOS SON TUYOS · PWA</div>
      </div>
    </AbsoluteFill>
  )
}

const BeatView: React.FC<{ b: Beat }> = ({ b }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const enter = spring({ frame, fps, config: { damping: 200, stiffness: 110 }, durationInFrames: 16 })
  const fade = interpolate(frame, [0, 8, b.dur - 8, b.dur], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const float = Math.sin(frame / 38) * 8
  return (
    <AbsoluteFill style={{ opacity: fade }}>
      {b.cta ? (
        <CloseCard enter={enter} />
      ) : (
        <>
          <Caption b={b} enter={enter} />
          {b.screen ? <Phone src={b.screen} enter={enter} float={float} /> : null}
        </>
      )}
    </AbsoluteFill>
  )
}

const ProgressBar: React.FC = () => {
  const frame = useCurrentFrame()
  const p = interpolate(frame, [0, PROMO_TOTAL], [0, 1], { extrapolateRight: 'clamp' })
  return (
    <div style={{ position: 'absolute', bottom: 64, left: 84, right: 84, height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.10)' }}>
      <div style={{ width: `${p * 100}%`, height: '100%', borderRadius: 3, background: `linear-gradient(90deg,${TEAL},${TEAL_BRIGHT})` }} />
    </div>
  )
}

export const Promo: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: 'linear-gradient(160deg,#1f2937 0%,#0f172a 100%)' }}>
      <Ambient />
      {BEATS.map((b, i) => {
        const start = BEATS.slice(0, i).reduce((a, x) => a + x.dur, 0)
        return (
          <Sequence key={b.key} from={start} durationInFrames={b.dur}>
            <BeatView b={b} />
            <Audio src={staticFile(b.vo)} />
          </Sequence>
        )
      })}
      <ProgressBar />
    </AbsoluteFill>
  )
}
