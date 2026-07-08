/** npx tsx scripts/probe-sa-urls-quick.ts */
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'

async function p(url: string) {
  const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(20_000) })
  console.log(url.replace('https://stockanalysis.com', ''), r.status, (await r.text()).length)
}

async function main() {
  await p('https://stockanalysis.com/stocks/hd/metrics/revenue-by-geography/')
  await p('https://stockanalysis.com/stocks/asml/metrics/revenue-by-segment/')
  await p('https://stockanalysis.com/quote/eur/asml/metrics/revenue-by-segment/')
  await p('https://stockanalysis.com/quote/eur/hlma/metrics/revenue-by-segment/')
  await p('https://stockanalysis.com/stocks/hlma/metrics/revenue-by-segment/')
}

main()
