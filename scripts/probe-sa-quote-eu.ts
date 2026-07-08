/** npx tsx scripts/probe-sa-quote-eu.ts */
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
const paths = [
  '/quote/swx/SIKA/metrics/revenue-by-segment/',
  '/quote/swx/STMN/metrics/revenue-by-segment/',
  '/quote/lon/HLMA/metrics/revenue-by-segment/',
  '/quote/ams/WKL/metrics/revenue-by-segment/',
  '/quote/epa/RMS/metrics/revenue-by-segment/',
  '/stocks/sxyay/metrics/revenue-by-segment/',
  '/stocks/wtkwy/metrics/revenue-by-segment/',
]
async function main() {
  for (const p of paths) {
    const r = await fetch(`https://stockanalysis.com${p}`, {
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(15_000),
    })
    const t = await r.text()
    console.log(p, r.status, t.includes('Date') || t.includes('Period Ending'), t.length)
  }
}
main()
