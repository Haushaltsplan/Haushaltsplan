const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
const HDR = { 'User-Agent': UA, Accept: 'text/html,application/json' }

async function simply(sym) {
  const paths = [
    `https://simplywall.st/stocks/us/nasdaq-${sym.toLowerCase()}/${sym.toLowerCase()}/future`,
    `https://simplywall.st/stocks/us/nasdaq-${sym.toLowerCase()}/${sym.toLowerCase()}/valuation`,
  ]
  for (const url of paths) {
    const h = await fetch(url, { headers: HDR }).then((r) => r.text())
    console.log('\nSimplyWallSt', url.split('/').slice(-2).join('/'), 'len', h.length)
    // __NEXT_DATA__ or similar
    const nd = h.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i)?.[1]
    if (nd) {
      const j = JSON.parse(nd)
      const str = JSON.stringify(j)
      for (const y of [2026, 2027, 2028, 2029]) {
        const re = new RegExp(`"year":${y}[^}]{0,200}?(revenue|totalRevenue|sales)[^:]*:([\\d.]+)`, 'gi')
        const m = str.match(re)
        if (m) console.log('  year', y, m.slice(0, 2))
      }
      // search revenue estimates array
      const revEst = str.match(/revenueEstimate[s]?[\\"]*:[\s\S]{0,500}/i)?.[0]
      if (revEst) console.log('  revEst', revEst.slice(0, 400))
      const future = str.match(/futureEarnings[\s\S]{0,800}/i)?.[0]
      if (future) console.log('  future', future.slice(0, 400))
    }
    // embedded JSON-LD or window state
    const blocks = [...h.matchAll(/20(2[6-9])[^0-9]{0,30}([\d.]+)\s*(billion|B|bn)/gi)]
    console.log('  B-mentions', blocks.slice(0, 8).map((m) => m[0]))
  }
}

async function barchart(sym) {
  const url = `https://www.barchart.com/stocks/quotes/${sym}/earnings-estimates`
  const h = await fetch(url, { headers: { ...HDR, Referer: 'https://www.barchart.com/' } }).then((r) => r.text())
  console.log('\nBarchart', sym, 'len', h.length)
  // look for data in script
  const scripts = [...h.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1])
  for (const s of scripts) {
    if (/202[6-9]/.test(s) && /revenue|sales|eps/i.test(s)) {
      console.log('  script snippet', s.replace(/\s+/g, ' ').slice(0, 300))
    }
  }
  // table rows
  for (const y of [2026, 2027, 2028]) {
    const re = new RegExp(`${y}[\\s\\S]{0,200}?([\\d,]+\\.?\\d*)`, 'i')
    const m = h.match(re)
    if (m) console.log('  FY', y, m[0].replace(/\s+/g, ' ').slice(0, 120))
  }
}

async function marketbeat(sym) {
  const h = await fetch(`https://www.marketbeat.com/stocks/NASDAQ/${sym}/earnings/`, { headers: HDR }).then((r) => r.text())
  console.log('\nMarketBeat', sym)
  const tables = [...h.matchAll(/<table[\s\S]*?<\/table>/gi)]
  for (const t of tables) {
    if (/202[6-9]/.test(t[0]) && /revenue|eps|estimate/i.test(t[0])) {
      console.log('  table', t[0].replace(/<[^>]+>/g, '|').replace(/\|+/g, ' ').slice(0, 400))
    }
  }
}

async function ms2027check() {
  const h = await fetch('https://www.marketscreener.com/quote/stock/ALPHABET-INC-24203373/finances-consensus/', { headers: HDR }).then((r) => r.text())
  const rowStart = h.search(/<td[^>]*>\s*Net sales\s*<\/td>/i)
  const tableStart = h.lastIndexOf('<table', rowStart)
  const tableEnd = h.indexOf('</table>', rowStart)
  const table = h.slice(tableStart, tableEnd + 8)
  const thead = table.match(/<thead>[\s\S]*?<\/thead>/i)?.[0] ?? ''
  const years = [...thead.matchAll(/>(\d{4})\s*(\*)?<\/th>/g)].map((m) => m[1] + (m[2] ? '*' : ''))
  const pos = table.search(/<td[^>]*>\s*Net sales\s*<\/td>/i)
  const rowEnd = table.indexOf('</tr>', pos)
  const row = table.slice(pos, rowEnd + 8)
  // all parsing methods
  const titles = [...row.matchAll(/title="([^"]+)"/g)].map((m) => m[1])
  const efd = [...row.matchAll(/<span class="efd_USD[^"]*"[^>]*>[\s\S]*?<span title="([^"]+)">/g)].map((m) => m[1])
  console.log('\nMS GOOGL years', years)
  console.log('  efd parser', efd)
  console.log('  all titles', titles.slice(0, 6))
}

async function stockanalysisFull(sa) {
  const h = await fetch(`https://stockanalysis.com/stocks/${sa}/forecast/`, { headers: HDR }).then((r) => r.text())
  const fy = (h.match(/fiscalYear:\[([^\]]+)\]/)?.[1] ?? '').split(',').map((s) => s.replace(/"/g, ''))
  const metrics = ['revenue', 'eps', 'operatingIncome', 'netIncome']
  for (const m of metrics) {
    const arr = (h.match(new RegExp(`${m}:\\[([^\\]]+)\\]`))?.[1] ?? '').split(',')
    const pairs = fy.map((y, i) => `${y}:${arr[i]?.trim() ?? '?'}`).slice(-4)
    console.log(`SA ${sa} ${m}`, pairs.join(' | '))
  }
}

await simply('GOOGL')
await barchart('GOOGL')
await marketbeat('MSFT')
await ms2027check()
await stockanalysisFull('googl')
