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
  /** Behauptung — steht als Überschrift im Bild, enthält metricValue wörtlich. */
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
  closing: string
  /** Pfad relativ zu `public/`, z. B. „youtube-music/track.mp3“. */
  musicSrc: string | null
  /** Linearer Pegel, gleicht Tracks untereinander an. */
  musicGain: number
  /** Quell-Frames, die übersprungen werden (leises Intro). */
  musicTrim: number
  sfx: boolean
}

export type MoatShortBeatId =
  | 'hook'
  | 'teaser'
  | 'business'
  | 'pillar0'
  | 'pillar1'
  | 'pillar2'
  | 'pillar3'
  | 'crack'
  | 'verdict'

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
  hook: 'At 51.3% gross margin, ASML sells machines nobody else can build.',
  hookLoop: 'But one thing could still break it.',
  metricValue: '51.3%',
  metricLabel: 'Gross margin',
  business: 'ASML sells lithography systems that print the smallest features on silicon wafers.',
  pillars: [
    {
      id: 'preissetzungsmacht',
      label: 'Pricing power',
      score: 9,
      line: 'Margins barely moved in ten years: a 2.1 pts swing.',
      stat: { value: '2.1 pts', label: '10y gross margin swing' },
    },
    {
      id: 'replikationsbarriere',
      label: 'Hard to copy',
      score: 10,
      line: 'Decades of optics and suppliers nobody can rebuild.',
      stat: { value: '28.4%', label: '5-year avg. ROIC' },
    },
    { id: 'wechselkosten', label: 'Switching costs', score: 8, line: 'Whole production lines are designed around these tools.', stat: null },
    { id: 'marktdichte', label: 'Market control', score: 9, line: 'In EUV there is simply no second supplier.', stat: null },
  ],
  crack: 'The risk is not a rival. It is export controls cutting off its biggest customers.',
  verdict: 'wide',
  score: 9,
  closing: 'Wide moat. 9 out of 10.',
  musicSrc: null,
  musicGain: 0.5,
  musicTrim: 0,
  sfx: true,
}
