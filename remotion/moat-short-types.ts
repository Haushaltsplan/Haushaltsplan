export const MOAT_SHORT_FPS = 30
export const MOAT_SHORT_WIDTH = 1080
export const MOAT_SHORT_HEIGHT = 1920

export type MoatShortPillarId = 'preissetzungsmacht' | 'replikationsbarriere' | 'wechselkosten' | 'marktdichte'

export type MoatShortVerdict = 'wide' | 'narrow' | 'none'

export type MoatShortStat = { value: string; label: string }

export type MoatShortProps = {
  ticker: string
  firmenname: string
  logoUrl: string | null
  /** Behauptung — beginnt mit Firmenname, enthält metricValue wörtlich. */
  hook: string
  /** Offene Schleife nach dem Hook, wird erst beim Crack aufgelöst. */
  hookLoop: string
  /** Wert exakt aus dem Export, englisch formatiert (z. B. „71.2%“). */
  metricValue: string
  metricLabel: string
  business: string
  pillars: { id: MoatShortPillarId; label: string; score: number; line: string; stat: MoatShortStat | null }[]
  crack: string
  verdict: MoatShortVerdict
  score: number
  /** Offene Brücke in den Hook — kein Schlusssatz, keine Hook-Zahl. */
  closing: string
  /** Pfad relativ zu `public/`, z. B. „youtube-music/track.mp3“. */
  musicSrc: string | null
  /** Linearer Pegel: Katalog-Angleich × Nutzerregler. */
  musicGain: number
  /** Quell-Frames, die übersprungen werden (leises Intro). */
  musicTrim: number
  sfx: boolean
  /** Blob-/Data-URL der ElevenLabs-Stimme; null = stumm, Timeline schätzt. */
  voiceSrc: string | null
  /** Wortzeiten zur Stimme — Bild und Captions folgen diesen Grenzen. */
  voiceAlignment: MoatShortVoiceWort[] | null
}

export type MoatShortVoiceWort = { text: string; startMs: number; endMs: number }

export type MoatShortBeatId =
  | 'hook'
  | 'teaser'
  | 'pillar0'
  | 'pillar1'
  | 'pillar2'
  | 'pillar3'
  | 'crack'
  | 'verdict'
  | 'loop'

export type MoatShortBeat = {
  id: MoatShortBeatId
  text: string
  from: number
  duration: number
}

export type MoatShortCaption = { text: string; from: number; duration: number }

export type MoatShortTimeline = {
  beats: MoatShortBeat[]
  captions: MoatShortCaption[]
  durationInFrames: number
}

export const MOAT_SHORT_DEFAULT_PROPS: MoatShortProps = {
  ticker: 'ASML',
  firmenname: 'ASML Holding',
  logoUrl: 'portfolio-logos/asml.png',
  hook: 'ASML prints a 51.3% margin selling machines nobody else can build.',
  hookLoop: 'The problem is that one thing could still break that lock.',
  metricValue: '51.3%',
  metricLabel: 'Gross margin',
  business: '',
  pillars: [
    {
      id: 'preissetzungsmacht',
      label: 'Pricing power',
      score: 9,
      line: 'Margins barely moved in ten years, just a 2.1 pts swing.',
      stat: { value: '2.1 pts', label: '10y gross margin swing' },
    },
    {
      id: 'replikationsbarriere',
      label: 'Hard to copy',
      score: 10,
      line: 'Rebuilding that optics stack takes decades and endless capital.',
      stat: { value: '28.4%', label: '5-year avg. ROIC' },
    },
    { id: 'wechselkosten', label: 'Switching costs', score: 8, line: 'Ripping a factory off these tools is a nightmare for the buyer.', stat: null },
    { id: 'marktdichte', label: 'Market control', score: 9, line: 'In EUV there is simply no second shop you can call.', stat: null },
  ],
  crack: 'The real risk is export controls cutting off its biggest customers.',
  verdict: 'wide',
  score: 9,
  closing: 'Nobody else can print these chips, which is why',
  musicSrc: null,
  musicGain: 0.5,
  musicTrim: 0,
  sfx: true,
  voiceSrc: null,
  voiceAlignment: null,
}
