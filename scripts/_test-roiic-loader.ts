/**
 * Ende-zu-Ende: liefert `ladeIncrementalRoic` jetzt die Kapitalbasis-Werte?
 * Aufruf: npx tsx --conditions=react-server scripts/_test-roiic-loader.ts
 */

import { ladeIncrementalRoic } from '@/lib/portfolio-analyse/incremental-roic-server'

const ZIELE = [
  { symbolYahoo: 'SPGI', isin: 'US78409V1044', name: 'S&P Global' },
  { symbolYahoo: 'TMO', isin: 'US8835561023', name: 'Thermo Fisher' },
  { symbolYahoo: 'RMS.PA', isin: 'FR0000052292', name: 'Hermès' },
  { symbolYahoo: 'H11.SG', isin: 'GB0004052071', name: 'Halma' },
]

async function main() {
  for (const ziel of ZIELE) {
    const p = await ladeIncrementalRoic({
      symbolYahoo: ziel.symbolYahoo,
      isin: ziel.isin,
      firmenname: ziel.name,
    })
    console.log(
      `${ziel.name.padEnd(15)} ${String(p.incrementalRoicPct ?? '–').padStart(7)} %  ` +
        `quelle=${p.quelle} regime=${p.regime ?? '–'} fenster=${p.fensterJahre ?? '–'}J ` +
        `buch=${p.buchPct ?? '–'} roh=${p.rohPct ?? '–'} maImFenster=${p.maImFenster ?? false}`,
    )
    if (p.begruendung) console.log(`                ${p.begruendung}`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
