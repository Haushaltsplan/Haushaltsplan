import { zeileMitIst } from '@/lib/portfolio-analyse/finnhub-earnings-ist-server'
import type { QuartalsPrognoseMetrik, QuartalsPrognoseZeile } from '@/lib/portfolio-analyse/earnings-quartals-prognose'
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

export async function ladeYahooEarningsHistoryIst(
  symbol: string,
  quartalLabel: string,
): Promise<Partial<Record<QuartalsPrognoseMetrik, number>> | null> {
  const sym = symbol.trim().toUpperCase()
  if (!sym || !quartalLabel) return null

  try {
    const auth = await holeYahooFinanceAuth()
    if (!auth) return null

    const u = new URL(
      `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(sym)}`,
    )
    u.searchParams.set('modules', 'earningsHistory')
    u.searchParams.set('crumb', auth.crumb)

    const res = await fetch(u.toString(), {
      headers: { ...YAHOO_FINANCE_FETCH_HEADERS, Cookie: auth.cookie },
      next: { revalidate: CACHE_REVALIDATE },
    })
    if (!res.ok) return null

    const history =
      (await res.json()).quoteSummary?.result?.[0]?.earningsHistory?.history ?? []
    if (!Array.isArray(history) || history.length === 0) return null

    const ziel = (history as HistoryRow[]).find((h) => quartalLabelAusHistory(h) === quartalLabel)
    if (!ziel) return null

    const out: Partial<Record<QuartalsPrognoseMetrik, number>> = {}
    const eps = ziel.epsActual?.raw
    const rev = ziel.revenueActual?.raw
    if (eps != null && Number.isFinite(eps)) out.eps = eps
    if (rev != null && Number.isFinite(rev)) out.umsatz = rev
    return Object.keys(out).length > 0 ? out : null
  } catch {
    return null
  }
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
