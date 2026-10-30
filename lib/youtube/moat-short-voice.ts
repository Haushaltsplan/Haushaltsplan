/** Spoken lines + ElevenLabs-Wortzeiten — client- und servertauglich. */

import type { MoatShortBeatId, MoatShortProps, MoatShortVoiceWort } from '@/remotion/moat-short-types'

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

/**
 * Regie nur für die Stimme. Untertitel bleiben der geschriebene Satz.
 * Gedankenstrich = kurze Pause vor der Zahl. Ausrufezeichen hebt die Zahl an.
 */
export function regieFuerElevenLabs<T extends string>(zeilen: ShortSprechzeile<T>[]): ShortSprechzeile<T>[] {
  return zeilen.map((z) => ({ ...z, text: regieZeile(String(z.id), z.text) }))
}

function regieZeile(id: string, text: string): string {
  const t = text.replace(/\s+/g, ' ').trim()
  if (id === 'proof') return regieBeweis(t)
  if (id === 'verdict' && /\bno moat\b/i.test(t)) return t.replace(/no moat[.!]?/i, 'no moat!')
  return t
}

function regieBeweis(text: string): string {
  let t = text
  if (!t.includes('—')) {
    const mitPause = t.replace(/\s+(an?\s+\d)/i, ' — $1')
    if (mitPause !== t) t = mitPause
  }
  if (/\.$/.test(t)) return `${t.slice(0, -1)}!`
  if (!/[!?]$/.test(t)) return `${t}!`
  return t
}

export function moatShortSprechFingerprint(
  props: Pick<MoatShortProps, 'hook' | 'proof' | 'hookLoop' | 'pillars' | 'crack' | 'closing'>,
): string {
  return moatShortSprechtext(moatShortSprechzeilen(props))
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

type PaarSchritt = 'diag' | 'zwei' | 'script' | 'audio'

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
