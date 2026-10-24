import {
  MOAT_SHORT_FPS,
  type MoatShortBeat,
  type MoatShortBeatId,
  type MoatShortCaption,
  type MoatShortProps,
  type MoatShortTimeline,
} from './moat-short-types'

/** Geschätztes Sprechtempo ohne Audiospur — Shorts-Erzähler liegen bei ~150–165 Wörtern/Minute. */
const WOERTER_PRO_SEKUNDE = 2.6
const PAUSE_SEKUNDEN = 0.3
const MIN_SEKUNDEN: Record<MoatShortBeatId, number> = {
  hook: 2.8,
  business: 2.4,
  pillar0: 2.2,
  pillar1: 2.2,
  pillar2: 2.2,
  pillar3: 2.2,
  crack: 3,
  verdict: 3.6,
}
const CAPTION_MAX_WOERTER = 3

function woerter(text: string): string[] {
  return text.trim().split(/\s+/).filter(Boolean)
}

function captionChunks(text: string): string[] {
  const chunks: string[] = []
  let aktuell: string[] = []
  for (const wort of woerter(text)) {
    aktuell.push(wort)
    if (aktuell.length >= CAPTION_MAX_WOERTER || /[.,;:!?]$/.test(wort)) {
      chunks.push(aktuell.join(' '))
      aktuell = []
    }
  }
  if (aktuell.length) chunks.push(aktuell.join(' '))
  const letzter = chunks[chunks.length - 1]
  if (chunks.length > 1 && letzter && !letzter.includes(' ')) {
    chunks.splice(-2, 2, `${chunks[chunks.length - 2]} ${letzter}`)
  }
  return chunks
}

export function berechneMoatShortTimeline(props: MoatShortProps): MoatShortTimeline {
  const texte: [MoatShortBeatId, string][] = [
    ['hook', props.hook],
    ['business', props.business],
    ...props.pillars.slice(0, 4).map((p, i) => [`pillar${i}` as MoatShortBeatId, p.line] as [MoatShortBeatId, string]),
    ['crack', props.crack],
    ['verdict', props.closing],
  ]

  const beats: MoatShortBeat[] = []
  const captions: MoatShortCaption[] = []
  let cursor = 0

  for (const [id, text] of texte) {
    const sprechSek = woerter(text).length / WOERTER_PRO_SEKUNDE
    const sek = Math.max(MIN_SEKUNDEN[id], sprechSek + PAUSE_SEKUNDEN)
    const duration = Math.round(sek * MOAT_SHORT_FPS)
    beats.push({ id, text, from: cursor, duration })

    const chunks = captionChunks(text)
    const sprechFrames = Math.max(1, Math.round(sprechSek * MOAT_SHORT_FPS))
    const zeichenGesamt = chunks.reduce((s, c) => s + c.length, 0) || 1
    let c = cursor
    chunks.forEach((chunk, i) => {
      const len =
        i === chunks.length - 1
          ? Math.max(6, cursor + sprechFrames - c)
          : Math.max(6, Math.round((chunk.length / zeichenGesamt) * sprechFrames))
      captions.push({ text: chunk, from: c, duration: len })
      c += len
    })

    cursor += duration
  }

  return { beats, captions, durationInFrames: cursor }
}
