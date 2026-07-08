/** npx tsx scripts/probe-sa-segment-html2.ts */
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'

async function main() {
  const html = await fetch('https://stockanalysis.com/stocks/msft/metrics/', { headers: { 'User-Agent': UA } }).then(
    (r) => r.text(),
  )
  const idx = html.indexOf('Revenue by Segment')
  console.log(html.slice(idx - 2000, idx + 6000).replace(/></g, '>\n<'))
}

main()
