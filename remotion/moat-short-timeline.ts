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
/** Phrase, nicht Wortsalat. Ein Block endet nicht auf a/of/the. */
const CAPTION_ZIEL_WOERTER = 4
const CAPTION_MAX_WOERTER = 6
const CAPTION_MAX_MS = 1600
const CAPTION_MIN_FRAMES = Math.round(0.8 * MOAT_SHORT_FPS)
const CAPTION_KLEIN = new Set(
  'a an the of and or to for in on with from by at out into that so as if when while without than per its their this these those'.split(' '),
)

function woerter(text: string): string[] {
  return text.trim().split(/\s+/).filter(Boolean)
}

function msZuFrame(ms: number): number {
  return Math.max(0, Math.round((ms / 1000) * MOAT_SHORT_FPS))
}

function captionKern(text: string): string {
  return text.replace(/[^A-Za-z']/g, '').toLowerCase()
}

function captionKlein(text: string): boolean {
  return CAPTION_KLEIN.has(captionKern(text))
}

/** Erst ab drei Wörtern und nie nach a/of/the umbrechen. */
function captionSchliessbar(g: MoatShortVoiceWort[]): boolean {
  return g.length >= 3 && !captionKlein(g[g.length - 1]!.text)
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
    const phraseVoll = captionSchliessbar(cur) && (probe.length > CAPTION_ZIEL_WOERTER || dauer(probe) > CAPTION_MAX_MS)
    if (phraseVoll || probe.length > CAPTION_MAX_WOERTER) {
      out.push(cur)
      cur = [w]
    } else {
      cur = probe
    }
  }
  if (cur.length) out.push(cur)
  let i = 0
  while (i < out.length - 1) {
    const prev = out[i]!
    const next = out[i + 1]!
    const haengt = next.length <= 2 || captionKlein(next[0]!.text)
    if (haengt && prev.length + next.length <= CAPTION_MAX_WOERTER) {
      out.splice(i, 2, [...prev, ...next])
      continue
    }
    i += 1
  }
  if (out.length >= 2 && out[out.length - 1]!.length === 1) {
    const last = out[out.length - 1]!
    const prev = out[out.length - 2]!
    if (prev.length >= 3) {
      const gestohlen = prev[prev.length - 1]!
      out.splice(-2, 2, prev.slice(0, -1), [gestohlen, ...last])
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
        end: Math.max(msZuFrame(w.startMs) - from + 1, msZuFrame(w.endMs) - from),
      })),
    }
  })
  return roh.map((c, i) => {
    const next = roh[i + 1]?.from ?? c.from + c.duration
    const raum = Math.max(1, next - c.from)
    let duration = Math.min(c.duration, raum)
    if (duration < CAPTION_MIN_FRAMES) duration = Math.min(CAPTION_MIN_FRAMES, raum)
    return { ...c, duration }
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

function legeCaptionsOhneUeberlappung(captions: MoatShortCaption[]): MoatShortCaption[] {
  const sorted = [...captions].sort((a, b) => a.from - b.from || b.text.length - a.text.length)
  const out: MoatShortCaption[] = []
  for (const c of sorted) {
    if (!c.text.trim() || c.duration < 1) continue
    const prev = out[out.length - 1]
    if (prev && c.from <= prev.from) continue
    if (prev && c.from < prev.from + prev.duration) prev.duration = c.from - prev.from
    out.push({
      ...c,
      woerter: c.woerter.map((w) => ({ ...w })),
    })
  }
  for (let i = 0; i < out.length; i++) {
    const c = out[i]!
    const nextFrom = out[i + 1]?.from ?? c.from + c.duration
    c.duration = Math.max(1, nextFrom - c.from)
    const ws = [...c.woerter].sort((a, b) => a.start - b.start || a.end - b.end)
    let cursor = 0
    for (let k = 0; k < ws.length; k++) {
      const w = ws[k]!
      const start = Math.min(Math.max(cursor, w.start), Math.max(0, c.duration - 1))
      const istLetztes = k === ws.length - 1
      const bis = istLetztes ? c.duration : Math.min(Math.max(start + 1, ws[k + 1]!.start), c.duration)
      w.start = start
      w.end = Math.max(start + 1, bis)
      cursor = w.end
    }
    c.woerter = ws
  }
  return out
}

function schliesseTimeline(
  beats: MoatShortBeat[],
  captions: MoatShortCaption[],
  cursor: number,
  voiceTrimFrames: number,
): MoatShortTimeline {
  const durationInFrames = Math.max(1, cursor)
  const saubereCaptions = legeCaptionsOhneUeberlappung(captions)
    .map((c) => ({ ...c, duration: Math.min(c.duration, Math.max(1, durationInFrames - c.from)) }))
    .filter((c) => c.from < durationInFrames && c.duration >= 1)
  return { beats, captions: saubereCaptions, durationInFrames, voiceTrimFrames }
}

export function berechneMoatShortTimeline(props: MoatShortProps): MoatShortTimeline {
  return timelineAusAlignment(props) ?? timelineGeschaetzt(props)
}
