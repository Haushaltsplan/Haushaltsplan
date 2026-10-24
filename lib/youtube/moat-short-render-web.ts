import { logoPlaySrc, musikPlaySrc } from '@/lib/youtube/moat-short-media-src'
import { MoatShort } from '@/remotion/MoatShort'
import { berechneMoatShortTimeline } from '@/remotion/moat-short-timeline'
import {
  MOAT_SHORT_DEFAULT_PROPS,
  MOAT_SHORT_FPS,
  MOAT_SHORT_HEIGHT,
  MOAT_SHORT_WIDTH,
  type MoatShortProps,
} from '@/remotion/moat-short-types'

export { logoPlaySrc, musikPlaySrc } from '@/lib/youtube/moat-short-media-src'

export async function rendereMoatShortImBrowser(
  props: MoatShortProps,
  onProgress?: (fortschritt: number) => void,
): Promise<Blob> {
  const { canRenderMediaOnWeb, renderMediaOnWeb } = await import('@remotion/web-renderer')
  const check = await canRenderMediaOnWeb({
    container: 'mp4',
    width: MOAT_SHORT_WIDTH,
    height: MOAT_SHORT_HEIGHT,
  })
  if (!check.canRender) {
    const grund = check.issues
      .filter((i) => i.severity === 'error')
      .map((i) => i.message)
      .join(' ')
    throw new Error(grund || 'Dieser Browser kann kein MP4 erzeugen. Bitte Chrome oder Edge.')
  }

  const webProps: MoatShortProps = {
    ...props,
    musicSrc: musikPlaySrc(props.musicSrc),
    logoUrl: logoPlaySrc(props.logoUrl),
  }
  const dauer = berechneMoatShortTimeline(webProps).durationInFrames
  const { getBlob } = await renderMediaOnWeb({
    composition: {
      id: 'MoatShort',
      component: MoatShort,
      durationInFrames: dauer,
      fps: MOAT_SHORT_FPS,
      width: MOAT_SHORT_WIDTH,
      height: MOAT_SHORT_HEIGHT,
      defaultProps: MOAT_SHORT_DEFAULT_PROPS,
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
