import { extrahiereAlleDetailBloeckeAus10kHtml } from '../lib/portfolio-analyse/sec-edgar-detail-extraktion'
import { entdeckeSegmentTextBlockTags, extrahiereDynamischeSegmentBloecke } from '../lib/portfolio-analyse/sec-edgar-dynamic-blocks'

const UA = process.env.SEC_EDGAR_USER_AGENT || 'Omnia Haushalt test@example.com'
const sym = process.argv[2] ?? 'MCD'

async function secFetch(url: string) {
  return fetch(url, { headers: { 'User-Agent': UA }, cache: 'no-store' })
}

async function main() {
  const tickers = await (await secFetch('https://www.sec.gov/files/company_tickers.json')).json()
  let cik: number | undefined
  for (const row of Object.values(tickers) as { ticker: string; cik_str: number }[]) {
    if (row.ticker === sym.toUpperCase()) cik = row.cik_str
  }
  const sub = await (await secFetch(`https://data.sec.gov/submissions/CIK${String(cik).padStart(10, '0')}.json`)).json()
  const f = sub.filings.recent
  let acc = ''
  let doc = ''
  for (let i = 0; i < f.form.length; i++) {
    if (f.form[i] !== '10-K') continue
    acc = f.accessionNumber[i]
    doc = f.primaryDocument[i]
    break
  }
  const accPath = acc.replace(/-/g, '')
  let pick = doc
  try {
    const idxRes = await secFetch(`https://www.sec.gov/Archives/edgar/data/${cik}/${accPath}/${acc}-index.json`)
    if (idxRes.ok) {
      const idx = await idxRes.json()
      const items = idx.directory?.item ?? []
      const sorted = items
        .filter((i: { name: string }) => /\.htm/i.test(i.name) && !/index/i.test(i.name))
        .sort((a: { size: string }, b: { size: string }) => parseInt(b.size || '0') - parseInt(a.size || '0'))
      if (sorted[0]?.name) pick = sorted[0].name
    }
  } catch { /* index optional */ }

  const html = await (await secFetch(`https://www.sec.gov/Archives/edgar/data/${cik}/${accPath}/${pick}`)).text()
  console.log(sym, 'html', html.length, 'doc', pick)

  const discovered = entdeckeSegmentTextBlockTags(html)
  console.log('discovered tags:', discovered)

  const dyn = extrahiereDynamischeSegmentBloecke(html)
  for (const k of dyn) {
    const j = k.jahre.map((x) => x.jahr).sort((a, b) => a - b)
    console.log(`  ${k.def.id}: ${j.length}J [${j.join(', ')}]`)
  }

  const all = extrahiereAlleDetailBloeckeAus10kHtml(html)
  console.log('combined blocks:', all.length)
  for (const k of all) {
    const j = k.jahre.map((x) => x.jahr).sort((a, b) => a - b)
    console.log(`  ${k.def.id}: ${j.length}J max=${j[j.length - 1]}`)
  }
}

main().catch(console.error)
