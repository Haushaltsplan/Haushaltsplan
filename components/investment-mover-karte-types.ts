/** Gemeinsames Datenmodell für S&P-/Nasdaq-Movers und Portfolio-Karten. */
export type InvestmentMoverKarteDaten = {
  symbol: string
  name: string
  brancheAnzeige: string | null
  aenderungProzent: number | null
  kurs: number | null
  notierung?: string
  ytdProzent?: number | null
  fuenfJahreProzent?: number | null
  zehnJahreProzent?: number | null
  athAbstandProzent?: number | null
  notiz?: string | null
  portfolioZeilenId?: string
  portfolioKarte?: boolean
}
