/**
 * Kostenlose Markt-Signale für Etsy-SEO: Autosuggest + Top-Konkurrenz.
 *
 * Etsy.com (Suche/Autosuggest) sitzt hinter DataDome und liefert Server-Requests
 * meist 403 + Captcha. Deshalb:
 * - Konkurrenz primär über die offizielle Open API (findAllListingsActive, nur App-Key),
 *   HTML/JSON-LD nur Best-Effort (Badges).
 * - Autosuggest Best-Effort; Fallback = reale Tags der Top-Listings, dann Domain-Seeds.
 * - Circuit-Breaker nach 403/429, damit Batch/Cron nicht in Timeouts laufen.
 * Alle Exporte werfen nie — Generator/Audit laufen immer weiter.
 */

import 'server-only'

import {
  ETSY_API_BASE,
  etsyApiKeyHeader,
  etsyApiKonfiguriert,
} from '@/lib/etsy/etsy-types'
import type {
  EtsyAutosuggestErgebnis,
  EtsyCompetitorInsights,
  EtsyCompetitorListing,
  EtsyKeywordExplorerErgebnis,
  EtsyKeywordIdee,
  EtsyMarktKontext,
  EtsyTagFrequenz,
} from '@/lib/etsy/etsy-markt-types'
import {
  ETSY_KONKURRENZ_SHOP_LOCATION,
  erkenneHolzGruppen,
  filtereKandidatenFuerZielmarkt,
  nenntFremdeHolzart,
} from '@/lib/etsy/etsy-zielmarkt'
import { createSupabaseAdmin } from '@/lib/supabase-admin'

const CACHE_TTL_MS = 24 * 60 * 60 * 1000
const HTML_BLOCK_MS = 30 * 60 * 1000
const TAG_MAX = 20
const COMPETITOR_LIMIT = 10
const MIN_DE_KONKURRENZ = 5

const BROWSER_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36',
  'Accept-Language': 'de-DE,de;q=0.9,en;q=0.7',
}

const DOMAIN_SEEDS = [
  'handgedrehte schale',
  'holzschale unikat',
  'obstschale holz',
  'holzschale deko',
  'massivholz schale',
  'holzgeschenk unikat',
  'holzhochzeit geschenk',
  'naturrand schale',
  'drechselarbeit',
  'esstisch deko holz',
  'schale eiche',
  'schale nussbaum',
  'holzschüssel groß',
  'dekoschale holz',
  'rustikale holzdeko',
]

const STOPWORDS = new Set([
  'und', 'oder', 'mit', 'aus', 'für', 'fuer', 'der', 'die', 'das', 'ein', 'eine', 'von', 'zum', 'zur',
  'im', 'in', 'am', 'an', 'auf', 'the', 'and', 'for', 'with', 'of', 'a', 'an', 'to', 'by', 'cm', 'ca',
])

// ---------------------------------------------------------------------------
// Throttling & Circuit-Breaker (pro Lambda-Instanz)
// ---------------------------------------------------------------------------

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

function erstelleDrossel(minAbstandMs: number) {
  let kette: Promise<void> = Promise.resolve()
  let letzter = 0
  return async function gedrosselt<T>(fn: () => Promise<T>): Promise<T> {
    const vorher = kette
    let freigeben!: () => void
    kette = new Promise<void>((r) => {
      freigeben = r
    })
    await vorher
    const warten = letzter + minAbstandMs - Date.now()
    if (warten > 0) await sleep(warten)
    try {
      return await fn()
    } finally {
      letzter = Date.now()
      freigeben()
    }
  }
}

/** Open API erlaubt ~10 QPS; HTML bewusst langsam, um nicht geflaggt zu werden. */
const apiDrossel = erstelleDrossel(150)
const htmlDrossel = erstelleDrossel(1500)
let htmlGeblocktBis = 0
let htmlCircuitSynced = false

function htmlGeblockt(): boolean {
  return Date.now() < htmlGeblocktBis
}

/** Für Rank/Cron: HTML-Circuit offen? (DataDome 403/429) — Memory + DB. */
export function etsyHtmlCircuitOffen(): boolean {
  return htmlGeblockt()
}

export function etsyHtmlCircuitRestMs(): number {
  return Math.max(0, htmlGeblocktBis - Date.now())
}

/** Vor Cron/Rank: DB-Stand in Memory laden (Cold-Start-sicher). */
export async function syncEtsyHtmlCircuitFromDb(): Promise<void> {
  if (htmlCircuitSynced && htmlGeblockt()) return
  try {
    const { etsyCircuitOffen, etsyCircuitRestMs } = await import('@/lib/etsy/etsy-circuit-breaker')
    if (await etsyCircuitOffen('html')) {
      htmlGeblocktBis = Date.now() + (await etsyCircuitRestMs('html'))
    }
  } catch {
    /* Migration fehlt — nur Memory */
  }
  htmlCircuitSynced = true
}

function markiereHtmlGeblockt(status: number) {
  if (status !== 403 && status !== 429) return
  htmlGeblocktBis = Date.now() + HTML_BLOCK_MS
  void import('@/lib/etsy/etsy-circuit-breaker')
    .then((m) => m.markiereEtsyHtmlGeblockt(status, `etsy-html ${status}`))
    .catch(() => undefined)
}

// ---------------------------------------------------------------------------
// Cache: In-Memory + Supabase (etsy_markt_cache)
// ---------------------------------------------------------------------------

type CacheEintrag<T> = { at: number; payload: T }
const memCache = new Map<string, CacheEintrag<unknown>>()

function cacheKey(kind: string, q: string): string {
  return `${kind}:${q.toLowerCase().replace(/\s+/g, ' ').trim()}`.slice(0, 200)
}

async function ladeCache<T>(key: string, ttlMs = CACHE_TTL_MS): Promise<CacheEintrag<T> | null> {
  const mem = memCache.get(key)
  if (mem && Date.now() - mem.at < ttlMs) return mem as CacheEintrag<T>
  try {
    const { data } = await createSupabaseAdmin()
      .from('etsy_markt_cache')
      .select('payload, fetched_at')
      .eq('cache_key', key)
      .maybeSingle()
    if (!data) return null
    const at = new Date(String(data.fetched_at)).getTime()
    if (!Number.isFinite(at) || Date.now() - at >= ttlMs) return null
    const eintrag = { at, payload: data.payload as T }
    memCache.set(key, eintrag)
    return eintrag
  } catch {
    return null
  }
}

