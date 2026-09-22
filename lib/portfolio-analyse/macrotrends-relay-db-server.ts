/** Singleton: aktueller Macrotrends-Heim-Relay (URL + Secret) in Supabase. */

import 'server-only'

import { createHash } from 'crypto'
import { createSupabaseAdmin } from '@/lib/supabase-admin'

const TABLE = 'macrotrends_scrape_relay' as const

function cloudOk(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
  )
}

export function hashRelaySecret(secret: string): string {
  return createHash('sha256').update(secret).digest('hex')
}

export async function speichereMacrotrendsRelay(opts: {
  baseUrl: string
  secret: string
}): Promise<boolean> {
  if (!cloudOk()) return false
  const baseUrl = opts.baseUrl.trim().replace(/\/$/, '')
  const secret = opts.secret.trim()
  if (!baseUrl || !secret) return false
  try {
    const db = createSupabaseAdmin()
    const { error } = await db.from(TABLE).upsert({
      id: 1,
      base_url: baseUrl,
      secret_hash: hashRelaySecret(secret),
      secret_plain: secret,
      updated_at: new Date().toISOString(),
    })
    if (error) {
      console.warn('[macrotrends-relay-db] upsert:', error.message)
      return false
    }
    return true
  } catch (e) {
    console.warn('[macrotrends-relay-db]', e instanceof Error ? e.message : e)
    return false
  }
}

export async function ladeMacrotrendsRelay(): Promise<{
  baseUrl: string
  secret: string
  updatedAt: string
} | null> {
  if (!cloudOk()) return null
  try {
    const db = createSupabaseAdmin()
    const { data, error } = await db
      .from(TABLE)
      .select('base_url, secret_plain, updated_at')
      .eq('id', 1)
      .maybeSingle()
    if (error || !data?.base_url || !data?.secret_plain) return null
    // Älter als 6h → vermutlich tot
    const age = Date.now() - new Date(String(data.updated_at)).getTime()
    if (age > 6 * 60 * 60 * 1000) {
      console.warn('[macrotrends-relay-db] Relay-Eintrag zu alt')
      return null
    }
    return {
      baseUrl: String(data.base_url).replace(/\/$/, ''),
      secret: String(data.secret_plain),
      updatedAt: String(data.updated_at),
    }
  } catch {
    return null
  }
}
