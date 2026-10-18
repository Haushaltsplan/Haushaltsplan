/** Supermarkt-Angebotsvergleich — gemeinsame Typen */

export const HAENDLER_IDS = [
  'rewe',
  'aldi_sued',
  'aldi_nord',
  'edeka',
  'lidl',
  'penny',
  'netto',
  'kaufland',
  'globus',
  'marktkauf',
] as const

export type HaendlerId = (typeof HAENDLER_IDS)[number]

export const HAENDLER_LABELS: Record<HaendlerId, string> = {
  rewe: 'REWE',
  aldi_sued: 'ALDI Süd',
  aldi_nord: 'ALDI Nord',
  edeka: 'EDEKA',
  lidl: 'Lidl',
  penny: 'PENNY',
  netto: 'Netto',
  kaufland: 'Kaufland',
  globus: 'GLOBUS',
  marktkauf: 'Marktkauf',
}

/** Ketten mit eigenem Direktadapter (Phase A/B). */
export const DIREKT_HAENDLER: readonly HaendlerId[] = [
  'rewe',
  'aldi_sued',
  'aldi_nord',
  'edeka',
  'lidl',
  'kaufland',
]

/** Ketten, die standardmäßig über Marktguru kommen (solange kein Direkt-Erfolg). */
export const MARKTGURU_FALLBACK_HAENDLER: readonly HaendlerId[] = [
  'lidl',
  'penny',
  'netto',
  'globus',
  'kaufland',
  'marktkauf',
  'rewe',
  'aldi_sued',
  'aldi_nord',
  'edeka',
]

export type QuellenStatusArt = 'ok' | 'fallback' | 'failed' | 'skipped'

export type QuellenStatus = {
  haendler: HaendlerId
  status: QuellenStatusArt
  quelle: 'direkt' | 'marktguru' | 'keine'
  anzahl: number
  fehler?: string
  dauerMs?: number
}

export type Angebot = {
  id: string
  haendler: HaendlerId
  name: string
  marke: string | null
  preisEur: number
  vorherigerPreisEur: number | null
  packungText: string | null
  /** Normierte Packungsmenge in Basiseinheit (g/ml/Stück), null wenn unbekannt */
  packungMenge: number | null
  packungEinheit: 'g' | 'ml' | 'st' | null
  /** Grundpreis in EUR pro kg bzw. pro Liter bzw. pro Stück */
  grundpreisEur: number | null
  grundpreisEinheit: 'kg' | 'l' | 'st' | null
  gueltigVon: string | null
  gueltigBis: string | null
  bildUrl: string | null
  kategorie: string | null
  quelle: 'direkt' | 'marktguru'
  rohText?: string
}

export type MarktInfo = {
  haendler: HaendlerId
  marktId: string
  name: string
  plz: string
  ort: string | null
  adresse: string | null
}

export type AngeboteEinstellung = {
  ownerUserId: string
  plz: string
  marktIds: Partial<Record<HaendlerId, string>>
  loyalty: string[]
  aktualisiertAm: string
}

export type VergleichRequest = {
  plz: string
  force?: boolean
  q?: string
  haendler?: HaendlerId[]
  loyalty?: string[]
  sort?: 'preis' | 'grundpreis' | 'haendler' | 'name'
}

export type VergleichResponse = {
  ok: true
  plz: string
  woche: string
  ausCache: boolean
  angebote: Angebot[]
  quellen: QuellenStatus[]
  maerkte: MarktInfo[]
  erstelltAm: string
}

export type VergleichFehler = {
  ok: false
  error: string
}
