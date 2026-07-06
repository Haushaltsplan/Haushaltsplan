/**
 * Scan Company Facts für Segment-Dimensionen
 * npx tsx scripts/diag-companyfacts-segments.ts UNH MCD ODFL
 */
const UA = process.env.SEC_EDGAR_USER_AGENT || 'test@example.com'
const syms = process.argv.slice(2).length ? process.argv.slice(2) : ['UNH', 'MCD']

async function secFetch(url: string) {
  return fetch(url, { headers: { 'User-Agent': UA }, cache: 'no-store' })
}

async function cik(sym: string) {
  const tickers = await (await secFetch('https://www.sec.gov/files/company_tickers.json')).json()
  for (const row of Object.values(tickers) as { ticker: string; cik_str: number }[]) {
    if (row.ticker === sym.toUpperCase()) return row.cik_str
  }
  return null
}

async function main() {
  for (const sym of syms) {
    const c = await cik(sym)
    if (!c) continue
    const res = await secFetch(`https://data.sec.gov/api/xbrl/companyfacts/CIK${String(c).padStart(10, '0')}.json`)
    const data = await res.json()
    const gaap = data?.facts?.['us-gaap'] ?? {}
    const segmentFacts = new Map<string, Map<number, number>>()

    for (const [tag, obj] of Object.entries(gaap) as [string, { units?: Record<string, unknown[]> }][]) {
      if (!/revenue|sales/i.test(tag)) continue
      for (const liste of Object.values(obj.units ?? {})) {
        for (const e of liste as { fy?: number; fp?: string; form?: string; val?: number; dimensions?: Record<string, string> }[]) {
          if (e.form !== '10-K' || e.fp !== 'FY' || !e.fy || e.val == null) continue
          const dims = e.dimensions ?? {}
          const axis = Object.entries(dims).find(([k]) => /segment|geograph|product|business/i.test(k))
          if (!axis) continue
          const segName = axis[1].replace(/^[^:]+:/, '').replace(/Member$/i, '').replace(/([A-Z])/g, ' $1').trim()
          if (!segName || /consolidat|total|elimination|corporate|intersegment/i.test(segName)) continue
          let m = segmentFacts.get(segName)
          if (!m) { m = new Map(); segmentFacts.set(segName, m) }
          const prev = m.get(e.fy)
          if (prev == null || Math.abs(e.val) > Math.abs(prev)) m.set(e.fy, e.val)
        }
      }
    }

    console.log(`\n=== ${sym} (${segmentFacts.size} Segmente) ===`)
    for (const [name, jahre] of [...segmentFacts.entries()].sort((a, b) => b[1].size - a[1].size).slice(0, 12)) {
      const ys = [...jahre.keys()].sort((a, b) => a - b)
      console.log(`  ${name}: ${ys.length}J (${ys[0]}–${ys[ys.length - 1]})`)
    }
  }
}

main().catch(console.error)
