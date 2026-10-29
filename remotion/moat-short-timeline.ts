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

/** Schätzung vor der Stimme: diese Stimme liegt bei ~2,3 Wörtern/s, mal speed 1,15. Mit Wortzeiten gilt die Audiodauer. */
const WOERTER_PRO_SEKUNDE = 2.6
const PAUSE_SEKUNDEN = 0.08
const MIN_SEKUNDEN: Record<Exclude<MoatShortBeatId, 'loop'>, number> = {
  hook: 1.6,
  proof: 1.3,
  teaser: 0.9,
  pillar0: 1.1,
  pillar1: 1.1,
  pillar2: 1.1,
  pillar3: 1.1,
  crack: 1.4,
  verdict: 1.1,
}
/** Kein Nachlauf. Der letzte Frame ist das Ende der offenen Frage, YouTube setzt den Hook davor. */
export const MOAT_SHORT_LOOP_FRAMES = 0
/** Ein Block bleibt kurz, damit das Auge nicht auf einem Satz liegen bleibt. */
const CAPTION_MAX_WOERTER = 4
const CAPTION_MAX_MS = 1200
const CAPTION_MIN_FRAMES = Math.round(0.8 * MOAT_SHORT_FPS)

function woerter(text: string): string[] {
  return text.trim().split(/\s+/).filter(Boolean)
}

function msZuFrame(ms: number): number {
  return Math.max(0, Math.round((ms / 1000) * MOAT_SHORT_FPS))
}

function gruppen(worte: MoatShortVoiceWort[]): MoatShortVoiceWort[][] {
  const out: MoatShortVoiceWort[][] = []
  let cur: MoatShortVoiceWort[] = []
  const dauer = (g: MoatShortVoiceWort[]) => g[g.length - 1]!.endMs - g[0]!.startMs
  for (const w of worte) {
    if (!cur.length) {
      cur = [w]
      continue
    }
    const probe = [...cur, w]
    const zuViel = probe.length > CAPTION_MAX_WOERTER || (cur.length >= 2 && dauer(probe) > CAPTION_MAX_MS)
    if (zuViel) {
      out.push(cur)
      cur = [w]
    } else {
      cur = probe
    }
  }
  if (cur.length) out.push(cur)
  if (out.length >= 2 && out[out.length - 1]!.length === 1) {
    const last = out[out.length - 1]!
    const prev = out[out.length - 2]!
    if (prev.length >= 3) {
      const gestohlen = prev[prev.length - 1]!
      out.splice(-2, 2, prev.slice(0, -1), [gestohlen, ...last])
    } else if (prev.length < CAPTION_MAX_WOERTER) {
      out.splice(-2, 2, [...prev, ...last])
    }
  }
  return out
}

function schaetzeWoerter(text: string, fromFrame: number): MoatShortVoiceWort[] {
  const liste = woerter(text)
  const ms = 1000 / WOERTER_PRO_SEKUNDE
  const start = (fromFrame / MOAT_SHORT_FPS) * 1000
  return liste.map((wort, i) => ({
    text: wort,
    startMs: start + i * ms,
    endMs: start + (i + 1) * ms,
  }))
}

function captionsAusWoertern(worte: MoatShortVoiceWort[]): MoatShortCaption[] {
  const roh = gruppen(worte).map((g) => {
    const from = msZuFrame(g[0]!.startMs)
    const ende = msZuFrame(g[g.length - 1]!.endMs)
    return {
      text: g.map((w) => w.text).join(' '),
      from,
      duration: Math.max(6, ende - from),
      woerter: g.map((w) => ({
        text: w.text,
        start: Math.max(0, msZuFrame(w.startMs) - from),
        end: Math.max(1, msZuFrame(w.endMs) - from),
      })),
    }
  })
  return roh.map((c, i) => {
    const next = roh[i + 1]?.from ?? c.from + c.duration
    let duration = c.duration
    if (duration < CAPTION_MIN_FRAMES) duration = Math.min(CAPTION_MIN_FRAMES, Math.max(6, next - c.from))
    duration = Math.min(duration, Math.max(6, next - c.from))
    return { ...c, duration: Math.max(6, duration) }
  })
}

