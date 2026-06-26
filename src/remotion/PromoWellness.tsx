import {
  AbsoluteFill,
  Audio,
  Img,
  OffthreadVideo,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
  staticFile,
} from 'remotion'

// ── Promo Hacktrack "Adiós al caos" × Hook 1 · v2 — wellness/longevidad, visuales premium ──
// Upgrades: fondo animado + partículas + grano + viñeta · teléfono tilt-3D + glare + slide-in ·
// captions cinéticos (palabra×palabra + pills) · chips que vuelan al teléfono · momentos hero de datos
// (anillo 0→90%, racha, kcal contando) · clip de scroll en vivo · sonido (whoosh/tap/ding + música).
const TEAL = '#5FC9B8'
const TEAL_BRIGHT = '#6FE3CD'
const FG = '#E8EDF2'
const MUTED = '#9DB0C7'
const WARN = '#E8A23A'
const ALERT = '#E85A4A'
const MONO = "'JetBrains Mono', ui-monospace, 'SFMono-Regular', monospace"
const SANS = "'Inter', -apple-system, 'Segoe UI', system-ui, sans-serif"
const W = 1080
const H = 1920

type Beat = {
  key: string
  dur: number
  kind: 'phone' | 'caos' | 'reveal' | 'hero-glp' | 'hero-nutri' | 'close'
  screen?: string
  screen2?: string
  video?: string
  vo: string
  label?: string
  headline: string
  sub?: string
  pills?: string[]
  dir?: 1 | -1
}

export const BEATS_W: Beat[] = [
  { key: 'hook', dur: 222, kind: 'phone', screen: 'promo/screen-inicio.png', vo: 'promo/d-hook.wav', headline: 'Todo en una sola app', pills: ['GLP-1', 'calorías', 'macros', 'sueño', 'peso', '+20'], dir: -1 },
  { key: 'caos', dur: 252, kind: 'caos', vo: 'promo/d-caos.wav', headline: 'El caos de antes', sub: '5 apps y las notas del celu…' },
  { key: 'reveal', dur: 72, kind: 'reveal', screen: 'promo/screen-inicio.png', vo: 'promo/d-reveal.wav', headline: 'Hacktrack' },
  { key: 'glp', dur: 204, kind: 'hero-glp', screen: 'promo/screen-calendario.png', vo: 'promo/d-glp.wav', label: 'TU GLP-1', headline: 'Tu GLP-1, ordenado', sub: 'te recuerda + lleva tu racha' },
  { key: 'nutri', dur: 150, kind: 'hero-nutri', video: 'promo/clip-comida.mp4', vo: 'promo/d-nutri.wav', label: 'NUTRICIÓN', headline: 'Calorías, macros y agua', sub: 'todo junto', dir: 1 },
  { key: 'bien', dur: 156, kind: 'phone', screen: 'promo/screen-medida.png', vo: 'promo/d-bien.wav', label: 'BIENESTAR', headline: 'Cómo te sientes', pills: ['sueño', 'energía', 'peso', 'ánimo'], dir: -1 },
  { key: 'vida', dur: 186, kind: 'phone', screen: 'promo/screen-vida.png', vo: 'promo/d-vida.wav', label: 'LA CIENCIA', headline: 'Tu cuerpo, hora a hora', sub: 'cuánto sigue activo cada compuesto', dir: 1 },
  { key: 'priv', dur: 138, kind: 'phone', screen: 'promo/screen-inicio.png', vo: 'promo/d-priv.wav', label: 'PRIVADO', headline: 'Tus datos son tuyos', sub: 'en tu teléfono · sin cuenta', dir: -1 },
  { key: 'cta', dur: 159, kind: 'close', vo: 'promo/d-cta.wav', headline: 'Hacktrack', sub: 'Tu salud, en una sola pantalla' },
]
export const PROMO_W_TOTAL = BEATS_W.reduce((a, b) => a + b.dur, 0)
const startOf = (i: number) => BEATS_W.slice(0, i).reduce((a, x) => a + x.dur, 0)

