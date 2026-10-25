export const EARNINGS_SHORT_FPS = 30
export const EARNINGS_SHORT_WIDTH = 1080
export const EARNINGS_SHORT_HEIGHT = 1920

export type EarningsShortBeatArt = 'beat' | 'miss' | 'inline'

export type EarningsShortKarte = {
  label: string
  ist: string
  schaetzung: string
  anzeige: string
}

export type EarningsShortVoiceWort = { text: string; startMs: number; endMs: number }

export type EarningsShortProps = {
  ticker: string
  firmenname: string
  logoUrl: string | null
  quartalLabel: string
  hook: string
  metricValue: string
  metricLabel: string
  numbers: string
  eps: EarningsShortKarte
  umsatz: EarningsShortKarte
  call0: string
  call1: string
  filing: string
  takeaway: string
  beat: EarningsShortBeatArt
  musicSrc: string | null
  musicGain: number
  musicTrim: number
  sfx: boolean
  voiceSrc: string | null
  voiceAlignment: EarningsShortVoiceWort[] | null
}

export type EarningsShortBeatId = 'hook' | 'numbers' | 'call0' | 'call1' | 'filing' | 'takeaway' | 'loop'

export type EarningsShortBeat = {
  id: EarningsShortBeatId
  text: string
  from: number
  duration: number
}

export type EarningsShortCaption = { text: string; from: number; duration: number }

export type EarningsShortTimeline = {
  beats: EarningsShortBeat[]
  captions: EarningsShortCaption[]
  durationInFrames: number
}

export const EARNINGS_SHORT_DEFAULT_PROPS: EarningsShortProps = {
  ticker: 'NVDA',
  firmenname: 'NVIDIA',
  logoUrl: null,
  quartalLabel: 'Q2 FY26',
  hook: 'NVIDIA prints a 4.2% EPS beat on 46.7 billion of data-center demand.',
  metricValue: '+4.2%',
  metricLabel: 'EPS surprise',
  numbers: 'EPS landed at 1.05 versus 1.01, and revenue came in at 46.7 billion versus 46.0.',
  eps: { label: 'EPS', ist: '1.05', schaetzung: '1.01', anzeige: 'Beat +4.2%' },
  umsatz: { label: 'Revenue', ist: '46.7B', schaetzung: '46.0B', anzeige: 'Beat +1.5%' },
  call0: 'Management said Blackwell ramps stay sold out through the next two quarters. The backlog is still the story, not the print on the quarter.',
  call1: 'China export limits still cap a slice of the data-center book. They called it a constraint, not a demand problem.',
  filing: 'The 10-Q shows inventory rose as they build the next GPU stack, which matches the sold-out ramp they described on the call.',
  takeaway: 'The call is about the backlog, not the print, which is why',
  beat: 'beat',
  musicSrc: null,
  musicGain: 0.5,
  musicTrim: 0,
  sfx: true,
  voiceSrc: null,
  voiceAlignment: null,
}
