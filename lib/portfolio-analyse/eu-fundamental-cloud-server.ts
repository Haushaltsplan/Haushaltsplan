/** Persistenter EU-Fundamental-Cache (Supabase, Service Role). */

import 'server-only'

import type { EuFundamentalPaket } from '@/lib/portfolio-analyse/fundamentaldaten-erweitert-types'
import { createSupabaseAdmin } from '@/lib/supabase-admin'

const TABLE = 'eu_fundamental_cache' as const
export const EU_FUNDAMENTAL_CLOUD_VERSION = 1
const MAX_CLOUD_AGE_MS = 45 * 24 * 60 * 60 * 1000

function istCloudKonfiguriert(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim())
}

export async function ladeEuFundamentalAusCloud(isin: string): Promise<EuFundamentalPaket | null> {
  if (!istCloudKonfiguriert()) return null
  const key = isin.trim().toUpperCase()
  if (key.length < 10) return null
  try {
    const { data, error } = await createSupabaseAdmin()
      .from(TABLE)
      .select('cache_version, paket_json, aktualisiert_am')
      .eq('isin', key)
      .maybeSingle()
    if (error || !data) {
      if (error) console.warn('[eu-fundamental-cloud] laden', key, error.message)
      return null
    }
    const row = data as {
      cache_version: number
      paket_json: EuFundamentalPaket
      aktualisiert_am: string
    }
    if (row.cache_version !== EU_FUNDAMENTAL_CLOUD_VERSION) return null
    const age = Date.now() - new Date(row.aktualisiert_am).getTime()
    if (!Number.isFinite(age) || age > MAX_CLOUD_AGE_MS) return null
    const paket = row.paket_json
    if (!paket?.kennzahlen?.length) return null
    return paket
  } catch (e) {
    console.warn('[eu-fundamental-cloud] laden fehlgeschlagen', key, e)
    return null
  }
}

export async function speichereEuFundamentalInCloud(opts: {
  isin: string
  ticker?: string | null
  firmenname?: string | null
  paket: EuFundamentalPaket
}): Promise<void> {
  if (!istCloudKonfiguriert()) return
  const key = opts.isin.trim().toUpperCase()
  if (key.length < 10) return
  if (!opts.paket.kennzahlen?.length) return
  try {
    const { error } = await createSupabaseAdmin()
      .from(TABLE)
      .upsert(
        {
          isin: key,
          ticker: opts.ticker?.trim().toUpperCase() || null,
          firmenname: opts.firmenname?.trim() || null,
          cache_version: EU_FUNDAMENTAL_CLOUD_VERSION,
          paket_json: opts.paket,
          quelle: opts.paket.quelle,
          aktualisiert_am: new Date().toISOString(),
        },
        { onConflict: 'isin' },
      )
    if (error) console.warn('[eu-fundamental-cloud] speichern', key, error.message)
  } catch (e) {
    console.warn('[eu-fundamental-cloud] speichern fehlgeschlagen', key, e)
  }
}

