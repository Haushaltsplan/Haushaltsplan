/**
 * Prüft: Fundamentaldaten-Ziele = Depot ∪ Watchlist, ohne DDOG/Whitelist-Only.
 *
 *   npx tsx --conditions=react-server --require ./scripts/mock-server-only.cjs scripts/verify-cache-ziele-kein-ddog.ts
 */
import { readFileSync } from 'fs'
import { ladeDepotAktieAnfragen } from '../lib/portfolio-analyse/depot-gewichte-server'
import { ladeNachkaufWatchlistAusCloud } from '../lib/portfolio-analyse/nachkauf-radar/nachkauf-watchlist-cloud-server'
import { runWithPrimaeremOwner } from '../lib/request-owner'

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

const DDOG = 'US23804L1035'

async function main() {
  const { depot, watchlist } = await runWithPrimaeremOwner(async () => ({
    depot: await ladeDepotAktieAnfragen(),
    watchlist: await ladeNachkaufWatchlistAusCloud(),
  }))
  const isins = new Set<string>()
  for (const d of depot) {
    const i = d.isin?.trim().toUpperCase()
    if (i) isins.add(i)
  }
  for (const w of watchlist) {
    const i = w.isin?.trim().toUpperCase()
    if (i) isins.add(i)
  }

  console.log(`Ziele Depot∪Watchlist: ${isins.size}`)
  console.log(
    'Depot:',
    depot.map((d) => d.symbolYahoo ?? d.isin).join(', ') || '(leer)',
  )
  console.log(
    'Watchlist:',
    watchlist.map((w) => w.symbolYahoo ?? w.isin).join(', ') || '(leer)',
  )

  if (isins.has(DDOG)) {
    console.error('FAIL: Datadog (US23804L1035) ist noch in Depot oder Watchlist!')
    process.exit(1)
  }
  console.log('OK: Datadog nicht in Scraping-Zielen.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