async function speichereCache(key: string, kind: string, payload: unknown): Promise<void> {
  const at = Date.now()
  memCache.set(key, { at, payload })
  try {
    await createSupabaseAdmin()
      .from('etsy_markt_cache')
      .upsert({ cache_key: key, kind, payload, fetched_at: new Date(at).toISOString() })
  } catch (e) {
    console.warn('[etsy-markt] cache:', e instanceof Error ? e.message : e)
  }
}

// ---------------------------------------------------------------------------
// Normalisierung
// ---------------------------------------------------------------------------

function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/,/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function alsTag(s: string): string | null {
  const t = norm(s)
  if (!t || t.length > TAG_MAX || t.length < 3) return null
  return t
}

function worte(s: string): string[] {
  return norm(s)
    .split(/[^a-zäöüß0-9]+/i)
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w) && !/^\d+$/.test(w))
}

function median(zahlen: number[]): number | null {
  if (zahlen.length === 0) return null
  const s = [...zahlen].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m]! : Math.round(((s[m - 1]! + s[m]!) / 2) * 100) / 100
}

function rund(n: number): number {
  return Math.round(n * 100) / 100
}

// ---------------------------------------------------------------------------
// Autosuggest
// ---------------------------------------------------------------------------

function extrahiereSuggestions(json: unknown): string[] {
  const out: string[] = []
  const besuche = (node: unknown, tiefe: number) => {
    if (tiefe > 4 || out.length >= 30 || node == null) return
    if (typeof node === 'string') {
      const t = norm(node)
      if (t.length >= 3 && t.length <= 60) out.push(t)
      return
    }
    if (Array.isArray(node)) {
      for (const n of node) besuche(n, tiefe + 1)
      return
    }
    if (typeof node === 'object') {
      const o = node as Record<string, unknown>
      for (const k of ['query', 'text', 'display', 'term', 'suggestion', 'name']) {
        if (typeof o[k] === 'string') {
          besuche(o[k], tiefe + 1)
          return
        }
      }
      for (const k of ['results', 'suggestions', 'data', 'items', 'queries']) {
        if (k in o) besuche(o[k], tiefe + 1)
      }
    }
  }
  besuche(json, 0)
  return [...new Set(out)].slice(0, 15)
}

function seedFallback(query: string): string[] {
  const qw = new Set(worte(query))
  const passend = DOMAIN_SEEDS.filter((s) => worte(s).some((w) => qw.has(w)))
  return (passend.length >= 3 ? passend : DOMAIN_SEEDS).slice(0, 10)
}

export async function getEtsyAutosuggest(
  query: string,
  opts?: { forceRefresh?: boolean },
): Promise<EtsyAutosuggestErgebnis> {
  const q = norm(query).slice(0, 60)
  const jetzt = new Date().toISOString()
  if (!q) {
    return { query: q, suggestions: [], provider: 'seed', quelle: 'fallback', fetchedAt: jetzt }
  }

  const key = cacheKey('suggest', q)
  if (!opts?.forceRefresh) {
    const c = await ladeCache<EtsyAutosuggestErgebnis>(key)
    if (c) return { ...c.payload, quelle: 'cache' }
  }

  let note: string | undefined
  if (!htmlGeblockt()) {
    try {
      const res = await htmlDrossel(() =>
        fetch(`https://www.etsy.com/search/async/suggest?query=${encodeURIComponent(q)}`, {
          headers: { ...BROWSER_HEADERS, Accept: 'application/json' },
          cache: 'no-store',
          signal: AbortSignal.timeout(8_000),
        }),
      )
      if (res.ok) {
        const suggestions = extrahiereSuggestions(await res.json().catch(() => null))
        if (suggestions.length > 0) {
          const erg: EtsyAutosuggestErgebnis = {
            query: q,
            suggestions,
            provider: 'etsy_suggest',
            quelle: 'live',
            fetchedAt: jetzt,
          }
          await speichereCache(key, 'suggest', erg)
          return erg
        }
        note = 'Autosuggest leer'
      } else {
        markiereHtmlGeblockt(res.status)
        note = `Autosuggest HTTP ${res.status}`
      }
    } catch (e) {
      note = e instanceof Error ? e.message.slice(0, 80) : 'Autosuggest fehlgeschlagen'
    }
  } else {
    note = 'Etsy.com blockiert (Circuit-Breaker aktiv)'
  }

  // Fallback 1: reale Tags der Top-Konkurrenz (von Etsy gerankte Phrasen)
  const comp = await getCompetitorInsights(q)
  const compTags = comp.topTags.map((t) => t.tag).slice(0, 12)
  if (compTags.length >= 3) {
    return {
      query: q,
      suggestions: compTags,
      provider: 'competitor_tags',
      quelle: 'fallback',
      fetchedAt: jetzt,
      note: `${note ?? 'Autosuggest nicht verfügbar'} — Tags der Top-Listings genutzt`,
    }
  }

  return {
    query: q,
    suggestions: seedFallback(q),
    provider: 'seed',
    quelle: 'fallback',
    fetchedAt: jetzt,
    note: `${note ?? 'Autosuggest nicht verfügbar'} — Domain-Seeds`,
  }
}

// ---------------------------------------------------------------------------
// Käufer-Suchvorschläge Google.de / Amazon.de (inoffiziell → wenig Abfragen, 7 Tage Cache)
// ---------------------------------------------------------------------------

type KaeuferQuelle = 'google_de' | 'amazon_de'

const KAEUFER_TTL_MS = 7 * 24 * 60 * 60 * 1000
const kaeuferDrossel = erstelleDrossel(300)
const kaeuferGeblocktBis: Record<KaeuferQuelle, number> = { google_de: 0, amazon_de: 0 }

/** Marken, Möbel, DIY — keine Kaufabsicht für ein gedrechseltes Unikat. */
const SUGGEST_BLOCK_RE =
  /\b(ikea|depot|butlers|tchibo|lidl|aldi|obi|hornbach|bauhaus|amazon|ebay|otto|kleinanzeigen|gebraucht|diy|anleitung|basteln|selber|selbst machen|bauen|kurs|lernen|test|rezept)\b|stuhl|sessel|schalenstuhl|schalensitz/
const SUGGEST_FUELL_RE = /\b(kaufen|günstig|guenstig|online|bestellen|shop)\b/g

function bereinigeSuggestion(raw: string): string | null {
  const t = norm(raw).replace(SUGGEST_FUELL_RE, ' ').replace(/\s+/g, ' ').trim()
  if (t.length < 3 || SUGGEST_BLOCK_RE.test(t)) return null
  return t
}

