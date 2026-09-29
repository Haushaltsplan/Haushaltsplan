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
  EtsyMarktKontext,
  EtsyTagFrequenz,
} from '@/lib/etsy/etsy-markt-types'
import { createSupabaseAdmin } from '@/lib/supabase-admin'

const CACHE_TTL_MS = 24 * 60 * 60 * 1000
const HTML_BLOCK_MS = 30 * 60 * 1000
const TAG_MAX = 20
const COMPETITOR_LIMIT = 10

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

function htmlGeblockt(): boolean {
  return Date.now() < htmlGeblocktBis
}

function markiereHtmlGeblockt(status: number) {
  if (status === 403 || status === 429) htmlGeblocktBis = Date.now() + HTML_BLOCK_MS
}

// ---------------------------------------------------------------------------
// Cache: In-Memory + Supabase (etsy_markt_cache)
// ---------------------------------------------------------------------------

type CacheEintrag<T> = { at: number; payload: T }
const memCache = new Map<string, CacheEintrag<unknown>>()

function cacheKey(kind: string, q: string): string {
  return `${kind}:${q.toLowerCase().replace(/\s+/g, ' ').trim()}`.slice(0, 200)
}

async function ladeCache<T>(key: string): Promise<CacheEintrag<T> | null> {
  const mem = memCache.get(key)
  if (mem && Date.now() - mem.at < CACHE_TTL_MS) return mem as CacheEintrag<T>
  try {
    const { data } = await createSupabaseAdmin()
      .from('etsy_markt_cache')
      .select('payload, fetched_at')
      .eq('cache_key', key)
      .maybeSingle()
    if (!data) return null
    const at = new Date(String(data.fetched_at)).getTime()
    if (!Number.isFinite(at) || Date.now() - at >= CACHE_TTL_MS) return null
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
): Promise<{ listings: EtsyCompetitorListing[]; count: number | null } | null> {
  if (!etsyApiKonfiguriert()) return null
  const q = new URLSearchParams({
    keywords: keyword,
    sort_on: 'score',
    limit: String(COMPETITOR_LIMIT),
  })
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
      fetch(`https://www.etsy.com/search?q=${encodeURIComponent(keyword)}&explicit=1`, {
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

  const key = cacheKey('competitor', kw)
  if (!opts?.forceRefresh) {
    const c = await ladeCache<EtsyCompetitorInsights>(key)
    if (c) return { ...c.payload, quelle: 'cache' }
  }

  try {
    let provider: EtsyCompetitorInsights['provider'] = 'unavailable'
    let listings: EtsyCompetitorListing[] = []
    let count: number | null = null
    const notes: string[] = []

    const api = await holeKonkurrenzViaApi(kw).catch((e) => {
      notes.push(e instanceof Error ? e.message.slice(0, 80) : 'API-Fehler')
      return null
    })
    if (api && api.listings.length > 0) {
      provider = 'etsy_api'
      listings = api.listings
      count = api.count
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
      note:
        [
          provider === 'etsy_api' ? 'Relevanz-Sortierung Open API (≈ organisch, ohne Ads/Personalisierung)' : '',
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
    autosuggest.push(await getEtsyAutosuggest(s, { forceRefresh: opts.forceRefresh }))
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
  for (const a of autosuggest) if (a.provider === 'etsy_suggest') a.suggestions.forEach(push)
  for (const c of competitors) c.topTags.filter((t) => t.count >= 2).forEach((t) => push(t.tag))
  for (const c of competitors) c.topTitelPhrasen.forEach((t) => push(t.tag))
  for (const a of autosuggest) if (a.provider !== 'etsy_suggest') a.suggestions.forEach(push)
  for (const c of competitors) c.topTags.forEach((t) => push(t.tag))

  const autosuggestLive = autosuggest.some((a) => a.provider === 'etsy_suggest')
  const compLive = competitors.some((c) => c.provider !== 'unavailable')
  if (!autosuggestLive && maxA > 0) hinweise.push('Autosuggest nicht erreichbar — Konkurrenz-Tags als Ersatz.')
  if (!compLive && maxC > 0) hinweise.push('Keine Konkurrenzdaten — nur Domain-Seeds.')
  if (kandidaten.length === 0) DOMAIN_SEEDS.forEach(push)

  return {
    seeds,
    autosuggest,
    competitors,
    keywordKandidaten: kandidaten.slice(0, 30),
    degradiert: !autosuggestLive || !compLive,
    hinweise,
  }
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
        : a.provider === 'competitor_tags'
          ? 'Ersatz: Tags der Top-Listings'
          : 'Ersatz: Domain-Seeds (nicht live)'
    zeilen.push(`${label} zu „${a.query}“: ${a.suggestions.slice(0, 10).join(' · ')}`)
  }
  for (const c of markt.competitors) {
    if (c.provider === 'unavailable') continue
    const tags = c.topTags.slice(0, 12).map((t) => `${t.tag} (${t.count}/${c.listings.length})`)
    zeilen.push(`Top-${c.listings.length} Konkurrenz „${c.keyword}“ — häufigste Tags: ${tags.join(' · ')}`)
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
  zeilen.push(
    'Nutze Markt-Phrasen nur, wenn sie zum Produkt passen (Holzart/Form). Keine fremden Holzarten/Formen übernehmen. Preise der Konkurrenz sind Orientierung, kein Anker nach unten für Unikate.',
  )
  return zeilen.join('\n')
}
