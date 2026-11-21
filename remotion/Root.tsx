import { Composition } from 'remotion'
import { AktienAnalyse } from './longform/AktienAnalyse'
import { berechneLongTimeline } from './longform/long-timeline'
import { AKTIEN_ANALYSE_DEFAULT_PROPS, LONG_FPS, LONG_HEIGHT, LONG_WIDTH, type AktienAnalyseProps } from './longform/long-types'
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
      id="AktienAnalyse"
      component={AktienAnalyse}
      fps={LONG_FPS}
      width={LONG_WIDTH}
      height={LONG_HEIGHT}
      durationInFrames={berechneLongTimeline(AKTIEN_ANALYSE_DEFAULT_PROPS).durationInFrames}
      defaultProps={AKTIEN_ANALYSE_DEFAULT_PROPS}
      calculateMetadata={({ props }: { props: AktienAnalyseProps }) => ({
        durationInFrames: berechneLongTimeline(props).durationInFrames,
      })}
    />
  </>
)
