export type JournalEintrag = {
  id: string
  isin: string | null
  ticker: string
  name: string
  these: string
  kaufgrund: string
  watchpoints: string
  status: 'aktiv' | 'geschlossen'
  reviewAm: string | null
  erstelltAm: string
  aktualisiertAm: string
}
