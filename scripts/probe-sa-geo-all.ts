/** npx tsx scripts/probe-sa-geo-all.ts */
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

const TICKERS = [
  ['hd', 'HD'],
  ['halma', 'HLMA.L'],
  ['asml', 'ASML'],
  ['hrms', 'HRMS.PA'],
  ['ma', 'MA'],
  ['googl', 'GOOGL'],
]

async function probe(sym: string, ticker: string) {
  for (const kind of ['revenue-by-segment', 'revenue-by-geography', 'geographic-revenue']) {
    for (const base of [`/stocks/${sym}/metrics/${kind}/`, `/quote/eur/${sym}/metrics/${kind}/`, `/quote/us/${ticker.split('.')[0]}/metrics/${kind}/`]) {
      const res = await fetch(`https://stockanalysis.com${base}`, { headers: { 'User-Agent': UA } })
      if (res.ok) {
        const html = await res.text()
        const tables = (html.match(/<table/gi) ?? []).length
        const hasDate = /Date|Period Ending/i.test(html)
        console.log(sym, base, res.status, html.length, 'tables', tables, 'hasDate', hasDate)
      }
    }
  }
}

async function main() {
  for (const [sym, t] of TICKERS) await probe(sym, t)
}

main()
