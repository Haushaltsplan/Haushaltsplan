import { formatGrosserBetrag, kennzahlAusSpanne } from '@/lib/portfolio-analyse/earnings-kennzahlen'
import type { EarningsKennzahlPrognose } from '@/lib/portfolio-analyse/earnings-kennzahlen'
import type { EarningsSchaetzungSpanne } from '@/lib/portfolio-analyse/earnings-schaetzungen'
import {
  holeYahooFinanceAuth,
  YAHOO_FINANCE_FETCH_HEADERS,
} from '@/lib/portfolio-analyse/yahoo-finance-auth-server'

const CACHE_REVALIDATE = 3600

type YahooFmt = { raw?: number; fmt?: string }

function rawUnix(v: unknown): number | null {
  if (v == null || typeof v !== 'object') return null
  const raw = (v as YahooFmt).raw
  return raw != null && Number.isFinite(raw) ? raw : null
}

function fmtStr(v: unknown): string | null {
  if (v == null || typeof v !== 'object') return null
  return (v as YahooFmt).fmt ?? null
}

function spanneAusEstimate(est: Record<string, unknown> | undefined): EarningsSchaetzungSpanne {
  if (!est || typeof est !== 'object') {
    return { low: null, high: null, average: null, averageAnzeige: null }
  }
  return {
    low: rawUnix(est.low),
    high: rawUnix(est.high),
    average: rawUnix(est.avg),
    averageAnzeige: fmtStr(est.avg),
  }
}

function wachstumAusTrend(growth: unknown): number | null {
  if (growth == null || typeof growth !== 'object') return null
  const raw = (growth as YahooFmt).raw
  if (raw == null || !Number.isFinite(raw)) return null
  return raw * 100
}

function epsVorjahrAusWachstum(konsens: number | null, wachstumDezimal: number | null): number | null {
  if (konsens == null || wachstumDezimal == null) return null
  const f = 1 + wachstumDezimal
  if (f === 0) return null
  return konsens / f
}

type TrendZeile = Record<string, unknown> & { period?: string }

export type YahooEarningsTrendDaten = {
  period: string
  periodLabel: string
  eps: EarningsSchaetzungSpanne
  umsatz: EarningsSchaetzungSpanne
  epsWachstumProzent: number | null
  umsatzWachstumProzent: number | null
  kennzahlen: EarningsKennzahlPrognose[]
}

const PERIOD_LABEL: Record<string, string> = {
  '0q': 'Aktuelles Quartal',
  '+1q': 'Nächstes Quartal',
  '0y': 'Laufendes Geschäftsjahr',
  '+1y': 'Nächstes Geschäftsjahr',
}

function parseTrendZeile(row: TrendZeile): YahooEarningsTrendDaten | null {
  const period = String(row.period ?? '')
  if (!period) return null

  const eps = spanneAusEstimate(row.earningsEstimate as Record<string, unknown> | undefined)
  const umsatz = spanneAusEstimate(row.revenueEstimate as Record<string, unknown> | undefined)
  const epsGrowthDec = rawUnix(row.growth)
  const epsWachstum = wachstumAusTrend(row.growth)
  const revGrowth = row.revenueEstimate as Record<string, unknown> | undefined
  const umsatzWachstum = wachstumAusTrend(revGrowth?.growth)

  const kennzahlen: EarningsKennzahlPrognose[] = []
  const vergleichArt = period.endsWith('q') ? ('vorjahr_quartal' as const) : ('vorjahr_geschaeftsjahr' as const)
  const vergleichLabel = period.endsWith('q') ? 'vs. Vorjahresquartal' : 'vs. Vorjahr (Geschäftsjahr)'

  const epsK = kennzahlAusSpanne('eps', 'Gewinn je Aktie (EPS)', eps, {
    vorjahrWert: epsVorjahrAusWachstum(eps.average, epsGrowthDec),
    wachstumProzent: epsWachstum,
    vergleichArt,
    vergleichLabel,
  })
  if (epsK) kennzahlen.push(epsK)

  const umsatzK = kennzahlAusSpanne('umsatz', 'Umsatz', umsatz, {
    wachstumProzent: umsatzWachstum,
    vergleichArt,
    vergleichLabel,
    vorjahrAnzeige: null,
    hinweis: umsatz.average != null ? formatGrosserBetrag(umsatz.average, '') : null,
  })
  if (umsatzK) {
    if (umsatz.average != null) {
      umsatzK.spanne = {
        ...umsatzK.spanne,
        averageAnzeige: formatGrosserBetrag(umsatz.average),
      }
    }
    kennzahlen.push(umsatzK)
  }

  if (kennzahlen.length === 0) return null

  return {
    period,
    periodLabel: PERIOD_LABEL[period] ?? period,
    eps,
    umsatz,
    epsWachstumProzent: epsWachstum,
    umsatzWachstumProzent: umsatzWachstum,
    kennzahlen,
  }
}

export async function ladeYahooEarningsTrend(symbol: string): Promise<YahooEarningsTrendDaten | null> {
  const sym = symbol.trim().toUpperCase()
  if (!sym) return null

  const auth = await holeYahooFinanceAuth()
  if (!auth) return null

  const u = new URL(
    `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(sym)}`,
  )
  u.searchParams.set('modules', 'earningsTrend')
  u.searchParams.set('crumb', auth.crumb)

  try {
    const res = await fetch(u.toString(), {
      headers: {
        ...YAHOO_FINANCE_FETCH_HEADERS,
        Cookie: auth.cookie,
      },
      next: { revalidate: CACHE_REVALIDATE },
    })
    if (!res.ok) return null
    const j = (await res.json()) as {
      quoteSummary?: { result?: Array<{ earningsTrend?: { trend?: TrendZeile[] } }> }
    }
    const trend = j.quoteSummary?.result?.[0]?.earningsTrend?.trend ?? []
    const row = trend.find((t) => t.period === '0q') ?? trend.find((t) => t.period === '+1q')
    return row ? parseTrendZeile(row) : null
  } catch {
    return null
  }
}
