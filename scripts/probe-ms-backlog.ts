/** npx tsx scripts/probe-ms-backlog.ts */
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

const SLUGS = ['MICROSOFT-CORPORATION-4835', 'SERVICENOW-INC-10912979', 'ARISTA-NETWORKS-INC-16617752']

async function fetchHtml(path: string) {
  return fetch(`https://www.marketscreener.com/quote/stock/${path}`, {
    headers: {
      'User-Agent': UA,
      'Accept-Language': 'en-US,en;q=0.9',
      Referer: 'https://www.marketscreener.com/',
      Accept: 'text/html,application/xhtml+xml',
    },
  }).then((r) => r.text())
}

async function main() {
  for (const slug of SLUGS) {
    for (const sub of [`${slug}/finances-segments/`, `${slug}/finances/`]) {
      const html = await fetchHtml(sub)
      const low = html.toLowerCase()
      for (const term of ['backlog', 'order book', 'remaining performance', 'deferred revenue']) {
        const i = low.indexOf(term)
        if (i >= 0) {
          console.log('\n', sub, term, html.slice(i, i + 120).replace(/\s+/g, ' '))
        }
      }
      const chartIds = [...html.matchAll(/id="(financial[^"]+)"/g)].map((m) => m[1])
      console.log(sub, 'len', html.length, 'charts', [...new Set(chartIds)].slice(0, 15))
    }
  }
}

main()
