const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
const H = { 'User-Agent': UA }

async function barchartAnnual(sym) {
  const h = await fetch(`https://www.barchart.com/stocks/quotes/${sym}/earnings-estimates`, { headers: H }).then((r) => r.text())
  // Annual earnings section
  const annualIdx = h.search(/Annual Earnings Estimates/i)
  if (annualIdx < 0) return console.log('Barchart annual section missing')
  const block = h.slice(annualIdx, annualIdx + 15000)
  const rows = [...block.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)]
  for (const r of rows.slice(0, 15)) {
    const text = r[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    if (/202[6-9]|revenue|sales|eps/i.test(text)) console.log('  row:', text.slice(0, 150))
  }
}

async function googleFinance(sym) {
  const h = await fetch(`https://www.google.com/finance/quote/${sym}:NASDAQ`, { headers: H }).then((r) => r.text())
  console.log('Google Finance len', h.length)
  for (const y of [2026, 2027, 2028]) {
    const c = (h.match(new RegExp(String(y), 'g')) ?? []).length
    if (c) console.log('  year', y, 'mentions', c)
  }
  // AF_initDataCallback pattern
  const dataBlocks = [...h.matchAll(/AF_initDataCallback\([\s\S]*?\);/g)]
  console.log('  AF_initData blocks', dataBlocks.length)
  for (const b of dataBlocks) {
    if (/202[78]/.test(b[0]) && /revenue|Revenue/i.test(b[0])) {
      console.log('  rev block', b[0].slice(0, 500))
    }
  }
}

async function morningstar(sym) {
  const h = await fetch(`https://www.morningstar.com/stocks/xnas/${sym.toLowerCase()}/quote`, { headers: H }).then((r) => r.text())
  console.log('Morningstar len', h.length, '2028', h.includes('2028'))
}

async function tikr(sym) {
  for (const url of [
    `https://www.tikr.com/stock/${sym}`,
    `https://app.tikr.com/stock/${sym}`,
  ]) {
    const h = await fetch(url, { headers: H }).then((r) => r.text()).catch(() => '')
    console.log('Tikr', url, 'len', h.length, 'forecast', /forecast|estimate/i.test(h))
  }
}

async function valuespreadsheet(sym) {
  const h = await fetch(`https://www.valuespreadsheet.com/value-investing/stock/${sym}`, { headers: H }).then((r) => r.text()).catch(() => '')
  console.log('ValueSpreadsheet len', h.length)
}

async function stockrow(sym) {
  const h = await fetch(`https://stockrow.com/${sym}/financials?dimension=MRY`, { headers: H }).then((r) => r.text()).catch(() => '')
  console.log('Stockrow len', h.length, 'estimate', /estimate|forecast/i.test(h))
}

async function csmarketcap(sym) {
  const h = await fetch(`https://companiesmarketcap.com/${sym.toLowerCase()}/revenue/`, { headers: H }).then((r) => r.text()).catch(() => '')
  console.log('CompaniesMarketCap len', h.length, '2028', /2028/.test(h))
}

async function publicCom(sym) {
  const h = await fetch(`https://stockanalysis.com/stocks/${sym}/forecast/`, { headers: H }).then((r) => r.text())
  // Check if quote/ams path has different paywall
  const eu = await fetch(`https://stockanalysis.com/quote/ams/${sym}/forecast/`, { headers: H }).then((r) => r.text()).catch(() => '')
  const revEu = eu.match(/revenue:\[([^\]]+)\]/)?.[1]?.split(',').slice(-3)
  const revUs = h.match(/revenue:\[([^\]]+)\]/)?.[1]?.split(',').slice(-3)
  console.log('SA US rev tail', revUs, 'EU rev tail', revEu)
}

async function polygon(sym) {
  const key = process.env.POLYGON_API_KEY
  if (!key) return console.log('Polygon: kein Key')
  const u = `https://api.polygon.io/v3/reference/tickers/${sym}?apiKey=${key}`
  console.log('Polygon', (await fetch(u).then((r) => r.json()))?.status)
}

async function twelve(sym) {
  const key = process.env.TWELVE_DATA_API_KEY
  if (!key) return console.log('TwelveData: kein Key')
}

async function eodFundamentals(sym) {
  const key = process.env.EODHD_API_KEY
  if (!key) return console.log('EODHD: kein Key')
}

async function seekingTable(seeking) {
  const h = await fetch(`https://seekingalpha.com/symbol/${seeking}/income-statement`, { headers: H }).then((r) => r.text())
  console.log('SA income-statement len', h.length)
  for (const y of [2026, 2027, 2028]) {
    const c = (h.match(new RegExp(`fiscalyear":${y}`, 'g')) ?? []).length
    if (c) console.log('  FY', y, 'count', c)
  }
}

async function marketwatch(sym) {
  const h = await fetch(`https://www.marketwatch.com/investing/stock/${sym.toLowerCase()}/analystestimates`, { headers: H }).then((r) => r.text())
  console.log('MarketWatch analystestimates len', h.length)
  const rows = [...h.matchAll(/202[6-9][\s\S]{0,80}?[\d,.]+/g)].slice(0, 8)
  console.log('  rows', rows.map((m) => m[0].replace(/\s+/g, ' ').slice(0, 80)))
}

console.log('=== FY2028 HUNT ===\n')
await barchartAnnual('GOOGL')
await googleFinance('GOOGL')
await morningstar('GOOGL')
await tikr('GOOGL')
await valuespreadsheet('GOOGL')
await stockrow('GOOGL')
await csmarketcap('google')
await publicCom('googl')
await seekingTable('GOOG')
await marketwatch('googl')

// Free API: Financial data from SEC nothing for forward
// Try quandl/Nasdaq Data Link
const ndl = process.env.NASDAQ_DATA_LINK_API_KEY
if (ndl) console.log('NDL key present')
else console.log('Nasdaq Data Link: kein Key')

// SimFin - free registration
const simfin = await fetch('https://www.simfin.com/api/v3/companies/list?api-key=demo').then((r) => r.json()).catch(() => null)
console.log('SimFin demo', simfin ? 'responds' : 'fail')
