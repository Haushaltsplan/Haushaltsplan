/**
 * Insider-Käufe — OpenInsider.com (SEC Form 4, HTML-Scraper).
 */

import 'server-only'

import { heuteIsoUtc, tageZwischenIso } from '@/lib/portfolio-analyse/dividenden-datum-hilfen'
import {
  INSIDER_CLUSTER_MAX_TAGE,
  INSIDER_CLUSTER_MIN_BUYS,
  INSIDER_CLUSTER_MIN_INSIDERS,
  INSIDER_MIN_VALUE_USD,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-constants'
import type {
  MomentumInsiderCluster,
  MomentumInsiderKauf,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-trader-types'

const CACHE_MS = 6 * 60 * 60 * 1000
const pageCache = new Map<string, { at: number; kauefe: MomentumInsiderKauf[] }>()

const FETCH_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  Accept: 'text/html',
  Referer: 'https://openinsider.com/',
} as const

function zellenText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseDatum(text: string): string | null {
  const iso = /(\d{4})-(\d{2})-(\d{2})/.exec(text)
  if (iso) return iso[0]
  const us = /(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(text)
  if (!us) return null
  return `${us[3]}-${us[1].padStart(2, '0')}-${us[2].padStart(2, '0')}`
}

function parseGeld(text: string): number | null {
  const m = text.replace(/,/g, '').match(/\$?\s*([\d.]+)\s*([kmb])?/i)
  if (!m) return null
  let n = Number(m[1])
  if (!Number.isFinite(n)) return null
  const suf = (m[2] ?? '').toLowerCase()
  if (suf === 'k') n *= 1_000
  if (suf === 'm') n *= 1_000_000
  if (suf === 'b') n *= 1_000_000_000
  return Math.round(n)
}

function parseMenge(text: string): number | null {
  const m = text.replace(/,/g, '').match(/\+?(-?\d[\d.]*)/)
  if (!m) return null
  const n = Number(m[1])
  return Number.isFinite(n) ? n : null
}

function parseTinytableRow(tds: string[], sym: string): MomentumInsiderKauf | null {
  if (tds.length < 10) return null
  if (!tds.some((t) => t.toUpperCase() === sym) && !tds.join(' ').toUpperCase().includes(sym)) return null

  const typCol = tds.find((t) => /P - Purchase|S - Sale/i.test(t)) ?? ''
  if (!/P - Purchase/i.test(typCol)) return null

  const filingDate = parseDatum(tds[0] ?? '') ?? parseDatum(tds[1] ?? '')
  const tradeDate = parseDatum(tds[1] ?? '') ?? filingDate
  if (!tradeDate) return null

  const valueZelle = tds.find((t) => /\$|k\b|m\b/i.test(t) && parseGeld(t) != null) ?? ''
  const valueUsd = parseGeld(valueZelle)
  if (valueUsd != null && valueUsd < INSIDER_MIN_VALUE_USD) return null

  const qtyZelle = tds.find((t) => /^\+?[\d,]+$/.test(t.replace(/\s/g, ''))) ?? ''
  const priceZelle = tds.find((t) => /^\$?[\d.]+$/.test(t.replace(/\s/g, ''))) ?? ''
  const insiderName = tds[4] ?? tds[3] ?? 'Unbekannt'
  const title = tds[5] ?? tds[4] ?? null

  return {
    symbol: sym,
    tradeDate,
    filingDate: filingDate ?? tradeDate,
    insiderName,
    title: title && title !== insiderName ? title : null,
    tradeType: 'purchase',
    valueUsd,
    qty: parseMenge(qtyZelle),
    price: parseGeld(priceZelle),
  }
}

/** OpenInsider-Screener-Tabelle parsen. */
export function parseOpenInsiderKauefe(html: string, symbol: string): MomentumInsiderKauf[] {
  const sym = symbol.trim().toUpperCase()
  const out: MomentumInsiderKauf[] = []
  const seen = new Set<string>()

  const tableHtml = html.match(/<table[^>]*class="tinytable"[^>]*>([\s\S]*?)<\/table>/i)?.[1] ?? html

  for (const row of tableHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const tds = [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => zellenText(m[1]))
    const parsed = parseTinytableRow(tds, sym)
    if (!parsed) continue
    const key = parsed.tradeDate + parsed.insiderName + (parsed.valueUsd ?? 0)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(parsed)
  }

  if (out.length === 0) {
    for (const row of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
      const tds = [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => zellenText(m[1]))
      const parsed = parseTinytableRow(tds, sym)
      if (!parsed) continue
      const key = parsed.tradeDate + parsed.insiderName + (parsed.valueUsd ?? 0)
      if (seen.has(key)) continue
      seen.add(key)
      out.push(parsed)
    }
  }

  return out.sort((a, b) => b.tradeDate.localeCompare(a.tradeDate))
}

/** Cluster: mehrere Insider-Käufe im Fenster. */
export function findeInsiderCluster(
  kauefe: MomentumInsiderKauf[],
  fensterTage = INSIDER_CLUSTER_MAX_TAGE,
): MomentumInsiderCluster | null {
  const heute = heuteIsoUtc()
  const recent = kauefe.filter(
    (k) =>
      k.tradeType === 'purchase' &&
      tageZwischenIso(k.tradeDate, heute) <= fensterTage &&
      (k.valueUsd == null || k.valueUsd >= INSIDER_MIN_VALUE_USD),
  )
  if (recent.length < INSIDER_CLUSTER_MIN_BUYS) return null

  const insiderSet = new Set(recent.map((k) => k.insiderName.toLowerCase()))
  if (insiderSet.size < INSIDER_CLUSTER_MIN_INSIDERS) return null

  const gesamtWertUsd = recent.reduce((s, k) => s + (k.valueUsd ?? 0), 0) || null

  return {
    symbol: recent[0]!.symbol,
    fensterTage,
    kaufAnzahl: recent.length,
    insiderAnzahl: insiderSet.size,
    gesamtWertUsd,
    letzterKauf: recent[0]!.tradeDate,
    kauefe: recent.slice(0, 8),
  }
}

async function ladeOpenInsiderSeite(symbol: string): Promise<string | null> {
  const sym = symbol.trim().toUpperCase()
  const url =
    'https://openinsider.com/screener?s=' +
    encodeURIComponent(sym) +
    '&xp=1&xs=1&vl=' +
    INSIDER_MIN_VALUE_USD +
    '&o=-transactionDate&sortDir=1&fd=0&fdr=&td=0&tdr=&fdlyl=&fdlyh=&daysago=&filterfd=' +
    INSIDER_CLUSTER_MAX_TAGE +
    '&cnt=100&page=1'
  try {
    const res = await fetch(url, {
      headers: FETCH_HEADERS,
      cache: 'no-store',
      signal: AbortSignal.timeout(20_000),
    })
    if (!res.ok) return null
    const html = await res.text()
    return html.length > 3000 ? html : null
  } catch {
    return null
  }
}

/** Letzte Insider-Käufe für ein Symbol. */
export async function ladeInsiderKauefeFuerSymbol(symbol: string): Promise<MomentumInsiderKauf[]> {
  const sym = symbol.trim().toUpperCase()
  const cached = pageCache.get(sym)
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.kauefe

  const html = await ladeOpenInsiderSeite(sym)
  if (!html) {
    pageCache.set(sym, { at: Date.now(), kauefe: [] })
    return []
  }
  const kauefe = parseOpenInsiderKauefe(html, sym)
  pageCache.set(sym, { at: Date.now(), kauefe })
  return kauefe
}

/** Batch — max. n Symbole mit Pause. */
export async function ladeInsiderKauefeBatch(
  symbole: string[],
  max = 8,
): Promise<Map<string, MomentumInsiderKauf[]>> {
  const out = new Map<string, MomentumInsiderKauf[]>()
  const uniq = [...new Set(symbole.map((s) => s.trim().toUpperCase()).filter(Boolean))].slice(0, max)
  for (const sym of uniq) {
    const kauefe = await ladeInsiderKauefeFuerSymbol(sym)
    if (kauefe.length > 0) out.set(sym, kauefe)
    await new Promise((r) => setTimeout(r, 900))
  }
  return out
}
