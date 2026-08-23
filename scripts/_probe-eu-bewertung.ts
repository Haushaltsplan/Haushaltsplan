/**
 * Prüft, ob historische Bewertungszeilen bei EU-Titeln gefüllt werden.
 * Aufruf: npx tsx --conditions=react-server scripts/_probe-eu-bewertung.ts
 */
import { ladeFundamentaldaten } from '../lib/portfolio-analyse/fundamentaldaten-server'
import { FUNDAMENTAL_TTM_KEY } from '../lib/portfolio-analyse/fundamentaldaten-types'

const TITEL = [
  { isin: 'NL0000395903', name: 'Wolters Kluwer', symbolYahoo: 'WKL.AS' },
  { isin: 'FR0000052292', name: 'Hermès', symbolYahoo: 'RMS.PA' },
  { isin: 'CH0418792922', name: 'Sika', symbolYahoo: 'SIKA.SW' },
]

const ZEILEN = ['kgv', 'ps', 'pb', 'pfcf', 'ev_rev', 'ev_ebitda', 'marktkapitalisierung'] as const

async function main() {
  for (const t of TITEL) {
    const paket = await ladeFundamentaldaten(t)
    const keys = paket.perioden
      .filter((p) => !p.istSchaetzung && !p.istNtm)
      .map((p) => p.iso)
      .filter((iso) => /^\d{4}-\d{2}-\d{2}$/.test(iso) || iso === FUNDAMENTAL_TTM_KEY)
      .slice(-8)
    console.log(`\n===== ${t.name} ok=${paket.ok} quelle=${paket.quelle} =====`)
    if (paket.fehler) console.log('Fehler:', paket.fehler)
    for (const id of ZEILEN) {
      const z = paket.zeilen.find((r) => r.id === id)
      const teile = keys.map((k) => {
        const v = z?.werte[k]
        const label = k === FUNDAMENTAL_TTM_KEY ? 'TTM' : k.slice(0, 4)
        return `${label}:${v != null ? (id === 'marktkapitalisierung' ? Math.round(v) : v.toFixed(1)) : '–'}`
      })
      console.log(`  ${id.padEnd(20)} ${teile.join('  ')}`)
    }
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
