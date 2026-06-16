const UA = 'Mozilla/5.0 Chrome/131'

// MarketBeat earnings page - look for transcript links
const mb = await fetch('https://www.marketbeat.com/stocks/EPA/RMS/earnings/', { headers: { 'User-Agent': UA } }).then((r) => r.text())
const transcriptLinks = [...mb.matchAll(/href="([^"]*transcript[^"]*)"/gi)].map((m) => m[1])
console.log('MarketBeat transcript links', transcriptLinks.slice(0, 5))

const quartr = [...mb.matchAll(/quartr|earnings call transcript/gi)]
console.log('Quartr mentions', quartr.length)

// Simulate wrong macrotrends path
const searchHermes = await fetch('https://www.macrotrends.net/assets/php/all_pages_query.php?q=Hermes', { headers: { 'User-Agent': UA } }).then((r) => r.text())
const items = JSON.parse(searchHermes)
console.log('\nSearch "Hermes" first hit:', items[0]?.name, items[0]?.url)

const searchHermesAccent = await fetch('https://www.macrotrends.net/assets/php/all_pages_query.php?q=Herm%C3%A8s', { headers: { 'User-Agent': UA } }).then((r) => r.text())
const items2 = JSON.parse(searchHermesAccent)
console.log('Search "Hermès" first hit:', items2[0]?.name, items2[0]?.url)

// Correct ident
console.log('\nCorrect URL works:', (await fetch('https://www.macrotrends.net/stocks/charts/HESAY/hermes-international/revenue', { headers: { 'User-Agent': UA } })).status)

// StockAnalysis forecast for RMS
for (const path of ['/stocks/rms/forecast/', '/quote/epa/RMS/forecast/']) {
  const h = await fetch(`https://stockanalysis.com${path}`, { headers: { 'User-Agent': UA } }).then((r) => r.text())
  console.log('SA', path, 'len', h.length, 'fiscalYear', h.includes('fiscalYear'))
}
