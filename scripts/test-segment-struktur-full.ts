/** npx tsx scripts/test-segment-struktur-full.ts */
import { extrahiereMsSegmentHistorien, htmlHatMsSegmentDaten } from '../lib/portfolio-analyse/marketscreener-segment-parser'
import { bekannterMarketscreenerSlug } from '../lib/portfolio-analyse/marketscreener-slug'
import { extrahiereMarketbeatBacklogAusHtml } from '../lib/portfolio-analyse/marketbeat-backlog-parser'
import { extrahiereStockanalysisBacklogAusHtml } from '../lib/portfolio-analyse/stockanalysis-backlog-parser'

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
const HDR = { 'User-Agent': UA, Referer: 'https://www.marketscreener.com/' }

const CASES = [
  { isin: 'US5949181045', name: 'Microsoft', ticker: 'MSFT' },
  { isin: 'US81762P1021', name: 'ServiceNow', ticker: 'NOW' },
  { isin: 'NL0010273215', name: 'ASML', ticker: 'ASML' },
  { isin: 'US0404132054', name: 'Arista Networks', ticker: 'ANET' },
] as const

async function main() {
  let ok = 0
  for (const c of CASES) {
    const slug = bekannterMarketscreenerSlug(c.isin)
    const msHtml = slug
      ? await fetch(`https://www.marketscreener.com/quote/stock/${slug}/finances-segments/`, { headers: HDR }).then(
          (r) => r.text(),
        )
      : ''
    const hist = msHtml ? extrahiereMsSegmentHistorien(msHtml) : { produkt: null, geo: null }
    const segOk = htmlHatMsSegmentDaten(msHtml)

    let mbBl = null as ReturnType<typeof extrahiereMarketbeatBacklogAusHtml>
    for (const ex of ['NASDAQ', 'NYSE'] as const) {
      const mbHtml = await fetch(`https://www.marketbeat.com/stocks/${ex}/${c.ticker}/financials/`, {
        headers: { 'User-Agent': UA },
      }).then((r) => r.text())
      mbBl = extrahiereMarketbeatBacklogAusHtml(mbHtml)
      if (mbBl) break
    }

    const saHtml = await fetch(`https://stockanalysis.com/stocks/${c.ticker.toLowerCase()}/metrics/`, {
      headers: { 'User-Agent': UA },
    }).then((r) => r.text())
    const saBl = extrahiereStockanalysisBacklogAusHtml(saHtml)

    const backlog = saBl ?? mbBl
    const line =
      `${segOk && (hist.produkt || hist.geo) ? 'OK' : 'FAIL'} ${c.name.padEnd(16)} ` +
      `seg p=${hist.produkt?.anzahlJahre ?? 0}J g=${hist.geo?.anzahlJahre ?? 0}J ` +
      `bl=${backlog ? backlog.anzahlJahre + 'J ' + backlog.quelleTag.slice(0, 40) : '—'}`
    console.log(line)
    if (segOk && (hist.produkt || hist.geo)) ok++
  }
  console.log(`\n${ok}/${CASES.length} Segmente OK`)
  process.exit(ok === CASES.length ? 0 : 1)
}

main()
