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
  Referer: 'http://openinsider.com/',
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

function tradeTypAusText(text: string): 'purchase' | 'sale' | null {
  const t = text.toLowerCase()
  if (/\bp\b|purchase|buy/.test(t) && !/sale/.test(t)) return 'purchase'
  if (/\bs\b|sale|sell/.test(t)) return 'sale'
  return null
}

/** OpenInsider-Screener-Tabelle parsen. */
export function parseOpenInsiderKauefe(html: string, symbol: string): MomentumInsiderKauf[] {
  const sym = symbol.trim().toUpperCase()
  const out: MomentumInsiderKauf[] = []
  const seen = new Set<string>()

  for (const row of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const tds = [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => zellenText(m[1]))
    if (tds.length < 8) continue

    const rowText = tds.join(' ')
    const typ = tradeTypAusText(rowText)
    if (!typ) continue

    const tickerZelle = tds.find((t) => t.toUpperCase() === sym) ?? tds[2] ?? ''
    if (tickerZelle && tickerZelle.toUpperCase() !== sym && !rowText.toUpperCase().includes(sym)) continue

    const filingDate = parseDatum(tds[0] ?? '') ?? parseDatum(tds[1] ?? '')
    const tradeDate = parseDatum(tds[1] ?? '') ?? filingDate
    if (!tradeDate) continue

    const typZelle = tds.find((t) => /purchase|sale|\bP\b|\bS\b/i.test(t)) ?? ''
    const typFinal = tradeTypAusText(typZelle) ?? typ
    if (typFinal !== 'purchase') continue

    const valueZelle = tds.find((t) => /\$|k\b|m\b/i.test(t) && parseGeld(t) != null) ?? ''
    const valueUsd = parseGeld(valueZelle)
    if (valueUsd != null && valueUsd < INSIDER_MIN_VALUE_USD) continue

    const qtyZelle = tds.find((t) => /^\+?[\d,]+$/.test(t.replace(/\s/g, ''))) ?? ''
    const priceZelle = tds.find((t) => /^\$?[\d.]+$/.test(t.replace(/\s/g, ''))) ?? ''

    const insiderName = tds[4] ?? tds[3] ?? 'Unbekannt'
    const title = tds[5] ?? tds[4] ?? null

    const key = tradeDate + insiderName + (valueUsd ?? 0)
    if (seen.has(key)) continue
    seen.add(key)

    out.push({
      symbol: sym,
      tradeDate,
      filingDate: filingDate ?? tradeDate,
      insiderName,
      title: title && title !== insiderName ? title : null,
      tradeType: 'purchase',
      valueUsd,
      qty: parseMenge(qtyZelle),
      price: parseGeld(priceZelle),
    })
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
    'http://openinsider.com/screener?s=' +
    encodeURIComponent(sym) +
    '&xp=1&xs=1&vl=' +
    INSIDER_MIN_VALUE_USD +
    '&o=-transactionDate&sortDir=1&fd=0&fdr=&td=0&tdr=&fdlyl=&fdlyh=&daysago=&filterfd=' +
    INSIDER_CLUSTER_MAX_TAGE
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
