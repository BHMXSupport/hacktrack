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

// ── Promo Hacktrack "Adiós al caos" × Hook 1 — 9:16, 30fps · ángulo wellness/longevidad, tono UGC ──
// Beats: hook (amplitud) · caos (problema) · reveal · GLP-1/dosis · nutrición · bienestar · privacidad · CTA.
const TEAL = '#5FC9B8'
const TEAL_BRIGHT = '#6FE3CD'
const FG = '#E8EDF2'
const MUTED = '#9DB0C7'
const WARN = '#E8A23A'
const ALERT = '#E85A4A'
const MONO = "'JetBrains Mono', ui-monospace, 'SFMono-Regular', monospace"
const SANS = "'Inter', -apple-system, 'Segoe UI', system-ui, sans-serif"

type Beat = {
  key: string
  dur: number
  kind: 'phone' | 'caos' | 'reveal' | 'close'
  screen?: string
  screen2?: string
  vo: string
  label?: string
  headline: string
  sub?: string
}

export const BEATS_W: Beat[] = [
  { key: 'hook', dur: 234, kind: 'phone', screen: 'promo/screen-inicio.png', vo: 'promo/d-hook.wav', label: '', headline: 'Todo en una\nsola app', sub: 'GLP-1 · calorías · macros · y +20 medidas' },
  { key: 'caos', dur: 219, kind: 'caos', vo: 'promo/d-caos.wav', headline: 'El caos de antes', sub: '5 apps y las notas del celu…' },
  { key: 'reveal', dur: 66, kind: 'reveal', screen: 'promo/screen-inicio.png', vo: 'promo/d-reveal.wav', headline: 'Hacktrack' },
  { key: 'glp', dur: 165, kind: 'phone', screen: 'promo/screen-inicio.png', screen2: 'promo/screen-calendario.png', vo: 'promo/d-glp.wav', label: 'TU GLP-1', headline: 'Tu GLP-1, ordenado', sub: 'te recuerda + lleva tu racha' },
  { key: 'nutri', dur: 138, kind: 'phone', screen: 'promo/screen-comida.png', screen2: 'promo/screen-comida2.png', vo: 'promo/d-nutri.wav', label: 'NUTRICIÓN', headline: 'Calorías, macros\ny agua', sub: 'todo junto' },
  { key: 'bien', dur: 126, kind: 'phone', screen: 'promo/screen-medida.png', vo: 'promo/d-bien.wav', label: 'BIENESTAR', headline: 'Cómo te sientes', sub: 'sueño · energía · peso' },
  { key: 'priv', dur: 120, kind: 'phone', screen: 'promo/screen-inicio.png', vo: 'promo/d-priv.wav', label: 'PRIVADO', headline: 'Tus datos\nson tuyos', sub: 'en tu teléfono · sin cuenta' },
  { key: 'cta', dur: 138, kind: 'close', vo: 'promo/d-cta.wav', headline: 'Hacktrack', sub: 'Tu salud, en una sola pantalla' },
]

export const PROMO_W_TOTAL = BEATS_W.reduce((a, b) => a + b.dur, 0)

const Ambient: React.FC = () => {
  const frame = useCurrentFrame()
  const d = Math.sin(frame / 70) * 40
  const d2 = Math.cos(frame / 90) * 50
  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', top: 120 + d, left: -160, width: 720, height: 720, borderRadius: '50%', background: `radial-gradient(circle, ${TEAL}22, transparent 65%)`, filter: 'blur(40px)' }} />
      <div style={{ position: 'absolute', bottom: 40 + d2, right: -200, width: 760, height: 760, borderRadius: '50%', background: `radial-gradient(circle, ${TEAL}1c, transparent 68%)`, filter: 'blur(50px)' }} />
    </AbsoluteFill>
  )
}

