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

export function gespeicherterMusikPegel(): number | null {
  if (typeof window === 'undefined') return null
  const roh = window.localStorage.getItem('moat-short-musik-pegel')
  if (roh == null || roh.trim() === '') return null
  const n = Number(roh)
  if (!Number.isFinite(n)) return null
  return Math.max(0, Math.min(100, n))
}

export function liesMusikDatei(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (file.size > 12_000_000) {
      reject(new Error('MP3 ist größer als 12 MB.'))
      return
    }
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('MP3 nicht lesbar'))
    reader.readAsDataURL(file)
  })
}

/** API-Liste, und für jede Katalogdatei ein direkter Blick in public/youtube-music. */
export async function ladeVorhandeneTracks(): Promise<string[]> {
  let ausApi: string[] = []
  try {
    const res = await fetch('/api/youtube/musik', { cache: 'no-store' })
    if (res.ok) {
      const j = (await res.json()) as { tracks?: string[] }
      ausApi = Array.isArray(j.tracks) ? j.tracks : []
    }
  } catch {
    ausApi = []
  }
  const haben = new Set(ausApi.map((p) => p.split('/').pop()))
  const rest = await Promise.all(
    KATALOG.map(async (t) => {
      if (haben.has(t.datei)) return null
      try {
        const url = `/youtube-music/${encodeURIComponent(t.datei)}`
        const head = await fetch(url, { method: 'HEAD', cache: 'no-store' })
        if (head.ok) return `youtube-music/${t.datei}`
        if (head.status === 404) return null
        const res = await fetch(url, { method: 'GET', headers: { Range: 'bytes=0-1' }, cache: 'no-store' })
        void res.body?.cancel()
        if (res.ok || res.status === 206) return `youtube-music/${t.datei}`
      } catch {
        return null
      }
      return null
    }),
  )
  return sortiereTracks([...ausApi, ...rest.filter((p): p is string => Boolean(p))])
}

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
