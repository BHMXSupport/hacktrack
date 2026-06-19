// Assets de heroes animados por sección (Higgsfield). Cada uno: poster ligero (.webp ~40KB,
// base instantánea + fallback Save-Data) + video loop (.mp4, gateado por conexión/reduced-motion).
import diarioPoster from '../../assets/rebuild/diario-poster.webp'
import diarioVideo from '../../assets/rebuild/diario-hero.mp4'
import progresoPoster from '../../assets/rebuild/progreso-poster.webp'
import progresoVideo from '../../assets/rebuild/progreso-hero.mp4'
import vidaPoster from '../../assets/rebuild/vida-poster.webp'
import vidaVideo from '../../assets/rebuild/vida-hero.mp4'
import comidaPoster from '../../assets/rebuild/comida-poster.webp'
import comidaVideo from '../../assets/rebuild/comida-hero.mp4'
import semanaPoster from '../../assets/rebuild/semana-poster.webp'
import semanaVideo from '../../assets/rebuild/semana-hero.mp4'

export type HeroAsset = { poster: string; video: string }

export const HEROES: Record<'diario' | 'progreso' | 'vida' | 'comida' | 'semana', HeroAsset> = {
  diario: { poster: diarioPoster, video: diarioVideo },
  progreso: { poster: progresoPoster, video: progresoVideo },
  vida: { poster: vidaPoster, video: vidaVideo },
  comida: { poster: comidaPoster, video: comidaVideo },
  semana: { poster: semanaPoster, video: semanaVideo },
}
