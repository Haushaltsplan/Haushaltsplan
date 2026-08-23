/** Supabase-Cache für das komplette Fundamentaldaten-Paket. */

import 'server-only'

import { createSupabaseAdmin } from '@/lib/supabase-admin'
import type {
  FundamentaldatenAnfrage,
  FundamentaldatenPaket,
} from '@/lib/portfolio-analyse/fundamentaldaten-types'
import { loesePortfolioIsin } from '@/lib/portfolio-analyse/isin-kenntnisse'

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

export type PaketCacheTreffer = {
  paket: FundamentaldatenPaket
  fingerprint: string
  aktualisiertAm: number
}

export function istFundamentalCacheFrisch(aktualisiertAm: number): boolean {
  const age = Date.now() - aktualisiertAm
  return Number.isFinite(age) && age >= 0 && age < FRISCH_MS
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
    const row = data as {
      cache_version: number
      fingerprint: string
      paket_json: FundamentaldatenPaket
      aktualisiert_am: string
    }
    if (row.cache_version !== FUNDAMENTALDATEN_CACHE_VERSION) return null
    if (!row.paket_json?.ok || !row.paket_json.zeilen?.length) return null
    const at = Date.parse(row.aktualisiert_am)
    if (!Number.isFinite(at)) return null
    return { paket: row.paket_json, fingerprint: row.fingerprint, aktualisiertAm: at }
  } catch (e) {
    console.warn('[fundamental-cache] laden fehlgeschlagen', cacheKey, e)
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
