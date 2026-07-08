/** npx tsx scripts/probe-sa-geo.ts */
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'

async function tryPath(p: string) {
  const r = await fetch(`https://stockanalysis.com${p}`, { headers: { 'User-Agent': UA } })
  const html = await r.text()
  const rows = (html.match(/<tr/gi) ?? []).length
  console.log(p, r.status, rows, html.includes('United States') || html.includes('Americas') || html.includes('EMEA'))
}

async function main() {
  for (const p of [
    '/stocks/msft/metrics/revenue-by-geography/',
    '/stocks/msft/metrics/geographic-revenue/',
    '/stocks/msft/metrics/revenue-by-region/',
    '/stocks/asml/metrics/revenue-by-segment/',
  ]) {
    await tryPath(p)
  }
}

main()
