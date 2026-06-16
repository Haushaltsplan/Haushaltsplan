const UA = 'Mozilla/5.0 Chrome/131'

const pages = [
  'https://finance.hermes.com/en/publications/first-quarter-2026-revenue',
  'https://finance.hermes.com/en/publications/message-executive-management-2025',
]

const BERICHT_MUSTER =
  /\b(annual report|geschäftsbericht|geschaeftsbericht|half[- ]year|halbjahr|interim report|quarterly report|quarterly results|financial report|financial statements|universal registration|registration document|rapport annuel|rapport financier|results presentation|investor presentation|q[1-4]\s*20\d{2}|fy20\d{2}|20\d{2}\s*(results|report|annual)|revenue)\b/i

for (const url of pages) {
  const h = await fetch(url, { headers: { 'User-Agent': UA } }).then((r) => r.text())
  console.log('\n===', url.split('/').pop(), '===')
  const pdfs = [...h.matchAll(/href="([^"]+\.pdf[^"]*)"/gi)].map((m) => ({ href: m[1], ctx: h.slice(Math.max(0, m.index - 80), m.index + 80).replace(/\s+/g, ' ') }))
  for (const p of pdfs) {
    const fname = p.href.split('/').pop()?.slice(0, 70)
    const match = BERICHT_MUSTER.test(`${fname} ${p.ctx}`)
    console.log(' pdf', fname, 'matchBericht', match)
  }
  console.log(' transcript pdf', /transcript/i.test(h))
  console.log(' webcast', /webcast|audio|replay/i.test(h))
}

// MS slug test again with row parse
const slug = 'HERMES-INTERNATIONAL-4635'
const h = await fetch(`https://www.marketscreener.com/quote/stock/${slug}/finances-consensus/`, { headers: { 'User-Agent': UA } }).then((r) => r.text())
console.log('\nMS', slug, 'len', h.length)
console.log(' Net sales idx', h.search(/Net sales/i))
console.log(' Chiffre', h.search(/Chiffre/i))

// Macrotrends all 4 statements for HESAY
for (const stmt of ['financial-ratios', 'income-statement', 'cash-flow-statement', 'balance-sheet']) {
  const u = `https://www.macrotrends.net/stocks/charts/HESAY/hermes-international/${stmt}`
  const html = await fetch(u, { headers: { 'User-Agent': UA } }).then((r) => r.text())
  const rows = (html.match(/field_name/g) ?? []).length
  const oops = html.includes('Oops!')
  console.log('MT', stmt, 'rows~', rows, 'oops', oops)
}
