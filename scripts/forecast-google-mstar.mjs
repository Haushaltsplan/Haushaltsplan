const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

async function googleFinanceEstimates(sym) {
  const h = await fetch(`https://www.google.com/finance/quote/${sym}:NASDAQ`, { headers: { 'User-Agent': UA } }).then((r) => r.text())
  // Extract all AF_initDataCallback blocks and search for estimate patterns
  const blocks = [...h.matchAll(/AF_initDataCallback\(\{key: '([^']+)'[\s\S]*?data:([\s\S]*?)\}\);/g)]
  console.log('Google Finance blocks', blocks.length)
  for (const [, key, data] of blocks) {
    if (!/202[678]/.test(data)) continue
    if (!/revenue|Revenue|sales|Sales|estimate|Estimate|billion|B\b/i.test(data)) continue
    // Try to find year + number patterns
    const snippets = []
    for (const y of [2026, 2027, 2028]) {
      const idx = data.indexOf(String(y))
      if (idx >= 0) snippets.push(data.slice(Math.max(0, idx - 80), idx + 120))
    }
    if (snippets.length) {
      console.log(`\n  block ${key}:`)
      for (const s of snippets) console.log('   ', s.replace(/\s+/g, ' ').slice(0, 200))
    }
  }
  // Also try financials tab
  const f = await fetch(`https://www.google.com/finance/quote/${sym}:NASDAQ/financials`, { headers: { 'User-Agent': UA } }).then((r) => r.text())
  const fblocks = [...f.matchAll(/AF_initDataCallback\([\s\S]*?\);/g)]
  console.log('\nGoogle Finance /financials blocks', fblocks.length)
  for (const b of fblocks) {
    if (/2028/.test(b[0]) && /revenue|Revenue/i.test(b[0])) {
      console.log('  2028 revenue ctx', b[0].slice(b[0].indexOf('2028') - 100, b[0].indexOf('2028') + 200).replace(/\s+/g, ' '))
    }
  }
}

async function morningstarEstimates(sym) {
  const urls = [
    `https://www.morningstar.com/stocks/xnas/${sym.toLowerCase()}/financials`,
    `https://www.morningstar.com/stocks/xnas/${sym.toLowerCase()}/quote`,
  ]
  for (const url of urls) {
    const h = await fetch(url, { headers: { 'User-Agent': UA } }).then((r) => r.text())
    console.log('\nMorningstar', url.split('/').pop(), 'len', h.length)
    for (const y of [2026, 2027, 2028, 2029]) {
      const re = new RegExp(`${y}[^<]{0,60}([\\d,.]+)\\s*(B|billion|%)`, 'g')
      const m = [...h.matchAll(re)].slice(0, 3)
      if (m.length) console.log(`  FY${y}`, m.map((x) => x[0].replace(/\s+/g, ' ').slice(0, 80)))
    }
    // __NEXT_DATA__
    const nd = h.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i)?.[1]
    if (nd && /2028/.test(nd)) {
      const str = nd
      const idx = str.indexOf('2028')
      console.log('  NEXT 2028 ctx', str.slice(idx - 100, idx + 200))
    }
  }
}

async function simfinEstimates(sym) {
  // SimFin has free tier with API key - check docs
  const h = await fetch(`https://simfin.com/data/bulk?dataset=derived&variant=annual&market=us`, { headers: { 'User-Agent': UA } }).then((r) => r.text()).catch(() => '')
  console.log('\nSimFin bulk page len', h.length)
}

async function openbb(sym) {
  // no hosted API
}

await googleFinanceEstimates('GOOGL')
await morningstarEstimates('googl')
await simfinEstimates('GOOGL')

// Double-check: does StockAnalysis have ANY stock with 2028 revenue not PRO?
for (const s of ['aapl', 'nvda', 'meta', 'amzn', 'tsla']) {
  const h = await fetch(`https://stockanalysis.com/stocks/${s}/forecast/`, { headers: { 'User-Agent': UA } }).then((r) => r.text())
  const fy = (h.match(/fiscalYear:\[([^\]]+)\]/)?.[1] ?? '').split(',').map((x) => x.replace(/"/g, ''))
  const rev = (h.match(/revenue:\[([^\]]+)\]/)?.[1] ?? '').split(',')
  const i28 = fy.indexOf('2028')
  const v28 = rev[i28]?.trim()
  console.log(`SA ${s} FY2028:`, v28?.includes('PRO') ? '[PRO]' : v28 ?? 'n/a')
}
