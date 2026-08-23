/**
 * Diagnose: liefert der Macrotrends-Adapter eine Kapitalbasis, und passt sie zu Yahoo?
 * Aufruf: npx tsx --conditions=react-server scripts/_debug-macrotrends-kb.ts
 */

import { ladeMacrotrendsKapitalbasis } from '@/lib/portfolio-analyse/kapitalbasis/macrotrends-kapitalbasis-server'

const ZIELE = [
  { isin: 'FR0000052292', symbol: 'RMS.PA', name: 'Hermès' },
  { isin: 'CH0418792922', symbol: 'SIKA.SW', name: 'Sika' },
  { isin: 'CH1175448666', symbol: 'STMN.SW', name: 'Straumann' },
  { isin: 'CA01626P1484', symbol: 'ATD.TO', name: 'Couche-Tard' },
  { isin: 'GB0004052071', symbol: 'H11.SG', name: 'Halma' },
  { isin: 'NL0000395903', symbol: 'WKL.AS', name: 'Wolters Kluwer' },
]

async function main() {
  for (const ziel of ZIELE) {
    const roh = await ladeMacrotrendsKapitalbasis({
      isin: ziel.isin,
      symbolYahoo: ziel.symbol,
      firmenname: ziel.name,
    })
    if (!roh) {
      console.log(`${ziel.name.padEnd(16)} → null`)
      continue
    }
    const j = roh.jahre
    const letzte = j[j.length - 1]!
    console.log(
      `${ziel.name.padEnd(16)} → ${j.length} Jahre ${j[0]!.jahr}–${letzte.jahr}  ` +
        `ident=${roh.ident.ticker}/${roh.ident.slug}`,
    )
    console.log(
      `    ${letzte.jahr}: Umsatz ${letzte.umsatzMio} EBIT ${letzte.ebitMio} ` +
        `EK ${letzte.eigenkapitalParentMio} LT-Schulden ${letzte.langfristigeSchuldenMio} ` +
        `GW ${letzte.goodwillMio} Intang ${letzte.intangiblesMio} CapEx ${letzte.capexMio}`,
    )
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