function captionsFuerBeat(
  _id: MoatShortBeatId,
  text: string,
  beatFrom: number,
  woerterDerZeile: MoatShortVoiceWort[] | null,
): MoatShortCaption[] {
  if (!text.trim()) return []
  const quelle = woerterDerZeile?.length ? woerterDerZeile : schaetzeWoerter(text, beatFrom)
  return captionsAusWoertern(quelle)
}

function ersterBlockAufFrameNull(captions: MoatShortCaption[]): MoatShortCaption[] {
  const erste = captions[0]
  if (!erste || erste.from <= 0 || erste.from > 4) return captions
  const delta = erste.from
  return [
    {
      ...erste,
      from: 0,
      duration: erste.duration + delta,
      woerter: erste.woerter.map((w) => ({ ...w, start: w.start + delta, end: w.end + delta })),
    },
    ...captions.slice(1),
  ]
}

function timelineAusAlignment(props: MoatShortProps): MoatShortTimeline | null {
  const alignment = props.voiceAlignment
  if (!alignment?.length) return null
  const zeilen = moatShortSprechzeilen(props)
  const map = sprechzeilenMitZeiten(zeilen, alignment)
  if (!map) return null

  const erste = map.get(zeilen[0]!.id)?.[0]?.startMs ?? 0
  const gemessen = props.voiceLeadMs
  const offset = gemessen != null ? Math.max(0, gemessen) : Math.max(0, erste)
  const geschoben = new Map(
    zeilen.map((z) => [
      z.id,
      (map.get(z.id) ?? []).map((w) => {
        const startMs = Math.max(0, w.startMs - offset)
        return { ...w, startMs, endMs: Math.max(startMs + 1, w.endMs - offset) }
      }),
    ]),
  )

  const beats: MoatShortBeat[] = []
  const captions: MoatShortCaption[] = []
  const starts = zeilen.map((z, i) => {
    const w = geschoben.get(z.id)!
    return i === 0 ? 0 : msZuFrame(w[0]!.startMs)
  })
  const letzte = geschoben.get(zeilen[zeilen.length - 1]!.id)!
  const endeMs = letzte[letzte.length - 1]!.endMs
  const sprechEnde = Math.max(1, Math.floor((endeMs / 1000) * MOAT_SHORT_FPS) + 1)

  for (let i = 0; i < zeilen.length; i++) {
    const z = zeilen[i]!
    const from = starts[i]!
    const next = starts[i + 1] ?? sprechEnde
    const duration = Math.max(6, next - from)
    beats.push({ id: z.id, text: z.text, from, duration })
    captions.push(...captionsFuerBeat(z.id, z.text, from, geschoben.get(z.id) ?? null))
  }

  const cursor = beats[beats.length - 1]!.from + beats[beats.length - 1]!.duration
  return schliesseTimeline(beats, ersterBlockAufFrameNull(captions), cursor, Math.round((offset / 1000) * MOAT_SHORT_FPS))
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

  return schliesseTimeline(beats, ersterBlockAufFrameNull(captions), cursor, 0)
}

function schliesseTimeline(
  beats: MoatShortBeat[],
  captions: MoatShortCaption[],
  cursor: number,
  voiceTrimFrames: number,
): MoatShortTimeline {
  const durationInFrames = Math.max(1, cursor)
  const saubereCaptions = captions
    .map((c) => ({ ...c, duration: Math.min(c.duration, durationInFrames - c.from) }))
    .filter((c) => c.duration >= 6 && c.from < durationInFrames)
  return { beats, captions: saubereCaptions, durationInFrames, voiceTrimFrames }
}

export function berechneMoatShortTimeline(props: MoatShortProps): MoatShortTimeline {
  return timelineAusAlignment(props) ?? timelineGeschaetzt(props)
}