async function holeKaeuferRoh(quelle: KaeuferQuelle, q: string): Promise<string[] | null> {
  if (Date.now() < kaeuferGeblocktBis[quelle]) return null
  const url =
    quelle === 'google_de'
      ? `https://suggestqueries.google.com/complete/search?client=firefox&hl=de&gl=de&ie=utf-8&oe=utf-8&q=${encodeURIComponent(q)}`
      : `https://completion.amazon.de/api/2017/suggestions?mid=A1PA6795UKMFR9&alias=aps&prefix=${encodeURIComponent(q)}`
  try {
    const res = await kaeuferDrossel(() =>
      fetch(url, {
        headers: { ...BROWSER_HEADERS, Accept: 'application/json' },
        cache: 'no-store',
        signal: AbortSignal.timeout(6_000),
      }),
    )
    if (!res.ok) {
      if (res.status === 403 || res.status === 429) kaeuferGeblocktBis[quelle] = Date.now() + HTML_BLOCK_MS
      return null
    }
    const json = (await res.json()) as unknown
    if (quelle === 'google_de') {
      const liste = Array.isArray(json) && Array.isArray(json[1]) ? (json[1] as unknown[]) : []
      return liste.map(String)
    }
    const s = (json as { suggestions?: Array<{ value?: string }> })?.suggestions ?? []
    return s.map((x) => String(x.value ?? '')).filter(Boolean)
  } catch {
    return null
  }
}

/** Gecachte, bereinigte Vorschläge einer Quelle — Reihenfolge = Beliebtheit laut Quelle. */
async function getKaeuferSuggestEinzeln(
  quelle: KaeuferQuelle,
  query: string,
  opts?: { forceRefresh?: boolean },
): Promise<EtsyAutosuggestErgebnis | null> {
  const q = norm(query).slice(0, 60)
  if (!q) return null
  const key = cacheKey('suggest', `${quelle}:${q}`)
  if (!opts?.forceRefresh) {
    const c = await ladeCache<EtsyAutosuggestErgebnis>(key, KAEUFER_TTL_MS)
    if (c) return { ...c.payload, quelle: 'cache' }
  }
  const roh = await holeKaeuferRoh(quelle, q)
  if (!roh) return null
  const suggestions = [...new Set(roh.map(bereinigeSuggestion).filter((s): s is string => Boolean(s)))].slice(0, 12)
  const erg: EtsyAutosuggestErgebnis = {
    query: q,
    suggestions,
    provider: quelle,
    quelle: 'live',
    fetchedAt: new Date().toISOString(),
  }
  await speichereCache(key, 'suggest', erg)
  return erg
}

/** Google.de + Amazon.de parallel; leere Liste, wenn beide ausfallen. */
export async function getKaeuferSuggest(
  query: string,
  opts?: { forceRefresh?: boolean },
): Promise<EtsyAutosuggestErgebnis[]> {
  const [g, a] = await Promise.all([
    getKaeuferSuggestEinzeln('google_de', query, opts),
    getKaeuferSuggestEinzeln('amazon_de', query, opts),
  ])
  return [g, a].filter((x): x is EtsyAutosuggestErgebnis => Boolean(x && x.suggestions.length > 0))
}

// ---------------------------------------------------------------------------
// Konkurrenz
// ---------------------------------------------------------------------------

type ApiListing = {
  listing_id?: number
  title?: string
  tags?: string[]
  url?: string
  num_favorers?: number
  price?: { amount?: number; divisor?: number; currency_code?: string }
}

function preisEur(p: ApiListing['price']): number | null {
  if (!p || String(p.currency_code || '').toUpperCase() !== 'EUR') return null
  const amount = Number(p.amount)
  const divisor = Number(p.divisor) || 100
  return Number.isFinite(amount) ? rund(amount / divisor) : null
}

