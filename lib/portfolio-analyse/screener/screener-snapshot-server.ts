/** Supabase-Snapshot des SEC-Screeners (ein JSON-Blob, service-role). */

import 'server-only'

import { createSupabaseAdmin } from '@/lib/supabase-admin'
import type { ScreenerSnapshot, ScreenerZeile } from '@/lib/portfolio-analyse/screener/screener-types'
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
  if (/statement timeout|canceling statement/i.test(raw)) {
    return 'Cloud-Speichern abgebrochen (Postgres-Timeout) — Universum ist im Server-Speicher. Bitte erneut versuchen; der Snapshot ist jetzt ohne Jahres-Historie-Blob deutlich kleiner.'
  }
  if (raw.length > 180) return `${fallback} (Antwort war kein JSON — oft kurzer Supabase-Ausfall).`
  return raw || fallback
}

function zeilenOhneHist(zeilen: ScreenerSnapshot['zeilen']): ScreenerSnapshot['zeilen'] {
  return zeilen.map(({ hist: _hist, ...z }) => z)
}

/** Fallback nur für Alt-Snapshots ohne schema_version-Spalte — nie auf „aktuell“ raten. */
function schemaAusZeilenHeuristik(zeilen: ScreenerZeile[]): number {
  const probe = zeilen.find((z) => z.ticker) ?? zeilen[0]
  if (!probe) return 1
  if (Object.prototype.hasOwnProperty.call(probe, 'kgv5y')) return 5
  if (Object.prototype.hasOwnProperty.call(probe, 'iroicPct')) return 4
  if (Object.prototype.hasOwnProperty.call(probe, 'roicPct')) return 2
  return 1
}

export async function ladeScreenerSnapshot(opts?: { frisch?: boolean }): Promise<ScreenerSnapshot | null> {
  if (!opts?.frisch && memory && Date.now() - memory.at < MEMORY_MS) return memory.data
  if (!cloudOk()) return memory?.data ?? null
  try {
    const { data, error } = await createSupabaseAdmin()
      .from(TABLE)
      .select('periode, zeilen, n, aktualisiert_am, schema_version')
      .eq('id', SNAPSHOT_ID)
      .maybeSingle()
    if (error || !data) {
      // Alt-Schema ohne schema_version-Spalte
      if (error?.message?.includes('schema_version')) {
        const alt = await createSupabaseAdmin()
          .from(TABLE)
          .select('periode, zeilen, n, aktualisiert_am')
          .eq('id', SNAPSHOT_ID)
          .maybeSingle()
        if (alt.error || !alt.data) {
          if (alt.error) console.warn('[screener] laden', alt.error.message)
          return memory?.data ?? null
        }
        const row = alt.data as {
          periode: string
          zeilen: ScreenerSnapshot['zeilen']
          n: number
          aktualisiert_am: string
        }
        if (!Array.isArray(row.zeilen) || row.zeilen.length === 0) return null
        const snap: ScreenerSnapshot = {
          periode: row.periode,
          n: row.n,
          zeilen: row.zeilen,
          aktualisiertAm: row.aktualisiert_am,
          schemaVersion: schemaAusZeilenHeuristik(row.zeilen),
        }
        memory = { at: Date.now(), data: snap }
        return snap
      }
      if (error) console.warn('[screener] laden', error.message)
      return memory?.data ?? null
    }
    const row = data as {
      periode: string
      zeilen: ScreenerSnapshot['zeilen']
      n: number
      aktualisiert_am: string
      schema_version?: number | null
    }
    if (!Array.isArray(row.zeilen) || row.zeilen.length === 0) return null
    const schemaVersion =
      row.schema_version != null && Number.isFinite(row.schema_version)
        ? Number(row.schema_version)
        : schemaAusZeilenHeuristik(row.zeilen)
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
  const schemaVersion = snap.schemaVersion ?? SCREENER_SCHEMA_VERSION
  const schlank: ScreenerSnapshot = {
    ...snap,
    schemaVersion,
    zeilen: zeilenOhneHist(snap.zeilen),
  }
  memory = { at: Date.now(), data: schlank }
  if (!cloudOk()) {
    return { cloudGespeichert: false, cloudWarnung: 'Supabase nicht konfiguriert — nur Server-Speicher.' }
  }
  try {
    const payload = {
      id: SNAPSHOT_ID,
      periode: schlank.periode,
      zeilen: schlank.zeilen,
      n: schlank.n,
      aktualisiert_am: schlank.aktualisiertAm,
      schema_version: schemaVersion,
    }
    let { error } = await createSupabaseAdmin().from(TABLE).upsert(payload)
    // Migration noch nicht angewendet → ohne schema_version speichern
    if (error?.message?.includes('schema_version')) {
      const { schema_version: _sv, ...ohne } = payload
      ;({ error } = await createSupabaseAdmin().from(TABLE).upsert(ohne))
    }
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

export async function erneuereScreenerSnapshot(opts?: {
  onProgress?: (p: import('@/lib/portfolio-analyse/screener/screener-sec-frames-server').ScreenerBuildProgress) => void
  budgetMs?: number
}): Promise<ScreenerSnapshot & ScreenerCloudStatus> {
  const snap = await baueScreenerSnapshot(opts)
  opts?.onProgress?.({ phase: 'speichern', message: 'Speichere Snapshot…' })
  const cloud = await speichereScreenerSnapshot(snap)
  return { ...snap, ...cloud }
}
