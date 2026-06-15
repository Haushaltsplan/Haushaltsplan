import 'server-only'

import { marketbeatBoersenKandidaten, marketbeatBasisTicker } from '@/lib/portfolio-analyse/marketbeat-earnings-transcript-server'

const ORIGIN = 'https://www.marketbeat.com'
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
const CACHE_MS = 6 * 60 * 60 * 1000

const pageCache = new Map<string, { at: number; html: string | null }>()

export type MarketbeatBeatMissZeile = {
  quartalLabel: string
  period: string | null
  epsIst: number | null
  epsSchaetzung: number | null
  umsatzIst: number | null
  umsatzSchaetzung: number | null
}

function zellenText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseGeldBetrag(raw: string): number | null {
  const t = raw.trim()
  if (!t || t === '-' || t === '—') return null
  const m = /^\$?\s*([+-]?[\d.,]+)\s*([BMK])?$/i.exec(t.replace(/,/g, ''))
  if (!m) return null
  let n = Number(m[1])
  if (!Number.isFinite(n)) return null
  const suf = (m[2] ?? '').toUpperCase()
  if (suf === 'B') n *= 1_000_000_000
  else if (suf === 'M') n *= 1_000_000
  else if (suf === 'K') n *= 1_000
  return n
}

function quartalLabelAusText(text: string): string | null {
  const m = /^Q(\d)\s+(\d{4})/i.exec(text.trim())
  if (!m) return null
  return `Q${m[1]} ${m[2]}`
}

function periodAusDatum(text: string): string | null {
  const clean = text.replace(/\(Estimated\)/i, '').trim()
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(clean)
  if (!m) return null
  return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`
}

export function parseMarketbeatEarningsHistory(html: string): MarketbeatBeatMissZeile[] {
  const tableMatch = html.match(/<table[^>]*id="earnings-history"[\s\S]*?<\/table>/i)
  if (!tableMatch) return []

  const out: MarketbeatBeatMissZeile[] = []
  for (const tr of tableMatch[0].matchAll(/<tr>([\s\S]*?)<\/tr>/gi)) {
    const tds = [...tr[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => m[1])
    if (tds.length < 8) continue

    const datumText = zellenText(tds[0]!)
    if (/estimated/i.test(datumText)) continue

    const quartalRaw = zellenText(tds[1]!)
    const quartalLabel = quartalLabelAusText(quartalRaw)
    if (!quartalLabel) continue

    const epsSchaetzung = parseGeldBetrag(zellenText(tds[2]!))
    const epsIst = parseGeldBetrag(zellenText(tds[3]!))
    const umsatzSchaetzung = parseGeldBetrag(zellenText(tds[6]!))
    const umsatzIst = parseGeldBetrag(zellenText(tds[7]!))

    if (epsIst == null && epsSchaetzung == null && umsatzIst == null && umsatzSchaetzung == null) {
      continue
    }

    out.push({
      quartalLabel,
      period: periodAusDatum(datumText),
      epsIst,
      epsSchaetzung,
      umsatzIst,
      umsatzSchaetzung,
    })
  }

  out.sort((a, b) => (b.period ?? b.quartalLabel).localeCompare(a.period ?? a.quartalLabel))
  return out
}

async function ladeEarningsSeite(boerse: string, basis: string): Promise<string | null> {
  const key = `${boerse}|${basis}`
  const hit = pageCache.get(key)
  if (hit && hit.at + CACHE_MS > Date.now()) return hit.html

  const url = `${ORIGIN}/stocks/${encodeURIComponent(boerse)}/${encodeURIComponent(basis)}/earnings/`
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'en-US,en;q=0.9' },
      cache: 'no-store',
      signal: AbortSignal.timeout(18_000),
    })
    if (!res.ok) {
      pageCache.set(key, { at: Date.now(), html: null })
      return null
    }
    const html = await res.text()
    const ok = html.includes('id="earnings-history"') ? html : null
    pageCache.set(key, { at: Date.now(), html: ok })
    return ok
  } catch {
    pageCache.set(key, { at: Date.now(), html: null })
    return null
  }
}

export async function ladeMarketbeatBeatMissHistorie(opts: {
  ticker: string
  symbolYahoo?: string | null
  limit?: number
}): Promise<MarketbeatBeatMissZeile[]> {
  const basis = marketbeatBasisTicker(opts.ticker, opts.symbolYahoo)
  const boersen = marketbeatBoersenKandidaten(opts.symbolYahoo, opts.ticker)
  const limit = opts.limit ?? 8

  for (const boerse of boersen) {
    const html = await ladeEarningsSeite(boerse, basis)
    if (!html) continue
    const rows = parseMarketbeatEarningsHistory(html)
    if (rows.length > 0) return rows.slice(0, limit)
  }
  return []
}
