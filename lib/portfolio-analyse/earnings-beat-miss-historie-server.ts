/** Earnings Beat/Miss-Historie — letzte N Quartale vs. Schätzung. */

import 'server-only'

import {
  beatMissProzent,
  formatBeatMissProzent,
} from '@/lib/portfolio-analyse/earnings-beat-miss'
import type { QuartalsPrognoseMetrik } from '@/lib/portfolio-analyse/earnings-quartals-prognose'
import { formatEpsUsd, formatKompaktUsd } from '@/lib/portfolio-analyse/earnings-quartals-prognose'
import {
  holeYahooFinanceAuth,
  YAHOO_FINANCE_FETCH_HEADERS,
} from '@/lib/portfolio-analyse/yahoo-finance-auth-server'

const CACHE_MS = 6 * 60 * 60 * 1000
const cache = new Map<string, { at: number; data: EarningsBeatMissPaket }>()

export type BeatMissMetrik = {
  ist: number | null
  schaetzung: number | null
  surprisePct: number | null
  anzeige: string | null
}

export type BeatMissQuartal = {
  quartalLabel: string
  period: string | null
  eps: BeatMissMetrik
  umsatz: BeatMissMetrik
}

export type EarningsBeatMissPaket = {
  ok: boolean
  ticker: string
  quartale: BeatMissQuartal[]
  epsBeatRatePct: number | null
  umsatzBeatRatePct: number | null
  epsBeats: number
  umsatzBeats: number
  bewertbarEps: number
  bewertbarUmsatz: number
  guidanceHinweis: string
  geladenAm: string
  fehler?: string | null
}

type HistoryRow = {
  epsActual?: { raw?: number }
  epsEstimate?: { raw?: number }
  revenueActual?: { raw?: number }
  revenueEstimate?: { raw?: number }
  quarter?: { raw?: number }
  period?: string
}

function quartalLabel(row: HistoryRow): string | null {
  const q = row.quarter?.raw
  const period = row.period
  if (q != null && period) {
    const jahr = Number(String(period).slice(0, 4))
    if (Number.isFinite(jahr)) return `Q${q} ${jahr}`
  }
  return null
}

function metrikZeile(
  metrik: QuartalsPrognoseMetrik,
  ist: number | null | undefined,
  schaetzung: number | null | undefined,
): BeatMissMetrik {
  const istVal = ist != null && Number.isFinite(ist) ? ist : null
  const schVal = schaetzung != null && Number.isFinite(schaetzung) ? schaetzung : null
  const surprisePct = beatMissProzent(istVal, schVal)
  return {
    ist: istVal,
    schaetzung: schVal,
    surprisePct,
    anzeige: formatBeatMissProzent(surprisePct),
  }
}

function istBeat(m: BeatMissMetrik): boolean {
  return m.surprisePct != null && m.surprisePct > 0.05
}

function baueGuidanceHinweis(
  epsBeats: number,
  bewertbarEps: number,
  umsatzBeats: number,
  bewertbarUmsatz: number,
): string {
  if (bewertbarEps === 0 && bewertbarUmsatz === 0) {
    return 'Keine vergleichbaren Schätzungen in der Yahoo-Historie.'
  }
  const parts: string[] = []
  if (bewertbarEps > 0) {
    const rate = Math.round((epsBeats / bewertbarEps) * 100)
    if (rate >= 75) parts.push(`EPS: ${epsBeats}/${bewertbarEps} Beats (${rate}%) — Management guidet eher konservativ`)
    else if (rate <= 35) parts.push(`EPS: ${epsBeats}/${bewertbarEps} Beats (${rate}%) — häufige Misses, Guidance prüfen`)
    else parts.push(`EPS: ${epsBeats}/${bewertbarEps} Beats (${rate}%)`)
  }
  if (bewertbarUmsatz > 0) {
    const rate = Math.round((umsatzBeats / bewertbarUmsatz) * 100)
    parts.push(`Umsatz: ${umsatzBeats}/${bewertbarUmsatz} Beats (${rate}%)`)
  }
  return parts.join(' · ')
}