async function holeKonkurrenzViaApi(
  keyword: string,
  shopLocation?: string,
): Promise<{ listings: EtsyCompetitorListing[]; count: number | null } | null> {
  if (!etsyApiKonfiguriert()) return null
  const q = new URLSearchParams({
    keywords: keyword,
    sort_on: 'score',
    limit: String(COMPETITOR_LIMIT),
  })
  if (shopLocation) q.set('shop_location', shopLocation)
  const res = await apiDrossel(() =>
    fetch(`${ETSY_API_BASE}/application/listings/active?${q.toString()}`, {
      headers: { 'x-api-key': etsyApiKeyHeader(), Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(12_000),
    }),
  )
  if (!res.ok) {
    console.warn('[etsy-markt] API', res.status, (await res.text()).slice(0, 160))
    return null
  }
  const data = (await res.json()) as { count?: number; results?: ApiListing[] }
  const listings: EtsyCompetitorListing[] = []
  for (const r of data.results ?? []) {
    const listingId = Number(r.listing_id)
    if (!Number.isFinite(listingId) || listingId <= 0) continue
    listings.push({
      listingId,
      title: String(r.title || '').slice(0, 200),
      tags: Array.isArray(r.tags) ? r.tags.map((t) => norm(String(t))).filter(Boolean) : [],
      priceEur: preisEur(r.price),
      numFavorers: r.num_favorers != null ? Number(r.num_favorers) : null,
      url: typeof r.url === 'string' ? r.url : null,
      badges: [],
    })
  }
  return { listings, count: typeof data.count === 'number' ? data.count : null }
}

const BADGE_RE =
  /(bestseller|star seller|star-verkäufer|etsy'?s pick|etsys auswahl|popular now|beliebt|in \d+\+? warenkörben|in \d+\+? carts)/gi

function badgesImFenster(html: string, listingId: number): string[] {
  const idx = html.indexOf(`/listing/${listingId}/`)
  if (idx < 0) return []
  const fenster = html.slice(idx, idx + 4000)
  const treffer = fenster.match(BADGE_RE) ?? []
  return [...new Set(treffer.map((b) => b.toLowerCase()))].slice(0, 4)
}

function parseJsonLdListings(html: string): EtsyCompetitorListing[] {
  const out: EtsyCompetitorListing[] = []
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null && out.length < COMPETITOR_LIMIT) {
    let json: unknown
    try {
      json = JSON.parse(m[1]!)
    } catch {
      continue
    }
    const knoten = Array.isArray(json) ? json : [json]
    for (const k of knoten) {
      const o = k as Record<string, unknown>
      const elemente = Array.isArray(o.itemListElement) ? o.itemListElement : []
      for (const el of elemente) {
        const e = el as Record<string, unknown>
        const item = (e.item && typeof e.item === 'object' ? e.item : e) as Record<string, unknown>
        const url = typeof item.url === 'string' ? item.url : ''
        const listingId = Number(/\/listing\/(\d+)/.exec(url)?.[1])
        if (!Number.isFinite(listingId)) continue
        const offers = (item.offers && typeof item.offers === 'object' ? item.offers : {}) as Record<
          string,
          unknown
        >
        const waehrung = String(offers.priceCurrency || '').toUpperCase()
        const preis = Number(offers.price ?? offers.lowPrice)
        out.push({
          listingId,
          title: String(item.name || '').slice(0, 200),
          tags: [],
          priceEur: waehrung === 'EUR' && Number.isFinite(preis) ? rund(preis) : null,
          numFavorers: null,
          url,
          badges: [],
        })
        if (out.length >= COMPETITOR_LIMIT) break
      }
    }
  }
  return out
}

async function holeSuchHtml(keyword: string): Promise<string | null> {
  if (htmlGeblockt()) return null
  try {
    const res = await htmlDrossel(() =>
      fetch(`https://www.etsy.com/search?q=${encodeURIComponent(keyword)}&explicit=1&ship_to=DE`, {
        headers: { ...BROWSER_HEADERS, Accept: 'text/html,application/xhtml+xml' },
        cache: 'no-store',
        signal: AbortSignal.timeout(15_000),
      }),
    )
    if (!res.ok) {
      markiereHtmlGeblockt(res.status)
      return null
    }
    return await res.text()
  } catch {
    return null
  }
}

function aggregiereTags(listings: EtsyCompetitorListing[]): EtsyTagFrequenz[] {
  const zaehler = new Map<string, number>()
  for (const l of listings) {
    for (const t of new Set(l.tags.map((x) => alsTag(x)).filter((x): x is string => Boolean(x)))) {
      zaehler.set(t, (zaehler.get(t) ?? 0) + 1)
    }
  }
  return [...zaehler.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.length - b.tag.length)
    .slice(0, 25)
}

function aggregiereTitelPhrasen(listings: EtsyCompetitorListing[]): EtsyTagFrequenz[] {
  const zaehler = new Map<string, number>()
  for (const l of listings) {
    const phrasen = new Set<string>()
    for (const segment of l.title.split(/[|,–—\-/]+/)) {
      const w = worte(segment)
      for (let i = 0; i < w.length - 1; i++) {
        const bi = `${w[i]} ${w[i + 1]}`
        if (bi.length <= TAG_MAX) phrasen.add(bi)
      }
    }
    for (const p of phrasen) zaehler.set(p, (zaehler.get(p) ?? 0) + 1)
  }
  return [...zaehler.entries()]
    .filter(([, c]) => c >= 2)
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15)
}

function leereInsights(keyword: string, note: string): EtsyCompetitorInsights {
  return {
    keyword,
    provider: 'unavailable',
    quelle: 'fallback',
    fetchedAt: new Date().toISOString(),
    listings: [],
    topTags: [],
    topTitelPhrasen: [],
    preis: { avg: null, median: null, min: null, max: null },
    badgeAnteil: null,
    wettbewerbCount: null,
    note,
  }
}

export async function getCompetitorInsights(
  keyword: string,
  opts?: { forceRefresh?: boolean; mitBadges?: boolean },
): Promise<EtsyCompetitorInsights> {
  const kw = norm(keyword).slice(0, 60)
  if (!kw) return leereInsights(kw, 'Leeres Keyword')

  const key = cacheKey('competitor', `de:${kw}`)
  if (!opts?.forceRefresh) {
    const c = await ladeCache<EtsyCompetitorInsights>(key)
    if (c) return { ...c.payload, quelle: 'cache' }
  }

  try {
    let provider: EtsyCompetitorInsights['provider'] = 'unavailable'
    let listings: EtsyCompetitorListing[] = []
    let count: number | null = null
    let marktFilter: EtsyCompetitorInsights['marktFilter']
    const notes: string[] = []
    const apiFehler = (e: unknown) => {
      notes.push(e instanceof Error ? e.message.slice(0, 80) : 'API-Fehler')
      return null
    }

    // Zielmarkt zuerst: deutsche Shops ranken mit deutschen Tags für DE-Käufer.
    const apiDe = await holeKonkurrenzViaApi(kw, ETSY_KONKURRENZ_SHOP_LOCATION).catch(apiFehler)
    if (apiDe && apiDe.listings.length >= MIN_DE_KONKURRENZ) {
      provider = 'etsy_api'
      listings = apiDe.listings
      count = apiDe.count
      marktFilter = 'DE'
    } else {
      const api = await holeKonkurrenzViaApi(kw).catch(apiFehler)
      if (api && api.listings.length > 0) {
        provider = 'etsy_api'
        listings = api.listings
        count = api.count
        marktFilter = 'global'
        notes.push(`Nur ${apiDe?.listings.length ?? 0} DE-Shops — globale Konkurrenz genutzt`)
      }
    }

    const brauchtHtml = provider === 'unavailable' || opts?.mitBadges !== false
    const html = brauchtHtml ? await holeSuchHtml(kw) : null
    if (html) {
      if (provider === 'unavailable') {
        listings = parseJsonLdListings(html)
        if (listings.length > 0) provider = 'etsy_html'
      }
      for (const l of listings) l.badges = badgesImFenster(html, l.listingId)
    } else if (brauchtHtml) {
      notes.push('Such-HTML geblockt — keine Badges')
    }

    if (provider === 'unavailable') {
      return leereInsights(kw, notes.join(' · ') || 'Keine Konkurrenzdaten verfügbar')
    }

    const preise = listings.map((l) => l.priceEur).filter((p): p is number => p != null)
    const mitBadge = html ? listings.filter((l) => l.badges.length > 0).length : null
    const erg: EtsyCompetitorInsights = {
      keyword: kw,
      provider,
      quelle: 'live',
      fetchedAt: new Date().toISOString(),
      listings,
      topTags: aggregiereTags(listings),
      topTitelPhrasen: aggregiereTitelPhrasen(listings),
      preis: {
        avg: preise.length ? rund(preise.reduce((s, p) => s + p, 0) / preise.length) : null,
        median: median(preise),
        min: preise.length ? Math.min(...preise) : null,
        max: preise.length ? Math.max(...preise) : null,
      },
      badgeAnteil: mitBadge != null && listings.length ? rund(mitBadge / listings.length) : null,
      wettbewerbCount: count,
      marktFilter,
      note:
        [
          provider === 'etsy_api' ? 'Relevanz-Sortierung Open API (≈ organisch, ohne Ads/Personalisierung)' : '',
          marktFilter === 'DE' ? 'Konkurrenz: Shops aus Deutschland' : '',
          preise.length < listings.length ? `Preis-Basis: ${preise.length} EUR-Listings` : '',
          ...notes,
        ]
          .filter(Boolean)
          .join(' · ') || undefined,
    }
    await speichereCache(key, 'competitor', erg)
    return erg
  } catch (e) {
    return leereInsights(kw, e instanceof Error ? e.message.slice(0, 120) : 'Konkurrenz-Scrape fehlgeschlagen')
  }
}

