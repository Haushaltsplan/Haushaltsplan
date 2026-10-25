/**
 * Musik-Katalog für Moat-Shorts (Dateien in public/youtube-music/).
 * gain ist nur Relativlautstärke zwischen Tracks (1 = am Deckel).
 * Renderer: mit Stimme −24 dB, ohne Stimme −18 dB; Slider 50 % = Deckel.
 */

import type { MoatShortVerdict } from '@/remotion/moat-short-types'

export type MoatShortTrack = {
  datei: string
  titel: string
  stimmung: string
  urteil: MoatShortVerdict
  gain: number
  startSekunden: number
  credit: string | null
}

export type MoatShortTrackQuelle = {
  datei: string
  titel: string
  url: string
}

function kevinMacLeod(titel: string): string {
  return `Music: "${titel}" Kevin MacLeod (incompetech.com)\nLicensed under Creative Commons: By Attribution 4.0 License\nhttp://creativecommons.org/licenses/by/4.0/`
}

function kevinMacLeodUrl(titel: string): string {
  return `https://incompetech.com/music/royalty-free/mp3-royaltyfree/${encodeURIComponent(titel)}.mp3`
}

const KATALOG: Omit<MoatShortTrack, 'credit'>[] = [
  { datei: 'chase-pulse.mp3', titel: 'Chase Pulse', stimmung: 'dark tech pulse', urteil: 'wide', gain: 1, startSekunden: 0 },
  { datei: 'night-break.mp3', titel: 'Night Break', stimmung: 'cinematic tick', urteil: 'narrow', gain: 1, startSekunden: 0 },
  { datei: 'basement-floor.mp3', titel: 'Basement Floor', stimmung: 'tech minimal', urteil: 'none', gain: 0.9, startSekunden: 0 },
]

const STANDARD_GAIN = 1

export const MOAT_SHORT_MUSIK_QUELLEN: MoatShortTrackQuelle[] = KATALOG.map((t) => ({
  datei: t.datei,
  titel: t.titel,
  url: kevinMacLeodUrl(t.titel),
}))

export const MOAT_SHORT_KATALOG_PFADE = KATALOG.map((t) => `youtube-music/${t.datei}`)

export function musikTrack(pfad: string): MoatShortTrack {
  const datei = pfad.split('/').pop() ?? pfad
  const k = KATALOG.find((t) => t.datei === datei)
  if (k) return { ...k, credit: kevinMacLeod(k.titel) }
  return {
    datei,
    titel: datei.replace(/\.[^.]+$/, ''),
    stimmung: 'eigener Track',
    urteil: 'narrow',
    gain: STANDARD_GAIN,
    startSekunden: 0,
    credit: null,
  }
}

/** Erster Katalog-Track zum Urteil, sonst erster vorhandener (Chase Pulse). */
export function trackZumUrteil(urteil: MoatShortVerdict | undefined, pfade: string[]): string | null {
  if (!pfade.length) return null
  const dateien = new Set(pfade.map((p) => p.split('/').pop()))
  const hit = KATALOG.find((t) => t.urteil === urteil && dateien.has(t.datei))
  if (hit) return `youtube-music/${hit.datei}`
  const irgend = KATALOG.find((t) => dateien.has(t.datei))
  return irgend ? `youtube-music/${irgend.datei}` : pfade[0] ?? null
}

/** Katalog-Reihenfolge zuerst, eigene Dateien dahinter. */
export function sortiereTracks(pfade: string[]): string[] {
  const rang = (p: string) => {
    const i = KATALOG.findIndex((t) => p.endsWith(`/${t.datei}`))
    return i < 0 ? KATALOG.length : i
  }
  return [...pfade].sort((a, b) => rang(a) - rang(b) || a.localeCompare(b))
}
