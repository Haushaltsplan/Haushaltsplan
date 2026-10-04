import type { Berichtszeit } from '@/lib/portfolio-analyse/earnings-berichtszeit'
import type { GuidanceRichtung } from '@/lib/portfolio-analyse/earnings-call-sentiment'
import type { EarningsRevisionMeta } from '@/lib/portfolio-analyse/earnings-revision-meta'
import type { EarningsSchaetzungSpanne } from '@/lib/portfolio-analyse/earnings-schaetzungen'

export type EarningsBriefingEintrag = {
  isin: string | null
  name: string
  symbol: string
  terminDatumIso: string
  tageBis: number
  berichtszeit: Berichtszeit | null
  berichtszeitAnzeige: string | null
  bestaetigt: boolean
  eps: EarningsSchaetzungSpanne
  umsatz: EarningsSchaetzungSpanne
  revisionMeta: EarningsRevisionMeta
  epsBeatRatePct: number | null
  umsatzBeatRatePct: number | null
  guidanceRichtung: GuidanceRichtung
  letzterCallKiKurz: string | null
}

export type EarningsBriefingErgebnis = {
  heuteIso: string
  horizonTage: number
  eintraege: EarningsBriefingEintrag[]
  hinweise: string[]
}
