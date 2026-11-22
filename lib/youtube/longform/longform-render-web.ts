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

/**
 * Signierte Supabase-URLs scheitern oft an Mediabunny im Web-Renderer.
 * Deshalb vor dem Export alles in blob:-URLs umwandeln (wie lokale Bytes).
 */
async function alsBlobUrl(src: string | null): Promise<string | null> {
  if (!src) return null
  if (/^(blob:|data:)/i.test(src)) return src
  const url = absolut(src)
  if (!url) return null
  try {
    const res = await fetch(url, { credentials: 'omit', cache: 'no-store' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const buf = await res.arrayBuffer()
    if (buf.byteLength < 64) throw new Error('Datei zu klein / leer')
    const mime = (res.headers.get('content-type') ?? '').split(';')[0]!.trim()
    const typ =
      mime && /^(audio|video|image)\//i.test(mime)
        ? mime
        : url.includes('.mp3')
          ? 'audio/mpeg'
          : url.includes('.mp4')
            ? 'video/mp4'
            : url.includes('.png')
              ? 'image/png'
              : url.includes('.webp')
                ? 'image/webp'
                : 'application/octet-stream'
    return URL.createObjectURL(new Blob([buf], { type: typ }))
  } catch (e) {
    const grund = e instanceof Error ? e.message : 'unbekannt'
    throw new Error(`Medien laden fehlgeschlagen (${url.slice(0, 80)}…): ${grund}`)
  }
}

/** Alle Medien auf Same-Origin bzw. absolute URLs, damit der Web-Renderer sie laden kann. */
export function normalisiereAnalysePropsFuerWeb(props: AktienAnalyseProps): AktienAnalyseProps {
  return {
    ...props,
    logoUrl: logoPlaySrc(props.logoUrl),
    kanalLogoUrl: props.kanalLogoUrl ? absolut(props.kanalLogoUrl) : props.kanalLogoUrl,
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

/** Props mit blob:-URLs für zuverlässigen Browser-Export. */
export async function propsMitBlobMedien(props: AktienAnalyseProps): Promise<AktienAnalyseProps> {
  const basis = normalisiereAnalysePropsFuerWeb(props)
  const saetze = await Promise.all(
    basis.saetze.map(async (s) => ({
      ...s,
      audioUrl: await alsBlobUrl(s.audioUrl),
      bildUrl: await alsBlobUrl(s.bildUrl),
    })),
  )
  const tracks = await Promise.all(
    basis.musik.tracks.map(async (t) => ({
      ...t,
      src: (await alsBlobUrl(t.src)) ?? t.src,
    })),
  )
  return {
    ...basis,
    logoUrl: (await alsBlobUrl(basis.logoUrl)) ?? basis.logoUrl,
    kanalLogoUrl: (await alsBlobUrl(basis.kanalLogoUrl ?? null)) ?? basis.kanalLogoUrl ?? null,
    saetze,
    musik: { ...basis.musik, tracks },
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

  const webProps = await propsMitBlobMedien(props)
  const dauer = berechneLongTimeline(webProps).durationInFrames
  try {
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
  } finally {
    for (const s of webProps.saetze) {
      if (s.audioUrl?.startsWith('blob:')) URL.revokeObjectURL(s.audioUrl)
      if (s.bildUrl?.startsWith('blob:')) URL.revokeObjectURL(s.bildUrl)
    }
    for (const t of webProps.musik.tracks) {
      if (t.src.startsWith('blob:')) URL.revokeObjectURL(t.src)
    }
  }
}
