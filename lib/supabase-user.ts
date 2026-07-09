import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/** Extrahiert das Supabase-Access-Token aus dem `Authorization: Bearer …`-Header. */
export function bearerAusRequest(req: Request): string | null {
  const auth = req.headers.get('authorization') || req.headers.get('Authorization') || ''
  const m = auth.match(/^Bearer\s+(.+)$/i)
  return m ? m[1].trim() : null
}

/** Von proxy.ts gesetzt nach erfolgreicher Auth-Prüfung. */
export function ownerUserIdAusRequest(req: Request): string | null {
  const id = req.headers.get('x-user-id')?.trim()
  return id || null
}

/**
 * Supabase-Client, der im Namen des angemeldeten Nutzers arbeitet (sein Access-Token).
 * Dadurch greift Row Level Security normal (owner_user_id = auth.uid()) — KEIN Service-Role,
 * also kein RLS-Bypass. Gibt `null` zurück, wenn kein Token/Konfiguration vorhanden ist.
 *
 * Die eigentliche Authentifizierung/Allowlist passiert zentral in der Middleware; hier wird
 * nur das bereits geprüfte Token an Supabase weitergereicht.
 */
export function createSupabaseFuerRequest(req: Request): SupabaseClient | null {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim()
  const anon = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim()
  const token = bearerAusRequest(req)
  if (!url || !anon || !token) return null
  return createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
}