// ---------------------------------------------------------------------------
// Positionssuche für Rank-Tracking
// ---------------------------------------------------------------------------

export type EtsySuchReihenfolge = {
  keyword: string
  listingIds: number[]
  /** `etsy_search` = echte Suchseite (inkl. Personalisierung-frei), `etsy_api_relevanz` = Open-API-Relevanz als Proxy */
  provider: 'etsy_search' | 'etsy_api_relevanz'
}

function listingIdsAusHtml(html: string, max = 120): number[] {
  const ids: number[] = []
  const seen = new Set<number>()
  const re = /\/listing\/(\d+)\//g
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    const id = Number(m[1])
    if (!Number.isFinite(id) || seen.has(id)) continue
    seen.add(id)
    ids.push(id)
    if (ids.length >= max) break
  }
  return ids
}

/** Reihenfolge der Suchtreffer für ein Keyword; null wenn beide Quellen scheitern. */
export async function sucheEtsyReihenfolge(keyword: string): Promise<EtsySuchReihenfolge | null> {
  const kw = norm(keyword).slice(0, 60)
  if (!kw) return null

  const html = await holeSuchHtml(kw)
  if (html) {
    const ids = listingIdsAusHtml(html)
    if (ids.length > 0) return { keyword: kw, listingIds: ids, provider: 'etsy_search' }
  }

  if (!etsyApiKonfiguriert()) return null
  try {
    const q = new URLSearchParams({ keywords: kw, sort_on: 'score', limit: '100' })
    const res = await apiDrossel(() =>
      fetch(`${ETSY_API_BASE}/application/listings/active?${q.toString()}`, {
        headers: { 'x-api-key': etsyApiKeyHeader(), Accept: 'application/json' },
        cache: 'no-store',
        signal: AbortSignal.timeout(15_000),
      }),
    )
    if (!res.ok) return null
    const data = (await res.json()) as { results?: Array<{ listing_id?: number }> }
    const ids = (data.results ?? [])
      .map((r) => Number(r.listing_id))
      .filter((id) => Number.isFinite(id) && id > 0)
    return { keyword: kw, listingIds: ids, provider: 'etsy_api_relevanz' }
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Kombinierter Markt-Kontext für Generator / Audit
// ---------------------------------------------------------------------------

export function marktSeedsFuerBasis(opts: { holzart?: string; produktForm?: string }): string[] {
  const form = norm(opts.produktForm || 'schale')
  const holz = norm(opts.holzart || '')
  const holzForm = form.includes('schale') ? 'holzschale' : `holz ${form}`
  return [
    ...new Set(
      [holz ? `${form} ${holz}` : '', holzForm, `handgedrehte ${form}`].filter((s) => s.length >= 3),
    ),
  ].slice(0, 3)
}

export function marktSeedsFuerListing(opts: { title: string; tags: string[] }): string[] {
  const front = norm(opts.title.split(/[|,]/)[0] || '')
    .split(' ')
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w))
    .slice(0, 3)
    .join(' ')
  const tags = opts.tags.map((t) => norm(t)).filter((t) => t.includes(' ')).slice(0, 2)
  return [...new Set([front, ...tags].filter((s) => s.length >= 3))].slice(0, 3)
}

