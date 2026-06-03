const YAHOO_FETCH_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  Referer: 'https://finance.yahoo.com/',
  Accept: 'application/json',
} as const

const CACHE_REVALIDATE = 86400

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

function heuteIsoUtc(): string {
  const d = new Date()
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

function rawUnix(v: unknown): number | null {
  if (v == null || typeof v !== 'object') return null
  const raw = (v as { raw?: number }).raw
  return raw != null && Number.isFinite(raw) ? raw : null
}

function rawNumber(v: unknown): number | null {
  if (v == null || typeof v !== 'object') return null
  const raw = (v as { raw?: number }).raw
  return raw != null && Number.isFinite(raw) && raw > 0 ? raw : null
}

type DivEvent = { amount: number; datumIso: string; unix: number }

async function ladeChartDividendenEvents(symbol: string, heute: string): Promise<DivEvent[]> {
  const sym = symbol.trim().toUpperCase()
  if (!sym) return []

  const start = Math.floor(Date.UTC(Number(heute.slice(0, 4)), Number(heute.slice(5, 7)) - 1, Number(heute.slice(8, 10))) / 1000) - 86400 * 400
  const end = start + 86400 * 800

  const u = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}`)
  u.searchParams.set('interval', '1d')
  u.searchParams.set('period1', String(start))
  u.searchParams.set('period2', String(end))
  u.searchParams.set('events', 'div')

  try {
    const res = await fetch(u.toString(), {
      headers: YAHOO_FETCH_HEADERS,
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
      if (!datumIso) continue
      out.push({ amount, datumIso, unix })
    }
    out.sort((a, b) => a.unix - b.unix)
    return out
  } catch {
    return []
  }
}

async function ladeQuoteSummaryKalender(symbol: string): Promise<{
  exDatumIso: string | null
  zahlungsdatumIso: string | null
  lastDividend: number | null
  dividendRateAnnual: number | null
}> {
  const sym = symbol.trim().toUpperCase()
  if (!sym) {
    return { exDatumIso: null, zahlungsdatumIso: null, lastDividend: null, dividendRateAnnual: null }
  }

  const u = new URL(
    `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(sym)}`,
  )
  u.searchParams.set('modules', 'calendarEvents,summaryDetail,defaultKeyStatistics')

  try {
    const res = await fetch(u.toString(), {
      headers: YAHOO_FETCH_HEADERS,
      next: { revalidate: CACHE_REVALIDATE },
    })
    if (!res.ok) {
      return { exDatumIso: null, zahlungsdatumIso: null, lastDividend: null, dividendRateAnnual: null }
    }
    const j = (await res.json()) as {
      quoteSummary?: {
        result?: Array<{
          calendarEvents?: {
            exDividendDate?: unknown
            dividendDate?: unknown
          }
          summaryDetail?: {
            dividendRate?: unknown
            trailingAnnualDividendRate?: unknown
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
    const lastDividend =
      rawNumber(row?.defaultKeyStatistics?.lastDividendValue) ??
      rawNumber(row?.summaryDetail?.trailingAnnualDividendRate)
    const dividendRateAnnual = rawNumber(row?.summaryDetail?.dividendRate)

    return {
      exDatumIso: exUnix != null ? tagAusUnix(exUnix) : null,
      zahlungsdatumIso: payUnix != null ? tagAusUnix(payUnix) : null,
      lastDividend,
      dividendRateAnnual,
    }
  } catch {
    return { exDatumIso: null, zahlungsdatumIso: null, lastDividend: null, dividendRateAnnual: null }
  }
}

/** Nächste angekündigte Dividende für ein Yahoo-Symbol (nur dieses Symbol). */
export async function ladeYahooAnkuendigteDividende(symbol: string): Promise<YahooAnkuendigteDividende | null> {
  const sym = symbol.trim().toUpperCase()
  if (!sym) return null

  const heute = heuteIsoUtc()
  const [kalender, events] = await Promise.all([
    ladeQuoteSummaryKalender(sym),
    ladeChartDividendenEvents(sym, heute),
  ])

  const zukunftEvents = events.filter((e) => e.datumIso >= heute)
  const naechstesEvent = zukunftEvents[0] ?? null

  let zahlungsdatumIso = kalender.zahlungsdatumIso
  let exDatumIso = kalender.exDatumIso

  if (zahlungsdatumIso && zahlungsdatumIso < heute) zahlungsdatumIso = null
  if (exDatumIso && exDatumIso < heute) exDatumIso = null

  if (!zahlungsdatumIso && exDatumIso) {
    zahlungsdatumIso = exDatumIso
  }
  if (!zahlungsdatumIso && naechstesEvent) {
    zahlungsdatumIso = naechstesEvent.datumIso
    exDatumIso = exDatumIso ?? naechstesEvent.datumIso
  }

  if (!zahlungsdatumIso) return null

  let dividendeProStueckEur: number | null = null

  if (naechstesEvent && naechstesEvent.datumIso === zahlungsdatumIso) {
    dividendeProStueckEur = naechstesEvent.amount
  } else if (naechstesEvent && exDatumIso && naechstesEvent.datumIso === exDatumIso) {
    dividendeProStueckEur = naechstesEvent.amount
  } else if (naechstesEvent) {
    dividendeProStueckEur = naechstesEvent.amount
  }

  if (dividendeProStueckEur == null && kalender.lastDividend != null) {
    dividendeProStueckEur = kalender.lastDividend
  }

  if (dividendeProStueckEur == null && kalender.dividendRateAnnual != null) {
    dividendeProStueckEur = Math.round((kalender.dividendRateAnnual / 4) * 10000) / 10000
  }

  const letzteHistorie = events.filter((e) => e.datumIso < heute).at(-1)
  if (dividendeProStueckEur == null && letzteHistorie) {
    dividendeProStueckEur = letzteHistorie.amount
  }

  if (dividendeProStueckEur == null || dividendeProStueckEur <= 0) return null

  return {
    symbol: sym,
    zahlungsdatumIso,
    exDatumIso,
    dividendeProStueckEur: Math.round(dividendeProStueckEur * 10000) / 10000,
  }
}
