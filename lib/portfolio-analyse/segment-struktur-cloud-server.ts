/** Persistenter Segment-Struktur-Cache (Supabase, Service Role). */

import 'server-only'

import type { SecSegmentHistoriePaket } from '@/lib/portfolio-analyse/fundamentaldaten-erweitert-types'
import { createSupabaseAdmin } from '@/lib/supabase-admin'

const TABLE = 'segment_struktur_cache' as const
export const SEGMENT_STRUKTUR_CLOUD_VERSION = 5
const MAX_CLOUD_AGE_MS = 45 * 24 * 60 * 60 * 1000

function istCloudKonfiguriert(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim())
}

export async function ladeSegmentStrukturAusCloud(
  isin: string,
): Promise<SecSegmentHistoriePaket | null> {
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
      if (error) console.warn('[segment-struktur-cloud] laden', key, error.message)
      return null
    }
    const row = data as {
      cache_version: number
      paket_json: SecSegmentHistoriePaket
      aktualisiert_am: string
    }
    if (row.cache_version !== SEGMENT_STRUKTUR_CLOUD_VERSION) return null
    const age = Date.now() - new Date(row.aktualisiert_am).getTime()
    if (!Number.isFinite(age) || age > MAX_CLOUD_AGE_MS) return null
    const paket = row.paket_json
    if (!paket?.produkt && !paket?.geo && !paket?.backlog) return null
    return paket
  } catch (e) {
    console.warn('[segment-struktur-cloud] laden fehlgeschlagen', key, e)
    return null
  }
}

export async function speichereSegmentStrukturInCloud(opts: {
  isin: string
  ticker?: string | null
  firmenname?: string | null
  paket: SecSegmentHistoriePaket
}): Promise<void> {
  if (!istCloudKonfiguriert()) return
  const key = opts.isin.trim().toUpperCase()
  if (key.length < 10) return
  if (!opts.paket.produkt && !opts.paket.geo && !opts.paket.backlog) return
  try {
    const { error } = await createSupabaseAdmin()
      .from(TABLE)
      .upsert(
        {
          isin: key,
          ticker: opts.ticker?.trim().toUpperCase() || null,
          firmenname: opts.firmenname?.trim() || null,
          cache_version: SEGMENT_STRUKTUR_CLOUD_VERSION,
          paket_json: opts.paket,
          quelle: opts.paket.quelle,
          aktualisiert_am: new Date().toISOString(),
        },
        { onConflict: 'isin' },
      )
    if (error) console.warn('[segment-struktur-cloud] speichern', key, error.message)
  } catch (e) {
    console.warn('[segment-struktur-cloud] speichern fehlgeschlagen', key, e)
  }
}
