/** Sätze mit Audio-Dauern → Frames, Szenenblöcke, Zwischentitel, Sprechpausen, Abo-Einblendung. */
import type { LongformAbschnittId } from '../../lib/youtube/longform/longform-types'
import { LONG_FPS, type AktienAnalyseProps, type LongSatzProps } from './long-types'

export type LongFamilie = 'hook' | 'chart' | 'moat' | 'bild' | 'titel' | 'reihe' | 'karte' | 'kapitel'

export type LongSatzZeit = {
  index: number
  from: number
  /** Frames mit Stimme. */
  dauer: number
  betonungFrame: number | null
  /** Absolute Frames der gesprochenen Wörter. */
  woerter: { text: string; from: number; bis: number }[]
}

export type LongBlock = {
  familie: LongFamilie
  abschnittId: LongformAbschnittId
  from: number
  dauer: number
  saetze: number[]
}

export type LongBumper = { abschnittId: LongformAbschnittId; from: number; dauer: number; nummer: number }

export type LongTimeline = {
  durationInFrames: number
  saetze: LongSatzZeit[]
  bloecke: LongBlock[]
  bumper: LongBumper[]
  abschnitte: { id: LongformAbschnittId; from: number; bis: number }[]
  sprechen: [number, number][]
  abo: { from: number; dauer: number } | null
  disclosure: { from: number; dauer: number } | null
}

/** Wenig Luft vor dem ersten Wort — Cold Open soll sofort sitzen. */
const VORLAUF = 3
/** Keine Extra-Pause. Die Kapitelkarte ist die einzige Lücke. */
const LUECKE = 0
/** Kapitelkarte 1,5 Sekunden, mit Ein- und Ausblendung und Standzeit dazwischen. */
const BUMPER = 45
const MINUTE_4 = 4 * 60 * LONG_FPS
const MINUTE_5 = 5 * 60 * LONG_FPS
export const LONG_ABSPANN = 75
export const LONG_ABO_DAUER = 150

export function familieVon(s: LongSatzProps): LongFamilie {
  const sz = s.visual.szene
  if (sz.startsWith('hook_')) return 'hook'
  if (sz.startsWith('chart_')) return 'chart'
  if (sz.startsWith('moat_')) return 'moat'
  if (sz === 'zahl_reihe') return 'reihe'
  if (sz === 'inhaber_anteile' || sz === 'bewertung_zahl' || sz === 'risiko_karte' || sz === 'scorecard_spalten' || sz === 'fazit_antwort') return 'kapitel'
  if (sz === 'titel_karte') return 'titel'
  if (sz === 'abo_karte' || sz === 'disclaimer' || sz === 'schluss') return 'karte'
  return 'bild'
}

export function geschaetzteDauerMs(text: string): number {
  const woerter = text.trim().split(/\s+/).filter(Boolean).length
  // ~155 WPM + knappes Polster — näher an ElevenLabs-Tempo, weniger Fake-Pause in der Vorschau.
  return Math.round((woerter / 2.6) * 1000 + 180)
}

const norm = (w: string) => w.toLowerCase().replace(/[^a-z0-9$%.]/g, '')

function betonungInFrames(s: LongSatzProps, dauer: number): number | null {
  const b = s.visual.betonung?.trim()
  if (!b) return null
  const ziel = norm(b.split(/\s+/)[0] ?? '')
  if (!ziel) return null
  if (s.woerter.length) {
    const w = s.woerter.find((x) => norm(x.text).startsWith(ziel))
    return w ? Math.round((w.startMs / 1000) * LONG_FPS) : null
  }
  const i = s.text.toLowerCase().indexOf(b.toLowerCase())
  return i < 0 ? null : Math.round((i / Math.max(1, s.text.length)) * dauer)
}

