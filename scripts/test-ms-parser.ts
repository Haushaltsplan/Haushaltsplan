/** npx tsx scripts/test-ms-parser.ts */
import {
  extrahiereMsSegmentHistorien,
  htmlHatMsSegmentDaten,
  parseMsChart,
} from '../lib/portfolio-analyse/marketscreener-segment-parser'

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

const SLUGS = [
  ['Alphabet', 'ALPHABET-INC-24203373'],
  ['Microsoft', 'MICROSOFT-CORPORATION-4835'],
  ['ASML', 'ASML-HOLDING-N-V-12002973'],
  ['Mastercard', 'MASTERCARD-INC-17163'],
] as const

async function test(slug: string, label: string) {
  const html = await (
    await fetch(`https://www.marketscreener.com/quote/stock/${slug}/finances-segments/`, {
      headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9' },
    })
  ).text()
  const chart = parseMsChart(html, 'financialSegmentCA1')
  const hist = extrahiereMsSegmentHistorien(html)
  const ok = htmlHatMsSegmentDaten(html)
  console.log(
    `${ok ? 'OK' : 'FAIL'} ${label.padEnd(10)} chart=${chart ? chart.segmente.length + 'seg' : 'null'} ` +
      `produkt=${hist.produkt?.anzahlJahre ?? 0}J geo=${hist.geo?.anzahlJahre ?? 0}J`,
  )
  return ok
}

async function main() {
  let ok = 0
  for (const [label, slug] of SLUGS) {
    if (await test(slug, label)) ok++
    await new Promise((r) => setTimeout(r, 400))
  }
  console.log(`\n${ok}/${SLUGS.length} OK`)
  process.exit(ok === SLUGS.length ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
