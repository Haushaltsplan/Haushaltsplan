/**
 * Umfassender Probe-Lauf: freie Quellen für Annual Revenue/EPS-Schätzungen FY2026–2029
 */
import { readFileSync, writeFileSync } from 'fs'

function loadEnv() {
  try {
    for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
      const m = line.match(/^([^#=]+)=(.*)$/)
      if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '')
    }
  } catch {}
}
loadEnv()

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
const HDR = { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9,de;q=0.9' }

const TICKERS = [
  { label: 'GOOGL', yahoo: 'GOOGL', sa: 'googl', ms: 'ALPHABET-INC-24203373', seeking: 'GOOG', inv: 'google-inc' },
  { label: 'ASML', yahoo: 'ASML', sa: 'asml', ms: 'ASML-HOLDING-N-V-12002973', seeking: 'ASML', inv: 'asml-holding' },
  { label: 'MSFT', yahoo: 'MSFT', sa: 'msft', ms: 'MICROSOFT-CORP-4835', seeking: 'MSFT', inv: 'microsoft-corp' },
]

const results = []

function log(source, ticker, status, detail) {
  results.push({ source, ticker, status, detail })
  const icon = status === 'ok' ? '✓' : status === 'partial' ? '~' : '✗'
  console.log(`${icon} [${source}] ${ticker}: ${detail}`)
}

async function yahooAuth() {
  let res = await fetch('https://fc.yahoo.com', { headers: { 'User-Agent': UA }, redirect: 'manual' })
  const jar = new Map()
  for (const c of res.headers.getSetCookie?.() ?? []) {
    const [kv] = c.split(';')
    const eq = kv.indexOf('=')
    if (eq > 0) jar.set(kv.slice(0, eq), kv.slice(eq + 1))
  }
  const cookie = [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ')
  res = await fetch('https://query1.finance.yahoo.com/v1/test/getcrumb', { headers: { 'User-Agent': UA, Cookie: cookie } })
  const crumb = await res.text()
  return { cookie, crumb }
}

async function probeYahoo(auth, sym) {
  const modules = ['earningsTrend', 'earningsHistory', 'financialData', 'defaultKeyStatistics']
  const u = new URL(`https://query2.finance.yahoo.com/v10/finance/quoteSummary/${sym}`)
  u.searchParams.set('modules', modules.join(','))
  u.searchParams.set('crumb', auth.crumb)
  const res = await fetch(u.toString(), { headers: { ...HDR, Cookie: auth.cookie, Accept: 'application/json' } })
  if (!res.ok) return log('Yahoo', sym, 'fail', `HTTP ${res.status}`)
  const j = await res.json()
  const trend = j.quoteSummary?.result?.[0]?.earningsTrend?.trend ?? []
  const annual = trend
    .filter((t) => /^[+]?\d*y$/i.test(String(t.period ?? '')))
    .map((t) => ({
      period: t.period,
      end: t.endDate?.fmt ?? t.endDate,
      rev: t.revenueEstimate?.avg?.raw,
      eps: t.earningsEstimate?.avg?.raw,
    }))
  const years = annual.map((a) => a.end?.slice(0, 4)).filter(Boolean)
  log('Yahoo earningsTrend', sym, annual.length ? 'partial' : 'fail', `Jahre ${years.join(', ')} | rev ${annual.map((a) => a.rev).join(' / ')}`)
}

async function probeStockAnalysis(sa) {
  const h = await fetch(`https://stockanalysis.com/stocks/${sa}/forecast/`, { headers: HDR }).then((r) => r.text())
  if (h.length < 50000) return log('StockAnalysis', sa, 'fail', `kurze Antwort ${h.length}`)
  const fy = (h.match(/fiscalYear:\[([^\]]+)\]/)?.[1] ?? '').split(',').map((s) => s.replace(/"/g, ''))
  const rev = (h.match(/revenue:\[([^\]]+)\]/)?.[1] ?? '').split(',')
  const estYears = []
  for (let i = 0; i < fy.length; i++) {
    const v = rev[i]?.trim()
    if (v && !v.includes('PRO') && !isNaN(Number(v))) estYears.push(`${fy[i]}=${(Number(v) / 1e9).toFixed(1)}B`)
    else if (v?.includes('PRO')) estYears.push(`${fy[i]}=[PRO]`)
  }
  const has2028 = fy.includes('2028')
  const val2028 = rev[fy.indexOf('2028')]
  log('StockAnalysis', sa, val2028 && !val2028.includes('PRO') ? 'ok' : 'partial', estYears.slice(-4).join(' | '))
  if (has2028 && val2028?.includes('PRO')) log('StockAnalysis 2028', sa, 'fail', 'FY2028 Paywall')
}

async function probeMarketscreener(ms) {
  const h = await fetch(`https://www.marketscreener.com/quote/stock/${ms}/finances-consensus/`, { headers: HDR }).then((r) => r.text())
  const rowStart = h.search(/<td[^>]*>\s*Net sales\s*<\/td>/i)
  if (rowStart < 0) return log('Marketscreener', ms, 'fail', 'keine Net-sales-Tabelle')
  const tableStart = h.lastIndexOf('<table', rowStart)
  const tableEnd = h.indexOf('</table>', rowStart)
  const table = h.slice(tableStart, tableEnd + 8)
  const years = [...table.matchAll(/>(\d{4})\s*(\*)?<\/th>/g)].map((m) => m[1] + (m[2] ? '*' : ''))
  const pos = table.search(/<td[^>]*>\s*Net sales\s*<\/td>/i)
  const rowEnd = table.indexOf('</tr>', pos)
  const row = table.slice(pos, rowEnd > pos ? rowEnd : pos + 12000)
  const vals = [...row.matchAll(/title="([^"]+)"/g)].map((m) => m[1]).slice(0, years.length)
  const pairs = years.map((y, i) => `${y}=${vals[i] ?? '?'}`)
  const maxYear = Math.max(...years.map((y) => Number(y.replace('*', ''))))
  log('Marketscreener', ms, maxYear >= 2028 ? 'ok' : 'partial', pairs.join(' | '))
}

async function probeFinnhub(sym) {
  const key = process.env.FINNHUB_API_KEY
  if (!key) return log('Finnhub', sym, 'fail', 'kein API-Key')
  for (const ep of ['revenue-estimate', 'eps-estimate']) {
    const u = `https://finnhub.io/api/v1/stock/${ep}?symbol=${sym}&freq=annual&token=${key}`
    const res = await fetch(u)
    const j = await res.json()
    if (res.status === 403) return log('Finnhub', sym, 'fail', '403 — kein Zugriff (Pro nötig)')
    const years = (j.data ?? []).map((r) => r.year).filter(Boolean)
    if (years.length) log(`Finnhub ${ep}`, sym, 'ok', `Jahre ${years.join(', ')}`)
  }
}

async function probeSeekingAlpha(seeking) {
  const h = await fetch(`https://seekingalpha.com/symbol/${seeking}/earnings/estimates`, { headers: HDR }).then((r) => r.text())
  const revBlock = h.match(/"revenue_consensus_mean":\{([\s\S]*?)\},"eps_normalized/)?.[1] ?? ''
  const years = [...revBlock.matchAll(/fiscalyear":(\d{4})/g)].map((m) => m[1])
  const vals = [...revBlock.matchAll(/dataitemvalue":"([^"]+)"/g)].map((m) => m[1])
  log('Seeking Alpha', seeking, years.length ? 'partial' : 'fail', years.map((y, i) => `${y}=${vals[i] ?? '?'}`).join(' | ') || 'keine revenue_consensus_mean')
  // Multi-year table in HTML?
  for (const y of [2026, 2027, 2028, 2029]) {
    const c = (h.match(new RegExp(`fiscalyear":${y}`, 'g')) ?? []).length
    if (c) log(`SeekingAlpha FY${y}`, seeking, c > 2 ? 'ok' : 'partial', `${c} Treffer im HTML`)
  }
}

async function probeInvesting(inv) {
  const urls = [
    `https://www.investing.com/equities/${inv}-earnings`,
    `https://www.investing.com/equities/${inv}-financial-summary`,
  ]
  for (const url of urls) {
    const h = await fetch(url, { headers: { ...HDR, Referer: 'https://www.investing.com/' } }).then((r) => r.text())
    if (h.length < 20000) {
      log('Investing.com', inv, 'fail', `${url.split('/').pop()} blockiert/kurz (${h.length})`)
      continue
    }
    const years = [...new Set([...h.matchAll(/\b20(2[6-9]|3\d)\b/g)].map((m) => m[0]))].sort()
    const revCtx = h.match(/revenue[\s\S]{0,200}20(2[6-9])/i)?.[0]?.slice(0, 120)
    log('Investing.com', inv, years.length ? 'partial' : 'fail', `Jahre im HTML: ${years.join(', ')} | ${revCtx ?? 'kein Rev-Kontext'}`)
    break
  }
}

async function probeZacks(sym) {
  const h = await fetch(`https://www.zacks.com/stock/quote/${sym}/detailed-earning-estimates`, { headers: HDR }).then((r) => r.text())
  // Zacks embeds chart data sometimes
  const tables = [...h.matchAll(/<table[^>]*class="[^"]*estimate[^"]*"[\s\S]*?<\/table>/gi)]
  const fyRows = [...h.matchAll(/FY\s*(20\d{2})[\s\S]{0,120}?([\d,]+\.?\d*)/gi)].slice(0, 8)
  log('Zacks', sym, fyRows.length ? 'partial' : 'fail', `FY-Zeilen: ${fyRows.map((m) => m[1]).join(', ') || 'keine'} | Tabellen ${tables.length}`)
}

async function probeTipRanks(sym) {
  const h = await fetch(`https://www.tipranks.com/stocks/${sym.toLowerCase()}/forecast`, { headers: HDR }).then((r) => r.text())
  const nd = h.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i)?.[1]
  if (nd) {
    const str = nd
    const revYears = [...str.matchAll(/"fiscalYear":(20\d{2})[\s\S]{0,80}?"revenue":([\d.]+)/g)].map((m) => `${m[1]}=${m[2]}`)
    if (revYears.length) return log('TipRanks', sym, 'ok', revYears.join(' | '))
  }
  const years = [...new Set([...h.matchAll(/\b202[6-9]\b/g)].map((m) => m[0]))].sort()
  log('TipRanks', sym, 'fail', `nur Jahre im HTML: ${years.join(', ') || 'keine'}`)
}

async function probeFinviz(sym) {
  const h = await fetch(`https://finviz.com/quote.ashx?t=${sym}`, { headers: HDR }).then((r) => r.text())
  const epsNextY = h.match(/EPS next Y[^<]*<[^>]*>([^<]+)/i)?.[1]
  const salesYY = h.match(/Sales Y\/Y TTM[^<]*<[^>]*>([^<]+)/i)?.[1]
  log('Finviz', sym, epsNextY ? 'partial' : 'fail', `EPS next Y: ${epsNextY ?? '-'} | kein Multi-Jahr-Umsatz`)
}

async function probeMacrotrends(sym) {
  const h = await fetch(`https://www.macrotrends.net/stocks/charts/${sym}/${sym}/revenue`, { headers: HDR }).then((r) => r.text())
  const hasEst = /estimate|forecast|project/i.test(h)
  log('Macrotrends', sym, 'fail', hasEst ? 'evtl. Schätz-Hinweis, aber keine Forward-Tabelle' : 'nur historisch')
}

async function probeTradingView(sym) {
  const h = await fetch(`https://www.tradingview.com/symbols/NASDAQ-${sym}/forecast/`, { headers: HDR }).then((r) => r.text())
  const years = [...new Set([...h.matchAll(/\b202[6-9]\b/g)].map((m) => m[0]))].sort()
  log('TradingView forecast', sym, years.length >= 3 ? 'partial' : 'fail', `Jahre: ${years.join(', ') || 'keine'}`)
}

async function probeSimplyWallSt(sym) {
  const h = await fetch(`https://simplywall.st/stocks/us/nasdaq-${sym.toLowerCase()}/${sym.toLowerCase()}/future`, { headers: HDR }).then((r) => r.text())
  const rev = h.match(/revenue[\s\S]{0,100}/gi)?.slice(0, 2)
  const years = [...new Set([...h.matchAll(/\b202[6-9]\b/g)].map((m) => m[0]))].sort()
  log('SimplyWallSt', sym, years.length ? 'partial' : 'fail', `Jahre ${years.join(', ')}`)
}

async function probeFMP(sym) {
  // Free tier ohne Key testen
  const u = `https://financialmodelingprep.com/stable/analyst-estimates?symbol=${sym}&period=annual&page=0&limit=10`
  const res = await fetch(u)
  const j = await res.json()
  if (j['Error Message'] || res.status === 401) return log('FMP', sym, 'fail', 'API-Key nötig')
  if (Array.isArray(j) && j.length) {
    const years = j.map((r) => r.date?.slice(0, 4) ?? r.fiscalYear ?? '?')
    log('FMP', sym, 'ok', `Jahre ${years.join(', ')}`)
  } else log('FMP', sym, 'fail', JSON.stringify(j).slice(0, 120))
}

async function probeAlphaVantage(sym) {
  const key = process.env.ALPHA_VANTAGE_API_KEY
  if (!key) return log('Alpha Vantage', sym, 'fail', 'kein Key in .env')
  const u = `https://www.alphavantage.co/query?function=EARNINGS_ESTIMATES&symbol=${sym}&apikey=${key}`
  const j = await fetch(u).then((r) => r.json())
  const annual = j.annualEarningsEstimates ?? j.estimates ?? []
  if (Array.isArray(annual) && annual.length) {
    log('Alpha Vantage', sym, 'ok', annual.map((e) => e.fiscalDateEnding?.slice(0, 4)).join(', '))
  } else log('Alpha Vantage', sym, 'fail', JSON.stringify(j).slice(0, 150))
}

async function probeWallstreet(slug) {
  const h = await fetch(`https://www.wallstreet-online.de/aktien/${slug}`, {
    headers: { ...HDR, Referer: 'https://www.wallstreet-online.de/' },
  }).then((r) => r.text())
  const est = [...new Set([...h.matchAll(/20\d{2}e/gi)].map((m) => m[0]))]
  log('Wallstreet', slug, est.length ? 'partial' : 'fail', `Spalten: ${est.join(', ') || 'keine'}`)
}

async function probeNasdaq(sym) {
  const h = await fetch(`https://www.nasdaq.com/market-activity/stocks/${sym.toLowerCase()}/earnings`, { headers: HDR }).then((r) => r.text())
  const years = [...new Set([...h.matchAll(/\b202[6-9]\b/g)].map((m) => m[0]))].sort()
  log('Nasdaq earnings', sym, years.length ? 'partial' : 'fail', `Jahre ${years.join(', ')}`)
}

async function probeStockrow(sym) {
  const h = await fetch(`https://stockrow.com/AAPL/financials?company=${sym}`, { headers: HDR }).then((r) => r.text()).catch(() => '')
  log('Stockrow', sym, h.length > 10000 ? 'partial' : 'fail', `len ${h.length}`)
}

async function probeKoyfin(sym) {
  const h = await fetch(`https://app.koyfin.com/api/v1/ticker/${sym}/estimates`, { headers: HDR }).then((r) => r.text()).catch(() => '')
  log('Koyfin API', sym, 'fail', h.slice(0, 100) || 'nicht erreichbar')
}

async function probeBarchart(sym) {
  const h = await fetch(`https://www.barchart.com/stocks/quotes/${sym}/earnings-estimates`, { headers: HDR }).then((r) => r.text())
  const years = [...new Set([...h.matchAll(/\b202[6-9]\b/g)].map((m) => m[0]))].sort()
  log('Barchart', sym, years.length >= 2 ? 'partial' : 'fail', `Jahre ${years.join(', ')}`)
}

async function probeMarketBeat(sym) {
  const exch = sym === 'ASML' ? 'NASDAQ' : 'NASDAQ'
  const h = await fetch(`https://www.marketbeat.com/stocks/${exch}/${sym}/earnings/`, { headers: HDR }).then((r) => r.text())
  const fy = [...new Set([...h.matchAll(/FY\s*(20\d{2})/g)].map((m) => m[1]))].sort()
  log('MarketBeat', sym, 'partial', `FY ${fy.join(', ') || 'keine'}`)
}

async function probeEodhd(sym) {
  const key = process.env.EODHD_API_KEY
  if (!key) return log('EODHD', sym, 'fail', 'kein Key')
  const u = `https://eodhd.com/api/calendar/earnings?symbols=${sym}.US&api_token=${key}&from=2026-01-01`
  const j = await fetch(u).then((r) => r.json())
  log('EODHD', sym, 'fail', JSON.stringify(j).slice(0, 120))
}

async function probeStockAnalysisFinancials(sa) {
  // Manchmal mehr in /financials/ als /forecast/
  const h = await fetch(`https://stockanalysis.com/stocks/${sa}/financials/`, { headers: HDR }).then((r) => r.text())
  const fy = (h.match(/fiscalYear:\[([^\]]+)\]/)?.[1] ?? '').split(',').map((s) => s.replace(/"/g, ''))
  log('StockAnalysis /financials/', sa, 'partial', `Jahre ${fy.join(', ')}`)
}

// --- Main ---
console.log('\n=== FORECAST SOURCE AUDIT ===\n')
const auth = await yahooAuth()

for (const t of TICKERS) {
  console.log(`\n--- ${t.label} ---`)
  await probeStockAnalysis(t.sa)
  await probeStockAnalysisFinancials(t.sa)
  await probeMarketscreener(t.ms)
  await probeYahoo(auth, t.yahoo)
  await probeFinnhub(t.yahoo)
  await probeSeekingAlpha(t.seeking)
  await probeInvesting(t.inv)
  await probeZacks(t.yahoo)
  await probeTipRanks(t.yahoo)
  await probeFinviz(t.yahoo)
  await probeMacrotrends(t.yahoo)
  await probeTradingView(t.yahoo)
  await probeSimplyWallSt(t.yahoo)
  await probeFMP(t.yahoo)
  await probeAlphaVantage(t.yahoo)
  await probeNasdaq(t.yahoo)
  await probeBarchart(t.yahoo)
  await probeMarketBeat(t.yahoo)
  if (t.label === 'GOOGL') await probeWallstreet('alphabet-aktie')
  if (t.label === 'ASML') await probeWallstreet('asml-aktie')
}

// Zusammenfassung
const with2028 = results.filter((r) => r.detail?.includes('2028') && r.status === 'ok')
const partialMulti = results.filter((r) => r.status === 'ok' || (r.status === 'partial' && /2027|2028/.test(r.detail)))

console.log('\n=== ZUSAMMENFASSUNG ===')
console.log(`Quellen mit FY2028 (ok): ${with2028.length}`)
for (const r of results.filter((x) => x.status === 'ok')) console.log(`  OK: ${r.source} / ${r.ticker}`)

writeFileSync('tmp-forecast-audit.json', JSON.stringify(results, null, 2))
console.log('\nDetails: tmp-forecast-audit.json')
