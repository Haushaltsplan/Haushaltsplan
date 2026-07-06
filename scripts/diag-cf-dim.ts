const UA = process.env.SEC_EDGAR_USER_AGENT || 'Omnia Haushalt test@example.com'
const sym = process.argv[2] ?? 'UNH'

async function secFetch(url: string) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, cache: 'no-store' })
  return res
}

async function cik(s: string) {
  const tickers = await (await secFetch('https://www.sec.gov/files/company_tickers.json')).json()
  for (const row of Object.values(tickers) as { ticker: string; cik_str: number }[]) {
    if (row.ticker === s.toUpperCase()) return row.cik_str
  }
  return null
}

async function main() {
  const c = await cik(sym)
  if (!c) return
  const pad = String(c).padStart(10, '0')

  const res = await secFetch(`https://data.sec.gov/api/xbrl/companyfacts/CIK${pad}.json`)
  console.log('status', res.status)
  const d = await res.json()
  const gaap = d?.facts?.['us-gaap'] ?? {}

  let dimCount = 0
  const samples: unknown[] = []
  for (const [tag, obj] of Object.entries(gaap) as [string, { units?: Record<string, unknown[]> }][]) {
    if (!/revenue|sales|contract/i.test(tag)) continue
    for (const liste of Object.values(obj.units ?? {})) {
      for (const e of liste as Record<string, unknown>[]) {
        const dims = e.dimensions as Record<string, string> | undefined
        const seg = e.segment as unknown
        if ((dims && Object.keys(dims).length > 0) || seg) {
          dimCount++
          if (samples.length < 5) samples.push({ tag, ...e })
        }
      }
    }
  }
  console.log('dimensional revenue facts:', dimCount)
  console.log(JSON.stringify(samples, null, 2))

  const tags = Object.keys(gaap).filter((t) => /Segment|Geograph|Product|Disaggregat/i.test(t))
  console.log('segment-related tags:', tags.slice(0, 30))
}

main().catch(console.error)
