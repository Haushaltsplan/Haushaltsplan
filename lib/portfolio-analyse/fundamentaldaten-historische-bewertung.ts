import {
  FUNDAMENTAL_TTM_KEY,
  type FundamentaldatenPaket,
  type FundamentalPeriode,
} from '@/lib/portfolio-analyse/fundamentaldaten-types'
import {
  bereinigeBewertungsSerie,
  perzentilInSerie,
} from '@/lib/portfolio-analyse/nachkauf-radar/nachkauf-qualitaet-signale'

export type HistorischeBewertung = {
  /** Median des jährlichen KGV (Macrotrends, letzte 5 Geschäftsjahre). */
  medianPe5y: number | null
  /** Median der FCF-Rendite % (aus Kurs/FCF-Jahreswerten). */
  medianFcfYield5y: number | null
  /** Median EV/EBITDA (letzte 5 GJ, aus Marktkap + Schulden − Cash). */
  medianEvEbitda5y: number | null
  /** Median EV/Umsatz (letzte 5 GJ). */
  medianEvRev5y: number | null
  /** Aktuelles Trailing-KGV als Perzentil der eigenen 5J-Historie (0=günstig, 100=teuer). */
  pePerzentil5y: number | null
  /** Aktuelles Trailing-KGV als Perzentil der eigenen 10J-Historie. */
  pePerzentil10y: number | null
  /** Anzahl KGV-Jahre hinter dem 5J- bzw. 10J-Perzentil (kann kürzer sein als das Label). */
  peJahre5: number
  peJahre10: number
  /** Aktuelles EV/EBITDA als Perzentil der 5J-Historie. */
  evEbitdaPerzentil5y: number | null
  /** Aktuelles EV/EBITDA als Perzentil der 10J-Historie. */
  evEbitdaPerzentil10y: number | null
  /** Aktuelles EV/Umsatz als Perzentil der 5J-Historie. */
  evRevPerzentil5y: number | null
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

/** Sinnvolle Obergrenzen für hist. Mediane / Perzentile (keine Einzeltitel-Locke). */
const MAX_PE = 100
const MAX_EV_EBITDA = 45
const MAX_EV_REV = 30
const MAX_PFCF = 80

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

function parseKeyMetricMultiple(paket: FundamentaldatenPaket, id: string): number | null {
  const raw = paket.keyMetrics.find((m) => m.id === id)?.wert
  if (!raw || raw === '–' || raw === '-') return null
  const s = raw
    .replace(/[x×%\s$€]/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
  const v = parseFloat(s)
  return Number.isFinite(v) && v > 0 ? v : null
}

function aktuellesMultiple(
  paket: FundamentaldatenPaket,
  zeilenId: string,
  keyMetricIds: string[],
  hist: number[],
): number | null {
  const z = paket.zeilen.find((r) => r.id === zeilenId)
  const ttm = z?.werte[FUNDAMENTAL_TTM_KEY]
  if (ttm != null && ttm > 0) return ttm
  for (const id of keyMetricIds) {
    const km = parseKeyMetricMultiple(paket, id)
    if (km != null) return km
  }
  return hist.length > 0 ? hist[hist.length - 1]! : null
}

/** 5-/10-Jahres-Median KGV/FCF/EV + Perzentile aus Macrotrends-Zeitreihen. */
export function berechneHistorischeBewertung(paket: FundamentaldatenPaket): HistorischeBewertung {
  const keys5 = geschaeftsjahresKeys(paket.perioden, 5)
  const keys10 = geschaeftsjahresKeys(paket.perioden, 10)
  const peWerte5Roh = werteAusZeile(paket, 'kgv', keys5)
  const peWerte10Roh = werteAusZeile(paket, 'kgv', keys10)
  const peWerte5 = bereinigeBewertungsSerie(peWerte5Roh, MAX_PE, 3)
  const peWerte10 = bereinigeBewertungsSerie(peWerte10Roh, MAX_PE, 3)
  const pfcfWerte = bereinigeBewertungsSerie(werteAusZeile(paket, 'pfcf', keys5), MAX_PFCF, 3)
  const fcfYieldWerte = pfcfWerte.map((m) => (m > 0 ? (1 / m) * 100 : 0)).filter((v) => v > 0)
  const evEbitda5 = bereinigeBewertungsSerie(
    werteAusZeile(paket, 'ev_ebitda', keys5),
    MAX_EV_EBITDA,
    1,
  )
  const evEbitda10 = bereinigeBewertungsSerie(
    werteAusZeile(paket, 'ev_ebitda', keys10),
    MAX_EV_EBITDA,
    1,
  )
  const evRev5 = bereinigeBewertungsSerie(werteAusZeile(paket, 'ev_rev', keys5), MAX_EV_REV, 0.2)

  const medianPe5y = median(peWerte5)
  const medianFcfYield5y = median(fcfYieldWerte)
  const medianEvEbitda5y = median(evEbitda5)
  const medianEvRev5y = median(evRev5)

  const peAktuell = aktuellesMultiple(paket, 'kgv', ['ltm_pe', 'ntm_pe'], peWerte5Roh)
  const evEbitdaAktuell = aktuellesMultiple(
    paket,
    'ev_ebitda',
    ['ntm_ev_ebitda', 'ltm_ev_ebitda'],
    werteAusZeile(paket, 'ev_ebitda', keys5),
  )
  const evRevAktuell = aktuellesMultiple(
    paket,
    'ev_rev',
    ['ntm_ev_rev', 'ltm_ev_rev'],
    werteAusZeile(paket, 'ev_rev', keys5),
  )

  const hatDaten =
    medianPe5y != null ||
    medianFcfYield5y != null ||
    medianEvEbitda5y != null ||
    medianEvRev5y != null

  return {
    medianPe5y,
    medianFcfYield5y,
    medianEvEbitda5y,
    medianEvRev5y,
    pePerzentil5y: peAktuell != null ? perzentilInSerie(peAktuell, peWerte5) : null,
    pePerzentil10y: peAktuell != null ? perzentilInSerie(peAktuell, peWerte10) : null,
    peJahre5: peWerte5.length,
    peJahre10: peWerte10.length,
    evEbitdaPerzentil5y:
      evEbitdaAktuell != null ? perzentilInSerie(evEbitdaAktuell, evEbitda5) : null,
    evEbitdaPerzentil10y:
      evEbitdaAktuell != null ? perzentilInSerie(evEbitdaAktuell, evEbitda10) : null,
    evRevPerzentil5y: evRevAktuell != null ? perzentilInSerie(evRevAktuell, evRev5) : null,
    quelle: hatDaten ? 'macrotrends' : null,
    jahre: Math.max(peWerte5.length, fcfYieldWerte.length, evEbitda5.length, evRev5.length),
  }
}