// ── Fondo: gradiente animado + partículas mint + grano + viñeta ──
const PARTICLES = Array.from({ length: 26 }, (_, i) => ({
  x: (i * 97) % 100,
  size: 2 + (i % 4),
  speed: 7 + (i % 6),
  phase: ((i * 37) % 100) / 100,
  drift: (((i * 53) % 5) - 2) * 10,
  op: 0.12 + ((i * 29) % 10) / 40,
}))
const GRAIN =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>"
  )
const Background: React.FC = () => {
  const frame = useCurrentFrame()
  const d = Math.sin(frame / 70) * 40
  const d2 = Math.cos(frame / 90) * 50
  return (
    <AbsoluteFill style={{ background: 'linear-gradient(160deg,#1f2937 0%,#0f172a 100%)' }}>
      <div style={{ position: 'absolute', top: 120 + d, left: -160, width: 720, height: 720, borderRadius: '50%', background: `radial-gradient(circle, ${TEAL}22, transparent 65%)`, filter: 'blur(40px)' }} />
      <div style={{ position: 'absolute', bottom: 40 + d2, right: -200, width: 760, height: 760, borderRadius: '50%', background: `radial-gradient(circle, ${TEAL}1c, transparent 68%)`, filter: 'blur(50px)' }} />
      {PARTICLES.map((p, i) => {
        const prog = ((frame / (p.speed * 30) + p.phase) % 1 + 1) % 1
        const y = H + 40 - prog * (H + 80)
        const x = (p.x / 100) * W + Math.sin(frame / 50 + i) * p.drift
        const op = p.op * (0.5 + 0.5 * Math.sin(frame / 24 + i))
        return <div key={i} style={{ position: 'absolute', left: x, top: y, width: p.size, height: p.size, borderRadius: '50%', background: TEAL_BRIGHT, opacity: op, filter: 'blur(0.5px)' }} />
      })}
      <AbsoluteFill style={{ background: 'radial-gradient(circle at 50% 42%, transparent 45%, rgba(0,0,0,0.45) 100%)' }} />
      <AbsoluteFill style={{ backgroundImage: `url("${GRAIN}")`, backgroundSize: '420px 420px', opacity: 0.05, mixBlendMode: 'overlay' }} />
    </AbsoluteFill>
  )
}

