/**
 * npx tsx --conditions=react-server --require ./scripts/mock-server-only.cjs scripts/liste-universum.ts
 */
import { readFileSync } from 'fs'
import { ladeNachkaufKandidaten } from '../lib/portfolio-analyse/nachkauf-radar/nachkauf-watchlist-cloud-server'
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

async function main() {
  const k = await runWithPrimaeremOwner(() => ladeNachkaufKandidaten())
  const depot = k.filter((x) => x.quelle === 'depot').sort((a, b) => a.name.localeCompare(b.name, 'de'))
  const wl = k.filter((x) => x.quelle === 'watchlist').sort((a, b) => a.name.localeCompare(b.name, 'de'))

  console.log(`## Depot (${depot.length})`)
  for (const p of depot) {
    console.log(`- ${p.name} (${p.symbolYahoo ?? '–'}) · ${p.isin}`)
  }
  console.log(`\n## Watchlist (${wl.length})`)
  for (const p of wl) {
    console.log(`- ${p.name} (${p.symbolYahoo ?? '–'}) · ${p.isin}`)
  }
  console.log(`\n**Gesamt: ${k.length}**`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
