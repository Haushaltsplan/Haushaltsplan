import { Composition } from 'remotion'
import { EarningsShort } from './EarningsShort'
import { berechneEarningsShortTimeline } from './earnings-short-timeline'
import {
  EARNINGS_SHORT_DEFAULT_PROPS,
  EARNINGS_SHORT_FPS,
  EARNINGS_SHORT_HEIGHT,
  EARNINGS_SHORT_WIDTH,
  type EarningsShortProps,
} from './earnings-short-types'
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
  <>
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
    <Composition
      id="EarningsShort"
      component={EarningsShort}
      fps={EARNINGS_SHORT_FPS}
      width={EARNINGS_SHORT_WIDTH}
      height={EARNINGS_SHORT_HEIGHT}
      durationInFrames={berechneEarningsShortTimeline(EARNINGS_SHORT_DEFAULT_PROPS).durationInFrames}
      defaultProps={EARNINGS_SHORT_DEFAULT_PROPS}
      calculateMetadata={({ props }: { props: EarningsShortProps }) => ({
        durationInFrames: berechneEarningsShortTimeline(props).durationInFrames,
      })}
    />
  </>
)
