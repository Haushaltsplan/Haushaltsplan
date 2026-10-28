/**
 * Musik-Katalog für Moat-Shorts (Dateien in public/youtube-music/).
 * YouTube Audio Library: Namensnennung ist nicht nötig, der Link kommt trotzdem in die Beschreibung.
 * gain ist nur Relativlautstärke zwischen Tracks (1 = am Deckel).
 * Renderer: mit Stimme −24 dB, ohne Stimme −18 dB; Slider 50 % = Deckel.
 */

import type { MoatShortVerdict } from '@/remotion/moat-short-types'

export type MoatShortTrack = {
  datei: string
  titel: string
  kuenstler: string
  stimmung: string
  urteil: MoatShortVerdict
  gain: number
  startSekunden: number
  link: string
  credit: string | null
}

export type MoatShortTrackQuelle = {
  datei: string
  titel: string
  url: string
}

type KatalogEintrag = Omit<MoatShortTrack, 'credit'>

const KATALOG: KatalogEintrag[] = [
  {
    datei: 'beat-your-competition.mp3',
    titel: 'Beat Your Competition',
    kuenstler: 'Vibe Tracks',
    stimmung: 'drive',
    urteil: 'wide',
    gain: 1,
    startSekunden: 0,
    link: 'https://www.youtube.com/watch?v=yZ-RFT49X9s',
  },
  {
    datei: 'know-myself.mp3',
    titel: 'Know Myself',
    kuenstler: 'Patrick Patrikios',
    stimmung: 'warm',
    urteil: 'narrow',
    gain: 1,
    startSekunden: 0,
    link: 'https://www.youtube.com/watch?v=e7HeKgWpgFE',
  },
  {
    datei: 'brain-trust.mp3',
    titel: 'Brain Trust',
    kuenstler: 'Wayne Jones',
    stimmung: 'cinematic',
    urteil: 'none',
    gain: 1,
    startSekunden: 0,
    link: 'https://www.youtube.com/watch?v=AqweWLFKlTk',
  },
]

const STANDARD_GAIN = 1

function creditFuer(t: Pick<KatalogEintrag, 'titel' | 'kuenstler' | 'link'>): string {
  return `${t.titel} — ${t.kuenstler}\n${t.link}`
}

/** Keine öffentliche MP3-Adresse. Die Dateien kommen aus der Audio Library und liegen lokal. */
export const MOAT_SHORT_MUSIK_QUELLEN: MoatShortTrackQuelle[] = []

export const MOAT_SHORT_KATALOG_PFADE = KATALOG.map((t) => `youtube-music/${t.datei}`)

export function musikTrack(pfad: string): MoatShortTrack {
  const datei = pfad.split('/').pop() ?? pfad
  const k = KATALOG.find((t) => t.datei === datei)
  if (k) return { ...k, credit: creditFuer(k) }
  return {
    datei,
    titel: datei.replace(/\.[^.]+$/, ''),
    kuenstler: '',
    stimmung: 'eigener Track',
    urteil: 'narrow',
    gain: STANDARD_GAIN,
    startSekunden: 0,
    link: '',
    credit: null,
  }
}

/** Erster Katalog-Track zum Urteil, sonst der erste vorhandene. */
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