// ── Teléfono: tilt-3D + glare + slide-in lateral ──
const Phone: React.FC<{ enter: number; float: number; dir?: number; children: React.ReactNode; top?: number; width?: number }> = ({ enter, float, dir = 0, children, top = 452, width = 624 }) => {
  const frame = useCurrentFrame()
  const tx = interpolate(enter, [0, 1], [dir * 150, 0])
  const ty = interpolate(enter, [0, 1], [40, 0]) + float
  const op = interpolate(enter, [0, 0.5], [0, 1], { extrapolateRight: 'clamp' })
  const rotY = Math.sin(frame / 90) * 4
  const rotX = Math.cos(frame / 110) * 2.2
  const glareX = ((frame % 150) / 150) * 200 - 50
  return (
    <div style={{ position: 'absolute', left: '50%', top, transform: `translateX(-50%) translateX(${tx}px) translateY(${ty}px)`, opacity: op, perspective: 1700 }}>
      <div style={{ width, padding: 12, borderRadius: 60, background: 'linear-gradient(180deg,#232d3a,#0f141c)', boxShadow: `0 50px 110px rgba(0,0,0,0.6), 0 0 0 2px rgba(255,255,255,0.05), 0 0 70px ${TEAL}22`, transform: `rotateY(${rotY}deg) rotateX(${rotX}deg)`, transformStyle: 'preserve-3d' }}>
        <div style={{ position: 'relative', borderRadius: 48, overflow: 'hidden', background: '#0b0f16' }}>
          {children}
          <div style={{ position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)', width: 114, height: 33, borderRadius: 20, background: '#05080c', zIndex: 3 }} />
          {/* glare sweep */}
          <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${glareX}%`, width: '40%', background: 'linear-gradient(105deg, transparent, rgba(255,255,255,0.14), transparent)', transform: 'skewX(-18deg)', pointerEvents: 'none', zIndex: 2 }} />
        </div>
      </div>
    </div>
  )
}
const Screen: React.FC<{ src: string }> = ({ src }) => <Img src={staticFile(src)} style={{ width: '100%', display: 'block' }} />

// ── Caption cinético: headline palabra×palabra + pills de keywords ──
const KineticCaption: React.FC<{ b: Beat }> = ({ b }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const words = b.headline.split(' ')
  return (
    <div style={{ position: 'absolute', top: 124, left: 0, right: 0, padding: '0 76px', textAlign: 'center' }}>
      {b.label ? (
        <div style={{ fontFamily: MONO, fontSize: 25, letterSpacing: 6, color: TEAL, fontWeight: 600, marginBottom: 18, opacity: interpolate(frame, [0, 10], [0, 1], { extrapolateRight: 'clamp' }) }}>{b.label}</div>
      ) : null}
      <div style={{ fontFamily: SANS, fontSize: 70, lineHeight: 1.06, fontWeight: 800, color: FG, letterSpacing: -1.5, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0 18px' }}>
        {words.map((w, i) => {
          const s = spring({ frame: frame - 3 - i * 3, fps, config: { damping: 200, stiffness: 120 }, durationInFrames: 14 })
          return (
            <span key={i} style={{ display: 'inline-block', transform: `translateY(${interpolate(s, [0, 1], [26, 0])}px)`, opacity: s }}>{w}</span>
          )
        })}
      </div>
      {b.pills ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 12, marginTop: 30 }}>
          {b.pills.map((p, i) => {
            const s = spring({ frame: frame - 12 - i * 4, fps, config: { damping: 14, stiffness: 160 }, durationInFrames: 18 })
            return (
              <span key={p} style={{ transform: `scale(${interpolate(s, [0, 1], [0.5, 1])})`, opacity: interpolate(s, [0, 0.6], [0, 1], { extrapolateRight: 'clamp' }), fontFamily: MONO, fontSize: 27, fontWeight: 600, color: TEAL_BRIGHT, background: `${TEAL}1c`, border: `1.5px solid ${TEAL}55`, borderRadius: 999, padding: '8px 20px' }}>{p}</span>
            )
          })}
        </div>
      ) : b.sub ? (
        <div style={{ fontFamily: SANS, fontSize: 30, color: MUTED, marginTop: 26, fontWeight: 500, opacity: interpolate(frame, [10, 22], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) }}>{b.sub}</div>
      ) : null}
    </div>
  )
}

// ── Caos: chips que tiemblan ──
const CHIPS = [
  { t: 'Dosis', x: 150, y: 780, r: -9, c: ALERT },
  { t: 'Calorías', x: 620, y: 720, r: 7, c: WARN },
  { t: 'Notas.app', x: 380, y: 940, r: -4, c: MUTED },
  { t: 'Peso', x: 180, y: 1140, r: 6, c: WARN },
  { t: 'Macros', x: 650, y: 1100, r: -8, c: ALERT },
  { t: 'Excel', x: 430, y: 1320, r: 5, c: MUTED },
  { t: 'Ayuno', x: 200, y: 1480, r: -6, c: WARN },
  { t: 'Sueño', x: 650, y: 1440, r: 9, c: ALERT },
]
const Chip: React.FC<{ c: typeof CHIPS[number]; x: number; y: number; rot: number; op: number; scale?: number }> = ({ c, x, y, rot, op, scale = 1 }) => (
  <div style={{ position: 'absolute', left: x, top: y, transform: `rotate(${rot}deg) scale(${scale})`, opacity: op, padding: '15px 26px', borderRadius: 16, background: 'rgba(20,26,34,0.9)', border: `1.5px solid ${c.c}66`, fontFamily: MONO, fontSize: 30, color: c.c, fontWeight: 600, boxShadow: '0 14px 30px rgba(0,0,0,0.45)' }}>{c.t}</div>
)
const CaosScene: React.FC<{ b: Beat }> = ({ b }) => {
  const frame = useCurrentFrame()
  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', top: 150, left: 0, right: 0, textAlign: 'center' }}>
        <div style={{ fontFamily: SANS, fontSize: 70, fontWeight: 800, color: FG, letterSpacing: -1.5, opacity: interpolate(frame, [0, 12], [0, 1], { extrapolateRight: 'clamp' }) }}>{b.headline}</div>
        <div style={{ fontFamily: SANS, fontSize: 30, color: MUTED, marginTop: 18, opacity: interpolate(frame, [6, 18], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) }}>{b.sub}</div>
      </div>
      {CHIPS.map((c, i) => {
        const jx = Math.sin((frame + i * 20) / 14) * 12
        const jy = Math.cos((frame + i * 14) / 16) * 12
        const cop = interpolate(frame, [i * 3, i * 3 + 12], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
        return <Chip key={c.t} c={c} x={c.x + jx} y={c.y + jy} rot={c.r + Math.sin(frame / 20 + i) * 3} op={cop * 0.96} />
      })}
    </AbsoluteFill>
  )
}

// ── Reveal: los chips VUELAN al teléfono + flash + la app entra ──
const RevealScene: React.FC<{ b: Beat }> = ({ b }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const enter = spring({ frame: frame - 6, fps, config: { damping: 13, stiffness: 150, mass: 0.9 }, durationInFrames: 28 })
  const flash = interpolate(frame, [4, 12, 30], [0, 0.9, 0], { extrapolateRight: 'clamp' })
  const headOp = interpolate(frame, [10, 24], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const cx = W / 2, cy = 1090
  return (
    <AbsoluteFill>
      {/* chips convergiendo al centro del teléfono */}
      {CHIPS.map((c, i) => {
        const t = interpolate(frame, [0, 16], [0, 1], { extrapolateRight: 'clamp' })
        const x = interpolate(t, [0, 1], [c.x, cx - 40])
        const y = interpolate(t, [0, 1], [c.y, cy])
        const op = interpolate(frame, [0, 14, 18], [0.9, 0.5, 0], { extrapolateRight: 'clamp' })
        const sc = interpolate(t, [0, 1], [1, 0.3])
        return <Chip key={c.t} c={c} x={x} y={y} rot={c.r} op={op} scale={sc} />
      })}
      <div style={{ position: 'absolute', top: 210, left: 0, right: 0, textAlign: 'center', opacity: headOp }}>
        <div style={{ fontFamily: SANS, fontSize: 86, fontWeight: 800, color: TEAL_BRIGHT, letterSpacing: -2 }}>{b.headline}</div>
      </div>
      {b.screen ? <Phone enter={enter} float={0}><Screen src={b.screen} /></Phone> : null}
      <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 60%, ${TEAL}, transparent 52%)`, opacity: flash, mixBlendMode: 'screen' }} />
    </AbsoluteFill>
  )
}

