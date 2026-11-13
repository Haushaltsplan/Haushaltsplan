/** Spoken lines + ElevenLabs-Wortzeiten — client- und servertauglich. */

import type { MoatShortBeatId, MoatShortProps, MoatShortVoiceWort } from '@/remotion/moat-short-types'
import { ziffernImText } from '@/lib/youtube/moat-caption'
import { flussZurZahl } from '@/lib/youtube/moat-short-script'

export type MoatShortSprechzeile = { id: Exclude<MoatShortBeatId, 'loop'>; text: string }

export type ShortSprechzeile<T extends string = string> = { id: T; text: string }

const PILLAR_IDS = ['pillar0', 'pillar1', 'pillar2', 'pillar3'] as const

export function moatShortSprechzeilen(
  props: Pick<MoatShortProps, 'hook' | 'proof' | 'hookLoop' | 'pillars' | 'crack' | 'closing'>,
): MoatShortSprechzeile[] {
  const zeilen: MoatShortSprechzeile[] = [
    { id: 'hook', text: props.hook },
    { id: 'proof', text: props.proof },
    ...props.pillars.slice(0, 4).map((p, i) => ({
      id: PILLAR_IDS[i] ?? 'pillar0',
      text: p.line,
    })),
    { id: 'crack', text: props.crack },
    { id: 'verdict', text: props.closing },
  ]
  return zeilen.filter((z) => z.text.trim())
}

export function moatShortSprechtext(zeilen: ShortSprechzeile[]): string {
  return zeilen.map((z) => z.text.trim()).join('\n')
}

export type StimmeRegie = { pause: number; betonung: number }

/** 0 aus, bis 40 Komma, bis 70 Gedankenstrich, darüber eine längere Pause. */
export function pauseZeichen(pause: number): string {
  if (pause <= 0) return ''
  if (pause < 41) return ', '
  if (pause < 71) return ' — '
  return ' — … '
}

/**
 * Regie nur für die Stimme. Untertitel bleiben der geschriebene Satz.
 * Vor der Kennzahl steht kein Satzzeichen. Die Betonung setzt höchstens ein Ausrufezeichen ans Ende.
 */
export function regieFuerElevenLabs<T extends string>(
  zeilen: ShortSprechzeile<T>[],
  regie: StimmeRegie = { pause: 50, betonung: 100 },
): ShortSprechzeile<T>[] {
  return zeilen.map((z) => ({ ...z, text: regieZeile(String(z.id), z.text, regie) }))
}

function regieZeile(id: string, text: string, regie: StimmeRegie): string {
  const t = text.replace(/\s+/g, ' ').trim()
  if (id === 'proof') return regieBeweis(t, regie)
  if (regie.betonung > 0 && id === 'verdict' && /\bno moat\b/i.test(t)) return t.replace(/no moat[.!]?/i, 'no moat!')
  return t
}

function regieBeweis(text: string, regie: StimmeRegie): string {
  const t = flussZurZahl(text)
  if (regie.betonung <= 0) return t
  if (/\.$/.test(t)) return `${t.slice(0, -1)}!`
  if (!/[!?]$/.test(t)) return `${t}!`
  return t
}

export function moatShortSprechFingerprint(
  props: Pick<MoatShortProps, 'hook' | 'proof' | 'hookLoop' | 'pillars' | 'crack' | 'closing'>,
): string {
  return moatShortSprechtext(moatShortSprechzeilen(props))
}

export type StimmeRegler = {
  stabilitaet: number
  aehnlichkeit: number
  stil: number
  /** ElevenLabs speed, 0,70–1,20. */
  tempo: number
  pause: number
  betonung: number
}

export const STIMME_REGLER_STANDARD: StimmeRegler = {
  stabilitaet: 40,
  aehnlichkeit: 80,
  stil: 20,
  tempo: 1.15,
  pause: 50,
  betonung: 100,
}

const STIMME_REGLER_KEYS: Record<keyof StimmeRegler, string> = {
  stabilitaet: 'moat-short-stimme-stabilitaet',
  aehnlichkeit: 'moat-short-stimme-aehnlichkeit',
  stil: 'moat-short-stimme-stil',
  tempo: 'moat-short-stimme-tempo',
  pause: 'moat-short-stimme-pause',
  betonung: 'moat-short-stimme-betonung',
}

function reglerZahl(roh: string | null, standard: number): number {
  if (roh == null || roh.trim() === '') return standard
  const n = Number(roh)
  if (!Number.isFinite(n)) return standard
  return Math.max(0, Math.min(100, Math.round(n)))
}

