/**
 * Aktiensplits (Parqet wendet sie bei der Stückberechnung an; reine Buy/Sell-Imports nicht).
 * faktor: neue Stückzahl = alte × faktor (5 bei Split 1:5).
 */

export type AktienSplit = {
  isin: string
  datum: string
  faktor: number
}

/** Bekannte Splits — bei CSV-Reimport ergänzen oder Parqet-Typ „StockSplit“ nutzen. */
export const AKTIEN_SPLITS: AktienSplit[] = [
  { isin: 'US81762P1021', datum: '2025-12-18', faktor: 5 },
]

const SPLITS_BY_DATE = new Map<string, AktienSplit[]>()

for (const s of AKTIEN_SPLITS) {
  const key = s.datum
  const list = SPLITS_BY_DATE.get(key) ?? []
  list.push(s)
  SPLITS_BY_DATE.set(key, list)
}

export function splitsAmDatum(datumIso: string): AktienSplit[] {
  return SPLITS_BY_DATE.get(datumIso) ?? []
}

type StandMap = Map<
  string,
  { stueck: number; kosten: number; name: string; assetKlasse: import('@/lib/portfolio-analyse/types').AssetKlasse }
>

/** Stückzahl × faktor, Einstandsgesamt (kosten) bleibt gleich. */
export function wendeAktienSplitsAufMap(map: StandMap, datumIso: string): void {
  for (const split of splitsAmDatum(datumIso)) {
    const cur = map.get(split.isin.toUpperCase())
    if (!cur || cur.stueck < 1e-8 || split.faktor <= 0 || !Number.isFinite(split.faktor)) continue
    cur.stueck = Math.round(cur.stueck * split.faktor * 1e6) / 1e6
  }
}
