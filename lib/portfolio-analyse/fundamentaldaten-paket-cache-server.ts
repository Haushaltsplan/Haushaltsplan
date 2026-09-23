/** Supabase-Cache für das komplette Fundamentaldaten-Paket. */

import 'server-only'

import { createSupabaseAdmin } from '@/lib/supabase-admin'
import type {
  FundamentaldatenAnfrage,
  FundamentaldatenPaket,
} from '@/lib/portfolio-analyse/fundamentaldaten-types'
import { isinKenntnis, loesePortfolioIsin } from '@/lib/portfolio-analyse/isin-kenntnisse'

const TABLE = 'fundamentaldaten_paket_cache' as const
export const FUNDAMENTALDATEN_CACHE_VERSION = 1
/** Frisch: kein erneuter Scrape. Danach einmal prüfen, ob sich die GuV geändert hat. */
const FRISCH_MS = 20 * 60 * 60 * 1000

function cloudOk(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim())
}

export function fundamentaldatenCacheKey(anfrage: FundamentaldatenAnfrage): string {
  const freq = anfrage.frequenz === 'quartal' ? 'quartal' : 'jahr'
  const isin = loesePortfolioIsin({
    isin: anfrage.isin,
    symbolYahoo: anfrage.symbolYahoo,
    firmenname: anfrage.name,
  })
  if (isin && isin.length >= 12) return `${isin}|${freq}`
  const sym = (anfrage.tickerOverride || anfrage.symbolYahoo || '').trim().toUpperCase()
  if (sym) return `${sym}|${freq}`
  return ''
}

/** Nur GuV/Bilanz — keine Kurse, sonst würde jeder Handelstag als Änderung gelten. */
export function fundamentaldatenFingerprint(p: FundamentaldatenPaket): string {
  const hist = p.perioden
    .filter((x) => !x.istSchaetzung && !x.istNtm && !x.istLtm)
    .map((x) => x.iso)
    .slice(-4)
  const serie = (id: string) => {
    const z = p.zeilen.find((r) => r.id === id)
    return hist.map((k) => z?.werte[k] ?? null)
  }
  return JSON.stringify({
    v: FUNDAMENTALDATEN_CACHE_VERSION,
    hist,
    umsatz: serie('umsatz'),
    eps: serie('eps'),
    fcf: serie('fcf'),
    ek: serie('eigenkapital'),
    zeilen: p.zeilen.length,
    roiic: p.keyMetrics.find((m) => m.id === 'incremental_roic')?.zahl ?? null,
  })
}

/** Anzahl historischer Werte einer Zeile (ohne TTM/Schätzung). */
export function fundamentalHistorikTiefe(p: FundamentaldatenPaket, id: string): number {
  const z = p.zeilen.find((r) => r.id === id)
  if (!z) return 0
  const hist = p.perioden.filter((x) => !x.istSchaetzung && !x.istNtm && !x.istLtm)
  let n = 0
  for (const per of hist) {
    const v = z.werte[per.iso]
    if (v != null && Number.isFinite(v)) n++
  }
  return n
}

/**
 * True wenn Live-Scrape die GuV-/Cashflow-Historie klar dünner macht als der Cache.
 * Verhindert, dass ein teilweiser Macrotrends-Abruf (CF/Timeout) gute CAGRs überschreibt.
 *
 * Strikt: schon wenn eine Kernserie spürbar kürzer wird ODER 3J-CAGRs verschwinden.
 */
export function liveFundamentalIstDuennemAlsCache(
  live: FundamentaldatenPaket,
  cached: FundamentaldatenPaket,
): boolean {
  if (!live.ok || !cached.ok) return false
  const ids = ['umsatz', 'eps', 'ebitda', 'fcf', 'eigenkapital'] as const
  let liveSum = 0
  let cacheSum = 0
  for (const id of ids) {
    const l = fundamentalHistorikTiefe(live, id)
    const c = fundamentalHistorikTiefe(cached, id)
    liveSum += l
    cacheSum += c
    // Einzelserie: Cache hat ≥6 Jahre, Live verliert >25 % → ablehnen
    if (c >= 6 && l < c * 0.75) return true
  }
  if (cacheSum >= 10 && liveSum < cacheSum) return true

  const cagrIds = ['rev_cagr_3y', 'ebitda_cagr_3y', 'eps_cagr_3y'] as const
  for (const id of cagrIds) {
    const c = cached.keyMetrics.find((m) => m.id === id)
    const l = live.keyMetrics.find((m) => m.id === id)
    const cOk = c?.zahl != null && Number.isFinite(c.zahl)
    const lOk = l?.zahl != null && Number.isFinite(l.zahl)
    if (cOk && !lOk) return true
  }

  // Deutlich weniger Zeilen (Ratios/CF fehlen) → Cache behalten
  if (cached.zeilen.length >= 20 && live.zeilen.length < cached.zeilen.length * 0.7) return true

  return false
}

export type PaketCacheTreffer = {
  paket: FundamentaldatenPaket
  fingerprint: string
  aktualisiertAm: number
}

export function istFundamentalCacheFrisch(aktualisiertAm: number): boolean {
  const age = Date.now() - aktualisiertAm
  return Number.isFinite(age) && age >= 0 && age < FRISCH_MS
}

function trefferAusRow(data: unknown): PaketCacheTreffer | null {
  const row = data as {
    cache_version: number
    fingerprint: string
    paket_json: FundamentaldatenPaket
    aktualisiert_am: string
  }
  if (row.cache_version !== FUNDAMENTALDATEN_CACHE_VERSION) return null
  if (!row.paket_json?.ok || !row.paket_json.zeilen?.length) return null
  const at = Date.parse(row.aktualisiert_am)
  return {
    paket: row.paket_json,
    fingerprint: row.fingerprint,
    aktualisiertAm: Number.isFinite(at) ? at : Date.now(),
  }
}

