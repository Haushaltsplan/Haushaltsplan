import { listeDividendenTermine } from '@/lib/portfolio-analyse/dividenden-prognose'
import type { DivvydiaryRohZeile } from '@/lib/portfolio-analyse/divvydiary-scraper-server'
import {
  addDaysIso,
  heuteIsoUtc,
  isoEndeNaechstesKalenderjahr,
  isoVorJahren,
  schaetzeZahlungsdatumNachEx,
} from '@/lib/portfolio-analyse/dividenden-datum-hilfen'
import {
  holeYahooFinanceAuth,
  YAHOO_FINANCE_FETCH_HEADERS,
} from '@/lib/portfolio-analyse/yahoo-finance-auth-server'

const CACHE_REVALIDATE = 86400
/** Ex vor kurzem, Zahltag fehlt bei Yahoo (EU) — nur wenn DivvyDiary nicht greift. */
const EX_LOOKBACK_TAGE = 120

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

export type YahooAnkuendigteDividendeEintrag = YahooAnkuendigteDividende & { bestaetigt: boolean }

/** Vergangene Dividenden-Termine (Chart-API) für Prognose-Muster. */
async function ladeChartDividendenHistorie(symbol: string, heute: string): Promise<DivEvent[]> {
  const sym = symbol.trim().toUpperCase()
  if (!sym) return []

  const von = isoVorJahren(12)
  const start = Math.floor(
    Date.UTC(Number(von.slice(0, 4)), Number(von.slice(5, 7)) - 1, Number(von.slice(8, 10))) / 1000,
  )
  const end = Math.floor(
    Date.UTC(Number(heute.slice(0, 4)), Number(heute.slice(5, 7)) - 1, Number(heute.slice(8, 10))) / 1000,
  )

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
      if (!datumIso || datumIso >= heute) continue
      out.push({ amount, datumIso, unix })
    }
    out.sort((a, b) => a.unix - b.unix)
    return out
  } catch {
    return []
  }
}

function chartZuRohZeilen(events: DivEvent[], symbol: string): DivvydiaryRohZeile[] {
  const sym = symbol.trim().toUpperCase()
  return events.map((e) => ({
    exDate: e.datumIso,
    payDate: schaetzeZahlungsdatumNachEx(e.datumIso, sym),
    amount: e.amount,
    forecast: false,
  }))
}

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
  erlaubeExSchaetzung: boolean,
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

    const exRoh = exUnix != null ? tagAusUnix(exUnix) : null
    const payRoh = payUnix != null ? tagAusUnix(payUnix) : null
    const exLookbackAb = addDaysIso(heute, -EX_LOOKBACK_TAGE)

    let exDatumIso: string | null = null
    let zahlungsdatumIso: string | null = null

    if (payRoh && payRoh >= heute && payRoh <= bis) zahlungsdatumIso = payRoh
    if (exRoh && exRoh >= heute && exRoh <= bis) exDatumIso = exRoh

    if (
      erlaubeExSchaetzung &&
      !zahlungsdatumIso &&
      exRoh &&
      exRoh >= exLookbackAb &&
      exRoh < heute
    ) {
      const schaetz = schaetzeZahlungsdatumNachEx(exRoh, sym)
      if (schaetz >= heute && schaetz <= bis) {
        zahlungsdatumIso = schaetz
        exDatumIso = exRoh
      }
    }

    const letzteDividendeProStueck = rawNumber(row?.defaultKeyStatistics?.lastDividendValue)

    return { exDatumIso, zahlungsdatumIso, letzteDividendeProStueck }
  } catch {
    return { exDatumIso: null, zahlungsdatumIso: null, letzteDividendeProStueck: null }
  }
}

/** Alle Termine: Kalender/Chart-Zukunft + Prognose aus Yahoo-Historie. */
export async function ladeYahooAnkuendigteDividenden(
  symbol: string,
  opts?: { erlaubeExSchaetzung?: boolean },
): Promise<YahooAnkuendigteDividendeEintrag[]> {
  const sym = symbol.trim().toUpperCase()
  if (!sym) return []

  const heute = heuteIsoUtc()
  const bis = isoEndeNaechstesKalenderjahr()
  const erlaubeExSchaetzung = opts?.erlaubeExSchaetzung !== false

  const [kalender, events, historie] = await Promise.all([
    ladeQuoteSummaryKalender(sym, heute, bis, erlaubeExSchaetzung),
    ladeChartDividendenZukunft(sym, heute, bis),
    ladeChartDividendenHistorie(sym, heute),
  ])

  const rows: DivvydiaryRohZeile[] = chartZuRohZeilen(historie, sym)

  if (kalender.zahlungsdatumIso) {
    const amt =
      kalender.letzteDividendeProStueck ??
      events.find((e) => e.datumIso === kalender.zahlungsdatumIso)?.amount ??
      historie[historie.length - 1]?.amount ??
      0
    if (amt > 0) {
      rows.push({
        exDate: kalender.exDatumIso ?? kalender.zahlungsdatumIso,
        payDate: kalender.zahlungsdatumIso,
        amount: amt,
        forecast: false,
      })
    }
  }

  for (const e of events) {
    rows.push({
      exDate: e.datumIso,
      payDate: e.datumIso,
      amount: e.amount,
      forecast: false,
    })
  }

  const termine = listeDividendenTermine(rows, heute, bis)
  return termine.map((t) => ({
    symbol: sym,
    zahlungsdatumIso: t.payDate,
    exDatumIso: t.exDate,
    dividendeProStueckEur: t.amount,
    bestaetigt: t.bestaetigt,
  }))
}

/** Nächste angekündigte Dividende — nur Termine ab heute, max. +1 Jahr. */
export async function ladeYahooAnkuendigteDividende(
  symbol: string,
  opts?: { erlaubeExSchaetzung?: boolean },
): Promise<YahooAnkuendigteDividende | null> {
  const alle = await ladeYahooAnkuendigteDividenden(symbol, opts)
  const first = alle[0]
  if (!first) return null
  const { bestaetigt: _b, ...rest } = first
  return rest
}
