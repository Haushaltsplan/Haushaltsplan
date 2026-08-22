/** ISIN-Sektor-Cache in Supabase (Yahoo assetProfile, server-only). */

import 'server-only'

import { createSupabaseAdmin } from '@/lib/supabase-admin'
import type { SektorBatchEintrag } from '@/lib/portfolio-analyse/sektor-batch-server'

const TABLE = 'portfolio_isin_sektor_cache' as const
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000

function istCloudOk(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim())
}

export async function ladeSektorenAusCloud(isins: string[]): Promise<Map<string, SektorBatchEintrag>> {
  const out = new Map<string, SektorBatchEintrag>()
  if (!istCloudOk() || isins.length === 0) return out

  const keys = [...new Set(isins.map((i) => i.trim().toUpperCase()).filter((i) => i.length >= 12))]
  if (keys.length === 0) return out

  try {
    const { data, error } = await createSupabaseAdmin()
      .from(TABLE)
      .select('isin, sektor, branche, aktualisiert_am')
      .in('isin', keys)
    if (error || !data) return out

    const now = Date.now()
    for (const row of data) {
      const r = row as { isin: string; sektor: string | null; branche: string | null; aktualisiert_am: string }
      const age = now - new Date(r.aktualisiert_am).getTime()
      if (!Number.isFinite(age) || age > MAX_AGE_MS) continue
      if (!r.sektor && !r.branche) continue
      out.set(r.isin.toUpperCase(), { sektor: r.sektor, branche: r.branche })
    }
  } catch (e) {
    console.warn('[sektor-cache-cloud] laden fehlgeschlagen', e)
  }
  return out
}

export async function speichereSektorenInCloud(
  eintraege: Array<{ isin: string; data: SektorBatchEintrag; symbolYahoo?: string | null }>,
): Promise<void> {
  if (!istCloudOk() || eintraege.length === 0) return

  const rows = eintraege
    .filter((e) => e.isin && (e.data.sektor || e.data.branche))
    .map((e) => ({
      isin: e.isin.trim().toUpperCase(),
      sektor: e.data.sektor,
      branche: e.data.branche,
      symbol_yahoo: e.symbolYahoo?.trim().toUpperCase() || null,
      quelle: 'yahoo',
      aktualisiert_am: new Date().toISOString(),
    }))

  if (rows.length === 0) return

  try {
    const { error } = await createSupabaseAdmin().from(TABLE).upsert(rows, { onConflict: 'isin' })
    if (error) console.warn('[sektor-cache-cloud] speichern', error.message)
  } catch (e) {
    console.warn('[sektor-cache-cloud] speichern fehlgeschlagen', e)
  }
}
