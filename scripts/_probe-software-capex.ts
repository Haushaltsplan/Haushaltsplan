/**
 * Sucht in den SEC-Company-Facts nach Tags, die kapitalisierte Software / Technologie-
 * Investitionen ausweisen. Hintergrund: für Datenkonzerne wie S&P Global ist das ein
 * relevanter Teil der Reinvestition, den die bisherige Tag-Kette nicht findet.
 *
 * Aufruf: npx tsx --conditions=react-server scripts/_probe-software-capex.ts SPGI MSCI
 */
import { cikFuerTicker, secFetch } from '../lib/portfolio-analyse/sec-edgar-common-server'

const MUSTER = /software|technolog|intangible|internaluse|develop|capitaliz/i

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
  for (const [taxonomie, tags] of Object.entries(json.facts ?? {})) {
    if (taxonomie !== 'us-gaap' && taxonomie !== 'ifrs-full') continue
    for (const [tag, inhalt] of Object.entries(tags)) {
      if (!MUSTER.test(tag)) continue
      const usd = inhalt.units?.USD as
        | Array<{ form?: string; end?: string; start?: string; val?: number }>
        | undefined
      if (!usd) continue
      const jahre = usd
        .filter((e) => e.form === '10-K' && e.start && e.end)
        .filter((e) => {
          const tage =
            (new Date(e.end!).getTime() - new Date(e.start!).getTime()) / (1000 * 60 * 60 * 24)
          return tage > 300 && tage < 400
        })
        .filter((e) => Number(e.end!.slice(0, 4)) >= 2022)
      if (!jahre.length) continue
      const zeigen = new Map<string, number>()
      for (const e of jahre) zeigen.set(e.end!.slice(0, 4), Math.round((e.val ?? 0) / 1e6))
      console.log(
        `  ${tag.padEnd(60)} ${[...zeigen.entries()]
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
