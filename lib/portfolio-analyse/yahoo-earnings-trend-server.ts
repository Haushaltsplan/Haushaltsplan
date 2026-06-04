import { berichtszeitAusYahooUnix } from '@/lib/portfolio-analyse/earnings-berichtszeit'
import type { Berichtszeit } from '@/lib/portfolio-analyse/earnings-berichtszeit'
import {
  bauePrognoseZeile,
  kalenderQuartalAusPeriodEnd,
  type EarningsQuartalsPrognose,
  type QuartalsPrognoseZeile,
  vorjahrQuartalLabel,
} from '@/lib/portfolio-analyse/earnings-quartals-prognose'
import { tageZwischenIso } from '@/lib/portfolio-analyse/dividenden-datum-hilfen'
import { terminIstVergangen } from '@/lib/portfolio-analyse/earnings-quartal-termin'
import type { EarningsKennzahlPrognose } from '@/lib/portfolio-analyse/earnings-kennzahlen'
import { kennzahlAusSpanne, formatGrosserBetrag } from '@/lib/portfolio-analyse/earnings-kennzahlen'
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

function wachstumDezimal(growth: unknown): number | null {
  return rawUnix(growth)
}

function wachstumProzentAusDezimal(d: number | null): number | null {
  if (d == null || !Number.isFinite(d)) return null
  return d * 100
}

function periodEndIso(row: Record<string, unknown>): string | null {
  const end = row.endDate
  if (typeof end === 'string' && /^\d{4}-\d{2}-\d{2}/.test(end)) return end.slice(0, 10)
  if (end && typeof end === 'object' && 'raw' in (end as object)) {
    const sec = rawUnix(end)
    if (sec) {
      const d = new Date(sec * 1000)
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
    }
  }
  return null
}

type TrendZeile = Record<string, unknown> & { period?: string }

function waehleTrendZeile(trend: TrendZeile[], terminDatumIso?: string): TrendZeile | null {
  const quartale = trend.filter((t) => {
    const p = String(t.period ?? '')
    return p === '0q' || p === '+1q'
  })
  if (quartale.length === 0) return null

  if (terminDatumIso) {
    const vergangen = terminIstVergangen(terminDatumIso)
    const fensterVor = vergangen ? -220 : -120
    const fensterNach = vergangen ? 90 : 45
    let best: { row: TrendZeile; diff: number } | null = null
    for (const row of quartale) {
      const end = periodEndIso(row)
      if (!end) continue
      const diff = tageZwischenIso(end, terminDatumIso)
      if (diff >= fensterVor && diff <= fensterNach) {
        const score = Math.abs(diff)
        if (!best || score < best.diff) best = { row, diff: score }
      }
    }
    if (best) return best.row
  }

  return quartale.find((t) => t.period === '0q') ?? quartale.find((t) => t.period === '+1q') ?? null
}

function parseTrendZuPrognose(
  row: TrendZeile,
  terminDatumIso: string | null,
  berichtszeit: Berichtszeit | null,
): EarningsQuartalsPrognose | null {
  const periodEnd = periodEndIso(row)
  if (!periodEnd) return null

  const { quartal, jahr, label } = kalenderQuartalAusPeriodEnd(periodEnd)
  const epsEst = row.earningsEstimate as Record<string, unknown> | undefined
  const revEst = row.revenueEstimate as Record<string, unknown> | undefined

  const epsAvg = rawUnix(epsEst?.avg)
  const revAvg = rawUnix(revEst?.avg)
  const epsYoy = rawUnix(epsEst?.yearAgoEps)
  const revYoy = rawUnix(revEst?.yearAgoRevenue)
  const epsGrowth = wachstumProzentAusDezimal(wachstumDezimal(epsEst?.growth) ?? wachstumDezimal(row.growth))
  const revGrowth = wachstumProzentAusDezimal(wachstumDezimal(revEst?.growth))

  const waehrung =
    (typeof epsEst?.earningsCurrency === 'string' && epsEst.earningsCurrency) ||
    (typeof revEst?.revenueCurrency === 'string' && revEst.revenueCurrency) ||
    'USD'

  const zeilen: QuartalsPrognoseZeile[] = []
  const umsatz = bauePrognoseZeile('umsatz', 'Revenue', waehrung, revAvg, revYoy, revGrowth)
  const eps = bauePrognoseZeile('eps', 'EPS', waehrung, epsAvg, epsYoy, epsGrowth)
  if (umsatz) zeilen.push(umsatz)
  if (eps) zeilen.push(eps)

  if (zeilen.length === 0) return null

  return {
    quartalLabel: label,
    vorjahrQuartalLabel: vorjahrQuartalLabel(quartal, jahr),
    periodEndIso: periodEnd,
    terminDatumIso,
    berichtszeit,
    berichtszeitLabel:
      berichtszeit === 'vor_boersenoeffnung'
        ? 'Before market open'
        : berichtszeit === 'nach_handelsschluss'
          ? 'After market close'
          : null,
    zeilen,
  }
}

/** @deprecated Legacy-Kennzahlen für Merge — nutze ladeYahooQuartalsPrognose. */
export type YahooEarningsTrendDaten = {
  period: string
  periodLabel: string
  eps: EarningsSchaetzungSpanne
  umsatz: EarningsSchaetzungSpanne
  epsWachstumProzent: number | null
  umsatzWachstumProzent: number | null
  kennzahlen: EarningsKennzahlPrognose[]
}

