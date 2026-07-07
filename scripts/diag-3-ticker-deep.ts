/**
 * Deep diag for ODFL, UNP, KNSL
 * npx tsx scripts/diag-3-ticker-deep.ts
 */
import {
  extrahiereAlleDetailBloeckeAus10kHtml,
  mergeDetailInMap,
} from '../lib/portfolio-analyse/sec-edgar-detail-extraktion.ts'
import {
  extrahiereBeideSegmentartenAus10kHtml,
  extrahiereErstenGeoBlock,
  extrahiereSegmentHistorieAus10kHtml,
  extrahiereSegmenteFuerJahr,
  parseGeoSegmente,
  teileUmsatzDetailInProduktUndGeo,
  validiereSegmente,
} from '../lib/portfolio-analyse/sec-edgar-segment-extraktion.ts'

const UA = process.env.SEC_EDGAR_USER_AGENT || 'Omnia Haushalt test@example.com'
const CIKS: Record<string, string> = {
  ODFL: '0000878927',
  UNP: '0000100885',
  KNSL: '0001669162',
}

async function secFetch(url: string, retries = 3): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    await new Promise((r) => setTimeout(r, 600 + i * 400))
    const res = await fetch(url, { headers: { 'User-Agent': UA }, cache: 'no-store' })
    const ct = res.headers.get('content-type') ?? ''
    if (res.ok && !ct.includes('xml')) return res
    if (i < retries - 1) await new Promise((r) => setTimeout(r, 2000))
  }
  throw new Error(`SEC fetch failed: ${url}`)
}

async function cik(sym: string) {
  if (CIKS[sym]) return parseInt(CIKS[sym], 10)
  const tickers = await (await secFetch('https://www.sec.gov/files/company_tickers.json')).json()
  for (const r of Object.values(tickers) as { ticker: string; cik_str: number }[]) {
    if (r.ticker === sym) return r.cik_str
  }
  return null
}

async function pickHtml(cik: number, acc: string, primary: string) {
  const accPath = acc.replace(/-/g, '')
  const base = `https://www.sec.gov/Archives/edgar/data/${cik}/${accPath}/`
  let pick = primary
  const idx = await (await secFetch(`${base}${acc}-index.json`)).json()
  const sorted = (idx.directory?.item ?? [])
    .filter((i: { name: string }) => /\.htm/i.test(i.name) && !/index/i.test(i.name))
    .sort((a: { size: string }, b: { size: string }) => parseInt(b.size || '0') - parseInt(a.size || '0'))
  if (sorted[0]?.name) pick = sorted[0].name
  return { html: await (await secFetch(`${base}${pick}`)).text(), pick }
}

async function diag(sym: string) {
  const c = await cik(sym)
  if (!c) return
  const sub = await (await secFetch(`https://data.sec.gov/submissions/CIK${String(c).padStart(10, '0')}.json`)).json()
  const f = sub.filings.recent
  let acc = ''
  let doc = ''
  let report = ''
  for (let i = 0; i < f.form.length; i++) {
    if (f.form[i] !== '10-K') continue
    acc = f.accessionNumber[i]
    doc = f.primaryDocument[i]
    report = f.reportDate?.[i]?.slice(0, 4) ?? ''
    break
  }
  const { html, pick } = await pickHtml(c, acc, doc)
  console.log(`\n======== ${sym} report=${report} html=${html.length} file=${pick} ========`)

  const blocks = extrahiereAlleDetailBloeckeAus10kHtml(html)
  for (const b of blocks) {
    const ys = b.jahre.map((j) => j.jahr).join(',')
    const names = b.jahre[0]?.segmente?.map((s) => s.name).slice(0, 5).join(' | ') ?? ''
    console.log(`  block ${b.def.id} (${b.def.tag.slice(0, 50)}…) ${b.jahre.length}J [${ys}] → ${names}`)
  }

  const hist = extrahiereSegmentHistorieAus10kHtml(html)
  console.log(`  hist produkt: ${hist.produkt?.jahre.length ?? 0}J  geo: ${hist.geo?.jahre.length ?? 0}J`)

  const beide = extrahiereBeideSegmentartenAus10kHtml(html)
  console.log(`  beide produkt: ${beide.produkt.segmente.length} [${beide.produkt.segmente.map((s) => s.name).join(', ')}]`)
  console.log(`  beide geo: ${beide.geo.segmente.length} [${beide.geo.segmente.map((s) => s.name).join(', ')}]`)

  const geoBlock = extrahiereErstenGeoBlock(html)
  console.log(`  geoBlock len=${geoBlock.length}`)
  if (geoBlock.length > 100) {
    const geo = validiereSegmente(parseGeoSegmente(geoBlock, true))
    console.log(`  geoBlock parse: ${geo.length} [${geo.map((s) => s.name).join(', ')}]`)
  }

  const jahr = parseInt(report, 10)
  if (jahr > 2000) {
    const einzel = extrahiereSegmenteFuerJahr(html, jahr)
    console.log(`  einzel produkt: ${einzel.produkt.length} geo: ${einzel.geo.length}`)
  }

  const disagg = blocks.find((b) => b.def.id === 'umsatz_detail')
  if (disagg) {
    const split = teileUmsatzDetailInProduktUndGeo(disagg.jahre)
    console.log(`  disagg split produkt: ${split.produkt.length}J geo: ${split.geo.length}J`)
    if (split.produkt[0]) console.log(`    prod names: ${split.produkt[0].segmente.map((s) => s.name).join(', ')}`)
    if (split.geo[0]) console.log(`    geo names: ${split.geo[0].segmente.map((s) => s.name).join(', ')}`)
  }

  // search keywords in html
  for (const kw of ['geographic', 'Geographical', 'RevenueFromExternal', 'Disaggregation', 'Segment', 'commodity', 'premium']) {
    const idx = html.toLowerCase().indexOf(kw.toLowerCase())
    if (idx >= 0) console.log(`  keyword "${kw}" at ${idx}`)
  }
}

async function main() {
  for (const s of Object.keys(CIKS)) await diag(s)
}

main().catch(console.error)
