import { berichtszeitAusYahooUnix } from '@/lib/portfolio-analyse/earnings-berichtszeit'
import type { Berichtszeit } from '@/lib/portfolio-analyse/earnings-berichtszeit'
import { brokerSymbolKandidaten } from '@/lib/portfolio-analyse/dividenden-datum-hilfen'
import {
  holeYahooFinanceAuth,
  YAHOO_FINANCE_FETCH_HEADERS,
} from '@/lib/portfolio-analyse/yahoo-finance-auth-server'
import type { EarningsSchaetzungen } from '@/lib/portfolio-analyse/earnings-schaetzungen'

const CACHE_REVALIDATE = 3600

type YahooFmt = { raw?: number; fmt?: string; longFmt?: string }

function tagAusUnix(sec: number): string | null {
  if (!Number.isFinite(sec) || sec <= 0) return null
  const d = new Date(sec * 1000)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

function rawUnix(v: unknown): number | null {
  if (v == null || typeof v !== 'object') return null
  const raw = (v as YahooFmt).raw
  return raw != null && Number.isFinite(raw) ? raw : null
}

function spanne(low: unknown, avg: unknown, high: unknown) {
  const a = rawUnix(avg)
  const fmt = (avg as YahooFmt)?.fmt ?? null
  return {
    low: rawUnix(low),
    high: rawUnix(high),
    average: a,
    averageAnzeige: fmt,
  }
}

function parseEarningsBlock(earnings: Record<string, unknown> | undefined): EarningsSchaetzungen | null {
  if (!earnings || typeof earnings !== 'object') return null

  const dates = Array.isArray(earnings.earningsDate) ? earnings.earningsDate : []
  const firstDate = dates[0] as { raw?: number; fmt?: string } | undefined
  const terminDatumIso =
    firstDate?.fmt?.slice(0, 10) ??
    (firstDate?.raw != null ? tagAusUnix(firstDate.raw) : null)

  const callDates = Array.isArray(earnings.earningsCallDate) ? earnings.earningsCallDate : []
  const firstCall = callDates[0] as { raw?: number; fmt?: string } | undefined
  const earningsCallDateIso =
    firstCall?.fmt?.slice(0, 10) ??
    (firstCall?.raw != null ? tagAusUnix(firstCall.raw) : null)

  const eps = spanne(earnings.earningsLow, earnings.earningsAverage, earnings.earningsHigh)
  const umsatz = spanne(earnings.revenueLow, earnings.revenueAverage, earnings.revenueHigh)

  if (eps.average == null && umsatz.average == null) return null

  return {
    quelle: 'yahoo',
    terminDatumIso,
    isEarningsDateEstimate: earnings.isEarningsDateEstimate === true,
    earningsCallDateIso,
    eps,
    umsatz,
    kennzahlen: [],
    weitereKennzahlen: [],
    quartalsPrognose: null,
  }
}

export async function ladeYahooEarningsSchaetzungen(symbol: string): Promise<EarningsSchaetzungen | null> {
  const sym = symbol.trim().toUpperCase()
  if (!sym) return null

  const auth = await holeYahooFinanceAuth()
  if (!auth) return null

  const u = new URL(
    `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(sym)}`,
  )
  u.searchParams.set('modules', 'calendarEvents')
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
      quoteSummary?: { result?: Array<{ calendarEvents?: { earnings?: Record<string, unknown> } }> }
    }
    const earnings = j.quoteSummary?.result?.[0]?.calendarEvents?.earnings
    const parsed = parseEarningsBlock(earnings)
    return parsed
  } catch {
    return null
  }
}

export async function ladeYahooEarningsSchaetzungenKandidaten(symbole: string[]): Promise<EarningsSchaetzungen | null> {
  const uniq: string[] = []
  for (const s of symbole) {
    for (const t of brokerSymbolKandidaten(s)) {
      if (t && !uniq.includes(t)) uniq.push(t)
    }
  }
  for (const sym of uniq) {
    const hit = await ladeYahooEarningsSchaetzungen(sym)
    if (hit) return hit
  }
  return null
}

export type YahooEarningsKalenderTermin = {
  terminDatumIso: string
  bestaetigt: boolean
  berichtszeit: Berichtszeit | null
}

function parseKalenderTermineAusEarnings(
  earnings: Record<string, unknown>,
): YahooEarningsKalenderTermin[] {
  const dates = Array.isArray(earnings.earningsDate) ? earnings.earningsDate : []
  const bestaetigt = earnings.isEarningsDateEstimate !== true
  const out: YahooEarningsKalenderTermin[] = []
  const seen = new Set<string>()

  for (const entry of dates) {
    const d = entry as { raw?: number; fmt?: string } | undefined
    const terminDatumIso =
      d?.fmt?.slice(0, 10) ?? (d?.raw != null ? tagAusUnix(d.raw) : null)
    if (!terminDatumIso || seen.has(terminDatumIso)) continue
    seen.add(terminDatumIso)
    out.push({
      terminDatumIso,
      bestaetigt,
      berichtszeit: berichtszeitAusYahooUnix(d?.raw ?? null),
    })
  }

  return out.sort((a, b) => a.terminDatumIso.localeCompare(b.terminDatumIso))
}

async function ladeYahooEarningsKalenderRoh(symbol: string): Promise<YahooEarningsKalenderTermin[]> {
  const sym = symbol.trim().toUpperCase()
  if (!sym) return []

  const auth = await holeYahooFinanceAuth()
  if (!auth) return []

  const u = new URL(
    `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(sym)}`,
  )
  u.searchParams.set('modules', 'calendarEvents')
  u.searchParams.set('crumb', auth.crumb)

  try {
    const res = await fetch(u.toString(), {
      headers: {
        ...YAHOO_FINANCE_FETCH_HEADERS,
        Cookie: auth.cookie,
      },
      next: { revalidate: CACHE_REVALIDATE },
    })
    if (!res.ok) return []
    const j = (await res.json()) as {
      quoteSummary?: { result?: Array<{ calendarEvents?: { earnings?: Record<string, unknown> } }> }
    }
    const earnings = j.quoteSummary?.result?.[0]?.calendarEvents?.earnings
    if (!earnings || typeof earnings !== 'object') return []

    return parseKalenderTermineAusEarnings(earnings as Record<string, unknown>)
  } catch {
    return []
  }
}

/** Alle Yahoo-Earnings-Termine im Zeitraum (calendarEvents). */
export async function ladeYahooEarningsKalenderImZeitraum(
  symbole: string[],
  vonIso: string,
  bisIso: string,
): Promise<YahooEarningsKalenderTermin[]> {
  const uniq: string[] = []
  for (const s of symbole) {
    for (const t of brokerSymbolKandidaten(s)) {
      if (t && !uniq.includes(t)) uniq.push(t)
    }
  }

  for (const sym of uniq) {
    const termine = await ladeYahooEarningsKalenderRoh(sym)
    const imZeitraum = termine.filter((t) => t.terminDatumIso >= vonIso && t.terminDatumIso <= bisIso)
    if (imZeitraum.length > 0) return imZeitraum
  }
  return []
}

export async function ladeYahooEarningsKalenderTerminKandidaten(
  symbole: string[],
): Promise<YahooEarningsKalenderTermin | null> {
  const uniq: string[] = []
  for (const s of symbole) {
    for (const t of brokerSymbolKandidaten(s)) {
      if (t && !uniq.includes(t)) uniq.push(t)
    }
  }
  for (const sym of uniq) {
    const hits = await ladeYahooEarningsKalenderRoh(sym)
    if (hits.length > 0) return hits[0]
  }
  return null
}
