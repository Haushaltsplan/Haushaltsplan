import {
  FUNDAMENTAL_TTM_KEY,
  type FundamentaldatenPaket,
  type FundamentalPeriode,
} from '@/lib/portfolio-analyse/fundamentaldaten-types'
import { perzentilInSerie } from '@/lib/portfolio-analyse/nachkauf-radar/nachkauf-qualitaet-signale'

export type HistorischeBewertung = {
  /** Median des jährlichen KGV (Macrotrends, letzte 5 Geschäftsjahre). */
  medianPe5y: number | null
  /** Median der FCF-Rendite % (aus Kurs/FCF-Jahreswerten). */
  medianFcfYield5y: number | null
  /** Aktuelles Trailing-KGV als Perzentil der eigenen 5J-Historie (0=günstig, 100=teuer). */
  pePerzentil5y: number | null
  /** Aktuelles Trailing-KGV als Perzentil der eigenen 10J-Historie. */
  pePerzentil10y: number | null
  /** Datenquelle der Mediane. */
  quelle: 'macrotrends' | null
  /** Anzahl verwendeter Jahrespunkte. */
  jahre: number
}

function median(werte: number[]): number | null {
  if (werte.length === 0) return null
  const s = [...werte].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 === 1 ? s[m]! : (s[m - 1]! + s[m]!) / 2
}

function geschaeftsjahresKeys(perioden: FundamentalPeriode[], max = 5): string[] {
  return perioden
    .filter(
      (p) =>
        !p.istLtm &&
        !p.istNtm &&
        !p.istSchaetzung &&
        p.iso !== FUNDAMENTAL_TTM_KEY &&
        /^\d{4}-\d{2}-\d{2}$/.test(p.iso),
    )
    .map((p) => p.iso)
    .sort()
    .slice(-max)
}

function werteAusZeile(
  paket: FundamentaldatenPaket,
  zeilenId: string,
  keys: string[],
): number[] {
  const z = paket.zeilen.find((r) => r.id === zeilenId)
  if (!z) return []
  const out: number[] = []
  for (const k of keys) {
    const v = z.werte[k]
    if (v != null && Number.isFinite(v) && v > 0) out.push(v)
  }
  return out
}

function aktuellesTrailingPe(paket: FundamentaldatenPaket, peHist: number[]): number | null {
  const kgv = paket.zeilen.find((z) => z.id === 'kgv')
  const ttm = kgv?.werte[FUNDAMENTAL_TTM_KEY]
  if (ttm != null && ttm > 0) return ttm
  return peHist.length > 0 ? peHist[peHist.length - 1]! : null
}

/** 5-/10-Jahres-Median KGV/FCF-Yield + Perzentile aus Macrotrends-Zeitreihen. */
export function berechneHistorischeBewertung(paket: FundamentaldatenPaket): HistorischeBewertung {
  const keys5 = geschaeftsjahresKeys(paket.perioden, 5)
  const keys10 = geschaeftsjahresKeys(paket.perioden, 10)
  const peWerte5 = werteAusZeile(paket, 'kgv', keys5)
  const peWerte10 = werteAusZeile(paket, 'kgv', keys10)
  const pfcfWerte = werteAusZeile(paket, 'pfcf', keys5)
  const fcfYieldWerte = pfcfWerte.map((m) => (m > 0 ? (1 / m) * 100 : 0)).filter((v) => v > 0)

  const medianPe5y = median(peWerte5)
  const medianFcfYield5y = median(fcfYieldWerte)
  const peAktuell = aktuellesTrailingPe(paket, peWerte5)

  return {
    medianPe5y,
    medianFcfYield5y,
    pePerzentil5y: peAktuell != null ? perzentilInSerie(peAktuell, peWerte5) : null,
    pePerzentil10y: peAktuell != null ? perzentilInSerie(peAktuell, peWerte10) : null,
    quelle: medianPe5y != null || medianFcfYield5y != null ? 'macrotrends' : null,
    jahre: Math.max(peWerte5.length, fcfYieldWerte.length),
  }
}
