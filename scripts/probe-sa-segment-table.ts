/** npx tsx scripts/probe-sa-segment-table.ts */
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'

async function main() {
  const html = await fetch('https://stockanalysis.com/stocks/msft/metrics/', { headers: { 'User-Agent': UA } }).then(
    (r) => r.text(),
  )
  for (const label of ['Revenue by Segment', 'Revenue by Geography', 'Geographic Revenue']) {
    const idx = html.indexOf(label)
    console.log('\n===', label, idx >= 0 ? 'FOUND' : 'missing', '===')
    if (idx < 0) continue
    const chunk = html.slice(idx, idx + 8000)
    const vals = [...chunk.matchAll(/<td[^>]*>([\d.]+[BMK]?)<\/td>/gi)].map((m) => m[1])
    console.log('values', vals.slice(0, 15))
    const names = [...chunk.matchAll(/<td[^>]*>([A-Za-z][^<]{2,50})<\/td>/g)].map((m) => m[1]!.trim())
    console.log('names', names.slice(0, 10))
    const years = [...html.slice(idx - 5000, idx).matchAll(/>(20\d{2})</g)].map((m) => m[1])
    console.log('years before', years.slice(-12))
  }
}

main()
