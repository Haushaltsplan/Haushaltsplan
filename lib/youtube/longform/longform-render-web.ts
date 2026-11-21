/** MP4 im Browser — funktioniert auf der Live-Seite (Chrome/Edge), ohne lokalen Remotion-CLI. */
import { logoPlaySrc, musikPlaySrc } from '@/lib/youtube/moat-short-media-src'
import { AktienAnalyse } from '@/remotion/longform/AktienAnalyse'
import { berechneLongTimeline } from '@/remotion/longform/long-timeline'
import {
  AKTIEN_ANALYSE_DEFAULT_PROPS,
  LONG_FPS,
  LONG_HEIGHT,
  LONG_WIDTH,
  type AktienAnalyseProps,
} from '@/remotion/longform/long-types'

function absolut(src: string | null): string | null {
  if (!src) return null
  if (/^(https?:|blob:|data:)/i.test(src)) return src
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  if (src.startsWith('/')) return origin ? `${origin}${src}` : src
  return musikPlaySrc(src) ?? src
}

/** Alle Medien auf Same-Origin bzw. absolute URLs, damit der Web-Renderer sie laden kann. */
export function normalisiereAnalysePropsFuerWeb(props: AktienAnalyseProps): AktienAnalyseProps {
  return {
    ...props,
    logoUrl: logoPlaySrc(props.logoUrl),
    saetze: props.saetze.map((s) => ({
      ...s,
      audioUrl: absolut(s.audioUrl),
      bildUrl: absolut(s.bildUrl),
    })),
    musik: {
      ...props.musik,
      tracks: props.musik.tracks.map((t) => ({
        ...t,
        src: absolut(t.src) ?? t.src,
      })),
    },
  }
}

export async function rendereAktienAnalyseImBrowser(
  props: AktienAnalyseProps,
  onProgress?: (fortschritt: number) => void,
): Promise<Blob> {
  const { canRenderMediaOnWeb, renderMediaOnWeb } = await import('@remotion/web-renderer')
  const check = await canRenderMediaOnWeb({
    container: 'mp4',
    width: LONG_WIDTH,
    height: LONG_HEIGHT,
  })
  if (!check.canRender) {
    const grund = check.issues
      .filter((i) => i.severity === 'error')
      .map((i) => i.message)
      .join(' ')
    throw new Error(grund || 'Dieser Browser kann kein MP4 erzeugen. Bitte Chrome oder Edge.')
  }

  const webProps = normalisiereAnalysePropsFuerWeb(props)
  const dauer = berechneLongTimeline(webProps).durationInFrames
  const { getBlob } = await renderMediaOnWeb({
    composition: {
      id: 'AktienAnalyse',
      component: AktienAnalyse,
      durationInFrames: dauer,
      fps: LONG_FPS,
      width: LONG_WIDTH,
      height: LONG_HEIGHT,
      defaultProps: AKTIEN_ANALYSE_DEFAULT_PROPS,
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
