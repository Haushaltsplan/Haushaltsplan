const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

async function get(url, extra = {}) {
  const r = await fetch(url, {
    headers: {
      'User-Agent': UA,
      Accept: 'text/html,application/json,*/*',
      'Accept-Language': 'en-US,en;q=0.9',
      ...extra,
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(25000),
  })
  return { status: r.status, text: await r.text(), ct: r.headers.get('content-type') }
}

function roiicHits(text) {
  const patterns = [
    /5.?Year ROIIC[^0-9]{0,80}([\d.-]+)\s*%/gi,
    /3.?Year ROIIC[^0-9]{0,80}([\d.-]+)\s*%/gi,
    /1.?Year ROIIC[^0-9]{0,80}([\d.-]+)\s*%/gi,
    /Incremental ROIC[^0-9]{0,60}([\d.-]+)\s*%/gi,
    /"roiic[^"]*"\s*:\s*([\d.-]+)/gi,
    /ROIIC[^0-9]{0,40}([\d.-]+)\s*%/gi,
  ]
  const found = []
  for (const re of patterns) {
    let m
    while ((m = re.exec(text)) && found.length < 6) found.push(m[0].slice(0, 100))
  }
  return found
}

const sym = process.argv[2] || 'SPGI'
const slug = process.argv[3] || 'spgi'

const urls = [
  ['roic.ai', `https://www.roic.ai/companies/${sym}`],
  ['roic-api', `https://api.roic.ai/v1/companies/${sym}/profitability`],
  ['valuesense', `https://valuesense.io/ticker/${sym}/`],
  ['gf-term5y', `https://www.gurufocus.com/term/roiic-5y/${sym}`],
  ['gf-summary', `https://www.gurufocus.com/stock/${sym}/summary`],
  ['gf-chart', `https://www.gurufocus.com/stock/${sym}/chart`],
  ['finchat', `https://finchat.io/companies/NYSE:${sym}/ratios`],
  ['SA-ratios', `https://stockanalysis.com/stocks/${slug}/financials/ratios/`],
  ['SA-api', `https://stockanalysis.com/api/symbol/s/${slug}/ratios`],
  ['compounding', `https://www.compoundingquality.net/stock/${sym}`],
  ['tikr-pub', `https://api.tikr.com/screener?tickers=${sym}`],
]

for (const [label, url] of urls) {
  try {
    const { status, text, ct } = await get(url, {
      Referer: label.startsWith('SA') ? 'https://stockanalysis.com/' : undefined,
    })
    const hits = status === 200 ? roiicHits(text) : []
    console.log(label, status, ct?.slice(0, 30), 'len', text.length, hits.length ? hits : '-')
    if (label === 'gf-term5y' && status === 403) {
      console.log('  gf403 snippet', text.slice(0, 200).replace(/\s+/g, ' '))
    }
    if (label.startsWith('SA') && text.includes('__data')) {
      const idx = text.indexOf('type:"data"')
      if (idx > 0) console.log('  svelte', text.slice(idx, idx + 200))
    }
  } catch (e) {
    console.log(label, 'fail', e.message)
  }
}
