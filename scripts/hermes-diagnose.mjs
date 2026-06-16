const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131'

async function probeMacrotrends(ticker, slug) {
  const urls = [
    `https://www.macrotrends.net/stocks/charts/${ticker}/${slug}/financial-ratios`,
    `https://www.macrotrends.net/stocks/charts/HESAY/${slug}/financial-ratios`,
    `https://www.macrotrends.net/stocks/charts/RMS/${slug}/financial-ratios`,
  ]
  for (const url of urls) {
    const res = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' })
    const h = await res.text()
    const hasData = h.includes('field_name') || h.includes('original_date')
    console.log('MT', url.split('/charts/')[1]?.slice(0, 50), 'status', res.status, 'len', h.length, 'data', hasData)
  }
}

async function probeHermesIR() {
  const urls = [
    'https://finance.hermes.com/en/publications/',
    'https://finance.hermes.com/en/',
    'https://finance.hermes.com/en/financial-results/',
    'https://finance.hermes.com/en/publications/financial-documents/',
  ]
  for (const url of urls) {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html' }, redirect: 'follow' })
    const h = await res.text()
    const pdfs = [...h.matchAll(/href="([^"]+\.pdf[^"]*)"/gi)].map((m) => m[1]).slice(0, 5)
    const transcript = /transcript|webcast|conference|call|results/i.test(h)
    console.log('\nIR', url, 'status', res.status, 'len', h.length, 'pdf', pdfs.length, 'callKeywords', transcript)
    if (pdfs.length) console.log('  pdfs', pdfs)
    const links = [...h.matchAll(/href="([^"]+)"/gi)]
      .map((m) => m[1])
      .filter((u) => /202[4-6]|q[1-4]|half|semest|result|publication|financial/i.test(u))
      .slice(0, 8)
    if (links.length) console.log('  links', links)
  }
}

async function probeFool() {
  for (const slug of ['hermes', 'hermes-international', 'rms']) {
    const url = `https://www.fool.com/earnings/call-transcripts/${new Date().getFullYear()}/${slug}/`
    const res = await fetch(url, { headers: { 'User-Agent': UA } })
    console.log('Fool', slug, res.status, (await res.text()).length)
  }
  // search motley fool hermes transcript
  const s = await fetch('https://www.fool.com/search/?query=hermes+earnings+transcript', { headers: { 'User-Agent': UA } }).then((r) => r.text())
  console.log('Fool search len', s.length, 'hermes', /hermes/i.test(s))
}

async function probeYahoo() {
  let res = await fetch('https://fc.yahoo.com', { headers: { 'User-Agent': UA }, redirect: 'manual' })
  const jar = new Map()
  for (const c of res.headers.getSetCookie?.() ?? []) {
    const [kv] = c.split(';')
    const eq = kv.indexOf('=')
    if (eq > 0) jar.set(kv.slice(0, eq), kv.slice(eq + 1))
  }
  const cookie = [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ')
  const crumb = await fetch('https://query1.finance.yahoo.com/v1/test/getcrumb', { headers: { 'User-Agent': UA, Cookie: cookie } }).then((r) => r.text())
  for (const sym of ['RMS.PA', 'HESAY', 'RMS']) {
    const u = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${sym}?modules=financialData,defaultKeyStatistics&crumb=${crumb}`
    const j = await fetch(u, { headers: { 'User-Agent': UA, Cookie: cookie } }).then((r) => r.json())
    const r0 = j.quoteSummary?.result?.[0]
    console.log('Yahoo', sym, 'ok', !!r0, 'rev', r0?.financialData?.totalRevenue?.raw)
  }
}

async function probeMarketscreener() {
  for (const slug of ['HERMES-INTERNATIONAL-4635', 'HERMES-INTERNATIONAL-S-C-A-4635', 'HERMES-INTERNATIONAL']) {
    const h = await fetch(`https://www.marketscreener.com/quote/stock/${slug}/finances-consensus/`, { headers: { 'User-Agent': UA } }).then((r) => r.text())
    console.log('MS', slug, 'len', h.length, 'Net sales', h.includes('Net sales'))
  }
}

await probeMacrotrends('HESAY', 'hermes-international')
await probeHermesIR()
await probeFool()
await probeYahoo()
await probeMarketscreener()
