/** npx tsx scripts/probe-marketbeat-years.ts */
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'

async function main() {
  const html = await fetch('https://www.marketbeat.com/stocks/NYSE/NOW/financials/', {
    headers: { 'User-Agent': UA },
  }).then((r) => r.text())

  const annualSection = html.indexOf('Annual Balance Sheet')
  console.log('annual idx', annualSection)
  const chunk = html.slice(annualSection, annualSection + 8000)
  const years = [...chunk.matchAll(/<th[^>]*>\s*(20\d{2})\s*<\/th>/g)].map((m) => Number(m[1]))
  console.log('years in annual section', years)

  // stockanalysis metrics - parse year headers before RPO
  const sa = await fetch('https://stockanalysis.com/stocks/now/metrics/', { headers: { 'User-Agent': UA } }).then(
    (r) => r.text(),
  )
  const before = sa.slice(Math.max(0, sa.indexOf('Remaining Performance Obligations') - 3000), sa.indexOf('Remaining Performance Obligations'))
  const saYears = [...before.matchAll(/>(20\d{2})</g)].map((m) => Number(m[1]))
  console.log('SA years near RPO', saYears)
}

main()
