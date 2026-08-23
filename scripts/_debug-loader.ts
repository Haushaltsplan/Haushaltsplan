/**
 * Diagnose: welcher Schritt im SEC-Loader scheitert?
 * Aufruf: npx tsx --conditions=react-server scripts/_debug-loader.ts MSFT
 */

import { leseAlsJson } from '@/lib/http/safe-json-response'
import { cikFuerTicker, padCik, secFetch } from '@/lib/portfolio-analyse/sec-edgar-common-server'
import { ladeSecKapitalbasis } from '@/lib/portfolio-analyse/kapitalbasis/sec-xbrl-serie-server'

async function main() {
  for (const ticker of process.argv.slice(2)) {
    const cik = await cikFuerTicker(ticker)
    console.log(`\n===== ${ticker} → CIK ${cik} =====`)
    if (cik == null) continue

    const res = await secFetch(`https://data.sec.gov/api/xbrl/companyfacts/CIK${padCik(cik)}.json`)
    console.log('Schritt 1 fetch:', res.status, res.ok)
    const facts = await leseAlsJson<any>(res)
    console.log('Schritt 2 JSON:', facts == null ? 'null' : `ok, facts=${!!facts.facts}`)

    if (facts?.facts) {
      const enden = new Set<string>()
      for (const ns of Object.values<any>(facts.facts)) {
        for (const tag of Object.values<any>(ns)) {
          for (const liste of Object.values<any>(tag.units ?? {})) {
            for (const e of liste as any[]) {
              if (e.fp === 'FY' && e.end && ['10-K', '10-K/A', '20-F', '20-F/A', '40-F', '40-F/A'].includes(e.form)) {
                enden.add(e.end)
              }
            }
          }
        }
      }
      console.log('Schritt 3 FY-Periodenenden:', enden.size, [...enden].sort().slice(-4).join(', '))
    }

    const serie = await ladeSecKapitalbasis(cik)
    console.log('Schritt 4 ladeSecKapitalbasis:', serie == null ? 'NULL' : `${serie.jahre.length} Jahre, ${serie.waehrung}`)
  }
}

main().catch((e) => {
  console.error('EXCEPTION:', e)
  process.exit(1)
})
