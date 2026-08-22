/**
 * EU Insider-Netto — Land → Register (AMF/BaFin-DGAP/AFM) + IR-Fallback.
 */

import 'server-only'

import type { InsiderNettoPaket } from '@/lib/portfolio-analyse/fundamentaldaten-erweitert-types'
import type { InsiderTransaktion } from '@/lib/portfolio-analyse/insider-transaktionen-types'
import { ladeAmfInsiderNetto90d, ladeAmfInsiderTransaktionen } from '@/lib/portfolio-analyse/eu-amf-insider-server'
import { ladeEuInsiderDealings } from '@/lib/portfolio-analyse/eu-insider-dealing-server'
import { heuteIsoUtc, tageZwischenIso } from '@/lib/portfolio-analyse/dividenden-datum-hilfen'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

const CACHE_MS = 6 * 60 * 60 * 1000
const dgapCache = new Map<string, { at: number; txs: InsiderTransaktion[] }>()

/** Whitelist-/Portfolio-Suchnamen für DGAP Directors' Dealings. */
const DGAP_QUERY_BY_ISIN: Record<string, string> = {
  DE0006580806: 'Mensch und Maschine',
  DE0005785802: 'Mensch und Maschine',
  DE000A0BVU28: 'USU Software',
  CH1175448666: 'Straumann',
  CH0418792922: 'Sika',
  NL0010273215: 'ASML',
  NL0000395903: 'Wolters Kluwer',
  GB0004052071: 'Halma',
  FR0000052292: 'Hermes',
  IE000S9YS762: 'Linde',
}

function parseDatumFlex(text: string): string | null {
  const iso = text.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  const de = text.match(/\b(\d{2})\.(\d{2})\.(20\d{2})\b/)
  if (de) return `${de[3]}-${de[2]}-${de[1]}`
  const fr = text.match(/\b(\d{2})\/(\d{2})\/(20\d{2})\b/)
  if (fr) return `${fr[3]}-${fr[2]}-${fr[1]}`
  return null
}

function typAusText(text: string): InsiderTransaktion['typ'] {
  const t = text.toLowerCase()
  if (/verkauf|sale|disposal|cession|sell/.test(t) && !/kauf|purchase|acquisition|buy/.test(t)) {
    return 'verkauf'
  }
  if (/kauf|purchase|acquisition|buy|erwerb/.test(t)) return 'kauf'
  return 'sonstiges'
}

/** DGAP/EQS Directors' Dealings Suche (DE + oft auch CH/NL Emittenten). */
export async function ladeDgapInsiderTransaktionen(opts: {
  isin: string
  firmenname?: string | null
}): Promise<InsiderTransaktion[]> {
  const isin = opts.isin.trim().toUpperCase()
  const hit = dgapCache.get(isin)
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.txs

  const q = DGAP_QUERY_BY_ISIN[isin] ?? opts.firmenname?.trim() ?? ''
  if (!q) return []

  const url = new URL('https://www.dgap.de/dgap/News/')
  url.searchParams.set('newsType', 'DD')
  url.searchParams.set('searchWord', q)
  url.searchParams.set('paging', '1')

  let html = ''
  try {
    const res = await fetch(url.toString(), {
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
      cache: 'no-store',
      signal: AbortSignal.timeout(18_000),
    })
    if (!res.ok) return []
    html = await res.text()
  } catch {
    return []
  }

  const out: InsiderTransaktion[] = []
  const seen = new Set<string>()
  // News-Zeilen: Datum + Titel-Link
  for (const m of html.matchAll(
    /<a[^>]+href="(\/dgap\/News\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi,
  )) {
    const href = `https://www.dgap.de${m[1]}`
    const title = m[2]!.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    if (!/Directors'? Dealings|Managers'? Transactions|Eigengeschäfte|PDMR/i.test(title + href)) {
      continue
    }
    if (seen.has(href)) continue
    seen.add(href)
    const typ = typAusText(title)
    if (typ === 'sonstiges') continue
    const datum = parseDatumFlex(title) ?? parseDatumFlex(href)
    out.push({
      id: `dgap-${Buffer.from(href).toString('base64url').slice(0, 14)}`,
      datum,
      person: 'PDMR / Directors Dealing',
      titel: null,
      typ,
      aktien: null,
      preisUsd: null,
      wertUsd: null,
      quelle: 'eu_dgap',
      url: href,
      hinweis: title.slice(0, 120),
    })
    if (out.length >= 20) break
  }

  dgapCache.set(isin, { at: Date.now(), txs: out })
  return out
}

