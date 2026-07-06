import { extrahiereAlleDetailBloeckeAus10kHtml } from '../lib/portfolio-analyse/sec-edgar-detail-extraktion.ts'

const UA = 'Omnia test@example.com'

async function secFetch(url) {
  return fetch(url, { headers: { 'User-Agent': UA }, cache: 'no-store' })
}

async function html() {
  const tickers = await (await secFetch('https://www.sec.gov/files/company_tickers.json')).json()
  let cik
  for (const row of Object.values(tickers)) if (row.ticker === 'GOOGL') cik = row.cik_str
  const sub = await (await secFetch(`https://data.sec.gov/submissions/CIK${String(cik).padStart(10, '0')}.json`)).json()
  const f = sub.filings.recent
  let acc, doc
  for (let i = 0; i < f.form.length; i++) if (f.form[i] === '10-K') { acc = f.accessionNumber[i]; doc = f.primaryDocument[i]; break }
  const accPath = acc.replace(/-/g, '')
  const idxRes = await secFetch(`https://www.sec.gov/Archives/edgar/data/${cik}/${accPath}/${acc}-index.json`)
  let pick = doc
  if (idxRes.ok) {
    const items = (await idxRes.json()).directory?.item ?? []
    const sorted = items.filter(i => /\.htm/i.test(i.name) && !/index/i.test(i.name)).sort((a, b) => parseInt(b.size || 0) - parseInt(a.size || 0))
    if (sorted[0]?.name) pick = sorted[0].name
  }
  return await (await secFetch(`https://www.sec.gov/Archives/edgar/data/${cik}/${accPath}/${pick}`)).text()
}

const h = await html()
const d = extrahiereAlleDetailBloeckeAus10kHtml(h)
for (const k of d) {
  console.log(`\n${k.def.id} (${k.def.titel}): ${k.jahre.length}J [${k.jahre.map(j => j.jahr).join(', ')}]`)
  const last = k.jahre[k.jahre.length - 1]
  if (last) {
    for (const s of last.segmente) console.log(`  ${s.name}: ${s.umsatzMio} Mio (${s.anteilPct}%)`)
  }
}
