import { Composition, registerRoot } from 'remotion'
import { Hero } from './Hero'
import { Promo, PROMO_TOTAL } from './Promo'

/** Registro para Remotion Studio (`npm run remotion`) y para render a video (app-store preview, marketing). */
export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="Hero"
        component={Hero}
        durationInFrames={90}
        fps={30}
        width={1080}
        height={1080}
        defaultProps={{ label: 'tu progreso, en una sola pantalla' }}
      />
      <Composition
        id="Promo"
        component={Promo}
        durationInFrames={PROMO_TOTAL}
        fps={30}
        width={1080}
        height={1920}
      />
    </>
  )
}

registerRoot(RemotionRoot)
