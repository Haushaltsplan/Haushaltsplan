import {
  MOAT_SHORT_FPS,
  type MoatShortBeat,
  type MoatShortBeatId,
  type MoatShortCaption,
  type MoatShortProps,
  type MoatShortTimeline,
} from './moat-short-types'

/** Shorts-Tempo: lieber knapp als tot — Guides wollen einen Beat alle 2–3 Sekunden. */
const WOERTER_PRO_SEKUNDE = 3.25
const PAUSE_SEKUNDEN = 0.1
const MIN_SEKUNDEN: Record<Exclude<MoatShortBeatId, 'loop'>, number> = {
  hook: 2,
  teaser: 1.1,
  business: 1.5,
  pillar0: 1.3,
  pillar1: 1.3,
  pillar2: 1.3,
  pillar3: 1.3,
  crack: 1.8,
  verdict: 1.6,
}
/** Letzte Frames: Hook-Ruhepose, weicher Join in den YouTube-Restart. */
export const MOAT_SHORT_LOOP_FRAMES = 22
/** Untertitel müssen vor dem Join weg sein — sonst sieht man den Cut. */
const CAPTION_ENDE_VOR_LOOP = 8
/** Der Hook steht als Überschrift im Bild — doppelte Untertitel wären nur Lärm. */
const OHNE_CAPTIONS = new Set<MoatShortBeatId>(['hook', 'loop'])
const CAPTION_MAX_WOERTER = 9
const CAPTION_MAX_ZEILEN = 3
/** Lange Wörter + 54px: mehr als ~22 Zeichen pro Zeile wird die 4. Zeile. */
const CAPTION_ZEICHEN_PRO_ZEILE = 22
const CAPTION_MAX_ZEICHEN = CAPTION_ZEICHEN_PRO_ZEILE * CAPTION_MAX_ZEILEN

function geschaetzteZeilen(text: string): number {
  let zeilen = 1
  let len = 0
  for (const wort of woerter(text)) {
    const next = len === 0 ? wort.length : len + 1 + wort.length
    if (len > 0 && next > CAPTION_ZEICHEN_PRO_ZEILE) {
      zeilen += 1
      len = wort.length
    } else {
      len = next
    }
  }
  return zeilen
}

function woerter(text: string): string[] {
  return text.trim().split(/\s+/).filter(Boolean)
}

function passtInPill(text: string): boolean {
  return (
    woerter(text).length <= CAPTION_MAX_WOERTER &&
    text.length <= CAPTION_MAX_ZEICHEN &&
    geschaetzteZeilen(text) <= CAPTION_MAX_ZEILEN
  )
}

function teileNachLaenge(text: string): string[] {
  const w = woerter(text)
  if (passtInPill(text)) return [text]
  const out: string[] = []
  let aktuell: string[] = []
  for (const wort of w) {
    const next = [...aktuell, wort]
    if (aktuell.length && !passtInPill(next.join(' '))) {
      out.push(aktuell.join(' '))
      aktuell = [wort]
    } else {
      aktuell = next
    }
  }
  if (aktuell.length) out.push(aktuell.join(' '))
  return out
}

export function captionChunks(text: string): string[] {
  const saetze = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
  const chunks: string[] = []
  for (const satz of saetze.length ? saetze : [text.trim()]) {
    if (passtInPill(satz)) {
      chunks.push(satz)
      continue
    }
    const teile = satz.split(/(?<=,)\s+/)
    let aktuell: string[] = []
    for (const teil of teile) {
      const next = [...aktuell, teil]
      if (aktuell.length && !passtInPill(next.join(' '))) {
        chunks.push(aktuell.join(' '))
        aktuell = [teil]
      } else {
        aktuell = next
      }
    }
    if (aktuell.length) chunks.push(aktuell.join(' '))
  }
  const fein = chunks.filter(Boolean).flatMap(teileNachLaenge)
  const letzter = fein[fein.length - 1]
  if (fein.length > 1 && letzter && woerter(letzter).length <= 3) {
    const merged = `${fein[fein.length - 2]} ${letzter}`
    if (passtInPill(merged)) fein.splice(-2, 2, merged)
  }
  return fein
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
