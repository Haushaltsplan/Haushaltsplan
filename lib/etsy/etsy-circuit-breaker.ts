/**
 * Persistenter Circuit-Breaker in Supabase (überlebt Vercel Cold Starts).
 * Schlüssel: 'html' | 'apify' — global, weil DataDome die Server-IP blockt.
 */

import 'server-only'

import { createSupabaseAdmin } from '@/lib/supabase-admin'

const HTML_BLOCK_MS = 30 * 60 * 1000
const APIFY_BLOCK_MS = 20 * 60 * 1000
const APIFY_FEHLER_SCHWELLE = 2

/** In-Memory-Cache für die Dauer eines Lambda-Invokes (weniger DB-Hits). */
const mem = new Map<string, { bis: number; serie: number }>()

export type EtsyCircuitSchluessel = 'html' | 'apify'

async function lade(schluessel: EtsyCircuitSchluessel): Promise<{ bis: number; serie: number }> {
  const cached = mem.get(schluessel)
  if (cached && cached.bis > Date.now()) return cached
  try {
    const { data } = await createSupabaseAdmin()
      .from('etsy_circuit_breaker')
      .select('geblockt_bis, fehler_serie')
      .eq('schluessel', schluessel)
      .maybeSingle()
    if (!data) return { bis: 0, serie: 0 }
    const bis = data.geblockt_bis ? Date.parse(String(data.geblockt_bis)) : 0
    const serie = Number(data.fehler_serie) || 0
    mem.set(schluessel, { bis, serie })
    return { bis, serie }
  } catch {
    return cached ?? { bis: 0, serie: 0 }
  }
}

async function speichere(
  schluessel: EtsyCircuitSchluessel,
  bis: number,
  serie: number,
  meldung: string,
): Promise<void> {
  mem.set(schluessel, { bis, serie })
  try {
    await createSupabaseAdmin().from('etsy_circuit_breaker').upsert({
      schluessel,
      geblockt_bis: new Date(bis).toISOString(),
      fehler_serie: serie,
      letzte_meldung: meldung.slice(0, 300),
      updated_at: new Date().toISOString(),
    })
  } catch (e) {
    console.warn('[etsy-circuit]', e instanceof Error ? e.message : e)
  }
}

export async function etsyCircuitOffen(schluessel: EtsyCircuitSchluessel): Promise<boolean> {
  const { bis } = await lade(schluessel)
  return Date.now() < bis
}

export async function etsyCircuitRestMs(schluessel: EtsyCircuitSchluessel): Promise<number> {
  const { bis } = await lade(schluessel)
  return Math.max(0, bis - Date.now())
}

export async function markiereEtsyHtmlGeblockt(status: number, meldung = ''): Promise<void> {
  if (status !== 403 && status !== 429) return
  await speichere('html', Date.now() + HTML_BLOCK_MS, 0, meldung || `HTTP ${status}`)
}

export async function markiereEtsyApifyFehler(meldung = ''): Promise<void> {
  const { serie } = await lade('apify')
  const next = serie + 1
  if (next >= APIFY_FEHLER_SCHWELLE) {
    await speichere('apify', Date.now() + APIFY_BLOCK_MS, 0, meldung || 'Apify Fehler-Serie')
  } else {
    await speichere('apify', 0, next, meldung || 'Apify Fehler')
  }
}

export async function markiereEtsyApifyOk(): Promise<void> {
  await speichere('apify', 0, 0, 'ok')
}