/** Mehrere Jahres-Pakete in einem Query (Depot-als-Firma). */
export async function ladeFundamentaldatenPaketCacheViele(
  isins: string[],
): Promise<Map<string, FundamentaldatenPaket>> {
  const out = new Map<string, FundamentaldatenPaket>()
  const keys = [...new Set(isins.map((s) => s.trim().toUpperCase()).filter((s) => s.length >= 12))]
  if (!cloudOk() || keys.length === 0) return out
  try {
    const { data, error } = await createSupabaseAdmin()
      .from(TABLE)
      .select('isin, cache_version, fingerprint, paket_json, aktualisiert_am')
      .eq('frequenz', 'jahr')
      .in('isin', keys)
    if (error) {
      console.warn('[fundamental-cache] batch', error.message)
      return out
    }
    for (const row of data ?? []) {
      const isin = String((row as { isin?: string }).isin ?? '').toUpperCase()
      const treffer = trefferAusRow(row)
      if (!isin || !treffer) continue
      if (!out.has(isin)) out.set(isin, treffer.paket)
    }
  } catch (e) {
    console.warn('[fundamental-cache] batch fehlgeschlagen', e)
  }
  return out
}

export async function ladeFundamentaldatenPaketCache(
  cacheKey: string,
): Promise<PaketCacheTreffer | null> {
  if (!cloudOk() || !cacheKey) return null
  try {
    const { data, error } = await createSupabaseAdmin()
      .from(TABLE)
      .select('cache_version, fingerprint, paket_json, aktualisiert_am')
      .eq('cache_key', cacheKey)
      .maybeSingle()
    if (error || !data) {
      if (error) console.warn('[fundamental-cache] laden', cacheKey, error.message)
      return null
    }
    return trefferAusRow(data)
  } catch (e) {
    console.warn('[fundamental-cache] laden fehlgeschlagen', cacheKey, e)
    return null
  }
}

/** ISIN-Key, Ticker-Key, danach ISIN-Spalte — damit die UI denselben Warmup-Stand trifft. */
export async function ladeFundamentaldatenPaketCacheFuerAnfrage(
  anfrage: FundamentaldatenAnfrage,
): Promise<PaketCacheTreffer | null> {
  const freq = anfrage.frequenz === 'quartal' ? 'quartal' : 'jahr'
  const isin = loesePortfolioIsin({
    isin: anfrage.isin,
    symbolYahoo: anfrage.symbolYahoo,
    firmenname: anfrage.name,
  })
  const keys = new Set<string>()
  const primary = fundamentaldatenCacheKey(anfrage)
  if (primary) keys.add(primary)
  if (isin && isin.length >= 12) keys.add(`${isin}|${freq}`)
  const ken = isinKenntnis(isin)
  const mt = ken?.macrotrendsTicker?.trim().toUpperCase()
  if (mt) keys.add(`${mt}|${freq}`)
  const sym = (anfrage.tickerOverride || anfrage.symbolYahoo || ken?.symbolYahoo || '').trim().toUpperCase()
  if (sym) {
    keys.add(`${sym}|${freq}`)
    // Bare-Ticker nur ohne Börsen-Suffix — sonst landet MC.PA bei US-Moelis (MC).
    if (!sym.includes('.')) {
      const basis = sym.split('-')[0]
      if (basis) keys.add(`${basis}|${freq}`)
    }
  }
  for (const key of keys) {
    const hit = await ladeFundamentaldatenPaketCache(key)
    if (hit) return hit
  }
  if (!cloudOk() || !isin || isin.length < 12) return null
  try {
    const { data, error } = await createSupabaseAdmin()
      .from(TABLE)
      .select('cache_version, fingerprint, paket_json, aktualisiert_am')
      .eq('isin', isin)
      .eq('frequenz', freq)
      .order('aktualisiert_am', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) {
      console.warn('[fundamental-cache] laden isin', isin, error.message)
      return null
    }
    return data ? trefferAusRow(data) : null
  } catch (e) {
    console.warn('[fundamental-cache] laden isin fehlgeschlagen', isin, e)
    return null
  }
}

export async function speichereFundamentaldatenPaketCache(opts: {
  cacheKey: string
  anfrage: FundamentaldatenAnfrage
  paket: FundamentaldatenPaket
  fingerprint: string
}): Promise<void> {
  if (!cloudOk() || !opts.cacheKey || !opts.paket.ok) return
  const isin = loesePortfolioIsin({
    isin: opts.anfrage.isin,
    symbolYahoo: opts.anfrage.symbolYahoo,
    firmenname: opts.anfrage.name,
  })
  try {
    const { error } = await createSupabaseAdmin().from(TABLE).upsert(
      {
        cache_key: opts.cacheKey,
        isin: isin && isin.length >= 12 ? isin : null,
        ticker: opts.paket.ticker?.trim().toUpperCase() || null,
        frequenz: opts.anfrage.frequenz === 'quartal' ? 'quartal' : 'jahr',
        cache_version: FUNDAMENTALDATEN_CACHE_VERSION,
        fingerprint: opts.fingerprint,
        paket_json: opts.paket,
        aktualisiert_am: new Date().toISOString(),
      },
      { onConflict: 'cache_key' },
    )
    if (error) console.warn('[fundamental-cache] speichern', opts.cacheKey, error.message)
  } catch (e) {
    console.warn('[fundamental-cache] speichern fehlgeschlagen', opts.cacheKey, e)
  }
}