// ── Anillo hero (count-up) ──
const HeroRing: React.FC<{ pct: number; enter: number; size?: number }> = ({ pct, enter, size = 300 }) => {
  const r = (size - 26) / 2
  const circ = 2 * Math.PI * r
  const v = interpolate(enter, [0, 1], [0, pct])
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', overflow: 'visible' }}>
        <defs>
          <linearGradient id="hr" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2={size} y2={size}>
            <stop offset="0%" stopColor="#3A8F83" />
            <stop offset="55%" stopColor={TEAL} />
            <stop offset="100%" stopColor={TEAL_BRIGHT} />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,.07)" strokeWidth={20} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke="url(#hr)" strokeWidth={20} fill="none" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ * (1 - v / 100)} style={{ filter: `drop-shadow(0 0 10px ${TEAL}99)` }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontFamily: MONO, fontSize: size * 0.26, fontWeight: 300, color: TEAL_BRIGHT, lineHeight: 1 }}>{Math.round(v)}%</span>
        <span style={{ fontFamily: MONO, fontSize: 18, letterSpacing: 4, color: MUTED, marginTop: 6 }}>ADHERENCIA</span>
      </div>
    </div>
  )
}
const HeroGlp: React.FC<{ b: Beat; enter: number }> = ({ b, enter }) => {
  const frame = useCurrentFrame()
  const streak = Math.round(interpolate(enter, [0, 1], [0, 26]))
  const float = Math.sin(frame / 38) * 8
  return (
    <AbsoluteFill>
      <KineticCaption b={b} />
      <div style={{ position: 'absolute', top: 372, left: 0, right: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 44 }}>
        <HeroRing pct={90} enter={enter} size={216} />
        <div style={{ textAlign: 'left', transform: `translateY(${float}px)`, opacity: interpolate(enter, [0.3, 1], [0, 1], { extrapolateLeft: 'clamp' }) }}>
          <div style={{ fontFamily: SANS, fontSize: 96, fontWeight: 800, color: FG, lineHeight: 1 }}>🔥{streak}</div>
          <div style={{ fontFamily: SANS, fontSize: 34, fontWeight: 600, color: MUTED, marginTop: 6 }}>días de racha</div>
        </div>
      </div>
      <Phone enter={enter} float={float} dir={b.dir} top={648} width={548}><Screen src={b.screen!} /></Phone>
    </AbsoluteFill>
  )
}

