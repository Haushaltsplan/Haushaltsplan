const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

async function msYears(slug) {
  const h = await fetch(`https://www.marketscreener.com/quote/stock/${slug}/finances-consensus/`, { headers: { 'User-Agent': UA } }).then((r) => r.text())
  const rowStart = h.search(/<td[^>]*>\s*Net sales\s*<\/td>/i)
  if (rowStart < 0) return null
  const tableStart = h.lastIndexOf('<table', rowStart)
  const tableEnd = h.indexOf('</table>', rowStart)
  const table = h.slice(tableStart, tableEnd + 8)
  return [...table.matchAll(/>(\d{4})\s*\*?<\/th>/g)].map((m) => m[1])
}

const stocks = [
  ['NVDA', 'NVIDIA-CORPORATION-57355629'],
  ['GOOGL', 'ALPHABET-INC-24203373'],
  ['AAPL', 'APPLE-INC-4849'],
  ['MSFT', 'MICROSOFT-CORP-4835'],
  ['AMD', 'ADVANCED-MICRO-DEVICES-INC-19475876'],
  ['AMZN', 'AMAZON-COM-INC-12864605'],
  ['ASML', 'ASML-HOLDING-N-V-12002973'],
  ['TSM', 'TAIWAN-SEMICONDUCTOR-MANUFACTURING-COMPANY-6492342'],
]

console.log('Marketscreener Schätzungsjahre (*):')
for (const [sym, slug] of stocks) {
  const y = await msYears(slug)
  console.log(`  ${sym}: ${y?.join(', ') ?? 'keine Tabelle'}`)
}

// GOOGL finances/ Hauptseite (nicht consensus)
const gf = await fetch('https://www.marketscreener.com/quote/stock/ALPHABET-INC-24203373/finances/', { headers: { 'User-Agent': UA } }).then((r) => r.text())
const estYears = [...new Set([...gf.matchAll(/>(\d{4})\s*\*?<\/th>/g)].map((m) => m[1] + '*'))]
console.log('\nGOOGL /finances/ estimate cols:', estYears.join(', '))