export function berechneLongTimeline(p: AktienAnalyseProps): LongTimeline {
  const saetze: LongSatzZeit[] = []
  const bumper: LongBumper[] = []
  const abschnitte: LongTimeline['abschnitte'] = []
  const sprechen: [number, number][] = []
  let f = VORLAUF
  let aktuell: LongformAbschnittId | null = null
  let nummer = 0

  p.saetze.forEach((s, index) => {
    if (s.abschnittId !== aktuell) {
      if (abschnitte.length) abschnitte[abschnitte.length - 1]!.bis = f
      aktuell = s.abschnittId
      if (s.abschnittId !== 'hook') {
        nummer += 1
        bumper.push({ abschnittId: s.abschnittId, from: f, dauer: BUMPER, nummer })
        abschnitte.push({ id: s.abschnittId, from: f, bis: f })
        f += BUMPER
      } else {
        abschnitte.push({ id: s.abschnittId, from: 0, bis: f })
      }
    }
    const dauer = satzDauerFrames(s)
    const bf = betonungInFrames(s, dauer)
    saetze.push({
      index,
      from: f,
      dauer,
      betonungFrame: bf != null ? f + bf : null,
      woerter: s.woerter.map((w) => ({
        text: w.text,
        from: f + Math.round((w.startMs / 1000) * LONG_FPS),
        bis: f + Math.max(Math.round((w.startMs / 1000) * LONG_FPS) + 1, Math.round((w.endMs / 1000) * LONG_FPS)),
      })),
    })
    sprechen.push([f, f + dauer])
    const naechster = p.saetze[index + 1]
    f += dauer + (naechster && naechster.abschnittId === s.abschnittId ? 0 : LUECKE)
  })
  if (abschnitte.length) abschnitte[abschnitte.length - 1]!.bis = f
  const disclosure = null
  const durationInFrames = Math.max(LONG_FPS * 3, f + LONG_ABSPANN)

  const bloecke: LongBlock[] = []
  for (const z of saetze) {
    const s = p.saetze[z.index]!
    const fam = familieVon(s)
    const letzter = bloecke[bloecke.length - 1]
    const vorher = letzter ? p.saetze[letzter.saetze[letzter.saetze.length - 1]!]! : null
    const moatBruch =
      fam === 'moat' &&
      vorher != null &&
      (vorher.visual.szene !== s.visual.szene ||
        s.visual.szene === 'moat_finanzen' ||
        (s.visual.szene === 'moat_pfeiler' && (vorher.visual.fokus ?? '') !== (s.visual.fokus ?? '')))
    const gleich =
      letzter &&
      letzter.familie === fam &&
      letzter.abschnittId === s.abschnittId &&
      !moatBruch &&
      fam !== 'titel' &&
      (fam !== 'bild' || (vorher?.bildUrl ?? null) === (s.bildUrl ?? null))
    if (gleich) {
      letzter.saetze.push(z.index)
    } else {
      bloecke.push({ familie: fam, abschnittId: s.abschnittId, from: z.from, dauer: 0, saetze: [z.index] })
    }
  }
  bloecke.forEach((b, i) => {
    const naechster = bloecke[i + 1]
    const ende = naechster ? (bumper.find((x) => x.from >= b.from && x.from < naechster.from)?.from ?? naechster.from) : durationInFrames
    b.dauer = Math.max(1, ende - b.from)
  })
  // Erster Block beginnt bei Frame 0, damit kein Schwarzbild entsteht.
  if (bloecke[0]) {
    bloecke[0].dauer += bloecke[0].from
    bloecke[0].from = 0
  }

  const versatz = p.filmStartFrame
  const grenze =
    versatz != null && versatz < 0
      ? undefined
      : saetze.find((z, i) => {
          if (versatz == null && i === 0) return false
          const abs = z.from + (versatz ?? 0)
          return abs >= MINUTE_4 && abs < MINUTE_5
        })
  const abo = grenze ? { from: grenze.from, dauer: LONG_ABO_DAUER } : null

  return { durationInFrames, saetze, bloecke, bumper, abschnitte, sprechen, abo, disclosure }
}

/** Volle Datei, wenn die Länge bekannt ist. Alte Takes enden am letzten Wort und bekommen den Ausklang dazu. */
function satzDauerFrames(s: LongSatzProps): number {
  const ms = s.dauerMs > 0 ? s.dauerMs : geschaetzteDauerMs(s.text)
  const letztesEnde = s.woerter.reduce((m, w) => Math.max(m, w.endMs), 0)
  const abgeschnitten = Boolean(s.audioUrl) && letztesEnde > 0 && ms <= letztesEnde + 90
  const gesamt = abgeschnitten ? letztesEnde + 280 : ms
  return Math.max(18, Math.ceil((gesamt / 1000) * LONG_FPS))
}
