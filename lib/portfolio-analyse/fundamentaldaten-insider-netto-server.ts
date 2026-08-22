/** Insider-Netto 90T — SEC Form 4 (primär), OpenInsider (Fallback). */

import 'server-only'

import { heuteIsoUtc, tageZwischenIso } from '@/lib/portfolio-analyse/dividenden-datum-hilfen'
import type { InsiderNettoPaket } from '@/lib/portfolio-analyse/fundamentaldaten-erweitert-types'
import { ladeSecInsiderNetto90d } from '@/lib/portfolio-analyse/sec-edgar-form4-server'

const CACHE_MS = 6 * 60 * 60 * 1000
const cache = new Map<string, { at: number; data: InsiderNettoPaket | null }>()
const FENSTER_TAGE = 90

const FETCH_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  Accept: 'text/html',
  Referer: 'https://openinsider.com/',
} as const

function zellenText(html: string): string {
  return html.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
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

function parseOpenInsiderTrades(
  html: string,
  symbol: string,
): Array<{ date: string; typ: 'purchase' | 'sale'; valueUsd: number | null }> {
  const sym = symbol.trim().toUpperCase()
  const out: Array<{ date: string; typ: 'purchase' | 'sale'; valueUsd: number | null }> = []
  const tableHtml = html.match(/<table[^>]*class="tinytable"[^>]*>([\s\S]*?)<\/table>/i)?.[1] ?? html

  for (const row of tableHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const tds = [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => zellenText(m[1]))
    if (tds.length < 10) continue
    if (!tds.some((t) => t.toUpperCase() === sym) && !row[1].toUpperCase().includes(sym)) continue

    const typCol = tds.find((t) => /P - Purchase|S - Sale/i.test(t)) ?? ''
    let typ: 'purchase' | 'sale' | null = null
    if (/P - Purchase/i.test(typCol)) typ = 'purchase'
    else if (/S - Sale/i.test(typCol)) typ = 'sale'
    if (!typ) continue

    const tradeDate = parseDatum(tds[1] ?? '') ?? parseDatum(tds[0] ?? '')
    if (!tradeDate) continue

    const valueZelle = tds.find((t) => /\$|k\b|m\b/i.test(t) && parseGeld(t) != null) ?? ''
    out.push({ date: tradeDate, typ, valueUsd: parseGeld(valueZelle) })
  }
  return out
}

async function ladeOpenInsiderNetto(symbol: string): Promise<InsiderNettoPaket | null> {
  const sym = symbol.trim().toUpperCase()
  const url =
    'https://openinsider.com/screener?s=' +
    encodeURIComponent(sym) +
    '&o=-transactiondate&pl=3&ph=90&fd=0&xp=1&xs=1&vl=&vh=&cnt=200&page=1'
  const res = await fetch(url, { headers: FETCH_HEADERS, cache: 'no-store' })
  if (!res.ok) return null
  const html = await res.text()
  const trades = parseOpenInsiderTrades(html, sym)
  const heute = heuteIsoUtc()
  const recent = trades.filter((t) => tageZwischenIso(t.date, heute) <= FENSTER_TAGE)

  let kaeufe = 0
  let verkaeufe = 0
  let netto = 0
  let hatWert = false
  for (const t of recent) {
    const v = t.valueUsd ?? 0
    if (t.valueUsd != null) hatWert = true
    if (t.typ === 'purchase') {
      kaeufe++
      netto += v
    } else {
      verkaeufe++
      netto -= v
    }
  }

  if (kaeufe + verkaeufe === 0) return null

  return {
    kaeufe90d: kaeufe,
    verkaeufe90d: verkaeufe,
    nettoWertUsd90d: hatWert ? netto : null,
    nettoRichtung: netto > 50_000 ? 'kauf' : netto < -50_000 ? 'verkauf' : 'neutral',
    letzterTrade: recent[0]?.date ?? null,
    quelle: 'openinsider',
  }
}

function symbolAliase(symbol: string): string[] {
  const sym = symbol.trim().toUpperCase()
  const out = [sym]
  if (sym === 'GOOG') out.push('GOOGL')
  if (sym === 'GOOGL') out.push('GOOG')
  if (sym === 'BRK.B' || sym === 'BRK-B') out.push('BRK.B', 'BRK-B')
  return [...new Set(out)]
}

export async function ladeInsiderNettoHandel(symbol: string): Promise<InsiderNettoPaket | null> {
  const sym = symbol.trim().toUpperCase()
  if (!sym || sym.includes('.')) return null

  const hit = cache.get(sym)
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.data

  try {
    for (const kandidat of symbolAliase(sym)) {
      const sec = await ladeSecInsiderNetto90d(kandidat)
      if (sec && (sec.kaeufe90d > 0 || sec.verkaeufe90d > 0)) {
        cache.set(sym, { at: Date.now(), data: sec })
        return sec
      }

      const oi = await ladeOpenInsiderNetto(kandidat)
      if (oi && (oi.kaeufe90d > 0 || oi.verkaeufe90d > 0)) {
        cache.set(sym, { at: Date.now(), data: oi })
        return oi
      }
    }

    // Erfolgreich abgefragt, aber keine Open-Market-Trades im Fenster → explizit neutral
    const leer: InsiderNettoPaket = {
      kaeufe90d: 0,
      verkaeufe90d: 0,
      nettoWertUsd90d: 0,
      nettoRichtung: 'neutral',
      letzterTrade: null,
      quelle: 'sec_form4',
    }
    cache.set(sym, { at: Date.now(), data: leer })
    return leer
  } catch {
    cache.set(sym, { at: Date.now(), data: null })
    return null
  }
}
