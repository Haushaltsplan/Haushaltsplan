import { moatShortSprechzeilen, sprechzeilenMitZeiten } from '@/lib/youtube/moat-short-voice'
import {
  MOAT_SHORT_FPS,
  type MoatShortBeat,
  type MoatShortBeatId,
  type MoatShortCaption,
  type MoatShortProps,
  type MoatShortTimeline,
  type MoatShortVoiceWort,
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
const CAPTION_MAX_WOERTER = 12
/** Nur echte Ausreißer splitten. Normale Sätze bleiben ein Block. */
const CAPTION_MAX_ZEICHEN = 90
/** Die Landung ist eine Seite, auch wenn „can not“ die Wortgrenze reißt. */
const LAND_EINE_SEITE = 120

function woerter(text: string): string[] {
  return text.trim().split(/\s+/).filter(Boolean)
}

function passtInPill(text: string): boolean {
  return woerter(text).length <= CAPTION_MAX_WOERTER && text.length <= CAPTION_MAX_ZEICHEN
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

function istEinAtemzug(text: string): boolean {
  return !/[.!?]/.test(text.replace(/[.!?…]+$/u, ''))
}

export function captionChunks(text: string): string[] {
  const ganz = text.trim()
  if (ganz && istEinAtemzug(ganz) && ganz.length <= CAPTION_MAX_ZEICHEN) return [ganz]
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

function msZuFrame(ms: number): number {
  return Math.max(0, Math.round((ms / 1000) * MOAT_SHORT_FPS))
}

function captionsFuerBeat(
  id: MoatShortBeatId,
  text: string,
  beatFrom: number,
  woerterDerZeile: MoatShortVoiceWort[] | null,
): MoatShortCaption[] {
  if (OHNE_CAPTIONS.has(id) || !text.trim()) return []
  const ganz = text.trim()
  const chunks = id === 'verdict' && ganz.length <= LAND_EINE_SEITE ? [ganz] : captionChunks(text)
  if (woerterDerZeile?.length) {
    const out: MoatShortCaption[] = []
    let i = 0
    for (const chunk of chunks) {
      const n = Math.max(1, woerter(chunk).length)
      const teil = woerterDerZeile.slice(i, i + n)
      i += n
      const quelle = teil.length ? teil : woerterDerZeile
      const from = msZuFrame(quelle[0]!.startMs)
      const ende = msZuFrame(quelle[quelle.length - 1]!.endMs)
      out.push({ text: chunk, from, duration: Math.max(6, ende - from) })
    }
    return out
  }
  const sprechSek = woerter(text).length / WOERTER_PRO_SEKUNDE
  const sprechFrames = Math.max(1, Math.round(sprechSek * MOAT_SHORT_FPS))
  const zeichenGesamt = chunks.reduce((s, c) => s + c.length, 0) || 1
  const out: MoatShortCaption[] = []
  let c = beatFrom
  chunks.forEach((chunk, i) => {
    const len =
      i === chunks.length - 1
        ? Math.max(6, beatFrom + sprechFrames - c)
        : Math.max(6, Math.round((chunk.length / zeichenGesamt) * sprechFrames))
    out.push({ text: chunk, from: c, duration: len })
    c += len
  })
  return out
}

function timelineAusAlignment(props: MoatShortProps): MoatShortTimeline | null {
  const alignment = props.voiceAlignment
  if (!alignment?.length) return null
  const zeilen = moatShortSprechzeilen(props)
  const map = sprechzeilenMitZeiten(zeilen, alignment)
  if (!map) return null

  const beats: MoatShortBeat[] = []
  const captions: MoatShortCaption[] = []
  const starts = zeilen.map((z, i) => {
    const w = map.get(z.id)!
    return i === 0 ? 0 : msZuFrame(w[0]!.startMs)
  })
  const letzte = map.get(zeilen[zeilen.length - 1]!.id)!
  const sprechEnde = msZuFrame(letzte[letzte.length - 1]!.endMs) + Math.round(0.12 * MOAT_SHORT_FPS)

  for (let i = 0; i < zeilen.length; i++) {
    const z = zeilen[i]!
    const from = starts[i]!
    const next = starts[i + 1] ?? sprechEnde
    const duration = Math.max(6, next - from)
    beats.push({ id: z.id, text: z.text, from, duration })
    captions.push(...captionsFuerBeat(z.id, z.text, from, map.get(z.id) ?? null))
  }

  const cursor = beats[beats.length - 1]!.from + beats[beats.length - 1]!.duration
  return schliesseTimeline(beats, captions, cursor)
}

function timelineGeschaetzt(props: MoatShortProps): MoatShortTimeline {
  const zeilen = moatShortSprechzeilen(props)
  const beats: MoatShortBeat[] = []
  const captions: MoatShortCaption[] = []
  let cursor = 0

  for (const z of zeilen) {
    const sprechSek = woerter(z.text).length / WOERTER_PRO_SEKUNDE
    const pause = z.id === 'verdict' ? 0 : PAUSE_SEKUNDEN
    const sek = Math.max(MIN_SEKUNDEN[z.id], sprechSek + pause)
    const duration = Math.round(sek * MOAT_SHORT_FPS)
    beats.push({ id: z.id, text: z.text, from: cursor, duration })
    captions.push(...captionsFuerBeat(z.id, z.text, cursor, null))
    cursor += duration
  }

  return schliesseTimeline(beats, captions, cursor)
}

function schliesseTimeline(beats: MoatShortBeat[], captions: MoatShortCaption[], cursor: number): MoatShortTimeline {
  beats.push({ id: 'loop', text: '', from: cursor, duration: MOAT_SHORT_LOOP_FRAMES })
  const durationInFrames = cursor + MOAT_SHORT_LOOP_FRAMES
  const captionEnde = durationInFrames - CAPTION_ENDE_VOR_LOOP
  const saubereCaptions = captions
    .map((c) => ({ ...c, duration: Math.min(c.duration, captionEnde - c.from) }))
    .filter((c) => c.duration >= 6)
  return { beats, captions: saubereCaptions, durationInFrames }
}

export function berechneMoatShortTimeline(props: MoatShortProps): MoatShortTimeline {
  return timelineAusAlignment(props) ?? timelineGeschaetzt(props)
}
