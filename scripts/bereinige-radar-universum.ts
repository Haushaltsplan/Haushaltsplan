/**
 * Löscht Radar-Scan/Deep-Research außerhalb Depot ∪ Watchlist (inkl. DDOG/MUM/Whitelist-Reste).
 *
 *   npx tsx --conditions=react-server --require ./scripts/mock-server-only.cjs scripts/bereinige-radar-universum.ts
 */
import { readFileSync } from 'fs'
import {
  bereinigeNachkaufRadarAusserhalbKandidaten,
  ladeNachkaufKandidaten,
} from '../lib/portfolio-analyse/nachkauf-radar/nachkauf-watchlist-cloud-server'
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
  await runWithPrimaeremOwner(async () => {
    const kandidaten = await ladeNachkaufKandidaten()
    console.log(
      'Universum Depot∪Watchlist:',
      kandidaten.length,
      kandidaten.map((k) => `${k.name}(${k.quelle})`).join(', ') || '(leer)',
    )
    // Bekannt verkauft — dürfen nicht mehr im Universum auftauchen
    const verboten = [
      { isin: 'US23804L1035', name: 'Datadog' },
      { isin: 'DE0006580806', name: 'Mensch und Maschine' },
      { isin: 'DE0005785802', name: 'Mensch und Maschine (alt)' },
    ]
    for (const v of verboten) {
      if (kandidaten.some((k) => k.isin.toUpperCase() === v.isin)) {
        console.error('FAIL: verkaufter Titel noch im Universum:', v.name, v.isin)
        process.exit(1)
      }
    }
    const n = await bereinigeNachkaufRadarAusserhalbKandidaten(kandidaten)
    console.log(`Bereinigt: ${n} Scan-ISINs außerhalb Universum entfernt.`)
  })
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
