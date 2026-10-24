export const MOAT_SHORT_FPS = 30
export const MOAT_SHORT_WIDTH = 1080
export const MOAT_SHORT_HEIGHT = 1920

export type MoatShortPillarId = 'preissetzungsmacht' | 'replikationsbarriere' | 'wechselkosten' | 'marktdichte'

export type MoatShortVerdict = 'wide' | 'narrow' | 'none'

export type MoatShortProps = {
  ticker: string
  firmenname: string
  logoUrl: string | null
  hook: string
  /** Wert exakt aus dem Export, englisch formatiert (z. B. „71.2%“). */
  metricValue: string
  metricLabel: string
  business: string
  pillars: { id: MoatShortPillarId; label: string; score: number; line: string }[]
  crack: string
  verdict: MoatShortVerdict
  score: number
  closing: string
}

export type MoatShortBeatId = 'hook' | 'business' | 'pillar0' | 'pillar1' | 'pillar2' | 'pillar3' | 'crack' | 'verdict'

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
  logoUrl: null,
  hook: 'One company ships the machines every advanced chip depends on.',
  metricValue: '51.3%',
  metricLabel: 'Gross margin',
  business: 'ASML sells lithography systems that print the smallest features on silicon wafers.',
  pillars: [
    { id: 'preissetzungsmacht', label: 'Pricing power', score: 9, line: 'A fab cannot run without them, so price barely matters.' },
    { id: 'replikationsbarriere', label: 'Hard to copy', score: 10, line: 'Decades of optics and suppliers nobody can rebuild.' },
    { id: 'wechselkosten', label: 'Switching costs', score: 8, line: 'Whole production lines are designed around these tools.' },
    { id: 'marktdichte', label: 'Market control', score: 9, line: 'In EUV there is simply no second supplier.' },
  ],
  crack: 'The risk is not a rival. It is export controls cutting off its biggest customers.',
  verdict: 'wide',
  score: 9,
  closing: 'Wide moat. Nine out of ten.',
}
