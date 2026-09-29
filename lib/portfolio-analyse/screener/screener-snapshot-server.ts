/** Supabase-Snapshot des SEC-Screeners (ein JSON-Blob, service-role). */

import 'server-only'

import { createSupabaseAdmin } from '@/lib/supabase-admin'
import type { ScreenerSnapshot } from '@/lib/portfolio-analyse/screener/screener-types'
import { SCREENER_SCHEMA_VERSION } from '@/lib/portfolio-analyse/screener/screener-types'
import { baueScreenerSnapshot } from '@/lib/portfolio-analyse/screener/screener-sec-frames-server'

const TABLE = 'screener_sec_snapshot' as const
const SNAPSHOT_ID = 'us_listed'
const MEMORY_MS = 30 * 60 * 1000

let memory: { at: number; data: ScreenerSnapshot } | null = null

function cloudOk(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim())
}

export async function ladeScreenerSnapshot(): Promise<ScreenerSnapshot | null> {
  if (memory && Date.now() - memory.at < MEMORY_MS) return memory.data
  if (!cloudOk()) return memory?.data ?? null
  try {
    const { data, error } = await createSupabaseAdmin()
      .from(TABLE)
      .select('periode, zeilen, n, aktualisiert_am')
      .eq('id', SNAPSHOT_ID)
      .maybeSingle()
    if (error || !data) {
      if (error) console.warn('[screener] laden', error.message)
      return null
    }
    const row = data as {
      periode: string
      zeilen: ScreenerSnapshot['zeilen']
      n: number
      aktualisiert_am: string
    }
    if (!Array.isArray(row.zeilen) || row.zeilen.length === 0) return null
    const schemaVersion = row.zeilen.some((z) => Object.prototype.hasOwnProperty.call(z, 'iroicPct'))
      ? SCREENER_SCHEMA_VERSION
      : row.zeilen.some((z) => Object.prototype.hasOwnProperty.call(z, 'roicPct'))
        ? 2
        : 1
    const snap: ScreenerSnapshot = {
      periode: row.periode,
      n: row.n,
      zeilen: row.zeilen,
      aktualisiertAm: row.aktualisiert_am,
      schemaVersion,
    }
    memory = { at: Date.now(), data: snap }
    return snap
  } catch (e) {
    console.warn('[screener] laden fehlgeschlagen', e)
    return null
  }
}

export async function speichereScreenerSnapshot(snap: ScreenerSnapshot): Promise<void> {
  memory = { at: Date.now(), data: snap }
  if (!cloudOk()) return
  const { error } = await createSupabaseAdmin().from(TABLE).upsert({
    id: SNAPSHOT_ID,
    periode: snap.periode,
    zeilen: snap.zeilen,
    n: snap.n,
    aktualisiert_am: snap.aktualisiertAm,
  })
  if (error) throw new Error(error.message)
}

export async function erneuereScreenerSnapshot(): Promise<ScreenerSnapshot> {
  const snap = await baueScreenerSnapshot()
  await speichereScreenerSnapshot(snap)
  return snap
}
