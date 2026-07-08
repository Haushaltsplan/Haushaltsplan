/** npx tsx scripts/test-ms-backlog-parser.ts */
import { extrahiereMsBacklogAusFinancesHtml } from '../lib/portfolio-analyse/marketscreener-backlog-parser'
import { parseMsChart } from '../lib/portfolio-analyse/marketscreener-segment-parser'

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

async function main() {
  for (const slug of ['SERVICENOW-INC-10912979', 'MICROSOFT-CORPORATION-4835']) {
    for (const sub of ['finances-segments/', 'finances/']) {
      const html = await fetch(`https://www.marketscreener.com/quote/stock/${slug}/${sub}`, {
        headers: { 'User-Agent': UA, Referer: 'https://www.marketscreener.com/' },
      }).then((r) => r.text())
      const ids = [...html.matchAll(/id="(financialDataChart-[^"]+)"/g)].map((m) => m[1]!)
      const bl = extrahiereMsBacklogAusFinancesHtml(html)
      console.log(slug, sub, 'charts', ids.length, 'backlog', bl ? bl.anzahlJahre + 'J' : 'null')
    }
  }
}

main()
