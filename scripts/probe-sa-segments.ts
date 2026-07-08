/** npx tsx scripts/probe-sa-segments.ts */
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

async function probe(path: string) {
  const r = await fetch(`https://stockanalysis.com${path}`, { headers: { 'User-Agent': UA } })
  const html = await r.text()
  const seg = /segment|geograph|revenue by|business segment/i.test(html)
  const tables = (html.match(/<table/gi) ?? []).length
  console.log(path, r.status, html.length, 'seg?', seg, 'tables', tables)
  if (seg) {
    for (const m of html.matchAll(/>([^<]{5,80}(?:segment|geograph|Segment|Geograph)[^<]{0,40})</g)) {
      console.log(' ', m[1]!.trim().slice(0, 70))
    }
  }
}

async function main() {
  for (const p of [
    '/stocks/msft/',
    '/stocks/msft/financials/',
    '/stocks/msft/revenue/',
    '/stocks/msft/metrics/',
    '/quote/us/MSFT/financials/',
  ]) {
    await probe(p)
  }
}

main()
