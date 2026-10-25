import { logoPlaySrc, musikPlaySrc } from '@/lib/youtube/moat-short-media-src'
import { EarningsShort } from '@/remotion/EarningsShort'
import { berechneEarningsShortTimeline } from '@/remotion/earnings-short-timeline'
import {
  EARNINGS_SHORT_DEFAULT_PROPS,
  EARNINGS_SHORT_FPS,
  EARNINGS_SHORT_HEIGHT,
  EARNINGS_SHORT_WIDTH,
  type EarningsShortProps,
} from '@/remotion/earnings-short-types'

export async function rendereEarningsShortImBrowser(
  props: EarningsShortProps,
  onProgress?: (fortschritt: number) => void,
): Promise<Blob> {
  const { canRenderMediaOnWeb, renderMediaOnWeb } = await import('@remotion/web-renderer')
  const check = await canRenderMediaOnWeb({
    container: 'mp4',
    width: EARNINGS_SHORT_WIDTH,
    height: EARNINGS_SHORT_HEIGHT,
  })
  if (!check.canRender) {
    const grund = check.issues
      .filter((i) => i.severity === 'error')
      .map((i) => i.message)
      .join(' ')
    throw new Error(grund || 'Dieser Browser kann kein MP4 erzeugen. Bitte Chrome oder Edge.')
  }

  const webProps: EarningsShortProps = {
    ...props,
    musicSrc: musikPlaySrc(props.musicSrc),
    logoUrl: logoPlaySrc(props.logoUrl),
  }
  const dauer = berechneEarningsShortTimeline(webProps).durationInFrames
  const { getBlob } = await renderMediaOnWeb({
    composition: {
      id: 'EarningsShort',
      component: EarningsShort,
      durationInFrames: dauer,
      fps: EARNINGS_SHORT_FPS,
      width: EARNINGS_SHORT_WIDTH,
      height: EARNINGS_SHORT_HEIGHT,
      defaultProps: EARNINGS_SHORT_DEFAULT_PROPS,
    },
    inputProps: webProps,
    container: 'mp4',
    videoCodec: 'h264',
    muted: false,
    allowHtmlInCanvas: true,
    onProgress: (p) => onProgress?.(p.progress),
  })
  return getBlob()
}
