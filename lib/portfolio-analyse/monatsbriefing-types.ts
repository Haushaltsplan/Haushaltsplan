export type MonatsbriefingErgebnis = {
  monatKey: string
  radar: {
    gruen: number
    gelb: number
    kaufempfehlungKurz: string | null
    topScores: Array<{ ticker: string; name: string; score: number; ampel: string }>
  }
  earningsWoche: Array<{ name: string; symbol: string; terminDatumIso: string; tageBis: number }>
  alertsOffen: number
  klumpen: Array<{ label: string; gewichtPct: number }>
  hinweise: string[]
}
