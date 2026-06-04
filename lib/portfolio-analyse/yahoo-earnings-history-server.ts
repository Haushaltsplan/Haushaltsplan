import { zeileMitIst } from '@/lib/portfolio-analyse/finnhub-earnings-ist-server'
import {
  bauePrognoseZeile,
  formatEpsUsd,
  formatKompaktUsd,
  type QuartalsPrognoseMetrik,
  type QuartalsPrognoseZeile,
} from '@/lib/portfolio-analyse/earnings-quartals-prognose'
import {
  holeYahooFinanceAuth,
  YAHOO_FINANCE_FETCH_HEADERS,
} from '@/lib/portfolio-analyse/yahoo-finance-auth-server'

const CACHE_REVALIDATE = 3600

type HistoryRow = {
  epsActual?: { raw?: number }
  epsEstimate?: { raw?: number }
  revenueActual?: { raw?: number }
  revenueEstimate?: { raw?: number }
  quarter?: { raw?: number }
  period?: string
}

function quartalLabelAusHistory(row: HistoryRow): string | null {
  const q = row.quarter?.raw
  const period = row.period
  if (q != null && period) {
    const jahr = Number(String(period).slice(0, 4))
    if (Number.isFinite(jahr)) return `Q${q} ${jahr}`
  }
  return null
}

export type YahooEarningsHistoryZeile = {
  quartalLabel: string
  ist: Partial<Record<QuartalsPrognoseMetrik, number>>
  schaetzung: Partial<Record<QuartalsPrognoseMetrik, number>>
}

function zeileAusHistory(row: HistoryRow): YahooEarningsHistoryZeile | null {
  const quartalLabel = quartalLabelAusHistory(row)
  if (!quartalLabel) return null
  const ist: Partial<Record<QuartalsPrognoseMetrik, number>> = {}
  const schaetzung: Partial<Record<QuartalsPrognoseMetrik, number>> = {}
  const eps = row.epsActual?.raw
  const rev = row.revenueActual?.raw
  const epsEst = row.epsEstimate?.raw
  const revEst = row.revenueEstimate?.raw
  if (eps != null && Number.isFinite(eps)) ist.eps = eps
  if (rev != null && Number.isFinite(rev)) ist.umsatz = rev
  if (epsEst != null && Number.isFinite(epsEst)) schaetzung.eps = epsEst
  if (revEst != null && Number.isFinite(revEst)) schaetzung.umsatz = revEst
  if (Object.keys(ist).length === 0 && Object.keys(schaetzung).length === 0) return null
  return { quartalLabel, ist, schaetzung }
}

async function ladeYahooHistoryRows(symbol: string): Promise<HistoryRow[]> {
  const sym = symbol.trim().toUpperCase()
  if (!sym) return []
  const auth = await holeYahooFinanceAuth()
  if (!auth) return []
  const u = new URL(
    `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(sym)}`,
  )
  u.searchParams.set('modules', 'earningsHistory')
  u.searchParams.set('crumb', auth.crumb)
  const res = await fetch(u.toString(), {
    headers: { ...YAHOO_FINANCE_FETCH_HEADERS, Cookie: auth.cookie },
    next: { revalidate: CACHE_REVALIDATE },
  })
  if (!res.ok) return []
  const history =
    (await res.json()).quoteSummary?.result?.[0]?.earningsHistory?.history ?? []
  return Array.isArray(history) ? (history as HistoryRow[]) : []
}

export async function ladeYahooEarningsHistoryZeile(
  symbol: string,
  quartalLabelKandidaten: string[],
): Promise<YahooEarningsHistoryZeile | null> {
  const kandidaten = new Set(quartalLabelKandidaten.filter(Boolean))
  if (kandidaten.size === 0) return null
  try {
    const history = await ladeYahooHistoryRows(symbol)
    for (const label of kandidaten) {
      const row = history.find((h) => quartalLabelAusHistory(h) === label)
      if (row) {
        const parsed = zeileAusHistory(row)
        if (parsed) return parsed
      }
    }
    return null
  } catch {
    return null
  }
}

export async function ladeYahooEarningsHistoryIst(
  symbol: string,
  quartalLabel: string,
): Promise<Partial<Record<QuartalsPrognoseMetrik, number>> | null> {
  const z = await ladeYahooEarningsHistoryZeile(symbol, [quartalLabel])
  return z?.ist && Object.keys(z.ist).length > 0 ? z.ist : null
}

export function prognoseZeilenMitYahooIst(
  zeilen: QuartalsPrognoseZeile[],
  ist: Partial<Record<QuartalsPrognoseMetrik, number>>,
): QuartalsPrognoseZeile[] {
  return zeilen.map((z) => {
    const v = ist[z.metrik]
    if (v == null) return z
    return zeileMitIst(z, v)
  })
}

function schaetzungAnzeige(metrik: QuartalsPrognoseMetrik, v: number): string {
  return metrik === 'eps' ? formatEpsUsd(v) : formatKompaktUsd(v)
}

export function prognoseZeilenMitYahooHistory(
  zeilen: QuartalsPrognoseZeile[],
  hist: YahooEarningsHistoryZeile,
): QuartalsPrognoseZeile[] {
  const waehrung = zeilen[0]?.waehrung ?? 'USD'
  const out = [...zeilen]

  for (const metrik of ['umsatz', 'eps'] as const) {
    const est = hist.schaetzung[metrik]
    const istVal = hist.ist[metrik]
    if (est == null && istVal == null) continue

    let idx = out.findIndex((z) => z.metrik === metrik)
    if (idx < 0 && (est != null || istVal != null)) {
      const row = bauePrognoseZeile(
        metrik,
        metrik === 'eps' ? 'EPS' : 'Revenue',
        waehrung,
        est ?? null,
        null,
      )
      if (row) {
        out.push(row)
        idx = out.length - 1
      }
    }
    if (idx < 0) continue

    let z = out[idx]
    if (est != null) {
      z = {
        ...z,
        schaetzung: est,
        schaetzungAnzeige: schaetzungAnzeige(metrik, est),
      }
    }
    if (istVal != null) {
      z = zeileMitIst(z, istVal, est ?? z.schaetzung)
    }
    out[idx] = z
  }

  return out
}