export async function ladeEtsyMarktKontext(opts: {
  seeds: string[]
  maxAutosuggest?: number
  maxCompetitor?: number
  forceRefresh?: boolean
  /** Weitere Seeds werden übersprungen, sobald das Budget verbraucht ist (Cache-Treffer sind ~0 ms). */
  budgetMs?: number
  /** Holzart/Titel des eigenen Produkts — Kandidaten mit fremder Holzart werden verworfen. */
  holzKontext?: string
}): Promise<EtsyMarktKontext> {
  const seeds = [...new Set(opts.seeds.map((s) => norm(s)).filter((s) => s.length >= 3))].slice(0, 4)
  const maxA = Math.max(0, opts.maxAutosuggest ?? 3)
  const maxC = Math.max(0, opts.maxCompetitor ?? 2)
  const hinweise: string[] = []
  const deadline = Date.now() + (opts.budgetMs ?? 25_000)
  const zeitUebrig = () => Date.now() < deadline

  if (seeds.length === 0) {
    return {
      seeds,
      autosuggest: [],
      competitors: [],
      keywordKandidaten: DOMAIN_SEEDS.slice(0, 13),
      degradiert: true,
      hinweise: ['Keine Seeds — nur Domain-Fallback'],
    }
  }

  // Konkurrenz zuerst: Autosuggest-Fallback nutzt denselben Cache.
  const competitors: EtsyCompetitorInsights[] = []
  for (const s of seeds.slice(0, maxC)) {
    if (!zeitUebrig()) break
    competitors.push(await getCompetitorInsights(s, { forceRefresh: opts.forceRefresh }))
  }
  const autosuggest: EtsyAutosuggestErgebnis[] = []
  for (const s of seeds.slice(0, maxA)) {
    if (!zeitUebrig()) break
    // Käufer-Vorschläge nur 7-tägig gecacht erneuern; forceRefresh gilt für Etsy-Daten.
    const [etsy, kaeufer] = await Promise.all([
      getEtsyAutosuggest(s, { forceRefresh: opts.forceRefresh }),
      getKaeuferSuggest(s),
    ])
    autosuggest.push(etsy, ...kaeufer)
  }
  if (!zeitUebrig()) hinweise.push('Zeitbudget für Markt-Daten erreicht — Teil-Daten.')

  const gesehen = new Set<string>()
  const kandidaten: string[] = []
  const push = (raw: string) => {
    const t = alsTag(raw)
    if (!t || gesehen.has(t)) return
    gesehen.add(t)
    kandidaten.push(t)
  }
  const istKaeufer = (a: EtsyAutosuggestErgebnis) => a.provider === 'google_de' || a.provider === 'amazon_de'
  // Phrasen, die Google UND Amazon vorschlagen, sind die stärksten Käufer-Signale.
  const kaeuferZaehler = new Map<string, number>()
  for (const a of autosuggest.filter(istKaeufer)) {
    for (const s of a.suggestions) kaeuferZaehler.set(s, (kaeuferZaehler.get(s) ?? 0) + 1)
  }
  for (const a of autosuggest) if (a.provider === 'etsy_suggest') a.suggestions.forEach(push)
  for (const [s, n] of kaeuferZaehler) if (n >= 2) push(s)
  for (const c of competitors) c.topTags.filter((t) => t.count >= 2).forEach((t) => push(t.tag))
  for (const a of autosuggest.filter(istKaeufer)) a.suggestions.forEach(push)
  for (const c of competitors) c.topTitelPhrasen.forEach((t) => push(t.tag))
  for (const a of autosuggest) if (a.provider === 'competitor_tags' || a.provider === 'seed') a.suggestions.forEach(push)
  for (const c of competitors) c.topTags.forEach((t) => push(t.tag))

  const autosuggestLive = autosuggest.some((a) => a.provider === 'etsy_suggest' || istKaeufer(a))
  const compLive = competitors.some((c) => c.provider !== 'unavailable')
  if (!autosuggestLive && maxA > 0) hinweise.push('Keine Suchvorschläge erreichbar — Konkurrenz-Tags als Ersatz.')
  else if (!autosuggest.some((a) => a.provider === 'etsy_suggest') && maxA > 0) {
    hinweise.push('Etsy-Autosuggest gesperrt — Suchvorschläge von Google.de/Amazon.de genutzt.')
  }
  if (!compLive && maxC > 0) hinweise.push('Keine Konkurrenzdaten — nur Domain-Seeds.')
  if (kandidaten.length === 0) DOMAIN_SEEDS.forEach(push)
  const zielmarkt = filtereKandidatenFuerZielmarkt(kandidaten, opts.holzKontext)

  return {
    seeds,
    autosuggest,
    competitors,
    keywordKandidaten: (zielmarkt.length > 0 ? zielmarkt : kandidaten).slice(0, 30),
    degradiert: !autosuggestLive || !compLive,
    hinweise,
  }
}

// ---------------------------------------------------------------------------
// Keyword-Explorer (eRank-Keyword-Tool-Ersatz aus freien Quellen)
// ---------------------------------------------------------------------------

const EXPLORER_BUCHSTABEN = 'abcdefghiklmnoprstuvwz'.split('')
const EXPLORER_ZUSAETZE = ['geschenk', 'groß', 'klein', 'deko', 'handgemacht', 'rund', 'natur']

/** So tippen Käufer weiter, nachdem das Produktwort da ist. */
const MENSCH_ANHAENGE_STANDARD = [
  'geschenk',
  'unikat',
  'groß',
  'klein',
  'deko',
  'rustikal',
  'für',
  'aus',
  'massivholz',
  'handgemacht',
]

const TITEL_PRODUKT_RE = /schale|vase|schüssel|schuessel|dose|bowl|holz/
const TITEL_HOLZ_RE = /eiche|nuss|ahorn|buche|kirsch|esche|olive|birke|ulme|linde|pflaume/

function kaeuferNgrammeAusTitel(title: string): string[] {
  const w = norm(title)
    .split(/[^a-zäöüß0-9]+/i)
    .filter((x) => x.length >= 3 && !STOPWORDS.has(x))
  const out: string[] = []
  for (let n = 2; n <= 3; n++) {
    for (let i = 0; i <= w.length - n; i++) {
      const g = w.slice(i, i + n).join(' ')
      if (g.length < 8 || g.length > 28) continue
      if (!TITEL_PRODUKT_RE.test(g) && !TITEL_HOLZ_RE.test(g)) continue
      out.push(g)
    }
  }
  return out
}

const SAISON_RE: Array<[RegExp, string]> = [
  [/weihnacht|advent|nikolaus|wichtel/, 'Weihnachten (ab Mitte Okt.)'],
  [/ostern|oster/, 'Ostern'],
  [/muttertag/, 'Muttertag (Mai)'],
  [/vatertag/, 'Vatertag'],
  [/valentin/, 'Valentinstag'],
  [/hochzeit|jahrestag/, 'Hochzeit/Jahrestag (ganzjährig)'],
  [/einzug|richtfest|housewarming|neue wohnung/, 'Einzug (ganzjährig)'],
  [/herbst|erntedank/, 'Herbst'],
]

function saisonFuer(k: string): string | null {
  for (const [re, label] of SAISON_RE) if (re.test(k)) return label
  return null
}

type EtsyTopTags = {
  listings: number
  markt: 'DE' | 'global'
  tags: Array<{ tag: string; nutzung: number; punkte: number }>
}

/**
 * Echte Etsy-Daten trotz blockiertem Autosuggest: Tags der von Etsy am besten gerankten
 * Listings (Open API, sort_on=score). Gewicht = Rang × Favoriten — Tags erfolgreicher
 * Listings sind die Suchphrasen, über die Etsy-Käufer tatsächlich finden.
 */
