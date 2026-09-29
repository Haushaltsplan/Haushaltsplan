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

export type ScreenerCloudStatus = {
  cloudGespeichert: boolean
  cloudWarnung: string | null
}

function cloudOk(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim())
}

/** HTML/520 von Cloudflare — kein App-Bug, Supabase-Host antwortet nicht. */
function cloudWarnungAusFehler(e: unknown, fallback: string): string {
  const raw =
    e != null && typeof e === 'object' && 'message' in e && typeof (e as { message: unknown }).message === 'string'
      ? (e as { message: string }).message
      : e instanceof Error
        ? e.message
        : String(e)
  if (raw.includes('<!DOCTYPE html>') || raw.includes('520') || raw.includes('Web server is returning an unknown error')) {
    return 'Supabase vorübergehend nicht erreichbar (Cloudflare 520). Das Universum läuft nur im Server-Speicher — in ein paar Minuten erneut „Universum neu aufbauen“ für Cloud-Sync.'
  }
  if (raw.length > 180) return `${fallback} (Antwort war kein JSON — oft kurzer Supabase-Ausfall).`
  return raw || fallback
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
      return memory?.data ?? null
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
    return memory?.data ?? null
  }
}

export async function speichereScreenerSnapshot(snap: ScreenerSnapshot): Promise<ScreenerCloudStatus> {
  memory = { at: Date.now(), data: snap }
  if (!cloudOk()) {
    return { cloudGespeichert: false, cloudWarnung: 'Supabase nicht konfiguriert — nur Server-Speicher.' }
  }
  try {
    const { error } = await createSupabaseAdmin().from(TABLE).upsert({
      id: SNAPSHOT_ID,
      periode: snap.periode,
      zeilen: snap.zeilen,
      n: snap.n,
      aktualisiert_am: snap.aktualisiertAm,
    })
    if (error) {
      const cloudWarnung = cloudWarnungAusFehler(error, 'Cloud-Snapshot konnte nicht gespeichert werden.')
      console.warn('[screener] speichern', cloudWarnung)
      return { cloudGespeichert: false, cloudWarnung }
    }
    return { cloudGespeichert: true, cloudWarnung: null }
  } catch (e) {
    const cloudWarnung = cloudWarnungAusFehler(e, 'Cloud-Snapshot konnte nicht gespeichert werden.')
    console.warn('[screener] speichern fehlgeschlagen', cloudWarnung)
    return { cloudGespeichert: false, cloudWarnung }
  }
}

export async function erneuereScreenerSnapshot(): Promise<ScreenerSnapshot & ScreenerCloudStatus> {
  const snap = await baueScreenerSnapshot()
  const cloud = await speichereScreenerSnapshot(snap)
  return { ...snap, ...cloud }
}
