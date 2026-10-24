import {
  MOAT_SHORT_FPS,
  type MoatShortBeat,
  type MoatShortBeatId,
  type MoatShortCaption,
  type MoatShortProps,
  type MoatShortTimeline,
} from './moat-short-types'

/** Shorts-Tempo: lieber knapp als tot — Guides wollen einen Beat alle 2–3 Sekunden. */
const WOERTER_PRO_SEKUNDE = 3
const PAUSE_SEKUNDEN = 0.16
const MIN_SEKUNDEN: Record<Exclude<MoatShortBeatId, 'loop'>, number> = {
  hook: 2,
  teaser: 1,
  business: 1.8,
  pillar0: 1.5,
  pillar1: 1.5,
  pillar2: 1.5,
  pillar3: 1.5,
  crack: 2.1,
  verdict: 2,
}
/** Letzte Frames: Hook-Ruhepose, damit YouTube unsichtbar neu startet. */
export const MOAT_SHORT_LOOP_FRAMES = 16
/** Untertitel müssen vor dem Join weg sein — sonst sieht man den Cut. */
const CAPTION_ENDE_VOR_LOOP = 8
/** Der Hook steht als Überschrift im Bild — doppelte Untertitel wären nur Lärm. */
const OHNE_CAPTIONS = new Set<MoatShortBeatId>(['hook', 'loop'])
const CAPTION_MAX_WOERTER = 8

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
  if (
    chunks.length > 1 &&
    letzter &&
    woerter(letzter).length <= 2 &&
    woerter(`${chunks[chunks.length - 2]} ${letzter}`).length <= CAPTION_MAX_WOERTER + 1
  ) {
    chunks.splice(-2, 2, `${chunks[chunks.length - 2]} ${letzter}`)
  }
  return chunks
}

export function berechneMoatShortTimeline(props: MoatShortProps): MoatShortTimeline {
  const texte: [Exclude<MoatShortBeatId, 'loop'>, string][] = [
    ['hook', props.hook],
    ['teaser', props.hookLoop],
    ['business', props.business],
    ...props.pillars.slice(0, 4).map((p, i) => [`pillar${i}` as Exclude<MoatShortBeatId, 'loop'>, p.line] as [Exclude<MoatShortBeatId, 'loop'>, string]),
    ['crack', props.crack],
    ['verdict', props.closing],
  ]

  const beats: MoatShortBeat[] = []
  const captions: MoatShortCaption[] = []
  let cursor = 0

  for (const [id, text] of texte) {
    if (!text.trim()) continue
    const sprechSek = woerter(text).length / WOERTER_PRO_SEKUNDE
    const pause = id === 'verdict' ? 0 : PAUSE_SEKUNDEN
    const sek = Math.max(MIN_SEKUNDEN[id], sprechSek + pause)
    const duration = Math.round(sek * MOAT_SHORT_FPS)
    beats.push({ id, text, from: cursor, duration })

    if (!OHNE_CAPTIONS.has(id)) {
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
    }

    cursor += duration
  }

  beats.push({ id: 'loop', text: '', from: cursor, duration: MOAT_SHORT_LOOP_FRAMES })
  const durationInFrames = cursor + MOAT_SHORT_LOOP_FRAMES
  const captionEnde = durationInFrames - CAPTION_ENDE_VOR_LOOP
  const saubereCaptions = captions
    .map((c) => ({ ...c, duration: Math.min(c.duration, captionEnde - c.from) }))
    .filter((c) => c.duration >= 6)

  return { beats, captions: saubereCaptions, durationInFrames }
}
