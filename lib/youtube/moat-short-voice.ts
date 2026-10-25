/** Spoken lines + ElevenLabs-Wortzeiten — client- und servertauglich. */

import type { MoatShortBeatId, MoatShortProps, MoatShortVoiceWort } from '@/remotion/moat-short-types'

export type MoatShortSprechzeile = { id: Exclude<MoatShortBeatId, 'loop'>; text: string }

const PILLAR_IDS = ['pillar0', 'pillar1', 'pillar2', 'pillar3'] as const

export function moatShortSprechzeilen(props: Pick<MoatShortProps, 'hook' | 'hookLoop' | 'business' | 'pillars' | 'crack' | 'closing'>): MoatShortSprechzeile[] {
  const zeilen: MoatShortSprechzeile[] = [
    { id: 'hook', text: props.hook },
    { id: 'teaser', text: props.hookLoop },
    { id: 'business', text: props.business },
    ...props.pillars.slice(0, 4).map((p, i) => ({
      id: PILLAR_IDS[i] ?? 'pillar0',
      text: p.line,
    })),
    { id: 'crack', text: props.crack },
    { id: 'verdict', text: props.closing },
  ]
  return zeilen.filter((z) => z.text.trim())
}

export function moatShortSprechtext(zeilen: MoatShortSprechzeile[]): string {
  return zeilen.map((z) => z.text.trim()).join('\n')
}

export function moatShortSprechFingerprint(props: Pick<MoatShortProps, 'hook' | 'hookLoop' | 'business' | 'pillars' | 'crack' | 'closing'>): string {
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

export function sprechzeilenMitZeiten(
  zeilen: MoatShortSprechzeile[],
  woerter: MoatShortVoiceWort[],
): Map<MoatShortSprechzeile['id'], MoatShortVoiceWort[]> | null {
  if (!woerter.length) return null
  const map = new Map<MoatShortSprechzeile['id'], MoatShortVoiceWort[]>()
  let i = 0
  for (const z of zeilen) {
    const erwartet = z.text.trim().split(/\s+/).filter(Boolean)
    const treffer: MoatShortVoiceWort[] = []
    for (const roh of erwartet) {
      const n = normWort(roh)
      if (!n) continue
      let gefunden = -1
      const limit = Math.min(woerter.length, i + 4)
      for (let k = i; k < limit; k++) {
        if (normWort(woerter[k]!.text) === n) {
          gefunden = k
          break
        }
      }
      if (gefunden < 0) {
        for (let k = i; k < Math.min(woerter.length, i + 12); k++) {
          if (normWort(woerter[k]!.text) === n) {
            gefunden = k
            break
          }
        }
      }
      if (gefunden < 0) return null
      treffer.push(woerter[gefunden]!)
      i = gefunden + 1
    }
    if (!treffer.length) return null
    map.set(z.id, treffer)
  }
  return map
}