async function holeEtsyTopTags(keyword: string): Promise<EtsyTopTags | null> {
  if (!etsyApiKonfiguriert()) return null
  const key = cacheKey('etsytags:v2:de', keyword)
  const c = await ladeCache<EtsyTopTags>(key)
  if (c) return c.payload

  const lade = async (shopLocation?: string) => {
    const q = new URLSearchParams({ keywords: keyword, sort_on: 'score', limit: '100' })
    if (shopLocation) q.set('shop_location', shopLocation)
    const res = await apiDrossel(() =>
      fetch(`${ETSY_API_BASE}/application/listings/active?${q.toString()}`, {
        headers: { 'x-api-key': etsyApiKeyHeader(), Accept: 'application/json' },
        cache: 'no-store',
        signal: AbortSignal.timeout(12_000),
      }),
    ).catch(() => null)
    if (!res?.ok) return [] as ApiListing[]
    return ((await res.json()) as { results?: ApiListing[] }).results ?? []
  }

  let markt: EtsyTopTags['markt'] = 'DE'
  let listings = await lade(ETSY_KONKURRENZ_SHOP_LOCATION)
  if (listings.length < 20) {
    markt = 'global'
    listings = await lade()
  }
  if (listings.length === 0) return null

  const tally = new Map<string, { nutzung: number; punkte: number }>()
  listings.forEach((l, rang) => {
    const gewicht = Math.max(0.2, 1 - rang / 120) * (1 + Math.log10(1 + Number(l.num_favorers || 0)) / 2)
    const gesehen = new Set<string>()
    for (const roh of l.tags ?? []) {
      const tag = bereinigeSuggestion(norm(String(roh)))
      if (!tag || gesehen.has(tag)) continue
      gesehen.add(tag)
      const t = tally.get(tag) ?? { nutzung: 0, punkte: 0 }
      t.nutzung++
      t.punkte += gewicht
      tally.set(tag, t)
    }
    for (const phrase of kaeuferNgrammeAusTitel(String(l.title || ''))) {
      const tag = bereinigeSuggestion(phrase)
      if (!tag || gesehen.has(tag)) continue
      gesehen.add(tag)
      const t = tally.get(tag) ?? { nutzung: 0, punkte: 0 }
      t.nutzung++
      t.punkte += gewicht * 0.7
      tally.set(tag, t)
    }
  })
  const erg: EtsyTopTags = {
    listings: listings.length,
    markt,
    tags: [...tally.entries()]
      .filter(([, t]) => t.nutzung >= 2)
      .map(([tag, t]) => ({ tag, nutzung: t.nutzung, punkte: Math.round(t.punkte * 100) / 100 }))
      .sort((a, b) => b.punkte - a.punkte)
      .slice(0, 40),
  }
  await speichereCache(key, 'competitor', erg)
  return erg
}

export function chanceAus(nachfrage: number, wettbewerb: number | null): EtsyKeywordIdee['chance'] {
  if (wettbewerb == null) return null
  // Nachfrage je Größenordnung Wettbewerb — Nischen mit echter Nachfrage gewinnen.
  const wert = nachfrage / Math.max(1, Math.log10(wettbewerb + 10))
  return wert >= 30 ? 'hoch' : wert >= 15 ? 'mittel' : 'niedrig'
}

export async function erkundeEtsyKeywords(
  seedRoh: string,
  opts?: {
    tief?: boolean
    menschlich?: boolean
    anhaenge?: string[]
    maxWettbewerb?: number
    budgetMs?: number
    holzKontext?: string
  },
): Promise<EtsyKeywordExplorerErgebnis> {
  const seed = norm(seedRoh).slice(0, 50)
  const hinweise: string[] = []
  if (seed.length < 3) return { seed, ideen: [], abfragen: 0, hinweise: ['Suchbegriff zu kurz'] }
  const deadline = Date.now() + (opts?.budgetMs ?? 40_000)
  const menschlich = opts?.menschlich === true
  const anhaenge = [...new Set((opts?.anhaenge?.length ? opts.anhaenge : MENSCH_ANHAENGE_STANDARD).map(norm))].filter(
    (a) => a.length >= 2 && a !== seed && !seed.includes(a),
  )

  const anfragen: Array<{ quelle: KaeuferQuelle | 'etsy'; q: string }> = [
    { quelle: 'google_de', q: seed },
    { quelle: 'amazon_de', q: seed },
    { quelle: 'etsy', q: seed },
  ]
  if (opts?.tief && menschlich) {
    for (const z of anhaenge.slice(0, 8)) {
      anfragen.push({ quelle: 'google_de', q: `${seed} ${z}` })
      anfragen.push({ quelle: 'amazon_de', q: `${seed} ${z}` })
    }
    for (const z of anhaenge.slice(0, 4)) {
      anfragen.push({ quelle: 'etsy', q: `${seed} ${z}` })
    }
  } else if (opts?.tief) {
    for (const b of EXPLORER_BUCHSTABEN) anfragen.push({ quelle: 'google_de', q: `${seed} ${b}` })
    for (const z of EXPLORER_ZUSAETZE) anfragen.push({ quelle: 'amazon_de', q: `${seed} ${z}` })
  } else if (menschlich) {
    for (const z of anhaenge.slice(0, 3)) {
      anfragen.push({ quelle: 'google_de', q: `${seed} ${z}` })
    }
  }

  type Treffer = { punkte: number; quellen: Set<EtsyKeywordIdee['quellen'][number]> }
  const treffer = new Map<string, Treffer>()
  const merke = (kw: string, quelle: EtsyKeywordIdee['quellen'][number], pos: number, gewicht: number) => {
    const t = treffer.get(kw) ?? { punkte: 0, quellen: new Set() }
    t.punkte += gewicht * Math.max(0.1, 1 - pos / 12)
    t.quellen.add(quelle)
    treffer.set(kw, t)
  }

  let abfragen = 0
  for (const a of anfragen) {
    if (Date.now() > deadline) {
      hinweise.push('Zeitbudget erreicht — Teilergebnis.')
      break
    }
    abfragen++
    if (a.quelle === 'etsy') {
      const e = await getEtsyAutosuggest(a.q)
      if (e.provider === 'etsy_suggest') e.suggestions.forEach((s, i) => merke(s, 'etsy_suggest', i, 1.3))
      else e.suggestions.forEach((s, i) => merke(s, 'etsy_tags', i, 0.55))
      continue
    }
    const r = await getKaeuferSuggestEinzeln(a.quelle, a.q)
    // Amazon = Kaufabsicht → leicht höher gewichtet.
    r?.suggestions.forEach((s, i) => merke(s, a.quelle as KaeuferQuelle, i, a.quelle === 'amazon_de' ? 1.2 : 1))
  }
  // Etsy selbst: Tags der Top-Listings für den Suchbegriff (+ bei Tiefensuche für die
  // stärksten Käuferphrasen). Wichtigste Quelle — hier wird tatsächlich verkauft.
  const etsyNutzung = new Map<string, number>()
  const etsySeeds = [seed]
  if (opts?.tief) {
    const top = [...treffer.entries()]
      .filter(([kw]) => kw !== seed && kw.includes(' '))
      .sort((a, b) => b[1].punkte - a[1].punkte)
      .slice(0, 4)
      .map(([kw]) => kw)
    etsySeeds.push(...top)
  }
  let etsyOk = false
  for (const q of etsySeeds) {
    if (q !== seed && Date.now() > deadline) break
    abfragen++
    const e = await holeEtsyTopTags(q)
    if (!e) continue
    etsyOk = true
    const maxP = e.tags[0]?.punkte || 1
    e.tags.forEach((t, i) => {
      const tr = treffer.get(t.tag) ?? { punkte: 0, quellen: new Set() }
      tr.punkte += 1.5 * (0.3 + 0.7 * (t.punkte / maxP)) * Math.max(0.3, 1 - i / 40)
      tr.quellen.add('etsy_tags')
      treffer.set(t.tag, tr)
      etsyNutzung.set(t.tag, Math.max(etsyNutzung.get(t.tag) ?? 0, t.nutzung))
    })
    if (q === seed && e.markt === 'global') hinweise.push('Etsy-Tags aus globalen Listings (zu wenig deutsche Treffer).')
  }
  if (!etsyOk) hinweise.push('Etsy-Top-Listings nicht erreichbar — nur Google/Amazon.')
  if (treffer.size === 0) hinweise.push('Keine Suchvorschläge erreichbar (Google/Amazon/Etsy).')

  const max = Math.max(1, ...[...treffer.values()].map((t) => t.punkte + (t.quellen.size - 1) * 0.8))
  const eigeneHolz = erkenneHolzGruppen(opts?.holzKontext || '')
  let ideen: EtsyKeywordIdee[] = [...treffer.entries()]
    .filter(([kw]) => !nenntFremdeHolzart(kw, eigeneHolz))
    .map(([keyword, t]) => ({
      keyword,
      nachfrage: Math.round(((t.punkte + (t.quellen.size - 1) * 0.8) / max) * 100),
      quellen: [...t.quellen],
      etsyNutzung: etsyNutzung.get(keyword) ?? null,
      wettbewerb: null,
      wettbewerbMarkt: null,
      chance: null,
      tagTauglich: keyword.length <= TAG_MAX,
      saison: saisonFuer(keyword),
    }))
    .sort((a, b) => b.nachfrage - a.nachfrage)
    .slice(0, 80)

  const maxW = opts?.maxWettbewerb ?? 12
  for (const idee of ideen.slice(0, maxW)) {
    if (Date.now() > deadline) break
    const c = await getCompetitorInsights(idee.keyword, { mitBadges: false })
    if (c.provider === 'unavailable') continue
    idee.wettbewerb = c.wettbewerbCount
    idee.wettbewerbMarkt = c.marktFilter ?? null
    idee.chance = chanceAus(idee.nachfrage, c.wettbewerbCount)
  }
  ideen = ideen.filter((i) => i.nachfrage >= 3)

  return { seed, ideen, abfragen, hinweise }
}

