/** npx tsx scripts/probe-all-sources.ts */
import { extrahiereMsSegmentHistorien, htmlHatMsSegmentDaten, parseMsChart } from '../lib/portfolio-analyse/marketscreener-segment-parser'
import { bekannterMarketscreenerSlug } from '../lib/portfolio-analyse/marketscreener-slug'

const UA =
  'Mozilla/5.0 (Windows NT .0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
const HDR = { 'User-Agent': UA, Referer: 'https://www.marketscreener.com/', 'Accept-Language': 'en-US,en;q=0.9' }

async function get(url: string) {
  const r = await fetch(url, { headers: HDR, redirect: 'follow' })
  return { status: r.status, html: await r.text() }
}

function msBacklogFromTables(html: string) {
  const hits: string[] = []
  for (const m of html.matchAll(/>([^<]{0,100}(?:backlog|order book|RPO|remaining performance|deferred revenue|bookings)[^<]{0,100})</gi)) {
    hits.push(m[1]!.replace(/\s+/g, ' ').trim())
  }
  return [...new Set(hits)].slice(0, 15)
}

async function probeMs(isin: string, name: string) {
  const slug = bekannterMarketscreenerSlug(isin)
  if (!slug) return console.log('MS', name, 'no slug')
  const { status, html } = await get(`https://www.marketscreener.com/quote/stock/${slug}/finances-segments/`)
  const hist = extrahiereMsSegmentHistorien(html)
  console.log(
    'MS',
    name,
    'status',
    status,
    'len',
    html.length,
    'ok',
    htmlHatMsSegmentDaten(html),
    `p=${hist.produkt?.anzahlJahre ?? 0}J`,
    `g=${hist.geo?.anzahlJahre ?? 0}J`,
    'backlog-text',
    msBacklogFromTables(html).slice(0, 3),
  )
  // scan all data-fct-attr keys for backlog
  for (const m of html.matchAll(/data-fct-attr="(\{&quot;.*?&quot;\})"/gs)) {
    const raw = m[1]!.replace(/&quot;/g, '"').replace(/&amp;/g, '&')
    if (/backlog|order book|rpo|deferred|remaining performance|bookings/i.test(raw)) {
      console.log('  attr-hit:', raw.slice(0, 180))
    }
  }
}

async function probeMacrotrends(ticker: string, slug: string) {
  const urls = [
    `https://www.macrotrends.net/stocks/charts/${ticker}/${slug}/revenue-by-segment`,
    `https://www.macrotrends.net/stocks/charts/${ticker}/${slug}/revenue-by-geography`,
    `https://www.macrotrends.net/stocks/charts/${ticker}/${slug}/backlog`,
    `https://www.macrotrends.net/stocks/charts/${ticker}/${slug}/total-backlog`,
  ]
  for (const url of urls) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' })
      const html = await r.text()
      const hasTable = html.includes('historical-data') || html.includes('original_data')
      console.log('MT', ticker, url.split('/').pop(), r.status, html.length, hasTable ? 'DATA' : 'no')
    } catch (e) {
      console.log('MT fail', url)
    }
  }
}

async function probeStockAnalysis(ticker: string) {
  const url = `https://stockanalysis.com/stocks/${ticker.toLowerCase()}/statistics/`
  const r = await fetch(url, { headers: { 'User-Agent': UA } })
  const html = await r.text()
  console.log('SA', ticker, r.status, html.length, /backlog|deferred revenue/i.test(html))
}

async function main() {
  await probeMs('US5949181045', 'Microsoft')
  await probeMs('US81762P1021', 'ServiceNow')
  await probeMs('NL0010273215', 'ASML')
  await probeMacrotrends('MSFT', 'microsoft')
  await probeMacrotrends('NOW', 'servicenow')
  await probeStockAnalysis('NOW')
  await probeStockAnalysis('MSFT')
}

main()
