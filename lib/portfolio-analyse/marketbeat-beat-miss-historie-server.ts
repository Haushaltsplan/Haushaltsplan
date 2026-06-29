import 'server-only'

import type { Berichtszeit } from '@/lib/portfolio-analyse/earnings-berichtszeit'
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

export type MarketbeatKalenderEintrag = {
  terminDatumIso: string
  berichtszeit: Berichtszeit | null
}

function berichtszeitAusMarketbeatText(text: string): Berichtszeit | null {
  const t = text.toLowerCase()
  if (/before\s+market\s+open|pre[- ]?market|bmo\b/.test(t)) return 'vor_boersenoeffnung'
  if (/after\s+market\s+close|after[- ]?hours|amc\b/.test(t)) return 'nach_handelsschluss'
  return null
}

/** Kommende + geschätzte Termine aus MarketBeat Earnings-Seite. */
export function parseMarketbeatKalenderTermine(
  html: string,
  vonIso: string,
  bisIso: string,
): MarketbeatKalenderEintrag[] {
  const seen = new Set<string>()
  const out: MarketbeatKalenderEintrag[] = []
  const pageZeit = berichtszeitAusMarketbeatText(html)

  const push = (iso: string, berichtszeit = pageZeit) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return
    if (iso < vonIso || iso > bisIso || seen.has(iso)) return
    seen.add(iso)
    out.push({ terminDatumIso: iso, berichtszeit })
  }

  const tableMatch = html.match(/<table[^>]*id="earnings-history"[\s\S]*?<\/table>/i)
  if (tableMatch) {
    for (const tr of tableMatch[0].matchAll(/<tr>([\s\S]*?)<\/tr>/gi)) {
      const tds = [...tr[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => m[1])
      if (tds.length < 2) continue
      const datumText = zellenText(tds[0]!)
      const period = periodAusDatum(datumText.replace(/\(Estimated\)/i, '').trim())
      if (!period) continue
      if (/estimated/i.test(datumText)) push(period)
    }
  }

  const nextBlock = html.match(/Next\s+Earnings\s+Date[\s\S]{0,500}/i)?.[0] ?? ''
  const nextM = /(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(nextBlock)
  if (nextM) {
    push(
      `${nextM[3]}-${nextM[1].padStart(2, '0')}-${nextM[2].padStart(2, '0')}`,
      berichtszeitAusMarketbeatText(nextBlock) ?? pageZeit,
    )
  }

  for (const m of html.matchAll(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s*\(Estimated\)/gi)) {
    push(`${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`)
  }

  return out.sort((a, b) => a.terminDatumIso.localeCompare(b.terminDatumIso))
}

/** IPO-/Listing-Datum aus MarketBeat-Profil (Scraper). */
export function parseMarketbeatIpoDatum(html: string): string | null {
  const m =
    html.match(/IPO\s*Date[\s\S]{0,80}?(\d{1,2})\/(\d{1,2})\/(\d{4})/i) ??
    html.match(/Public\s+since[\s\S]{0,80}?(\d{1,2})\/(\d{1,2})\/(\d{4})/i)
  if (!m) return null
  return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`
}

export async function ladeMarketbeatEarningsSeiteHtml(
  ticker: string,
  symbolYahoo?: string | null,
): Promise<string | null> {
  const basis = marketbeatBasisTicker(ticker, symbolYahoo)
  const boersen = marketbeatBoersenKandidaten(symbolYahoo, ticker)
  for (const boerse of boersen) {
    const html = await ladeEarningsSeite(boerse, basis)
    if (html) return html
  }
  return null
}

export async function ladeMarketbeatEarningsKalender(opts: {
  ticker: string
  symbolYahoo?: string | null
  vonIso: string
  bisIso: string
}): Promise<MarketbeatKalenderEintrag[]> {
  const html = await ladeMarketbeatEarningsSeiteHtml(opts.ticker, opts.symbolYahoo)
  if (!html) return []
  return parseMarketbeatKalenderTermine(html, opts.vonIso, opts.bisIso)
}

async function ladeMarketbeatProfilSeite(boerse: string, basis: string): Promise<string | null> {
  const key = `profile|${boerse}|${basis}`
  const hit = pageCache.get(key)
  if (hit && hit.at + CACHE_MS > Date.now()) return hit.html

  const url = `${ORIGIN}/stocks/${encodeURIComponent(boerse)}/${encodeURIComponent(basis)}/`
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
    pageCache.set(key, { at: Date.now(), html: html.length > 10_000 ? html : null })
    return html.length > 10_000 ? html : null
  } catch {
    pageCache.set(key, { at: Date.now(), html: null })
    return null
  }
}

export async function ladeMarketbeatIpoDatum(
  ticker: string,
  symbolYahoo?: string | null,
): Promise<string | null> {
  const basis = marketbeatBasisTicker(ticker, symbolYahoo)
  for (const boerse of marketbeatBoersenKandidaten(symbolYahoo, ticker)) {
    const htmlProfil = await ladeMarketbeatProfilSeite(boerse, basis)
    if (htmlProfil) {
      const ipo = parseMarketbeatIpoDatum(htmlProfil)
      if (ipo) return ipo
    }
    const htmlEarn = await ladeEarningsSeite(boerse, basis)
    if (htmlEarn) {
      const ipo = parseMarketbeatIpoDatum(htmlEarn)
      if (ipo) return ipo
    }
  }
  return null
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
  const limit = opts.limit ?? 16

  for (const boerse of boersen) {
    const html = await ladeEarningsSeite(boerse, basis)
    if (!html) continue
    const rows = parseMarketbeatEarningsHistory(html)
    if (rows.length > 0) return rows.slice(0, limit)
  }
  return []
}
