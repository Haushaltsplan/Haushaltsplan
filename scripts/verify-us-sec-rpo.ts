/**
 * npx tsx --conditions=react-server --require ./scripts/mock-server-only.cjs scripts/verify-us-sec-rpo.ts
 */
import { ladeGescrapteSegmentStruktur } from '../lib/portfolio-analyse/segment-struktur-scraper-server'

async function main() {
  for (const t of ['MSFT', 'NOW', 'CRM'] as const) {
    const paket = await ladeGescrapteSegmentStruktur({
      ticker: t,
      symbolYahoo: t,
      name: t,
      refresh: true,
    })
    const b = paket?.backlog
    console.log(
      t,
      'quellePaket=',
      paket?.quelle,
      'backlog=',
      b
        ? `${b.art} · ${b.label} · ${b.anzahlJahre}J · ${b.quelleTag} · last=${b.eintraege.at(-1)?.wertMio}`
        : 'null',
    )
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
