/** npx tsx scripts/probe-sa-segment-annual.ts */
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'

async function main() {
  const html = await fetch('https://stockanalysis.com/stocks/msft/metrics/revenue-by-segment/', {
    headers: { 'User-Agent': UA },
  }).then((r) => r.text())
  const rows = [...html.matchAll(/<tr[\s\S]*?<\/tr>/gi)]
  console.log('total rows', rows.length)
  for (const r of rows.slice(0, 15)) {
    const cells = [...r[0].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)]
      .map((c) => c[1]!.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim())
    if (cells.length) console.log(cells.join(' | '))
  }
  console.log('has Annual button', html.includes('>Annual<'))
}

main()
