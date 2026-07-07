/** Persistenter SEC-Segment-Historie-Cache in Supabase (Service Role). */

import 'server-only'

import type { SecSegmentHistoriePaket } from '@/lib/portfolio-analyse/fundamentaldaten-erweitert-types'
import type { SecSegmentHistorieRohZustand } from '@/lib/portfolio-analyse/sec-edgar-segment-historie-roh-types'
import { createSupabaseAdmin } from '@/lib/supabase-admin'

const TABLE = 'sec_segment_historie_cache' as const

export type SecSegmentHistorieCloudEintrag = {
  ticker: string
  cik: number
  cacheVersion: number
  verarbeiteteAccessions: string[]
  neuesteAccession: string | null
  neuestesBerichtJahr: number | null
  roh: SecSegmentHistorieRohZustand
  paket: SecSegmentHistoriePaket
  aktualisiertAm: string
}

function istCloudKonfiguriert(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim())
}

function tickerNorm(ticker: string): string {
  return ticker.trim().toUpperCase()
}

export async function ladeSecSegmentHistorieAusCloud(
  ticker: string,
): Promise<SecSegmentHistorieCloudEintrag | null> {
  if (!istCloudKonfiguriert()) return null
  const sym = tickerNorm(ticker)
  try {
    const { data, error } = await createSupabaseAdmin()
      .from(TABLE)
      .select(
        'ticker, cik, cache_version, verarbeitete_accessions, neueste_accession, neuestes_bericht_jahr, roh_json, paket_json, aktualisiert_am',
      )
      .eq('ticker', sym)
      .maybeSingle()
    if (error || !data) {
      if (error) console.warn('SEC-Segment-Cloud: laden', sym, error.message)
      return null
    }
    const row = data as {
      ticker: string
      cik: number
      cache_version: number
      verarbeitete_accessions: string[] | null
      neueste_accession: string | null
      neuestes_bericht_jahr: number | null
      roh_json: SecSegmentHistorieRohZustand
      paket_json: SecSegmentHistoriePaket
      aktualisiert_am: string
    }
    if (!row.paket_json || !row.roh_json) return null
    return {
      ticker: sym,
      cik: row.cik,
      cacheVersion: row.cache_version,
      verarbeiteteAccessions: row.verarbeitete_accessions ?? [],
      neuesteAccession: row.neueste_accession,
      neuestesBerichtJahr: row.neuestes_bericht_jahr,
      roh: row.roh_json,
      paket: row.paket_json,
      aktualisiertAm: row.aktualisiert_am,
    }
  } catch (e) {
    console.warn('SEC-Segment-Cloud: laden fehlgeschlagen', sym, e)
    return null
  }
}

export async function speichereSecSegmentHistorieInCloud(
  eintrag: SecSegmentHistorieCloudEintrag,
): Promise<void> {
  if (!istCloudKonfiguriert()) return
  const sym = tickerNorm(eintrag.ticker)
  try {
    const { error } = await createSupabaseAdmin()
      .from(TABLE)
      .upsert(
        {
          ticker: sym,
          cik: eintrag.cik,
          cache_version: eintrag.cacheVersion,
          verarbeitete_accessions: eintrag.verarbeiteteAccessions,
          neueste_accession: eintrag.neuesteAccession,
          neuestes_bericht_jahr: eintrag.neuestesBerichtJahr,
          roh_json: eintrag.roh,
          paket_json: eintrag.paket,
          aktualisiert_am: new Date().toISOString(),
        },
        { onConflict: 'ticker' },
      )
    if (error) console.warn('SEC-Segment-Cloud: speichern', sym, error.message)
  } catch (e) {
    console.warn('SEC-Segment-Cloud: speichern fehlgeschlagen', sym, e)
  }
}
