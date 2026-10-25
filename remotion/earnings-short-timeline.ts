import { earningsShortSprechzeilen, earningsShortZeilenMitZeiten } from '@/lib/youtube/earnings-short-voice'
import {
  EARNINGS_SHORT_FPS,
  type EarningsShortBeat,
  type EarningsShortBeatId,
  type EarningsShortCaption,
  type EarningsShortProps,
  type EarningsShortTimeline,
  type EarningsShortVoiceWort,
} from './earnings-short-types'

const WOERTER_PRO_SEKUNDE = 3.25
const PAUSE_SEKUNDEN = 0.1
const MIN_SEKUNDEN: Record<Exclude<EarningsShortBeatId, 'loop'>, number> = {
  hook: 5.5,
  numbers: 7,
  call0: 11,
  call1: 11,
  filing: 8.5,
  takeaway: 5.5,
}
export const EARNINGS_SHORT_LOOP_FRAMES = 22
const CAPTION_ENDE_VOR_LOOP = 8
const OHNE_CAPTIONS = new Set<EarningsShortBeatId>(['hook', 'loop'])
const CAPTION_MAX_WOERTER = 12
const CAPTION_MAX_ZEICHEN = 90
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

export function earningsCaptionChunks(text: string): string[] {
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
  return Math.max(0, Math.round((ms / 1000) * EARNINGS_SHORT_FPS))
}

function captionsFuerBeat(
  id: EarningsShortBeatId,
  text: string,
  beatFrom: number,
  woerterDerZeile: EarningsShortVoiceWort[] | null,
): EarningsShortCaption[] {
  if (OHNE_CAPTIONS.has(id) || !text.trim()) return []
  const ganz = text.trim()
  const chunks = id === 'takeaway' && ganz.length <= LAND_EINE_SEITE ? [ganz] : earningsCaptionChunks(text)
  if (woerterDerZeile?.length) {
    const out: EarningsShortCaption[] = []
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
  const sprechFrames = Math.max(1, Math.round(sprechSek * EARNINGS_SHORT_FPS))
  const zeichenGesamt = chunks.reduce((s, c) => s + c.length, 0) || 1
  const out: EarningsShortCaption[] = []
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

function timelineAusAlignment(props: EarningsShortProps): EarningsShortTimeline | null {
  const alignment = props.voiceAlignment
  if (!alignment?.length) return null
  const zeilen = earningsShortSprechzeilen(props)
  const map = earningsShortZeilenMitZeiten(zeilen, alignment)
  if (!map) return null

  const beats: EarningsShortBeat[] = []
  const captions: EarningsShortCaption[] = []
  const starts = zeilen.map((z, i) => {
    const w = map.get(z.id)!
    return i === 0 ? 0 : msZuFrame(w[0]!.startMs)
  })
  const letzte = map.get(zeilen[zeilen.length - 1]!.id)!
  const sprechEnde = msZuFrame(letzte[letzte.length - 1]!.endMs) + Math.round(0.12 * EARNINGS_SHORT_FPS)

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

function timelineGeschaetzt(props: EarningsShortProps): EarningsShortTimeline {
  const zeilen = earningsShortSprechzeilen(props)
  const beats: EarningsShortBeat[] = []
  const captions: EarningsShortCaption[] = []
  let cursor = 0

  for (const z of zeilen) {
    const sprechSek = woerter(z.text).length / WOERTER_PRO_SEKUNDE
    const pause = z.id === 'takeaway' ? 0 : PAUSE_SEKUNDEN
    const sek = Math.max(MIN_SEKUNDEN[z.id], sprechSek + pause)
    const duration = Math.round(sek * EARNINGS_SHORT_FPS)
    beats.push({ id: z.id, text: z.text, from: cursor, duration })
    captions.push(...captionsFuerBeat(z.id, z.text, cursor, null))
    cursor += duration
  }

  return schliesseTimeline(beats, captions, cursor)
}

function schliesseTimeline(beats: EarningsShortBeat[], captions: EarningsShortCaption[], cursor: number): EarningsShortTimeline {
  beats.push({ id: 'loop', text: '', from: cursor, duration: EARNINGS_SHORT_LOOP_FRAMES })
  const durationInFrames = cursor + EARNINGS_SHORT_LOOP_FRAMES
  const captionEnde = durationInFrames - CAPTION_ENDE_VOR_LOOP
  const saubereCaptions = captions
    .map((c) => ({ ...c, duration: Math.min(c.duration, captionEnde - c.from) }))
    .filter((c) => c.duration >= 6)
  return { beats, captions: saubereCaptions, durationInFrames }
}

export function berechneEarningsShortTimeline(props: EarningsShortProps): EarningsShortTimeline {
  return timelineAusAlignment(props) ?? timelineGeschaetzt(props)
}
