/**
 * Client-State in Supabase (pro Owner + Schlüssel ein JSON-Blob).
 */
import 'server-only'

import { createSupabaseAdmin } from '@/lib/supabase-admin'
import type { ClientStateEintrag } from '@/lib/client-state/client-state-keys'

const TABLE = 'omnia_client_state' as const

function istKonfiguriert(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
  )
}

export async function ladeClientStateAusCloud(ownerUserId: string): Promise<ClientStateEintrag[]> {
  if (!istKonfiguriert() || !ownerUserId) return []
  try {
    const { data, error } = await createSupabaseAdmin()
      .from(TABLE)
      .select('schluessel, payload, aktualisiert_am')
      .eq('owner_user_id', ownerUserId)
    if (error) {
      console.warn('[client-state] Laden:', error.message)
      return []
    }
    return (data ?? []).map((r) => {
      const row = r as { schluessel: string; payload: unknown; aktualisiert_am: string }
      return {
        schluessel: row.schluessel,
        payload: row.payload,
        aktualisiertAm: row.aktualisiert_am,
      }
    })
  } catch (e) {
    console.warn('[client-state] Laden fehlgeschlagen:', e)
    return []
  }
}

export async function speichereClientStateInCloud(
  ownerUserId: string,
  eintraege: ClientStateEintrag[],
): Promise<{ ok: boolean; fehler?: string; uebersprungen?: number }> {
  if (!istKonfiguriert()) return { ok: false, fehler: 'Supabase nicht konfiguriert.' }
  if (!ownerUserId) return { ok: false, fehler: 'Nutzer nicht angemeldet.' }

  const admin = createSupabaseAdmin()
  let uebersprungen = 0
  try {
    for (const e of eintraege) {
      const schluessel = e.schluessel.trim()
      if (!schluessel) continue
      const am = e.aktualisiertAm?.trim() || new Date().toISOString()

      const { data: existing, error: leseErr } = await admin
        .from(TABLE)
        .select('aktualisiert_am')
        .eq('owner_user_id', ownerUserId)
        .eq('schluessel', schluessel)
        .maybeSingle()
      if (leseErr) return { ok: false, fehler: leseErr.message }

      const remoteAm = (existing as { aktualisiert_am?: string } | null)?.aktualisiert_am
      if (remoteAm && remoteAm > am) {
        uebersprungen += 1
        continue
      }

      const { error } = await admin.from(TABLE).upsert(
        {
          owner_user_id: ownerUserId,
          schluessel,
          payload: e.payload ?? {},
          aktualisiert_am: am,
        },
        { onConflict: 'owner_user_id,schluessel' },
      )
      if (error) return { ok: false, fehler: error.message }
    }
    return { ok: true, uebersprungen }
  } catch (e) {
    return { ok: false, fehler: e instanceof Error ? e.message : String(e) }
  }
}
