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
  /** Blickfang, 2–5 Wörter, nur Bild, nicht gesprochen. */
  kicker: string
  /** Frage in Sekunde 0. Ohne Kennzahl. */
  hook: string
  /** Die Kennzahl als Antwort, gesprochen ab Sekunde 3. */
  proof: string
  /** Offene Schleife nach der Antwort, wird erst beim Crack aufgelöst. */
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
  /** Millisekunden bis zum ersten Ton, gemessen an der Datei. Fehlt der Wert, gilt das erste Wort. */
  voiceLeadMs?: number
}

export type MoatShortVoiceWort = { text: string; startMs: number; endMs: number }

export type MoatShortBeatId =
  | 'hook'
  | 'proof'
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

export type MoatShortCaptionWort = { text: string; start: number; end: number }

/** Eine lesbare Phrase. `start`/`end` sind Frames relativ zu `from`. */
export type MoatShortCaption = {
  text: string
  from: number
  duration: number
  woerter: MoatShortCaptionWort[]
}

export type MoatShortTimeline = {
  beats: MoatShortBeat[]
  captions: MoatShortCaption[]
  durationInFrames: number
  /** Frames Stille vor dem ersten Wort. Die Stimme wird um genau so viel vorgezogen. */
  voiceTrimFrames: number
}

export const MOAT_SHORT_DEFAULT_PROPS: MoatShortProps = {
  ticker: 'ASML',
  firmenname: 'ASML Holding',
  logoUrl: 'portfolio-logos/asml.png',
  kicker: 'No second shop',
  hook: 'Why can ASML charge whatever the chip needs?',
  proof: 'Because those machines print a 51.3% margin.',
  hookLoop: '',
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
  closing: 'Nobody else has a lock like this, so the question is',
  musicSrc: null,
  musicGain: 0.5,
  musicTrim: 0,
  sfx: true,
  voiceSrc: null,
  voiceAlignment: null,
}
