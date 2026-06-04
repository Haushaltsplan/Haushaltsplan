import type { EarningsSchaetzungen } from '@/lib/portfolio-analyse/earnings-schaetzungen'

export type JahresEarningsSchaetzung = {
  jahrLabel: string
  vorjahrLabel: string | null
  waehrung: string
  umsatz: {
    schaetzung: number | null
    schaetzungAnzeige: string | null
    vorjahr: number | null
    vorjahrAnzeige: string | null
    wachstumAnzeige: string | null
  }
  eps: {
    schaetzung: number | null
    schaetzungAnzeige: string | null
    vorjahr: number | null
    vorjahrAnzeige: string | null
    wachstumAnzeige: string | null
  }
}

export function jahresSchaetzungAusWallstreet(
  ws: EarningsSchaetzungen | null,
): JahresEarningsSchaetzung | null {
  if (!ws?.jahr && !ws?.prognosePeriode) return null
  const jahrLabel = ws.jahr
    ? `Geschäftsjahr ${ws.jahr}e`
    : (ws.prognosePeriode ?? 'Geschäftsjahr (Schätzung)')
  const epsK = ws.kennzahlen.find((k) => k.schluessel === 'eps')
  const umsatzK = ws.kennzahlen.find((k) => k.schluessel === 'umsatz')
  const vorjahrLabel =
    epsK?.vergleichLabel?.replace(/^vs\.\s*/i, '') ??
    umsatzK?.vergleichLabel?.replace(/^vs\.\s*/i, '') ??
    null

  if (ws.eps.average == null && ws.umsatz.average == null && !epsK && !umsatzK) return null

  const waehrung = ws.quartalsPrognose?.zeilen[0]?.waehrung ?? 'EUR'

  return {
    jahrLabel,
    vorjahrLabel,
    waehrung,
    umsatz: {
      schaetzung: ws.umsatz.average,
      schaetzungAnzeige: ws.umsatz.averageAnzeige,
      vorjahr: umsatzK?.vorjahrWert ?? null,
      vorjahrAnzeige: umsatzK?.vorjahrAnzeige ?? null,
      wachstumAnzeige: umsatzK?.wachstumAnzeige ?? null,
    },
    eps: {
      schaetzung: ws.eps.average ?? epsK?.spanne.average ?? null,
      schaetzungAnzeige: ws.eps.averageAnzeige ?? epsK?.spanne.averageAnzeige ?? null,
      vorjahr: epsK?.vorjahrWert ?? null,
      vorjahrAnzeige: epsK?.vorjahrAnzeige ?? null,
      wachstumAnzeige: epsK?.wachstumAnzeige ?? null,
    },
  }
}
