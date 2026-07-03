/** OpenInsider — Netto-Käufe vs. Verkäufe (90 Tage). */

import 'server-only'

import { heuteIsoUtc, tageZwischenIso } from '@/lib/portfolio-analyse/dividenden-datum-hilfen'
import type { InsiderNettoPaket } from '@/lib/portfolio-analyse/fundamentaldaten-erweitert-types'

const CACHE_MS = 6 * 60 * 60 * 1000
const cache = new Map<string, { at: number; data: InsiderNettoPaket | null }>()
const FENSTER_TAGE = 90

const FETCH_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  Accept: 'text/html',
  Referer: 'http://openinsider.com/',
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

function tradeTypAusText(text: string): 'purchase' | 'sale' | null {
  const t = text.toLowerCase()
  if (/\bp\b|purchase|buy/.test(t) && !/sale/.test(t)) return 'purchase'
  if (/\bs\b|sale|sell/.test(t)) return 'sale'
  return null
}

function parseTrades(html: string, symbol: string): Array<{ date: string; typ: 'purchase' | 'sale'; valueUsd: number | null }> {
  const sym = symbol.trim().toUpperCase()
  const out: Array<{ date: string; typ: 'purchase' | 'sale'; valueUsd: number | null }> = []

  for (const row of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const tds = [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => zellenText(m[1]))
    if (tds.length < 8) continue
    const rowText = tds.join(' ')
    if (!rowText.toUpperCase().includes(sym)) continue

    const typZelle = tds.find((t) => /purchase|sale|\bP\b|\bS\b/i.test(t)) ?? ''
    const typ = tradeTypAusText(typZelle) ?? tradeTypAusText(rowText)
    if (!typ) continue

    const tradeDate = parseDatum(tds[1] ?? '') ?? parseDatum(tds[0] ?? '')
    if (!tradeDate) continue

    const valueZelle = tds.find((t) => /\$|k\b|m\b/i.test(t) && parseGeld(t) != null) ?? ''
    out.push({ date: tradeDate, typ, valueUsd: parseGeld(valueZelle) })
  }
  return out
}

export async function ladeInsiderNettoHandel(symbol: string): Promise<InsiderNettoPaket | null> {
  const sym = symbol.trim().toUpperCase()
  if (!sym || sym.includes('.')) return null

  const hit = cache.get(sym)
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.data

  try {
    const url =
      'http://openinsider.com/screener?s=' +
      encodeURIComponent(sym) +
      '&o=-transactiondate&pl=3&ph=90&fd=0&fdr=&td=0&tdr=&fdlyl=&fdlyh=&daysago=&xp=1&xs=1&vl=&vh=&ocl=&och=&sic1=-1&sicl=100&sich=9999&grp=0&nfl=&nfh=&nil=&nih=&nol=&noh=&v2l=&v2h=&oc2l=&oc2h=&sortcol=0&cnt=200&page=1'
    const res = await fetch(url, { headers: FETCH_HEADERS, cache: 'no-store' })
    if (!res.ok) {
      cache.set(sym, { at: Date.now(), data: null })
      return null
    }
    const html = await res.text()
    const trades = parseTrades(html, sym)
    const heute = heuteIsoUtc()
    const recent = trades.filter((t) => tageZwischenIso(t.date, heute) <= FENSTER_TAGE)

    let kaeufe = 0
    let verkaeufe = 0
    let netto = 0
    for (const t of recent) {
      const v = t.valueUsd ?? 0
      if (t.typ === 'purchase') {
        kaeufe++
        netto += v
      } else {
        verkaeufe++
        netto -= v
      }
    }

    const data: InsiderNettoPaket = {
      kaeufe90d: kaeufe,
      verkaeufe90d: verkaeufe,
      nettoWertUsd90d: recent.some((t) => t.valueUsd != null) ? netto : null,
      nettoRichtung: kaeufe + verkaeufe === 0 ? null : netto > 50_000 ? 'kauf' : netto < -50_000 ? 'verkauf' : 'neutral',
      letzterTrade: recent[0]?.date ?? null,
      quelle: 'openinsider',
    }
    cache.set(sym, { at: Date.now(), data })
    return data
  } catch {
    cache.set(sym, { at: Date.now(), data: null })
    return null
  }
}
