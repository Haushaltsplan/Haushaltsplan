/** npx tsx scripts/diag-unh-geo-facts.ts */
import { extrahiereIxbrlTextBlock } from '../lib/portfolio-analyse/sec-edgar-segment-extraktion.ts'

const UA = process.env.SEC_EDGAR_USER_AGENT || 'test@example.com'

async function main() {
  const cik = 731766
  const sub = await (await fetch(`https://data.sec.gov/submissions/CIK0000731766.json`, { headers: { 'User-Agent': UA } })).json()
  const f = sub.filings.recent
  let acc = ''
  let doc = ''
  for (let i = 0; i < f.form.length; i++) {
    if (f.form[i] === '10-K') {
      acc = f.accessionNumber[i]
      doc = f.primaryDocument[i]
      break
    }
  }
  const html = await (await fetch(`https://www.sec.gov/Archives/edgar/data/${cik}/${acc.replace(/-/g, '')}/${doc}`, { headers: { 'User-Agent': UA } })).text()

  const tags = [...html.matchAll(/name="(?:[a-zA-Z0-9_-]+:)?([A-Za-z0-9]+TableTextBlock)"/gi)].map((m) => m[1]!)
  const geoTags = [...new Set(tags.filter((t) => /geograph|revenue|segment/i.test(t)))]
  console.log('tags', geoTags.filter((t) => /geograph/i.test(t)))

  for (const t of geoTags) {
    const b = extrahiereIxbrlTextBlock(html, t)
    if (b.length < 100) continue
    const plain = b.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
    if (/united states|foreign|international|domestic/i.test(plain) && /revenue|premium/i.test(plain)) {
      console.log('\n', t, 'len', b.length)
      console.log(plain.slice(0, 350))
    }
  }

  const seg = extrahiereIxbrlTextBlock(html, 'SegmentReportingDisclosureTextBlock')
  const plain = seg.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
  const i = plain.search(/united states|foreign|international/i)
  console.log('\nsegment disclosure geo snippet:', plain.slice(Math.max(0, i - 50), i + 300))
}

main().catch(console.error)
