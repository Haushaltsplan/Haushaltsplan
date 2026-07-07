/** npx tsx scripts/diag-unh-cf-geo.ts */
const UA = process.env.SEC_EDGAR_USER_AGENT || 'test@example.com'

async function main() {
  const data = await (await fetch('https://data.sec.gov/api/xbrl/companyfacts/CIK0000731766.json', { headers: { 'User-Agent': UA } })).json()
  const gaap = data?.facts?.['us-gaap'] ?? {}
  for (const [tag, obj] of Object.entries(gaap) as [string, { units?: Record<string, unknown[]> }][]) {
    if (!/revenue|premium|sales/i.test(tag)) continue
    for (const liste of Object.values(obj.units ?? {})) {
      for (const e of liste as { fy?: number; fp?: string; form?: string; val?: number; dimensions?: Record<string, string> }[]) {
        if (e.form !== '10-K' || e.fp !== 'FY' || !e.fy) continue
        const dims = JSON.stringify(e.dimensions ?? {})
        if (!/GeographicDistribution|Geographical|Country/i.test(dims)) continue
        console.log(tag, e.fy, e.val, dims.slice(0, 200))
      }
    }
  }
}

main().catch(console.error)