/** 1,15 bleibt 1,15. Werte über 3 sind die Balkenstellung 70–120. */
export function tempoAusRegler(roh: string | number | null, standard = STIMME_REGLER_STANDARD.tempo): number {
  if (roh == null || (typeof roh === 'string' && roh.trim() === '')) return standard
  const n = typeof roh === 'number' ? roh : Number(roh)
  if (!Number.isFinite(n)) return standard
  const wert = n > 3 ? n / 100 : n
  return Math.min(1.2, Math.max(0.7, Math.round(wert * 100) / 100))
}

/** 0 bleibt 0. Fehlt der Eintrag, gilt der Standard. */
export function gespeicherteStimmeRegler(): StimmeRegler {
  if (typeof window === 'undefined') return { ...STIMME_REGLER_STANDARD }
  return {
    stabilitaet: reglerZahl(window.localStorage.getItem(STIMME_REGLER_KEYS.stabilitaet), STIMME_REGLER_STANDARD.stabilitaet),
    aehnlichkeit: reglerZahl(window.localStorage.getItem(STIMME_REGLER_KEYS.aehnlichkeit), STIMME_REGLER_STANDARD.aehnlichkeit),
    stil: reglerZahl(window.localStorage.getItem(STIMME_REGLER_KEYS.stil), STIMME_REGLER_STANDARD.stil),
    tempo: tempoAusRegler(window.localStorage.getItem(STIMME_REGLER_KEYS.tempo)),
    pause: reglerZahl(window.localStorage.getItem(STIMME_REGLER_KEYS.pause), STIMME_REGLER_STANDARD.pause),
    betonung: reglerZahl(window.localStorage.getItem(STIMME_REGLER_KEYS.betonung), STIMME_REGLER_STANDARD.betonung),
  }
}

export function speichereStimmeRegler(teil: keyof StimmeRegler, wert: number): void {
  if (typeof window === 'undefined') return
  const gespeichert = teil === 'tempo' ? tempoAusRegler(wert) : reglerZahl(String(wert), STIMME_REGLER_STANDARD[teil])
  window.localStorage.setItem(STIMME_REGLER_KEYS[teil], String(gespeichert))
}

export function woerterAusZeichen(
  characters: string[],
  starts: number[],
  ends: number[],
): MoatShortVoiceWort[] {
  const out: MoatShortVoiceWort[] = []
  let buf = ''
  let start = 0
  let end = 0
  const flush = () => {
    const text = buf.trim()
    if (text) out.push({ text, startMs: Math.round(start * 1000), endMs: Math.round(end * 1000) })
    buf = ''
  }
  for (let i = 0; i < characters.length; i++) {
    const ch = characters[i] ?? ''
    const s = Number(starts[i])
    const e = Number(ends[i])
    if (!Number.isFinite(s) || !Number.isFinite(e)) continue
    if (/\s/.test(ch)) {
      flush()
      continue
    }
    if (!buf) start = s
    buf += ch
    end = e
  }
  flush()
  return out
}

function normWort(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9.%]/g, '')
}

function locker(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '')
}

type PaarSchritt = 'diag' | 'zwei' | 'script' | 'audio' | 'zahl'

function audioIstZiffer(scriptWort: string, audioWorte: string[]): boolean {
  const ziel = locker(scriptWort)
  if (!/\d/.test(ziel)) return false
  return locker(ziffernImText(audioWorte.join(' '))) === ziel
}

function spanneFuerZiffer(scriptWort: string, audio: MoatShortVoiceWort[], j: number): number {
  let treffer = 0
  const bis = Math.min(6, j)
  for (let s = 2; s <= bis; s++) {
    if (audioIstZiffer(scriptWort, audio.slice(j - s, j).map((w) => w.text))) treffer = s
  }
  return treffer
}

/**
 * Hängt die gesprochenen Zeiten an die aktuellen Wörter.
 * Ein ersetztes Wort behält das Zeitfenster des gesprochenen Wortes.
 * Zwei Audio-Wörter, die zusammen ein Bindestrich-Wort sind, werden zusammengefasst.
 * Ohne diese Zuordnung fiel die Timeline auf eine Schätzung zurück und lief aus dem Takt.
 */
