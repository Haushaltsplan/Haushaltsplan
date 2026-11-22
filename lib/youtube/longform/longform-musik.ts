/** Musik-Bibliothek fürs Long-Form: Stimmung pro Abschnitt, Auswahl per Seed. Client und Server. */
import type { LongformAbschnittId } from '@/lib/youtube/longform/longform-types'

export const LONGFORM_MUSIK_STIMMUNGEN = ['spannung', 'treibend', 'nachdenklich', 'warm', 'ernst'] as const
export type LongformMusikStimmung = (typeof LONGFORM_MUSIK_STIMMUNGEN)[number]

export type LongformMusikTrack = {
  id: string
  /** Pfad unter public/, z. B. „youtube-music/long/xyz.mp3“. */
  datei: string
  stimmung: LongformMusikStimmung
  sekunden: number | null
}

export const LONGFORM_MUSIK_KATALOG_PFAD = 'youtube-music/long/katalog.json'

/** Vorhandene Short-Tracks, solange die Eleven-Music-Bibliothek noch nicht erzeugt wurde. */
export const LONGFORM_MUSIK_FALLBACK: LongformMusikTrack[] = [
  { id: 'brain-trust', datei: 'youtube-music/brain-trust.mp3', stimmung: 'nachdenklich', sekunden: null },
  { id: 'beat-your-competition', datei: 'youtube-music/beat-your-competition.mp3', stimmung: 'treibend', sekunden: null },
  { id: 'know-myself', datei: 'youtube-music/know-myself.mp3', stimmung: 'warm', sekunden: null },
]

export const ABSCHNITT_STIMMUNG: Record<LongformAbschnittId, LongformMusikStimmung[]> = {
  hook: ['spannung', 'treibend'],
  chart10k: ['treibend', 'warm'],
  geschaeft: ['warm', 'nachdenklich'],
  burggraben: ['nachdenklich', 'warm'],
  inhaber: ['nachdenklich', 'ernst'],
  zahlen: ['treibend', 'nachdenklich'],
  bewertung: ['nachdenklich', 'ernst'],
  risiken: ['ernst', 'spannung'],
  scorecard: ['treibend', 'warm'],
  fazit: ['warm', 'nachdenklich'],
}

/** Pro Abschnitt ein Track; derselbe Track läuft über benachbarte Abschnitte weiter, wenn die Stimmung passt. */
export function waehleMusik(
  katalog: LongformMusikTrack[],
  abschnitte: LongformAbschnittId[],
  seed: number,
): { abschnittId: LongformAbschnittId; src: string }[] {
  if (!katalog.length) return []
  const liste = katalog
  const out: { abschnittId: LongformAbschnittId; src: string }[] = []
  let vorher: LongformMusikTrack | null = null
  abschnitte.forEach((a, k) => {
    const wunsch = ABSCHNITT_STIMMUNG[a]
    if (vorher && wunsch.includes(vorher.stimmung) && k % 3 !== 0) {
      out.push({ abschnittId: a, src: `/${vorher.datei}` })
      return
    }
    const passend = liste.filter((t) => wunsch.includes(t.stimmung) && t.id !== vorher?.id)
    const pool = passend.length ? passend : liste.filter((t) => t.id !== vorher?.id)
    const t = (pool.length ? pool : liste)[(seed + k * 7) % (pool.length || liste.length)]!
    vorher = t
    out.push({ abschnittId: a, src: `/${t.datei}` })
  })
  return out
}
