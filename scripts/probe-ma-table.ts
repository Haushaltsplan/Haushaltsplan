/** Inspect MS table rows for MA business segments. */
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

async function main() {
  const html = await fetch('https://www.marketscreener.com/quote/stock/MASTERCARD-INC-17163/finances-segments/', {
    headers: { 'User-Agent': UA, Referer: 'https://www.marketscreener.com/' },
  }).then((r) => r.text())

  const idx = html.search(/Historical Breakdown of Revenue by Business Segments/i)
  console.log('table section snippet:\n', html.slice(idx, idx + 4000).replace(/></g, '>\n<'))

  for (const path of [
    'https://stockanalysis.com/stocks/ma/metrics/revenue-by-segment/',
    'https://stockanalysis.com/quote/nyse/ma/metrics/revenue-by-segment/',
    'https://stockanalysis.com/quote/us/MA/metrics/revenue-by-segment/',
  ]) {
    const h = await fetch(path, { headers: { 'User-Agent': UA }, redirect: 'follow' }).then((r) =>
      r.text(),
    )
    const hasTable = h.includes('revenue') && h.includes('<table')
  const rows = [...h.matchAll(/<tr[\s\S]*?<\/tr>/gi)].slice(0, 15).map((m) =>
      m[0]
        .replace(/<[^>]+>/g, '|')
        .replace(/\|+/g, ' | ')
        .trim(),
    )
    console.log('\n', path, 'status rows sample:', rows.slice(0, 8))
  }
}

main().catch(console.error)
