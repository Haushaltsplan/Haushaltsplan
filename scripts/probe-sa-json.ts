/** npx tsx scripts/probe-sa-json.ts */
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'

async function main() {
  const html = await fetch('https://stockanalysis.com/stocks/msft/metrics/revenue-by-segment/', {
    headers: { 'User-Agent': UA },
  }).then((r) => r.text())
  console.log('length', html.length)
  const idx = html.indexOf('Productivity and Business')
  console.log('context', html.slice(idx - 200, idx + 400))
  for (const m of html.matchAll(/type="application\/json"[^>]*>([\s\S]*?)<\/script>/gi)) {
    const j = m[1]!.slice(0, 300)
    if (/segment|revenue/i.test(j)) console.log('json', j)
  }
}

main()
