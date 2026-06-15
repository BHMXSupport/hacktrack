import { Composition, registerRoot } from 'remotion'
import { Hero } from './Hero'

/** Registro para Remotion Studio (`npm run remotion`) y para render a video (app-store preview, marketing). */
export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="Hero"
      component={Hero}
      durationInFrames={90}
      fps={30}
      width={1080}
      height={1080}
      defaultProps={{ label: 'tu progreso, en una sola pantalla' }}
    />
  )
}

registerRoot(RemotionRoot)