const Phone: React.FC<{ src: string; enter: number; float: number }> = ({ src, enter, float }) => {
  const scale = interpolate(enter, [0, 1], [0.9, 1])
  const ty = interpolate(enter, [0, 1], [60, 0]) + float
  return (
    <div style={{ position: 'absolute', left: '50%', top: 560, transform: `translateX(-50%) translateY(${ty}px) scale(${scale})`, width: 512, padding: 12, borderRadius: 60, background: 'linear-gradient(180deg,#222c39,#10151d)', boxShadow: `0 40px 90px rgba(0,0,0,0.55), 0 0 0 2px rgba(255,255,255,0.05), 0 0 60px ${TEAL}1f` }}>
      <div style={{ position: 'relative', borderRadius: 48, overflow: 'hidden', background: '#0b0f16' }}>
        <Img src={staticFile(src)} style={{ width: '100%', display: 'block' }} />
        <div style={{ position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)', width: 116, height: 33, borderRadius: 20, background: '#05080c' }} />
      </div>
    </div>
  )
}

const Caption: React.FC<{ b: Beat; enter: number }> = ({ b, enter }) => {
  const ty = interpolate(enter, [0, 1], [40, 0])
  const op = interpolate(enter, [0, 1], [0, 1])
  return (
    <div style={{ position: 'absolute', top: 128, left: 0, right: 0, padding: '0 80px', textAlign: 'center', transform: `translateY(${ty}px)`, opacity: op }}>
      {b.label ? <div style={{ fontFamily: MONO, fontSize: 26, letterSpacing: 6, color: TEAL, fontWeight: 600, marginBottom: 20 }}>{b.label}</div> : null}
      <div style={{ fontFamily: SANS, fontSize: 72, lineHeight: 1.04, fontWeight: 800, color: FG, whiteSpace: 'pre-line', letterSpacing: -1.5 }}>{b.headline}</div>
      {b.sub ? <div style={{ fontFamily: SANS, fontSize: 30, color: MUTED, marginTop: 24, fontWeight: 500 }}>{b.sub}</div> : null}
    </div>
  )
}

const CHIPS = [
  { t: 'Dosis', x: 120, y: 760, r: -9, c: ALERT },
  { t: 'Calorías', x: 600, y: 700, r: 7, c: WARN },
  { t: 'Notas.app', x: 360, y: 920, r: -4, c: MUTED },
  { t: 'Peso', x: 150, y: 1120, r: 6, c: WARN },
  { t: 'Macros', x: 640, y: 1080, r: -8, c: ALERT },
  { t: 'Excel', x: 420, y: 1300, r: 5, c: MUTED },
  { t: 'Ayuno', x: 180, y: 1460, r: -6, c: WARN },
  { t: 'Sueño', x: 640, y: 1420, r: 9, c: ALERT },
]
const CaosScene: React.FC<{ b: Beat; enter: number; dur: number }> = ({ b, enter, dur }) => {
  const frame = useCurrentFrame()
  const op = interpolate(enter, [0, 1], [0, 1])
  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', top: 150, left: 0, right: 0, textAlign: 'center', opacity: op }}>
        <div style={{ fontFamily: SANS, fontSize: 70, fontWeight: 800, color: FG, letterSpacing: -1.5 }}>{b.headline}</div>
        <div style={{ fontFamily: SANS, fontSize: 30, color: MUTED, marginTop: 18 }}>{b.sub}</div>
      </div>
      {CHIPS.map((c, i) => {
        const jx = Math.sin((frame + i * 20) / 16) * 10
        const jy = Math.cos((frame + i * 14) / 18) * 10
        const cop = interpolate(frame, [i * 3, i * 3 + 12], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
        return (
          <div key={c.t} style={{ position: 'absolute', left: c.x + jx, top: c.y + jy, transform: `rotate(${c.r}deg)`, opacity: cop * 0.95, padding: '16px 26px', borderRadius: 16, background: 'rgba(20,26,34,0.85)', border: `1.5px solid ${c.c}66`, fontFamily: MONO, fontSize: 30, color: c.c, fontWeight: 600, boxShadow: '0 14px 30px rgba(0,0,0,0.4)' }}>
            {c.t}
          </div>
        )
      })}
    </AbsoluteFill>
  )
}

const RevealScene: React.FC<{ b: Beat; frame: number; fps: number; dur: number }> = ({ b, frame, fps, dur }) => {
  const enter = spring({ frame, fps, config: { damping: 12, stiffness: 140, mass: 0.9 }, durationInFrames: 30 })
  const flash = interpolate(frame, [0, 8, 26], [0, 0.85, 0], { extrapolateRight: 'clamp' })
  const headOp = interpolate(frame, [6, 20], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', top: 200, left: 0, right: 0, textAlign: 'center', opacity: headOp }}>
        <div style={{ fontFamily: SANS, fontSize: 84, fontWeight: 800, color: TEAL_BRIGHT, letterSpacing: -2 }}>{b.headline}</div>
      </div>
      {b.screen ? <Phone src={b.screen} enter={enter} float={0} /> : null}
      <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 62%, ${TEAL}, transparent 55%)`, opacity: flash, mixBlendMode: 'screen' }} />
    </AbsoluteFill>
  )
}

const CloseCard: React.FC<{ enter: number }> = ({ enter }) => {
  const scale = interpolate(enter, [0, 1], [0.8, 1])
  const op = interpolate(enter, [0, 1], [0, 1])
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', transform: `scale(${scale})`, opacity: op }}>
        <Img src={staticFile('pwa-512.png')} style={{ width: 230, height: 230, borderRadius: 54, boxShadow: `0 30px 80px rgba(0,0,0,0.5), 0 0 70px ${TEAL}33` }} />
        <div style={{ fontFamily: SANS, fontSize: 92, fontWeight: 800, color: FG, marginTop: 52, letterSpacing: -2 }}>Hacktrack</div>
        <div style={{ fontFamily: SANS, fontSize: 34, color: MUTED, marginTop: 14 }}>Tu salud, en una sola pantalla</div>
        <div style={{ fontFamily: MONO, fontSize: 32, color: TEAL_BRIGHT, marginTop: 30, letterSpacing: 1 }}>Pruébala gratis</div>
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
  const src = b.screen2 && frame >= b.dur * 0.5 ? b.screen2 : b.screen
  return (
    <AbsoluteFill style={{ opacity: fade }}>
      {b.kind === 'caos' ? (
        <CaosScene b={b} enter={enter} dur={b.dur} />
      ) : b.kind === 'reveal' ? (
        <RevealScene b={b} frame={frame} fps={fps} dur={b.dur} />
      ) : b.kind === 'close' ? (
        <CloseCard enter={enter} />
      ) : (
        <>
          <Caption b={b} enter={enter} />
          {src ? <Phone src={src} enter={enter} float={float} /> : null}
        </>
      )}
    </AbsoluteFill>
  )
}

const ProgressBar: React.FC = () => {
  const frame = useCurrentFrame()
  const p = interpolate(frame, [0, PROMO_W_TOTAL], [0, 1], { extrapolateRight: 'clamp' })
  return (
    <div style={{ position: 'absolute', bottom: 64, left: 84, right: 84, height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.10)' }}>
      <div style={{ width: `${p * 100}%`, height: '100%', borderRadius: 3, background: `linear-gradient(90deg,${TEAL},${TEAL_BRIGHT})` }} />
    </div>
  )
}

export const PromoWellness: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: 'linear-gradient(160deg,#1f2937 0%,#0f172a 100%)' }}>
      <Ambient />
      {BEATS_W.map((b, i) => {
        const start = BEATS_W.slice(0, i).reduce((a, x) => a + x.dur, 0)
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