async function fetchTrend(sym: string): Promise<TrendZeile[]> {
  const auth = await holeYahooFinanceAuth()
  if (!auth) return []

  const u = new URL(
    `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(sym)}`,
  )
  u.searchParams.set('modules', 'earningsTrend,calendarEvents')
  u.searchParams.set('crumb', auth.crumb)

  const res = await fetch(u.toString(), {
    headers: { ...YAHOO_FINANCE_FETCH_HEADERS, Cookie: auth.cookie },
    next: { revalidate: CACHE_REVALIDATE },
  })
  if (!res.ok) return []

  const j = (await res.json()) as {
    quoteSummary?: {
      result?: Array<{
        earningsTrend?: { trend?: TrendZeile[] }
        calendarEvents?: { earnings?: Record<string, unknown> }
      }>
    }
  }
  return j.quoteSummary?.result?.[0]?.earningsTrend?.trend ?? []
}

function kalenderAusResult(
  result: { calendarEvents?: { earnings?: Record<string, unknown> } } | undefined,
): { terminDatumIso: string | null; berichtszeit: Berichtszeit | null } {
  const earnings = result?.calendarEvents?.earnings
  if (!earnings) return { terminDatumIso: null, berichtszeit: null }
  const dates = Array.isArray(earnings.earningsDate) ? earnings.earningsDate : []
  const first = dates[0] as { raw?: number; fmt?: string } | undefined
  const terminDatumIso =
    first?.fmt?.slice(0, 10) ??
    (first?.raw != null
      ? (() => {
          const d = new Date(first.raw! * 1000)
          return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
        })()
      : null)
  return { terminDatumIso, berichtszeit: berichtszeitAusYahooUnix(first?.raw ?? null) }
}

export async function ladeYahooQuartalsPrognose(
  symbol: string,
  terminDatumIso?: string,
): Promise<EarningsQuartalsPrognose | null> {
  const sym = symbol.trim().toUpperCase()
  if (!sym) return null

  try {
    const auth = await holeYahooFinanceAuth()
    if (!auth) return null

    const u = new URL(
      `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(sym)}`,
    )
    u.searchParams.set('modules', 'earningsTrend,calendarEvents')
    u.searchParams.set('crumb', auth.crumb)

    const res = await fetch(u.toString(), {
      headers: { ...YAHOO_FINANCE_FETCH_HEADERS, Cookie: auth.cookie },
      next: { revalidate: CACHE_REVALIDATE },
    })
    if (!res.ok) return null

    const result = (await res.json()).quoteSummary?.result?.[0]
    const trend = result?.earningsTrend?.trend ?? []
    const row = waehleTrendZeile(trend, terminDatumIso)
    if (!row) return null

    const kal = kalenderAusResult(result)
    const termin = terminDatumIso ?? kal.terminDatumIso
    return parseTrendZuPrognose(row, termin, kal.berichtszeit)
  } catch {
    return null
  }
}

export async function ladeYahooEarningsTrend(
  symbol: string,
  terminDatumIso?: string,
): Promise<YahooEarningsTrendDaten | null> {
  const prognose = await ladeYahooQuartalsPrognose(symbol, terminDatumIso)
  if (!prognose) return null

  const umsatzZ = prognose.zeilen.find((z) => z.metrik === 'umsatz')
  const epsZ = prognose.zeilen.find((z) => z.metrik === 'eps')

  const umsatz: EarningsSchaetzungSpanne = {
    low: null,
    high: null,
    average: umsatzZ?.schaetzung ?? null,
    averageAnzeige: umsatzZ?.schaetzung != null ? formatGrosserBetrag(umsatzZ.schaetzung) : null,
  }
  const eps: EarningsSchaetzungSpanne = {
    low: null,
    high: null,
    average: epsZ?.schaetzung ?? null,
    averageAnzeige: epsZ?.schaetzungAnzeige ?? null,
  }

  const kennzahlen: EarningsKennzahlPrognose[] = []
  if (umsatzZ) {
    const k = kennzahlAusSpanne('umsatz', 'Umsatz', umsatz, {
      vorjahrWert: umsatzZ.vorjahr,
      vorjahrAnzeige: umsatzZ.vorjahrAnzeige,
      wachstumProzent: umsatzZ.wachstumProzent,
      vergleichArt: 'vorjahr_quartal',
      vergleichLabel: `vs. ${prognose.vorjahrQuartalLabel}`,
    })
    if (k) kennzahlen.push(k)
  }
  if (epsZ) {
    const k = kennzahlAusSpanne('eps', 'EPS', eps, {
      vorjahrWert: epsZ.vorjahr,
      vorjahrAnzeige: epsZ.vorjahrAnzeige,
      wachstumProzent: epsZ.wachstumProzent,
      vergleichArt: 'vorjahr_quartal',
      vergleichLabel: `vs. ${prognose.vorjahrQuartalLabel}`,
    })
    if (k) kennzahlen.push(k)
  }

  return {
    period: '0q',
    periodLabel: prognose.quartalLabel,
    eps,
    umsatz,
    epsWachstumProzent: epsZ?.wachstumProzent ?? null,
    umsatzWachstumProzent: umsatzZ?.wachstumProzent ?? null,
    kennzahlen,
  }
}
