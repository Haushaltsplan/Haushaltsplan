const isin = process.argv[2] || 'LU1681038243'

async function probeJustEtf() {
  const r = await fetch(`https://www.justetf.com/de/etf-profile.html?isin=${isin}`, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
  })
  const html = await r.text()
  console.log('justetf status', r.status, 'len', html.length)
  for (const p of ['window.', 'holdings', 'composition', 'Top 10', 'Gewicht', 'sector', 'country', '/api/']) {
    const idx = html.toLowerCase().indexOf(p.toLowerCase())
    if (idx >= 0) console.log('  hit', p, idx)
  }
  const apiMatches = [...html.matchAll(/\/api\/[a-zA-Z0-9_\-/?=&.%]+/g)].map((m) => m[0])
  console.log('  api paths', [...new Set(apiMatches)].slice(0, 30))
}

async function probeTrackInsight() {
  const urls = [
    `https://www.trackinsight.com/en/fund/${isin}`,
    `https://api.trackinsight.com/api/funds/${isin}`,
    `https://api.trackinsight.com/api/funds/${isin}/holdings`,
    `https://www.trackinsight.com/api/funds/${isin}/holdings`,
  ]
  for (const u of urls) {
    try {
      const r = await fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' } })
      const t = await r.text()
      console.log(u, r.status, t.slice(0, 150).replace(/\s+/g, ' '))
    } catch (e) {
      console.log(u, 'ERR', e.message)
    }
  }
}

async function probeExtraEtf() {
  const urls = [
    `https://extraetf.com/de/etf/${isin}`,
    `https://extraetf.com/api/etf/${isin}/holdings`,
    `https://www.extraetf.com/de/etf/${isin}`,
  ]
  for (const u of urls) {
    try {
      const r = await fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0' } })
      const t = await r.text()
      console.log(u, r.status, t.slice(0, 150).replace(/\s+/g, ' '))
    } catch (e) {
      console.log(u, 'ERR', e.message)
    }
  }
}

async function probeAmundi() {
  const urls = [
    `https://www.amundietf.de/de/privatkunden/etf/etf-detail/${isin}`,
    `https://www.amundietf.de/api/product/${isin}/holdings`,
  ]
  for (const u of urls) {
    try {
      const r = await fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' } })
      const t = await r.text()
      console.log(u, r.status, t.slice(0, 150).replace(/\s+/g, ' '))
    } catch (e) {
      console.log(u, 'ERR', e.message)
    }
  }
}

async function probeXtrackers() {
  const urls = [
    `https://etf.dws.com/en-gb/Asset/IE00BLNMYC90/`,
    `https://www.xtrackers.com/xtrackers-en/products/xtrackers-sp-500-equal-weight-ucits-etf-1c-usd-hedged-etf/IE00BLNMYC90`,
  ]
  for (const u of urls) {
    try {
      const r = await fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0' } })
      const t = await r.text()
      console.log(u, r.status, t.slice(0, 150).replace(/\s+/g, ' '))
      if (t.includes('__NEXT_DATA__')) console.log('  has NEXT_DATA')
    } catch (e) {
      console.log(u, 'ERR', e.message)
    }
  }
}

console.log('ISIN', isin)
await probeJustEtf()
console.log('--- trackinsight ---')
await probeTrackInsight()
console.log('--- extraetf ---')
await probeExtraEtf()
console.log('--- amundi ---')
await probeAmundi()
console.log('--- xtrackers ---')
await probeXtrackers()