async function ladeHistoryRows(symbol: string): Promise<HistoryRow[]> {
  const sym = symbol.trim().toUpperCase()
  if (!sym) return []
  const auth = await holeYahooFinanceAuth()
  if (!auth) return []
  const u = new URL(`https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(sym)}`)
  u.searchParams.set('modules', 'earningsHistory')
  u.searchParams.set('crumb', auth.crumb)
  const res = await fetch(u.toString(), {
    headers: { ...YAHOO_FINANCE_FETCH_HEADERS, Cookie: auth.cookie },
    cache: 'no-store',
  })
  if (!res.ok) return []
  const history = (await res.json()).quoteSummary?.result?.[0]?.earningsHistory?.history ?? []
  return Array.isArray(history) ? (history as HistoryRow[]) : []
}

export async function ladeEarningsBeatMissHistorie(opts: {
  ticker: string
  symbolYahoo?: string | null
  limit?: number
  force?: boolean
}): Promise<EarningsBeatMissPaket> {
  const ticker = opts.ticker.trim().toUpperCase()
  const sym = (opts.symbolYahoo ?? ticker).trim().toUpperCase()
  const limit = opts.limit ?? 8
  const key = `${sym}|${limit}`
  const hit = cache.get(key)
  if (hit && hit.at + CACHE_MS > Date.now() && !opts.force) return hit.data

  try {
    const rows = await ladeHistoryRows(sym)
    const quartale: BeatMissQuartal[] = []

    for (const row of rows) {
      const label = quartalLabel(row)
      if (!label) continue
      quartale.push({
        quartalLabel: label,
        period: row.period ?? null,
        eps: metrikZeile('eps', row.epsActual?.raw, row.epsEstimate?.raw),
        umsatz: metrikZeile('umsatz', row.revenueActual?.raw, row.revenueEstimate?.raw),
      })
    }

    quartale.sort((a, b) => (b.period ?? '').localeCompare(a.period ?? ''))
    const trimmed = quartale.slice(0, limit)

    let epsBeats = 0
    let umsatzBeats = 0
    let bewertbarEps = 0
    let bewertbarUmsatz = 0
    for (const q of trimmed) {
      if (q.eps.ist != null && q.eps.schaetzung != null) {
        bewertbarEps++
        if (istBeat(q.eps)) epsBeats++
      }
      if (q.umsatz.ist != null && q.umsatz.schaetzung != null) {
        bewertbarUmsatz++
        if (istBeat(q.umsatz)) umsatzBeats++
      }
    }

    const paket: EarningsBeatMissPaket = {
      ok: trimmed.length > 0,
      ticker,
      quartale: trimmed,
      epsBeatRatePct: bewertbarEps > 0 ? Math.round((epsBeats / bewertbarEps) * 100) : null,
      umsatzBeatRatePct: bewertbarUmsatz > 0 ? Math.round((umsatzBeats / bewertbarUmsatz) * 100) : null,
      epsBeats,
      umsatzBeats,
      bewertbarEps,
      bewertbarUmsatz,
      guidanceHinweis: baueGuidanceHinweis(epsBeats, bewertbarEps, umsatzBeats, bewertbarUmsatz),
      geladenAm: new Date().toISOString(),
    }
    cache.set(key, { at: Date.now(), data: paket })
    return paket
  } catch (e) {
    return {
      ok: false,
      ticker,
      quartale: [],
      epsBeatRatePct: null,
      umsatzBeatRatePct: null,
      epsBeats: 0,
      umsatzBeats: 0,
      bewertbarEps: 0,
      bewertbarUmsatz: 0,
      guidanceHinweis: '',
      geladenAm: new Date().toISOString(),
      fehler: e instanceof Error ? e.message : 'Beat/Miss-Historie fehlgeschlagen',
    }
  }
}

export function formatBeatMissIst(metrik: QuartalsPrognoseMetrik, v: number): string {
  return metrik === 'eps' ? formatEpsUsd(v) : formatKompaktUsd(v)
}