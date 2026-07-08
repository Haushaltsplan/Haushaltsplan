/** npx tsx scripts/probe-sa-years2.ts */
async function main() {
  const html = await fetch('https://stockanalysis.com/stocks/now/metrics/', {
    headers: { 'User-Agent': 'Mozilla/5.0' },
  }).then((r) => r.text())
  const idx = html.indexOf('Remaining Performance Obligations')
  const block = html.slice(idx - 8000, idx + 500)
  const years = [...block.matchAll(/>(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+'(\d{2})</g)]
  console.log('month years', years.map((m) => m[0]))
  const fy = [...block.matchAll(/>(20\d{2})</g)].map((m) => m[1])
  console.log('4digit', fy.slice(-20))
}

main()