// ── Nutri: clip en vivo (scroll) + kcal contando ──
const HeroNutri: React.FC<{ b: Beat; enter: number }> = ({ b, enter }) => {
  const frame = useCurrentFrame()
  const kcal = Math.round(interpolate(enter, [0, 1], [0, 1440]))
  const float = Math.sin(frame / 38) * 8
  const macros = [{ l: 'Proteína', v: 106, c: TEAL }, { l: 'Carbs', v: 121, c: TEAL_BRIGHT }, { l: 'Grasa', v: 49, c: WARN }]
  return (
    <AbsoluteFill>
      <KineticCaption b={b} />
      <div style={{ position: 'absolute', top: 388, left: 0, right: 0, textAlign: 'center' }}>
        <span style={{ fontFamily: MONO, fontSize: 100, fontWeight: 700, color: TEAL_BRIGHT }}>{kcal.toLocaleString('es-MX')}</span>
        <span style={{ fontFamily: MONO, fontSize: 36, color: MUTED, marginLeft: 10 }}>kcal</span>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 20, marginTop: 22 }}>
          {macros.map((m, i) => {
            const w = interpolate(enter, [0.2, 1], [0, 1], { extrapolateLeft: 'clamp' })
            return (
              <div key={m.l} style={{ width: 200 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: MONO, fontSize: 21, color: MUTED, marginBottom: 6 }}><span>{m.l}</span><span style={{ color: FG }}>{Math.round(m.v * w)}g</span></div>
                <div style={{ height: 11, borderRadius: 6, background: 'rgba(255,255,255,0.08)' }}><div style={{ width: `${w * (50 + i * 18)}%`, height: '100%', borderRadius: 6, background: m.c }} /></div>
              </div>
            )
          })}
        </div>
      </div>
      <Phone enter={enter} float={float} dir={b.dir} top={648} width={548}>
        <OffthreadVideo src={staticFile(b.video!)} trimBefore={2} muted style={{ width: '100%', display: 'block' }} />
      </Phone>
    </AbsoluteFill>
  )
}

