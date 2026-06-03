import { heuteIsoUtc, isoInJahren } from '@/lib/portfolio-analyse/dividenden-datum-hilfen'
import {
  holeYahooFinanceAuth,
  YAHOO_FINANCE_FETCH_HEADERS,
} from '@/lib/portfolio-analyse/yahoo-finance-auth-server'

const CACHE_REVALIDATE = 86400
const HORIZONT_JAHRE = 1
export type YahooAnkuendigteDividende = {
  symbol: string
  zahlungsdatumIso: string
  exDatumIso: string | null
  dividendeProStueckEur: number
}

function tagAusUnix(sec: number): string | null {
  if (!Number.isFinite(sec) || sec <= 0) return null
  const d = new Date(sec * 1000)
  if (!Number.isFinite(d.getTime())) return null
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

function rawUnix(v: unknown): number | null {
  if (v == null || typeof v !== 'object') return null
  const raw = (v as { raw?: number }).raw
  return raw != null && Number.isFinite(raw) ? raw : null
}

function rawNumber(v: unknown): number | null {
  const n = rawUnix(v)
  if (n != null && n > 0) return n
  if (typeof v === 'number' && Number.isFinite(v) && v > 0) return v
  return null
}

type DivEvent = { amount: number; datumIso: string; unix: number }

/** Nur Dividenden-Termine ab heute, höchstens +1 Jahr. */
async function ladeChartDividendenZukunft(symbol: string, heute: string, bis: string): Promise<DivEvent[]> {
  const sym = symbol.trim().toUpperCase()
  if (!sym) return []

  const start = Math.floor(
    Date.UTC(Number(heute.slice(0, 4)), Number(heute.slice(5, 7)) - 1, Number(heute.slice(8, 10))) / 1000,
  )
  const end = Math.floor(
    Date.UTC(Number(bis.slice(0, 4)), Number(bis.slice(5, 7)) - 1, Number(bis.slice(8, 10))) / 1000,
  ) + 86400

  const u = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}`)
  u.searchParams.set('interval', '1d')
  u.searchParams.set('period1', String(start))
  u.searchParams.set('period2', String(end))
  u.searchParams.set('events', 'div')

  try {
    const res = await fetch(u.toString(), {
      headers: YAHOO_FINANCE_FETCH_HEADERS,
      next: { revalidate: CACHE_REVALIDATE },
    })
    if (!res.ok) return []
    const j = (await res.json()) as {
      chart?: {
        result?: Array<{
          events?: {
            dividends?: Record<string, { amount?: number; date?: number }>
          }
        }>
      }
    }
    const divs = j.chart?.result?.[0]?.events?.dividends ?? {}
    const out: DivEvent[] = []
    for (const entry of Object.values(divs)) {
      const unix = entry?.date
      const amount = entry?.amount
      if (unix == null || amount == null || !Number.isFinite(amount) || amount <= 0) continue
      const datumIso = tagAusUnix(unix)
      if (!datumIso || datumIso < heute || datumIso > bis) continue
      out.push({ amount, datumIso, unix })
    }
    out.sort((a, b) => a.unix - b.unix)
    return out
  } catch {
    return []
  }
}

async function ladeQuoteSummaryKalender(
  symbol: string,
  heute: string,
  bis: string,
): Promise<{
  exDatumIso: string | null
  zahlungsdatumIso: string | null
  letzteDividendeProStueck: number | null
}> {
  const sym = symbol.trim().toUpperCase()
  if (!sym) return { exDatumIso: null, zahlungsdatumIso: null, letzteDividendeProStueck: null }

  const auth = await holeYahooFinanceAuth()
  if (!auth) return { exDatumIso: null, zahlungsdatumIso: null, letzteDividendeProStueck: null }

  const u = new URL(
    `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(sym)}`,
  )
  u.searchParams.set('modules', 'calendarEvents,defaultKeyStatistics')
  u.searchParams.set('crumb', auth.crumb)

  try {
    const res = await fetch(u.toString(), {
      headers: {
        ...YAHOO_FINANCE_FETCH_HEADERS,
        Cookie: auth.cookie,
      },
      next: { revalidate: CACHE_REVALIDATE },
    })
    if (!res.ok) return { exDatumIso: null, zahlungsdatumIso: null, letzteDividendeProStueck: null }
    const j = (await res.json()) as {
      quoteSummary?: {
        result?: Array<{
          calendarEvents?: {
            exDividendDate?: unknown
            dividendDate?: unknown
          }
          defaultKeyStatistics?: {
            lastDividendValue?: unknown
          }
        }>
      }
    }
    const row = j.quoteSummary?.result?.[0]
    const cal = row?.calendarEvents
    const exUnix = rawUnix(cal?.exDividendDate)
    const payUnix = rawUnix(cal?.dividendDate)

    let exDatumIso = exUnix != null ? tagAusUnix(exUnix) : null
    let zahlungsdatumIso = payUnix != null ? tagAusUnix(payUnix) : null

    if (exDatumIso && (exDatumIso < heute || exDatumIso > bis)) exDatumIso = null
    if (zahlungsdatumIso && (zahlungsdatumIso < heute || zahlungsdatumIso > bis)) {
      zahlungsdatumIso = null
    }

    const letzteDividendeProStueck = rawNumber(row?.defaultKeyStatistics?.lastDividendValue)

    return { exDatumIso, zahlungsdatumIso, letzteDividendeProStueck }
  } catch {
    return { exDatumIso: null, zahlungsdatumIso: null, letzteDividendeProStueck: null }
  }
}

/** Nächste angekündigte Dividende — nur Termine ab heute, max. +1 Jahr. */
export async function ladeYahooAnkuendigteDividende(symbol: string): Promise<YahooAnkuendigteDividende | null> {
  const sym = symbol.trim().toUpperCase()
  if (!sym) return null

  const heute = heuteIsoUtc()
  const bis = isoInJahren(HORIZONT_JAHRE)

  const [kalender, events] = await Promise.all([
    ladeQuoteSummaryKalender(sym, heute, bis),
    ladeChartDividendenZukunft(sym, heute, bis),
  ])

  const naechstesEvent = events[0] ?? null

  let zahlungsdatumIso = kalender.zahlungsdatumIso
  let exDatumIso = kalender.exDatumIso

  if (!zahlungsdatumIso && exDatumIso) {
    zahlungsdatumIso = exDatumIso
  }
  if (!zahlungsdatumIso && naechstesEvent) {
    zahlungsdatumIso = naechstesEvent.datumIso
    exDatumIso = exDatumIso ?? naechstesEvent.datumIso
  }

  if (!zahlungsdatumIso || zahlungsdatumIso < heute || zahlungsdatumIso > bis) return null

  let dividendeProStueckEur: number | null = null
  if (naechstesEvent) {
    if (naechstesEvent.datumIso === zahlungsdatumIso || naechstesEvent.datumIso === exDatumIso) {
      dividendeProStueckEur = naechstesEvent.amount
    }
  }
  if (dividendeProStueckEur == null && naechstesEvent) {
    dividendeProStueckEur = naechstesEvent.amount
  }
  if (dividendeProStueckEur == null && kalender.letzteDividendeProStueck != null) {
    dividendeProStueckEur = kalender.letzteDividendeProStueck
  }

  if (dividendeProStueckEur == null || dividendeProStueckEur <= 0) return null

  return {
    symbol: sym,
    zahlungsdatumIso,
    exDatumIso,
    dividendeProStueckEur: Math.round(dividendeProStueckEur * 10000) / 10000,
  }
}
