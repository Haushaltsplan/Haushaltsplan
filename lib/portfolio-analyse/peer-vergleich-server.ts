import 'server-only'

import { baueKontextWerte } from '@/lib/portfolio-analyse/fundamentaldaten-kontext-werte'
import { loesePeerDatenTicker, peersFuerTicker } from '@/lib/portfolio-analyse/peer-vergleich-data'
import {
  ladeMacrotrendsFundamentaldaten,
  loeseMacrotrendsIdent,
} from '@/lib/portfolio-analyse/macrotrends-scraper-server'
import { ladeYahooMantraFinanzdaten } from '@/lib/portfolio-analyse/yahoo-fundamentals-timeseries-server'
import { holeYahooFinanceAuth } from '@/lib/portfolio-analyse/yahoo-finance-auth-server'
import type { YahooFundamentalKennzahlen } from '@/lib/portfolio-analyse/fundamentaldaten-key-metrics'

const CACHE_MS = 24 * 60 * 60 * 1000
const cache = new Map<string, { at: number; data: PeerVergleichPaket }>()

export type PeerKennzahlen = {
  ticker: string
  roic: number | null
  fcfMarge: number | null
  ruleOf40: number | null
  netDebtEbitda: number | null
}

export type PeerVergleichPaket = {
  ok: boolean
  ticker: string
  subject: PeerKennzahlen
  peers: PeerKennzahlen[]
  median: PeerKennzahlen
  geladenAm: string
  fehler?: string | null
}

const YAHOO_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'

function rawNum(o: Record<string, { raw?: number }> | undefined, k: string): number | undefined {
  const v = o?.[k]?.raw
  return v != null && Number.isFinite(v) ? v : undefined
}

async function ladeYahooKurz(symbol: string): Promise<YahooFundamentalKennzahlen | null> {
  const auth = await holeYahooFinanceAuth()
  if (!auth) return null
  const u = new URL(`https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}`)
  u.searchParams.set('modules', 'defaultKeyStatistics,financialData')
  u.searchParams.set('crumb', auth.crumb)
  const res = await fetch(u.toString(), {
    headers: { 'User-Agent': YAHOO_UA, Cookie: auth.cookie, Accept: 'application/json' },
    cache: 'no-store',
  })
  if (!res.ok) return null
  const j = (await res.json()) as {
    quoteSummary?: { result?: Array<{ defaultKeyStatistics?: Record<string, { raw?: number }>; financialData?: Record<string, { raw?: number }> }> }
  }
  const fd = j.quoteSummary?.result?.[0]?.financialData
  const dks = j.quoteSummary?.result?.[0]?.defaultKeyStatistics
  return {
    totalDebt: rawNum(fd, 'totalDebt'),
    totalCash: rawNum(fd, 'totalCash'),
    revenueGrowth: rawNum(fd, 'revenueGrowth'),
    returnOnEquity: rawNum(fd, 'returnOnEquity'),
    returnOnAssets: rawNum(fd, 'returnOnAssets'),
    payoutRatio: rawNum(dks, 'payoutRatio'),
    priceToBook: rawNum(dks, 'priceToBook'),
  }
}

async function ladePeerKennzahlen(ticker: string): Promise<PeerKennzahlen> {
  const t = ticker.trim().toUpperCase()
  const ident = await loeseMacrotrendsIdent(t, { erwarteterTicker: t })
  const roh = ident ? await ladeMacrotrendsFundamentaldaten(ident) : null
  const yahoo = await ladeYahooKurz(t)
  const yahooFinanz = await ladeYahooMantraFinanzdaten(t)
  const w = baueKontextWerte({
    yahoo,
    roh: roh ? { perioden: roh.perioden, zeilen: roh.zeilen } : null,
    schaetzungen: { perioden: [], zeilen: [] },
    yahooFinanz,
  })
  return {
    ticker: t,
    roic: w.roic,
    fcfMarge: w.fcfMarge,
    ruleOf40: w.ruleOf40,
    netDebtEbitda: w.netDebtEbitda,
  }
}

function median(values: (number | null)[]): number | null {
  const nums = values.filter((v): v is number => v != null && Number.isFinite(v)).sort((a, b) => a - b)
  if (!nums.length) return null
  const mid = Math.floor(nums.length / 2)
  return nums.length % 2 ? nums[mid]! : (nums[mid - 1]! + nums[mid]!) / 2
}

function medianRow(ticker: string, rows: PeerKennzahlen[]): PeerKennzahlen {
  return {
    ticker: `${ticker} (Median Peers)`,
    roic: median(rows.map((r) => r.roic)),
    fcfMarge: median(rows.map((r) => r.fcfMarge)),
    ruleOf40: median(rows.map((r) => r.ruleOf40)),
    netDebtEbitda: median(rows.map((r) => r.netDebtEbitda)),
  }
}

export async function ladePeerVergleich(opts: {
  ticker: string
  isin?: string | null
  force?: boolean
}): Promise<PeerVergleichPaket> {
  const ticker = opts.ticker.trim().toUpperCase()
  const key = `${ticker}|${opts.isin ?? ''}`
  const hit = cache.get(key)
  if (hit && hit.at + CACHE_MS > Date.now() && !opts.force) return hit.data

  try {
    const subjectTicker = loesePeerDatenTicker(ticker, opts.isin)
    const subject = await ladePeerKennzahlen(subjectTicker)
    subject.ticker = ticker
    const peerTickers = peersFuerTicker(ticker, opts.isin)
    const peers: PeerKennzahlen[] = []
    for (const p of peerTickers) {
      try {
        peers.push(await ladePeerKennzahlen(p))
      } catch {
        /* skip peer */
      }
    }

    const paket: PeerVergleichPaket = {
      ok: true,
      ticker,
      subject,
      peers,
      median: medianRow(ticker, peers),
      geladenAm: new Date().toISOString(),
    }
    cache.set(key, { at: Date.now(), data: paket })
    return paket
  } catch (e) {
    return {
      ok: false,
      ticker,
      subject: { ticker, roic: null, fcfMarge: null, ruleOf40: null, netDebtEbitda: null },
      peers: [],
      median: { ticker: 'Median', roic: null, fcfMarge: null, ruleOf40: null, netDebtEbitda: null },
      geladenAm: new Date().toISOString(),
      fehler: e instanceof Error ? e.message : 'Peer-Vergleich fehlgeschlagen',
    }
  }
}

/** Peer-Vergleich aus bereits geladenen Kontext-Werten (schneller im Fundamentaldaten-Paket). */
export async function ladePeerVergleichMitSubject(
  subject: PeerKennzahlen,
  isin?: string | null,
  force?: boolean,
): Promise<PeerVergleichPaket> {
  const ticker = subject.ticker
  const key = `${ticker}|${isin ?? ''}|subject`
  const hit = cache.get(key)
  if (hit && hit.at + CACHE_MS > Date.now() && !force) return hit.data

  const peerTickers = peersFuerTicker(ticker, isin)
  const peers: PeerKennzahlen[] = []
  for (const p of peerTickers) {
    try {
      peers.push(await ladePeerKennzahlen(p))
    } catch {
      /* skip */
    }
  }

  const paket: PeerVergleichPaket = {
    ok: peers.length > 0,
    ticker,
    subject,
    peers,
    median: medianRow(ticker, peers),
    geladenAm: new Date().toISOString(),
    fehler: peers.length === 0 ? 'Keine Peer-Daten geladen.' : null,
  }
  cache.set(key, { at: Date.now(), data: paket })
  return paket
}
