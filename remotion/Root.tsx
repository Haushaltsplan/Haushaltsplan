import { Composition } from 'remotion'
import { MoatShort } from './MoatShort'
import { berechneMoatShortTimeline } from './moat-short-timeline'
import {
  MOAT_SHORT_DEFAULT_PROPS,
  MOAT_SHORT_FPS,
  MOAT_SHORT_HEIGHT,
  MOAT_SHORT_WIDTH,
  type MoatShortProps,
} from './moat-short-types'

export const RemotionRoot: React.FC = () => (
  <Composition
    id="MoatShort"
    component={MoatShort}
    fps={MOAT_SHORT_FPS}
    width={MOAT_SHORT_WIDTH}
    height={MOAT_SHORT_HEIGHT}
    durationInFrames={berechneMoatShortTimeline(MOAT_SHORT_DEFAULT_PROPS).durationInFrames}
    defaultProps={MOAT_SHORT_DEFAULT_PROPS}
    calculateMetadata={({ props }: { props: MoatShortProps }) => ({
      durationInFrames: berechneMoatShortTimeline(props).durationInFrames,
    })}
  />
)
