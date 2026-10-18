import 'server-only'

import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { requireOwnerUserId } from '@/lib/request-owner'
import type {
  Angebot,
  AngeboteEinstellung,
  HaendlerId,
  MarktInfo,
  QuellenStatus,
} from '@/lib/angebote/types'

function db() {
  return createSupabaseAdmin()
}

export async function ladeEinstellung(ownerUserId?: string): Promise<AngeboteEinstellung | null> {
  const oid = requireOwnerUserId(ownerUserId)
  const { data, error } = await db()
    .from('angebote_einstellung')
    .select('owner_user_id, plz, markt_ids, loyalty, aktualisiert_am')
    .eq('owner_user_id', oid)
    .maybeSingle()
  if (error) {
    console.warn('[angebote:db] ladeEinstellung:', error.message)
    return null
  }
  if (!data) return null
  return {
    ownerUserId: data.owner_user_id as string,
    plz: data.plz as string,
    marktIds: (data.markt_ids ?? {}) as Partial<Record<HaendlerId, string>>,
    loyalty: Array.isArray(data.loyalty) ? (data.loyalty as string[]) : [],
    aktualisiertAm: data.aktualisiert_am as string,
  }
}

export async function speichereEinstellung(input: {
  ownerUserId?: string
  plz: string
  marktIds?: Partial<Record<HaendlerId, string>>
  loyalty?: string[]
}): Promise<AngeboteEinstellung> {
  const oid = requireOwnerUserId(input.ownerUserId)
  const row = {
    owner_user_id: oid,
    plz: input.plz,
    markt_ids: input.marktIds ?? {},
    loyalty: input.loyalty ?? [],
    aktualisiert_am: new Date().toISOString(),
  }
  const { data, error } = await db()
    .from('angebote_einstellung')
    .upsert(row, { onConflict: 'owner_user_id' })
    .select('owner_user_id, plz, markt_ids, loyalty, aktualisiert_am')
    .single()
  if (error) throw new Error(`Einstellung speichern: ${error.message}`)
  return {
    ownerUserId: data.owner_user_id as string,
    plz: data.plz as string,
    marktIds: (data.markt_ids ?? {}) as Partial<Record<HaendlerId, string>>,
    loyalty: Array.isArray(data.loyalty) ? (data.loyalty as string[]) : [],
    aktualisiertAm: data.aktualisiert_am as string,
  }
}

export type SnapshotRow = {
  plz: string
  woche: string
  angebote: Angebot[]
  quellen: QuellenStatus[]
  maerkte: MarktInfo[]
  erstelltAm: string
}

export async function ladeSnapshot(
  plz: string,
  woche: string,
  ownerUserId?: string,
): Promise<SnapshotRow | null> {
  const oid = requireOwnerUserId(ownerUserId)
  const { data, error } = await db()
    .from('angebote_snapshot')
    .select('plz, woche, payload, quellen_status, maerkte, erstellt_am')
    .eq('owner_user_id', oid)
    .eq('plz', plz)
    .eq('woche', woche)
    .maybeSingle()
  if (error) {
    console.warn('[angebote:db] ladeSnapshot:', error.message)
    return null
  }
  if (!data) return null
  return {
    plz: data.plz as string,
    woche: data.woche as string,
    angebote: (data.payload ?? []) as Angebot[],
    quellen: (data.quellen_status ?? []) as QuellenStatus[],
    maerkte: (data.maerkte ?? []) as MarktInfo[],
    erstelltAm: data.erstellt_am as string,
  }
}

export async function speichereSnapshot(input: {
  ownerUserId?: string
  plz: string
  woche: string
  angebote: Angebot[]
  quellen: QuellenStatus[]
  maerkte: MarktInfo[]
}): Promise<SnapshotRow> {
  const oid = requireOwnerUserId(input.ownerUserId)
  const erstelltAm = new Date().toISOString()
  const row = {
    owner_user_id: oid,
    plz: input.plz,
    woche: input.woche,
    payload: input.angebote,
    quellen_status: input.quellen,
    maerkte: input.maerkte,
    erstellt_am: erstelltAm,
  }
  const { error } = await db()
    .from('angebote_snapshot')
    .upsert(row, { onConflict: 'owner_user_id,plz,woche' })
  if (error) throw new Error(`Snapshot speichern: ${error.message}`)
  return {
    plz: input.plz,
    woche: input.woche,
    angebote: input.angebote,
    quellen: input.quellen,
    maerkte: input.maerkte,
    erstelltAm,
  }
}

/** Rate-Limit: letzter Scan jünger als 15 Min (außer force). */
export function snapshotZuFrisch(erstelltAm: string, minuten = 15): boolean {
  const t = Date.parse(erstelltAm)
  if (!Number.isFinite(t)) return false
  return Date.now() - t < minuten * 60_000
}