/** Kompakter Prompt-Block — hält Tokens klein (Free-Tier). */
export function baueMarktPromptBlock(markt: EtsyMarktKontext | null | undefined): string {
  if (!markt) return ''
  const zeilen: string[] = ['### MARKT-DATEN (Etsy, heute)']
  for (const a of markt.autosuggest) {
    if (a.suggestions.length === 0) continue
    const label =
      a.provider === 'etsy_suggest'
        ? 'Reale Etsy-Suchanfragen'
        : a.provider === 'google_de'
          ? 'Google.de-Suchvorschläge (deutsche Käufer)'
          : a.provider === 'amazon_de'
            ? 'Amazon.de-Suchvorschläge (Kaufabsicht)'
            : a.provider === 'competitor_tags'
          ? 'Ersatz: Tags der Top-Listings'
          : 'Ersatz: Domain-Seeds (nicht live)'
    zeilen.push(`${label} zu „${a.query}“: ${a.suggestions.slice(0, 10).join(' · ')}`)
  }
  for (const c of markt.competitors) {
    if (c.provider === 'unavailable') continue
    const tags = c.topTags.slice(0, 12).map((t) => `${t.tag} (${t.count}/${c.listings.length})`)
    const herkunft = c.marktFilter === 'DE' ? ' (Shops aus DE)' : c.marktFilter === 'global' ? ' (global, v. a. US/UK)' : ''
    zeilen.push(`Top-${c.listings.length} Konkurrenz „${c.keyword}“${herkunft} — häufigste Tags: ${tags.join(' · ')}`)
    if (c.topTitelPhrasen.length) {
      zeilen.push(`  Titel-Phrasen: ${c.topTitelPhrasen.slice(0, 8).map((t) => t.tag).join(' · ')}`)
    }
    if (c.preis.median != null) {
      zeilen.push(`  Preise EUR: Median ${c.preis.median} · Spanne ${c.preis.min}–${c.preis.max}`)
    }
    if (c.wettbewerbCount != null) zeilen.push(`  Wettbewerb: ${c.wettbewerbCount} aktive Treffer`)
    if (c.badgeAnteil != null) zeilen.push(`  Anteil mit Bestseller/Popular-Badge: ${Math.round(c.badgeAnteil * 100)} %`)
  }
  if (markt.keywordKandidaten.length) {
    zeilen.push(`Keyword-Kandidaten (≤20 Zeichen): ${markt.keywordKandidaten.slice(0, 20).join(' · ')}`)
  }
  if (markt.degradiert) zeilen.push(`Hinweis: ${markt.hinweise.join(' ') || 'Teilweise Fallback-Daten.'}`)
  const eigen = markt.eigeneSignale
  if (eigen) {
    if (eigen.merkliste.length) {
      zeilen.push(`Vom Verkäufer gemerkte Keywords (bevorzugen, wenn sie zum Produkt passen): ${eigen.merkliste.slice(0, 15).join(' · ')}`)
    }
    if (eigen.konkurrenzTags.length) {
      zeilen.push(
        `Tags der ${eigen.konkurrenzShops} erfolgreichsten deutschen Drechsler-Shops (Schwerpunkt gedrechselte Schalen): ` +
          eigen.konkurrenzTags.slice(0, 15).map((t) => `${t.tag} (${t.shops}/${eigen.konkurrenzShops})`).join(' · '),
      )
    }
    for (const s of eigen.saison) {
      zeilen.push(`SAISON JETZT: ${s.name} — „${s.tag}“ als einen der 13 Tags einplanen.`)
    }
  }
  zeilen.push(
    'Nutze Markt-Phrasen nur, wenn sie zum Produkt passen (Holzart/Form). Keine fremden Holzarten/Formen übernehmen. Englische Phrasen nur als Ergänzung (Zielmarkt DE/EU, kein Versand USA/UK). Preise der Konkurrenz sind Orientierung, kein Anker nach unten für Unikate.',
  )
  return zeilen.join('\n')
}
