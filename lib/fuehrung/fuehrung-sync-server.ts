/**
 * Führung-State in Supabase (pro Owner ein JSON-Blob).
 */
import 'server-only'

import { createSupabaseAdmin } from '@/lib/supabase-admin'
import type { FuehrungState } from '@/lib/fuehrung/store'

const TABLE = 'fuehrung_state' as const

function istKonfiguriert(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
  )
}

export type FuehrungCloudStand = {
  payload: FuehrungState
  aktualisiertAm: string
}

export async function ladeFuehrungStateAusCloud(
  ownerUserId: string,
): Promise<FuehrungCloudStand | null> {
  if (!istKonfiguriert() || !ownerUserId) return null
  try {
    const { data, error } = await createSupabaseAdmin()
      .from(TABLE)
      .select('payload, aktualisiert_am')
      .eq('owner_user_id', ownerUserId)
      .maybeSingle()
    if (error) {
      console.warn('[fuehrung-sync] Laden:', error.message)
      return null
    }
    if (!data) return null
    const row = data as { payload: unknown; aktualisiert_am: string }
    if (!row.payload || typeof row.payload !== 'object') return null
    return {
      payload: row.payload as FuehrungState,
      aktualisiertAm: row.aktualisiert_am,
    }
  } catch (e) {
    console.warn('[fuehrung-sync] Laden fehlgeschlagen:', e)
    return null
  }
}

export async function speichereFuehrungStateInCloud(
  ownerUserId: string,
  payload: FuehrungState,
  aktualisiertAm?: string,
): Promise<{ ok: boolean; fehler?: string }> {
  if (!istKonfiguriert()) return { ok: false, fehler: 'Supabase nicht konfiguriert.' }
  if (!ownerUserId) return { ok: false, fehler: 'Nutzer nicht angemeldet.' }

  const am = aktualisiertAm?.trim() || payload.aktualisiertAm || new Date().toISOString()
  try {
    const { error } = await createSupabaseAdmin().from(TABLE).upsert(
      {
        owner_user_id: ownerUserId,
        payload: { ...payload, aktualisiertAm: am },
        aktualisiert_am: am,
      },
      { onConflict: 'owner_user_id' },
    )
    if (error) return { ok: false, fehler: error.message }
    return { ok: true }
  } catch (e) {
    return { ok: false, fehler: e instanceof Error ? e.message : String(e) }
  }
}
