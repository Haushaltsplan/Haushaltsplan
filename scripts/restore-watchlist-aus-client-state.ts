/**
 * Stellt Radar-Watchlist aus omnia_client_state wieder her (ISIN-Anreicherung).
 *
 *   npx tsx --conditions=react-server --require ./scripts/mock-server-only.cjs scripts/restore-watchlist-aus-client-state.ts
 */
import { readFileSync } from 'fs'
import {
  ladeEffektiveNachkaufWatchlist,
  syncNachkaufWatchlistZurCloud,
} from '../lib/portfolio-analyse/nachkauf-radar/nachkauf-watchlist-cloud-server'
import { ladeClientStateAusCloud } from '../lib/client-state/client-state-server'
import { requireOwnerUserId, runWithPrimaeremOwner } from '../lib/request-owner'

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
    const rows = await ladeClientStateAusCloud(requireOwnerUserId())
    const hit = rows.find((r) => r.schluessel === 'watchlist')
    const payload = hit?.payload
    const liste = Array.isArray(payload)
      ? payload
      : Array.isArray((payload as { eintraege?: unknown })?.eintraege)
        ? (payload as { eintraege: unknown[] }).eintraege
        : []
    console.log(`Client-State Watchlist roh: ${liste.length}`)

    const roh = liste.map((raw) => {
      const r = (raw ?? {}) as Record<string, unknown>
      return {
        isin: r.isin != null ? String(r.isin) : null,
        name: String(r.name ?? '').trim(),
        symbolYahoo: r.symbolYahoo != null ? String(r.symbolYahoo) : null,
        symbolCandidates: Array.isArray(r.symbolCandidates)
          ? r.symbolCandidates.filter((s): s is string => typeof s === 'string')
          : [],
        hinzugefuegtAm: typeof r.hinzugefuegtAm === 'string' ? r.hinzugefuegtAm : undefined,
      }
    })

    const result = await syncNachkaufWatchlistZurCloud(roh)
    if (!result.ok) {
      console.error('Sync fehlgeschlagen:', result.fehler)
      process.exit(1)
    }

    const effektiv = await ladeEffektiveNachkaufWatchlist()
    console.log(`\nEffektive Watchlist nach Restore: ${effektiv.length}`)
    for (const e of effektiv.sort((a, b) => a.name.localeCompare(b.name, 'de'))) {
      console.log(`- ${e.name} (${e.symbolYahoo ?? '–'}) · ${e.isin}`)
    }
  })
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
