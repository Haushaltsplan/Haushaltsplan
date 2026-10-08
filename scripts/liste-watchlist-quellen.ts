/**
 * Vergleicht Watchlist-Quellen: nachkauf_radar_watchlist vs omnia_client_state.
 *
 *   npx tsx --conditions=react-server --require ./scripts/mock-server-only.cjs scripts/liste-watchlist-quellen.ts
 */
import { readFileSync } from 'fs'
import { createSupabaseAdmin } from '../lib/supabase-admin'
import { requireOwnerUserId, runWithPrimaeremOwner } from '../lib/request-owner'
import { ladeNachkaufWatchlistAusCloud } from '../lib/portfolio-analyse/nachkauf-radar/nachkauf-watchlist-cloud-server'

try {
  const raw = readFileSync('.env.local', 'utf8').replace(/^\uFEFF/, '')
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (!m) continue
    const k = m[1]!.trim()
    if (!k || process.env[k]) continue
    process.env[k] = m[2]!.trim().replace(/^["']|["']$/g, '')
  }
} catch {
  /* */
}

async function main() {
  await runWithPrimaeremOwner(async () => {
    const owner = requireOwnerUserId()
    const radar = await ladeNachkaufWatchlistAusCloud()
    console.log(`\n## nachkauf_radar_watchlist (${radar.length})`)
    for (const e of radar.sort((a, b) => a.name.localeCompare(b.name, 'de'))) {
      console.log(`- ${e.name} (${e.symbolYahoo ?? '–'}) · ${e.isin}`)
    }

    const admin = createSupabaseAdmin()
    const { data, error } = await admin
      .from('omnia_client_state')
      .select('schluessel, payload, aktualisiert_am')
      .eq('owner_user_id', owner)
      .eq('schluessel', 'watchlist')
      .maybeSingle()

    if (error) {
      console.log('\n## omnia_client_state.watchlist ERROR', error.message)
      return
    }
    if (!data) {
      console.log('\n## omnia_client_state.watchlist: (kein Eintrag)')
      return
    }

    const payload = (data as { payload: unknown; aktualisiert_am: string }).payload
    const liste = Array.isArray(payload)
      ? payload
      : Array.isArray((payload as { eintraege?: unknown })?.eintraege)
        ? (payload as { eintraege: unknown[] }).eintraege
        : null

    console.log(
      `\n## omnia_client_state.watchlist updated=${(data as { aktualisiert_am: string }).aktualisiert_am}`,
    )
    if (!liste) {
      console.log(
        'Payload-Typ:',
        typeof payload,
        Array.isArray(payload) ? 'array' : JSON.stringify(payload)?.slice(0, 300),
      )
      return
    }
    console.log(`Einträge: ${liste.length}`)
    for (const raw of liste) {
      const e = raw as { name?: string; symbolYahoo?: string | null; isin?: string | null }
      console.log(`- ${e.name ?? '?'} (${e.symbolYahoo ?? '–'}) · ${e.isin ?? 'ohne ISIN'}`)
    }
  })
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
