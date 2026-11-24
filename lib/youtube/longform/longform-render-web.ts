/** MP4 im Browser — funktioniert auf der Live-Seite (Chrome/Edge), ohne lokalen Remotion-CLI. */
import { logoPlaySrc, musikPlaySrc } from '@/lib/youtube/moat-short-media-src'
import { AktienAnalyse } from '@/remotion/longform/AktienAnalyse'
import { LongZusammenschnitt, zusammenschnittDauer, type ZusammenschnittProps } from '@/remotion/longform/LongZusammenschnitt'
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

function istMp3(buf: ArrayBuffer): boolean {
  const b = new Uint8Array(buf.slice(0, 4))
  if (b.length < 2) return false
  if (b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33) return true
  return b[0] === 0xff && (b[1] & 0xe0) === 0xe0
}

const FADE_EIN_MS = 8
const FADE_AUS_MS = 12

function kosinusRein(t: number): number {
  return 0.5 * (1 - Math.cos(Math.PI * t))
}

/** Erste 8 ms von null, letzte 12 ms auf null. Sonst knackst die Naht zwischen zwei MP3s. */
function kanteAufNull(audio: AudioBuffer): void {
  const n = audio.length
  if (n < 1) return
  const ein = Math.min(Math.floor(n / 2), Math.max(1, Math.round((FADE_EIN_MS / 1000) * audio.sampleRate)))
  const aus = Math.min(n - ein, Math.max(1, Math.round((FADE_AUS_MS / 1000) * audio.sampleRate)))
  for (let c = 0; c < audio.numberOfChannels; c++) {
    const data = audio.getChannelData(c)
    for (let i = 0; i < ein; i++) {
      const t = i / Math.max(1, ein - 1)
      data[i] = (data[i] ?? 0) * kosinusRein(t)
    }
    if (aus <= 1) {
      data[n - 1] = 0
    } else {
      for (let j = 0; j < aus; j++) {
        const idx = n - aus + j
        data[idx] = (data[idx] ?? 0) * (1 - kosinusRein(j / (aus - 1)))
      }
    }
    data[0] = 0
    data[n - 1] = 0
  }
}

/** 16-bit PCM, damit der Web-Renderer die Stimme selbst dekodiert und nicht stumm ausfällt. */
function pcmWav(audio: AudioBuffer): ArrayBuffer {
  const channels = audio.numberOfChannels
  const rate = audio.sampleRate
  const length = audio.length
  const block = channels * 2
  const dataSize = length * block
  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)
  const text = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i))
  }
  text(0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  text(8, 'WAVE')
  text(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, channels, true)
  view.setUint32(24, rate, true)
  view.setUint32(28, rate * block, true)
  view.setUint16(32, block, true)
  view.setUint16(34, 16, true)
  text(36, 'data')
  view.setUint32(40, dataSize, true)
  const daten = Array.from({ length: channels }, (_, i) => audio.getChannelData(i))
  let offset = 44
  for (let i = 0; i < length; i++) {
    for (let c = 0; c < channels; c++) {
      const sample = Math.max(-1, Math.min(1, daten[c]![i] ?? 0))
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
      offset += 2
    }
  }
  return buffer
}

