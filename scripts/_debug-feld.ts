/**
 * Diagnose: warum fehlt ein Feld / eine Serie?
 * Aufruf: npx tsx --conditions=react-server scripts/_debug-feld.ts MSFT
 */

import { cikFuerTicker, padCik, secFetch } from '@/lib/portfolio-analyse/sec-edgar-common-server'

const JAHRESFORMULARE = new Set(['10-K', '10-K/A', '20-F', '20-F/A', '40-F', '40-F/A'])

async function main() {
  for (const ticker of process.argv.slice(2)) {
    const cik = await cikFuerTicker(ticker)
    console.log(`\n===== ${ticker} → CIK ${cik} =====`)
    if (cik == null) continue

    const res = await secFetch(`https://data.sec.gov/api/xbrl/companyfacts/CIK${padCik(cik)}.json`)
    console.log('HTTP', res.status, 'content-length', res.headers.get('content-length'))
    const text = await res.text()
    console.log('Bytes', text.length, '| beginnt mit', JSON.stringify(text.slice(0, 40)))

    let j: any
    try {
      j = JSON.parse(text)
    } catch (e) {
      console.log('JSON-Parse fehlgeschlagen:', (e as Error).message)
      continue
    }
    console.log('Namespaces:', Object.keys(j.facts ?? {}).join(', '))

    // Formulare + fp-Werte auf den Kern-Tags
    for (const tag of [
      'OperatingIncomeLoss',
      'StockholdersEquity',
      'NetIncomeLoss',
      'IncomeTaxExpenseBenefit',
      'IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest',
      'DepreciationDepletionAndAmortization',
      'DepreciationAmortizationAndOther',
    ]) {
      const node = j.facts?.['us-gaap']?.[tag]
      if (!node) {
        console.log(`  ${tag}: nicht vorhanden`)
        continue
      }
      const units = Object.keys(node.units ?? {})
      const liste = node.units?.USD ?? []
      const fy = liste.filter((e: any) => e.fp === 'FY' && JAHRESFORMULARE.has(e.form))
      const enden = [...new Set(fy.map((e: any) => e.end))].sort().slice(-6)
      const formen = [...new Set(liste.map((e: any) => e.form))]
      console.log(
        `  ${tag}: units=${units.join('/')} eintraege=${liste.length} FY+10K=${fy.length} formen=${formen.join(',')} letzte_enden=${enden.join(',')}`,
      )
    }
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
