/** Props der Composition „AktienAnalyse“ — vollständig, ohne Server-Zugriff renderbar. */
import type {
  LongformAbschnittId,
  LongformChart10k,
  LongformJahresreihe,
  LongformMoat,
  LongformScorecardSpalte,
  LongformSegmente,
  LongformVarianten,
  LongformVisual,
  LongformWort,
} from '../../lib/youtube/longform/longform-types'

export const LONG_FPS = 30
export const LONG_WIDTH = 1920
export const LONG_HEIGHT = 1080

export type LongSatzProps = {
  id: string
  abschnittId: LongformAbschnittId
  text: string
  visual: LongformVisual
  faktIds: string[]
  audioUrl: string | null
  /** Echte Audio-Länge; ohne Take geschätzt aus der Wortzahl. */
  dauerMs: number
  woerter: LongformWort[]
  bildUrl: string | null
  bildArt: 'foto' | 'video' | null
  bildCredit: string | null
}

export type LongMusikTrack = { abschnittId: LongformAbschnittId; src: string; startSek?: number }

export type AktienAnalyseProps = {
  ticker: string
  firmenname: string
  logoUrl: string | null
  /** „Technology · Semiconductors“ — englisch aus Yahoo, kein KI-Text. */
  branche: string | null
  leitfrage: string
  varianten: LongformVarianten
  chart: LongformChart10k | null
  moat: LongformMoat | null
  burggraben: LongformScorecardSpalte | null
  segmente: LongformSegmente | null
  reihen: LongformJahresreihe[]
  /** faktId → englischer Text und Label. */
  fakten: Record<string, { text: string; label: string; wert: number | null }>
  saetze: LongSatzProps[]
  musik: { aktiv: boolean; pegel: number; tracks: LongMusikTrack[] }
  sfx: boolean
  abschnittTitel: Partial<Record<LongformAbschnittId, string>>
  kanalName?: string
  kanalLogoUrl?: string | null
  investiert: boolean | null
}

export const AKTIEN_ANALYSE_DEFAULT_PROPS: AktienAnalyseProps = {
  ticker: 'DEMO',
  firmenname: 'Demo Corp',
  logoUrl: null,
  branche: null,
  leitfrage: 'Is Demo Corp still worth owning?',
  varianten: {
    hookSzene: 'hook_zahl',
    chartStil: 'linie_flaeche',
    moatLayout: 'karten',
    aboPosition: 0.5,
    aboText: 'If this helps, a subscribe keeps these coming.',
    akzent: '#E9B44C',
    kameraSeed: 7,
  },
  chart: null,
  moat: null,
  burggraben: null,
  segmente: null,
  reihen: [],
  fakten: { 'k10.endwert': { text: '$34,210', label: 'Value of $10,000 today', wert: 34210 } },
  saetze: [
    {
      id: 'demo-1',
      abschnittId: 'hook',
      text: 'Ten thousand dollars turned into thirty-four thousand.',
      visual: { szene: 'hook_zahl', betonung: 'thirty-four' },
      faktIds: ['k10.endwert'],
      audioUrl: null,
      dauerMs: 3200,
      woerter: [],
      bildUrl: null,
      bildArt: null,
      bildCredit: null,
    },
  ],
  musik: { aktiv: false, pegel: 50, tracks: [] },
  sfx: false,
  abschnittTitel: {},
  kanalName: 'DailyMoat',
  kanalLogoUrl: '/youtube-longform/dailymoat.jpg',
  investiert: null,
}