function nettoAusTxs(
  txs: InsiderTransaktion[],
  quelle: InsiderNettoPaket['quelle'],
): InsiderNettoPaket | null {
  if (txs.length === 0) return null
  const heute = heuteIsoUtc()
  const recent = txs.filter((t) => t.datum && tageZwischenIso(t.datum, heute) <= 90)
  if (recent.length === 0) {
    return {
      kaeufe90d: 0,
      verkaeufe90d: 0,
      nettoWertUsd90d: 0,
      nettoRichtung: 'neutral',
      letzterTrade: txs[0]?.datum ?? null,
      quelle,
    }
  }
  let kaeufe = 0
  let verkaeufe = 0
  let nettoWert = 0
  let hatWert = false
  for (const t of recent) {
    if (t.typ === 'kauf') {
      kaeufe++
      if (t.wertUsd != null) {
        nettoWert += t.wertUsd
        hatWert = true
      }
    } else if (t.typ === 'verkauf') {
      verkaeufe++
      if (t.wertUsd != null) {
        nettoWert -= t.wertUsd
        hatWert = true
      }
    }
  }
  const netto = kaeufe - verkaeufe
  return {
    kaeufe90d: kaeufe,
    verkaeufe90d: verkaeufe,
    nettoWertUsd90d: hatWert ? Math.round(nettoWert) : null,
    nettoRichtung: netto > 0 ? 'kauf' : netto < 0 ? 'verkauf' : 'neutral',
    letzterTrade: recent[0]?.datum ?? null,
    quelle,
  }
}

/**
 * Aggregiert EU-Insider: AMF (FR) → DGAP → IR Directors' Dealings.
 */
export async function ladeEuInsiderNettoAggregiert(opts: {
  ticker: string
  isin: string
  firmenname: string
}): Promise<InsiderNettoPaket | null> {
  const isin = opts.isin.trim().toUpperCase()
  if (isin.length < 10) return null

  if (isin.startsWith('FR')) {
    const amf = await ladeAmfInsiderNetto90d({
      isin,
      firmenname: opts.firmenname,
    }).catch(() => null)
    if (amf && (amf.kaeufe90d > 0 || amf.verkaeufe90d > 0 || amf.letzterTrade)) return amf
  }

  const dgapTx = await ladeDgapInsiderTransaktionen({
    isin,
    firmenname: opts.firmenname,
  }).catch(() => [])
  const dgapNetto = nettoAusTxs(dgapTx, 'eu_dgap')
  if (dgapNetto && (dgapNetto.kaeufe90d > 0 || dgapNetto.verkaeufe90d > 0)) return dgapNetto

  // FR: auch Roh-Transaktionen aus AMF mit IR mergen, falls Netto leer
  let irTx = await ladeEuInsiderDealings({
    ticker: opts.ticker,
    isin,
    firmenname: opts.firmenname,
  }).catch(() => [])
  if (isin.startsWith('FR') && irTx.length === 0) {
    irTx = await ladeAmfInsiderTransaktionen({ isin, firmenname: opts.firmenname }).catch(() => [])
  }

  const irNetto = nettoAusTxs(irTx, 'eu_directors_dealing')
  if (irNetto) return irNetto
  if (dgapNetto) return dgapNetto
  return {
    kaeufe90d: 0,
    verkaeufe90d: 0,
    nettoWertUsd90d: 0,
    nettoRichtung: 'neutral',
    letzterTrade: null,
    quelle: 'eu_directors_dealing',
  }
}