const CloseCard: React.FC = () => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const enter = spring({ frame, fps, config: { damping: 14, stiffness: 120 }, durationInFrames: 26 })
  const pulse = 1 + Math.sin(frame / 18) * 0.02
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', transform: `scale(${interpolate(enter, [0, 1], [0.8, 1])})`, opacity: enter }}>
        <Img src={staticFile('pwa-512.png')} style={{ width: 240, height: 240, borderRadius: 56, transform: `scale(${pulse})`, boxShadow: `0 30px 80px rgba(0,0,0,0.5), 0 0 ${60 + Math.sin(frame / 18) * 20}px ${TEAL}44` }} />
        <div style={{ fontFamily: SANS, fontSize: 94, fontWeight: 800, color: FG, marginTop: 52, letterSpacing: -2 }}>Hacktrack</div>
        <div style={{ fontFamily: SANS, fontSize: 34, color: MUTED, marginTop: 14 }}>Tu salud, en una sola pantalla</div>
        <div style={{ display: 'inline-block', marginTop: 34, fontFamily: MONO, fontSize: 34, color: '#0f172a', fontWeight: 700, background: `linear-gradient(90deg,${TEAL},${TEAL_BRIGHT})`, borderRadius: 999, padding: '16px 44px', boxShadow: `0 0 40px ${TEAL}55` }}>Pruébala gratis</div>
      </div>
    </AbsoluteFill>
  )
}

const BeatView: React.FC<{ b: Beat }> = ({ b }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const enter = spring({ frame, fps, config: { damping: 200, stiffness: 110 }, durationInFrames: 18 })
  const fade = interpolate(frame, [0, 7, b.dur - 7, b.dur], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const float = Math.sin(frame / 38) * 8
  const src = b.screen2 && frame >= b.dur * 0.5 ? b.screen2 : b.screen
  return (
    <AbsoluteFill style={{ opacity: fade }}>
      {b.kind === 'caos' ? <CaosScene b={b} />
        : b.kind === 'reveal' ? <RevealScene b={b} />
        : b.kind === 'hero-glp' ? <HeroGlp b={b} enter={enter} />
        : b.kind === 'hero-nutri' ? <HeroNutri b={b} enter={enter} />
        : b.kind === 'close' ? <CloseCard />
        : (
          <>
            <KineticCaption b={b} />
            {src ? <Phone enter={enter} float={float} dir={b.dir}><Screen src={src} /></Phone> : null}
          </>
        )}
    </AbsoluteFill>
  )
}

const ProgressBar: React.FC = () => {
  const frame = useCurrentFrame()
  const p = interpolate(frame, [0, PROMO_W_TOTAL], [0, 1], { extrapolateRight: 'clamp' })
  return (
    <div style={{ position: 'absolute', bottom: 60, left: 84, right: 84, height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.10)' }}>
      <div style={{ width: `${p * 100}%`, height: '100%', borderRadius: 3, background: `linear-gradient(90deg,${TEAL},${TEAL_BRIGHT})` }} />
    </div>
  )
}

export const PromoWellness: React.FC = () => {
  return (
    <AbsoluteFill>
      <Background />
      {/* música de fondo (colchón ambiental, bajo en la mezcla) */}
      <Audio src={staticFile('promo/music.wav')} volume={0.4} />
      {BEATS_W.map((b, i) => {
        const start = startOf(i)
        return (
          <Sequence key={b.key} from={start} durationInFrames={b.dur}>
            <BeatView b={b} />
            <Audio src={staticFile(b.vo)} />
            {/* whoosh en cada transición de beat */}
            <Audio src={staticFile('promo/whoosh.wav')} volume={0.6} />
          </Sequence>
        )
      })}
      {/* ding en el reveal */}
      <Sequence from={startOf(2) + 4} durationInFrames={30}><Audio src={staticFile('promo/ding.wav')} volume={0.75} /></Sequence>
      <ProgressBar />
    </AbsoluteFill>
  )
}
