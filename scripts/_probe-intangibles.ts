/**
 * Sucht Bilanz-Tags (Zeitpunktwerte) für immaterielle Vermögenswerte. Hintergrund: bei
 * Rollins fehlen sie ab 2019, wodurch die tangible Kapitalbasis und damit der organische
 * ROIIC unbrauchbar wurde.
 *
 * Aufruf: npx tsx --conditions=react-server scripts/_probe-intangibles.ts ROL CTAS
 */
import { cikFuerTicker, secFetch } from '../lib/portfolio-analyse/sec-edgar-common-server'

const MUSTER = /intangible/i

async function probe(ticker: string) {
  const cik = await cikFuerTicker(ticker)
  if (!cik) {
    console.log(`${ticker}: keine CIK`)
    return
  }
  const res = await secFetch(
    `https://data.sec.gov/api/xbrl/companyfacts/CIK${String(cik).padStart(10, '0')}.json`,
  )
  const json = (await res.json()) as {
    facts?: Record<string, Record<string, { units?: Record<string, unknown[]> }>>
  }
  console.log(`\n===== ${ticker} (CIK ${cik}) =====`)
  for (const tags of Object.values(json.facts ?? {})) {
    for (const [tag, inhalt] of Object.entries(tags)) {
      if (!MUSTER.test(tag)) continue
      const usd = inhalt.units?.USD as
        | Array<{ form?: string; end?: string; start?: string; val?: number }>
        | undefined
      if (!usd) continue
      // Nur Zeitpunktwerte aus Jahresabschlüssen, ein Wert je Jahresende.
      const perJahr = new Map<string, number>()
      for (const e of usd) {
        if (e.start || e.form !== '10-K' || !e.end || e.val == null) continue
        if (!e.end.endsWith('-12-31') && !e.end.match(/-0[3-9]-|-1[0-2]-/)) continue
        const jahr = e.end.slice(0, 4)
        if (Number(jahr) < 2017) continue
        perJahr.set(jahr, Math.round((e.val / 1e6) * 10) / 10)
      }
      if (!perJahr.size) continue
      console.log(
        `  ${tag.padEnd(58)} ${[...perJahr.entries()]
          .sort()
          .map(([j, v]) => `${j}:${v}`)
          .join('  ')}`,
      )
    }
  }
}

async function main() {
  for (const t of process.argv.slice(2)) await probe(t)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
