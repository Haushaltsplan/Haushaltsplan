export const BOERSEN_MONAT_LABELS = [
  'Januar',
  'Februar',
  'März',
  'April',
  'Mai',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'Dezember',
] as const

export const BOERSEN_MONAT_KURZ = [
  'Jan',
  'Feb',
  'Mrz',
  'Apr',
  'Mai',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Okt',
  'Nov',
  'Dez',
] as const

export type BoersenSaisonMonat = {
  monat: number
  label: string
  kurz: string
  durchschnittPct: number
  medianPct: number
  trefferquotePct: number
  anzahl: number
  minPct: number
  maxPct: number
}

export type BoersenSaisonIndex = {
  id: string
  name: string
  symbol: string
  vonJahr: number | null
  bisJahr: number | null
  hinweis: string
  monate: BoersenSaisonMonat[]
}

export type BoersenSaisonPaket = {
  ok: boolean
  indezes: BoersenSaisonIndex[]
  geladenAm: string
  fehler?: string
}