/** MP3 aus der Cloud in WAV umwandeln. Schlägt das fehl, bricht der Export sofort ab. */
async function alsWavUrl(src: string | null, ctx: AudioContext): Promise<{ url: string; dauerMs: number } | null> {
  if (!src) return null
  const url = /^(blob:|data:)/i.test(src) ? src : absolut(src)
  if (!url) return null
  try {
    const res = await fetch(url, { credentials: 'omit', cache: 'no-store' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const buf = await res.arrayBuffer()
    if (buf.byteLength < 64) throw new Error('Datei zu klein / leer')
    const audio = await ctx.decodeAudioData(buf.slice(0))
    if (audio.duration < 0.05) throw new Error('Stimme ist leer')
    kanteAufNull(audio)
    const dauerMs = Math.round((audio.length / audio.sampleRate) * 1000)
    return { url: URL.createObjectURL(new Blob([pcmWav(audio)], { type: 'audio/wav' })), dauerMs }
  } catch (e) {
    const grund = e instanceof Error ? e.message : 'unbekannt'
    throw new Error(`Stimme laden fehlgeschlagen (${url.slice(0, 80)}…): ${grund}`)
  }
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
    const header = (res.headers.get('content-type') ?? '').split(';')[0]!.trim()
    const sollAudio = /audio\//i.test(header) || /\.mp3(\?|$)/i.test(url)
    if (sollAudio && !istMp3(buf)) throw new Error('Stimme ist keine MP3')
    const typ = sollAudio || istMp3(buf)
      ? 'audio/mpeg'
      : header && /^(video|image)\//i.test(header)
        ? header
        : url.includes('.mp4')
          ? 'video/mp4'
          : url.includes('.png')
            ? 'image/png'
            : url.includes('.webp')
              ? 'image/webp'
              : header || 'application/octet-stream'
    return URL.createObjectURL(new Blob([buf], { type: typ }))
  } catch (e) {
    const grund = e instanceof Error ? e.message : 'unbekannt'
    throw new Error(`Medien laden fehlgeschlagen (${url.slice(0, 80)}…): ${grund}`)
  }
}

/** Bricht ab, bevor ein stummer Film geschrieben wird. */
function stimmeMussDaSein(props: AktienAnalyseProps): void {
  const ohne = props.saetze.filter((s) => !s.audioUrl).length
  if (!props.saetze.length || ohne === 0) return
  throw new Error(
    `Stimme fehlt bei ${ohne} von ${props.saetze.length} Sätzen. Die Dateien liegen in der Cloud, die Links kamen nicht an. Es wird kein stummes Video geschrieben.`,
  )
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
      visual: {
        ...s.visual,
        konkurrentLogos: s.visual.konkurrentLogos?.map((l) => ({ ...l, url: absolut(l.url) ?? l.url })),
      },
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

/** Props mit blob:-URLs für zuverlässigen Browser-Export. Stimme wird vorher zu WAV. */
export async function propsMitBlobMedien(props: AktienAnalyseProps): Promise<AktienAnalyseProps> {
  const basis = normalisiereAnalysePropsFuerWeb(props)
  const ctx = new AudioContext()
  try {
    const saetze = await Promise.all(
      basis.saetze.map(async (s) => {
        const wav = await alsWavUrl(s.audioUrl, ctx)
        return {
          ...s,
          audioUrl: wav?.url ?? null,
          dauerMs: wav?.dauerMs ?? s.dauerMs,
          bildUrl: await alsBlobUrl(s.bildUrl),
          visual: {
            ...s.visual,
            konkurrentLogos: await Promise.all(
              (s.visual.konkurrentLogos ?? []).map(async (l) => ({ ...l, url: (await alsBlobUrl(l.url)) ?? l.url })),
            ),
          },
        }
      }),
    )
    if (basis.musik.aktiv && basis.musik.tracks.length === 0) {
      throw new Error('Musik ist an, aber auf dem Server liegt keine Musikdatei. Schalter aus, oder die Dateien nach public/youtube-music/long legen.')
    }
    const tracks = basis.musik.aktiv
      ? await Promise.all(
          basis.musik.tracks.map(async (t) => ({
            ...t,
            src: (await alsBlobUrl(t.src)) ?? t.src,
          })),
        )
      : []
    return {
      ...basis,
      logoUrl: (await alsBlobUrl(basis.logoUrl)) ?? basis.logoUrl,
      kanalLogoUrl: (await alsBlobUrl(basis.kanalLogoUrl ?? null)) ?? basis.kanalLogoUrl ?? null,
      saetze,
      musik: { ...basis.musik, tracks },
    }
  } finally {
    await ctx.close().catch(() => undefined)
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

  stimmeMussDaSein(props)
  const webProps = await propsMitBlobMedien(props)
  const dauer = berechneLongTimeline(webProps).durationInFrames
  try {
    stimmeMussDaSein(webProps)
    const fertig = await renderMediaOnWeb({
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
    return await fertig.getBlob()
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

/** Schlussfilm aus den Kapiteldateien. Die Dateien werden nur aneinandergelegt. */
export async function rendereZusammenschnittImBrowser(
  eingabe: ZusammenschnittProps,
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
  const teile = await Promise.all(
    eingabe.teile.map(async (t) => ({ ...t, src: (await alsBlobUrl(t.src)) ?? t.src })),
  )
  const props: ZusammenschnittProps = { ...eingabe, teile }
  const dauer = zusammenschnittDauer(teile)
  try {
    const { getBlob } = await renderMediaOnWeb({
      composition: {
        id: 'KapitelZusammenschnitt',
        component: LongZusammenschnitt,
        durationInFrames: dauer,
        fps: LONG_FPS,
        width: LONG_WIDTH,
        height: LONG_HEIGHT,
        defaultProps: props,
      },
      inputProps: props,
      container: 'mp4',
      videoCodec: 'h264',
      muted: false,
      allowHtmlInCanvas: true,
      onProgress: (p) => onProgress?.(p.progress),
    })
    return getBlob()
  } finally {
    for (const t of teile) {
      if (t.src.startsWith('blob:')) URL.revokeObjectURL(t.src)
    }
  }
}