function zeitenFuerScript(script: string[], audio: MoatShortVoiceWort[]): { startMs: number; endMs: number }[] {
  const n = script.length
  const m = audio.length
  const INF = 1_000_000
  const dp: number[][] = Array.from({ length: n + 1 }, () => Array(m + 1).fill(INF))
  const weg: PaarSchritt[][] = Array.from({ length: n + 1 }, () => Array<PaarSchritt>(m + 1).fill('diag'))
  const span: number[][] = Array.from({ length: n + 1 }, () => Array<number>(m + 1).fill(0))
  dp[0][0] = 0
  for (let i = 1; i <= n; i++) {
    dp[i][0] = i * 2
    weg[i][0] = 'script'
  }
  for (let j = 1; j <= m; j++) {
    dp[0][j] = j * 2
    weg[0][j] = 'audio'
  }
  for (let i = 1; i <= n; i++) {
    const soll = locker(script[i - 1] ?? '')
    for (let j = 1; j <= m; j++) {
      const ist = locker(audio[j - 1]?.text ?? '')
      const diag = dp[i - 1]![j - 1]! + (soll && soll === ist ? 0 : 3)
      let best = diag
      let schritt: PaarSchritt = 'diag'
      const oben = dp[i - 1]![j]! + 2
      if (oben < best) {
        best = oben
        schritt = 'script'
      }
      const links = dp[i]![j - 1]! + 2
      if (links < best) {
        best = links
        schritt = 'audio'
      }
      if (j >= 2) {
        const beide = locker(audio[j - 2]?.text ?? '') + ist
        if (soll && beide === soll) {
          const kosten = dp[i - 1]![j - 2]!
          if (kosten < best) {
            best = kosten
            schritt = 'zwei'
          }
        }
        const zahlSpan = spanneFuerZiffer(script[i - 1] ?? '', audio, j)
        if (zahlSpan >= 2) {
          const kosten = dp[i - 1]![j - zahlSpan]!
          if (kosten < best) {
            best = kosten
            schritt = 'zahl'
            span[i]![j] = zahlSpan
          }
        }
      }
      dp[i]![j] = best
      weg[i]![j] = schritt
    }
  }

  const roh: ({ startMs: number; endMs: number } | null)[] = Array(n).fill(null)
  let i = n
  let j = m
  while (i > 0 || j > 0) {
    const schritt: PaarSchritt = i === 0 ? 'audio' : j === 0 ? 'script' : weg[i]![j]!
    if (schritt === 'diag' && i > 0 && j > 0) {
      roh[i - 1] = { startMs: audio[j - 1]!.startMs, endMs: audio[j - 1]!.endMs }
      i -= 1
      j -= 1
    } else if (schritt === 'zwei' && i > 0 && j >= 2) {
      roh[i - 1] = { startMs: audio[j - 2]!.startMs, endMs: audio[j - 1]!.endMs }
      i -= 1
      j -= 2
    } else if (schritt === 'zahl' && i > 0) {
      const s = Math.max(2, span[i]![j]!)
      roh[i - 1] = { startMs: audio[j - s]!.startMs, endMs: audio[j - 1]!.endMs }
      i -= 1
      j -= s
    } else if (schritt === 'script' && i > 0) {
      i -= 1
    } else if (j > 0) {
      j -= 1
    } else {
      break
    }
  }

  const zeiten = roh.map((z) => (z ? { ...z } : null))
  let k = 0
  while (k < n) {
    if (zeiten[k]) {
      k += 1
      continue
    }
    const von = k
    while (k < n && !zeiten[k]) k += 1
    const bis = k
    const davor = von > 0 ? zeiten[von - 1] : null
    const danach = bis < n ? zeiten[bis] : null
    const start = davor?.endMs ?? 0
    const ende = danach?.startMs ?? start + 180 * (bis - von)
    const anzahl = bis - von
    const spanne = Math.max(anzahl, ende - start)
    for (let t = 0; t < anzahl; t++) {
      const a = Math.round(start + (spanne * t) / anzahl)
      const b = Math.round(start + (spanne * (t + 1)) / anzahl)
      zeiten[von + t] = { startMs: a, endMs: Math.max(a + 1, b) }
    }
  }
  for (let k = 0; k < n; k++) {
    const z = zeiten[k]!
    if (z.endMs <= z.startMs) z.endMs = z.startMs + 1
  }
  return zeiten.map((z) => z!)
}

export function sprechzeilenMitZeiten<T extends string>(
  zeilen: ShortSprechzeile<T>[],
  woerter: MoatShortVoiceWort[],
): Map<T, MoatShortVoiceWort[]> | null {
  if (!woerter.length) return null
  const script: { id: T; text: string }[] = []
  for (const z of zeilen) {
    for (const text of z.text.trim().split(/\s+/).filter(Boolean)) {
      if (!locker(text)) continue
      script.push({ id: z.id, text })
    }
  }
  if (!script.length) return null
  const zeiten = zeitenFuerScript(
    script.map((s) => s.text),
    woerter,
  )
  const map = new Map<T, MoatShortVoiceWort[]>()
  script.forEach((s, i) => {
    const zeit = zeiten[i]!
    const liste = map.get(s.id) ?? []
    liste.push({ text: s.text, startMs: zeit.startMs, endMs: zeit.endMs })
    map.set(s.id, liste)
  })
  for (const z of zeilen) {
    if (z.text.trim() && !map.get(z.id)?.length) return null
  }
  return map
}
