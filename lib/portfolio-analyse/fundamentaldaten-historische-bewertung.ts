import {
  FUNDAMENTAL_TTM_KEY,
  type FundamentaldatenPaket,
  type FundamentalPeriode,
} from '@/lib/portfolio-analyse/fundamentaldaten-types'

export type HistorischeBewertung = {
  /** Median des jährlichen KGV (Macrotrends, letzte 5 Geschäftsjahre). */
  medianPe5y: number | null
  /** Median der FCF-Rendite % (aus Kurs/FCF-Jahreswerten). */
  medianFcfYield5y: number | null
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

/** 5-Jahres-Median KGV und FCF-Yield aus Macrotrends-Zeitreihen im Fundamentalpaket. */
export function berechneHistorischeBewertung(paket: FundamentaldatenPaket): HistorischeBewertung {
  const keys = geschaeftsjahresKeys(paket.perioden, 5)
  const peWerte = werteAusZeile(paket, 'kgv', keys)
  const pfcfWerte = werteAusZeile(paket, 'pfcf', keys)
  const fcfYieldWerte = pfcfWerte.map((m) => (m > 0 ? (1 / m) * 100 : 0)).filter((v) => v > 0)

  const medianPe5y = median(peWerte)
  const medianFcfYield5y = median(fcfYieldWerte)

  return {
    medianPe5y,
    medianFcfYield5y,
    quelle: medianPe5y != null || medianFcfYield5y != null ? 'macrotrends' : null,
    jahre: Math.max(peWerte.length, fcfYieldWerte.length),
  }
}
