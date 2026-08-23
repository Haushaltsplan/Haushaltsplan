const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

async function get(url, extra = {}) {
  const r = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'text/html,application/json,*/*', ...extra },
    signal: AbortSignal.timeout(22000),
  })
  return { status: r.status, text: await r.text(), ct: r.headers.get('content-type') }
}

function roiicHits(label, text) {
  const patterns = [
    /5.?Year ROIIC[^0-9]{0,60}([\d.-]+)\s*%/gi,
    /3.?Year ROIIC[^0-9]{0,60}([\d.-]+)\s*%/gi,
    /1.?Year ROIIC[^0-9]{0,60}([\d.-]+)\s*%/gi,
    /"roiic[^"]*"\s*:\s*([\d.-]+)/gi,
    /Incremental ROIC[^0-9]{0,40}([\d.-]+)\s*%/gi,
    /ROIIC[^0-9]{0,30}([\d.-]+)\s*%/gi,
  ]
  const found = []
  for (const re of patterns) {
    let m
    while ((m = re.exec(text)) && found.length < 8) found.push(m[0].slice(0, 80))
  }
  console.log(label, 'status ok', 'len', text.length, found.length ? found : '(no roiic hits)')
}

const sym = process.argv[2] || 'SPGI'
const slug = process.argv[3] || 'spgi'

const urls = [
  [`SA-ratios`, `https://stockanalysis.com/stocks/${slug}/financials/ratios/`],
  [`SA-metrics`, `https://stockanalysis.com/stocks/${slug}/financials/metrics/`],
  [`SA-stat`, `https://stockanalysis.com/stocks/${slug}/statistics/`],
  [`Finviz`, `https://finviz.com/quote.ashx?t=${sym}`],
  [`MB`, `https://www.marketbeat.com/stocks/NYSE/${sym}/`],
  [`MB-fin`, `https://www.marketbeat.com/stocks/NYSE/${sym}/financials/`],
  [`Yahoo-stats`, `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${sym}?modules=defaultKeyStatistics,financialData`],
  [`Nasdaq`, `https://api.nasdaq.com/api/company/${sym}/financials?frequency=1`],
]

for (const [label, url] of urls) {
  try {
    const { status, text, ct } = await get(url, {
      Referer: label.startsWith('SA') ? 'https://stockanalysis.com/' : undefined,
      Origin: label.startsWith('Nasdaq') ? 'https://www.nasdaq.com' : undefined,
    })
    if (status !== 200) {
      console.log(label, status, ct)
      continue
    }
    roiicHits(label, text)
    if (label.startsWith('SA-metrics')) {
      // svelte: data arrays
      const dm = text.match(/data:\s*\[([\s\S]{0,500})/)
      if (dm) console.log('  data prefix', dm[0].slice(0, 120))
      const rows = [...text.matchAll(/>([^<]{3,80}(?:ROIC|ROIIC|Incremental)[^<]{0,40})</gi)].slice(0, 8)
      if (rows.length) console.log('  rows', rows.map((x) => x[1]))
    }
  } catch (e) {
    console.log(label, 'fail', e.message)
  }
}
