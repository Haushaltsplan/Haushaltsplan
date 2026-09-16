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

export type BoersenWahlPhase = 'nachwahl' | 'midterm' | 'vorwahl' | 'wahljahr'

export type BoersenWahlJahrStats = {
  phase: BoersenWahlPhase
  jahrImZyklus: 1 | 2 | 3 | 4
  label: string
  kurz: string
  hinweis: string
  durchschnittJahrPct: number
  medianJahrPct: number
  trefferquotePct: number
  anzahl: number
}

export type BoersenWahlFenster = {
  label: string
  durchschnittPct: number
  trefferquotePct: number
  anzahl: number
}

export type BoersenWahlZyklus = {
  phasen: BoersenWahlJahrStats[]
  midtermVorher: BoersenWahlFenster
  midtermDanach: BoersenWahlFenster
  wahljahrVorher: BoersenWahlFenster
  wahljahrDanach: BoersenWahlFenster
}

export type BoersenMonatRendite = {
  jahr: number
  monat: number
  retPct: number
}

export type BoersenSaisonIndex = {
  id: string
  name: string
  symbol: string
  vonJahr: number | null
  bisJahr: number | null
  hinweis: string
  monate: BoersenSaisonMonat[]
  wahlZyklus: BoersenWahlZyklus | null
  /** Monatliche Renditen für die Jahresfilterung; kann in der Erstansicht leer sein. */
  renditen?: BoersenMonatRendite[]
}

export type BoersenSaisonPaket = {
  ok: boolean
  indezes: BoersenSaisonIndex[]
  geladenAm: string
  fehler?: string
}
