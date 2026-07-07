import { extrahiereAlleDetailBloeckeAus10kHtml } from '../lib/portfolio-analyse/sec-edgar-detail-extraktion.ts'
import { mergeDetailInMap } from '../lib/portfolio-analyse/sec-edgar-detail-extraktion.ts'
import {
  extrahiereIxbrlTextBlock,
  parseMehrjahresSegmente,
  parseMehrjahresSegmenteDetail,
} from '../lib/portfolio-analyse/sec-edgar-segment-extraktion.ts'

const UA = process.env.SEC_EDGAR_USER_AGENT || 'Omnia Haushalt test@example.com'

async function secFetch(url: string) {
  await new Promise((r) => setTimeout(r, 350))
  return fetch(url, { headers: { 'User-Agent': UA }, cache: 'no-store' })
}

async function pickHtml(cik: number, acc: string, primary: string): Promise<string> {
  const accPath = acc.replace(/-/g, '')
  const base = `https://www.sec.gov/Archives/edgar/data/${cik}/${accPath}/`
  let pick = primary
  try {
    const idx = await (await secFetch(`${base}${acc}-index.json`)).json()
    const sorted = (idx.directory?.item ?? [])
      .filter((i: { name: string }) => /\.htm/i.test(i.name) && !/index/i.test(i.name))
      .sort((a: { size: string }, b: { size: string }) => parseInt(b.size || '0') - parseInt(a.size || '0'))
    if (sorted[0]?.name) pick = sorted[0].name
  } catch { /* */ }
  return await (await secFetch(`${base}${pick}`)).text()
}

async function main() {
  const sym = process.argv[2] ?? 'MA'
  const tickers = await (await secFetch('https://www.sec.gov/files/company_tickers.json')).json()
  let cik = 0
  for (const r of Object.values(tickers) as { ticker: string; cik_str: number }[]) {
    if (r.ticker === sym) cik = r.cik_str
  }

  const sub = await (await secFetch(`https://data.sec.gov/submissions/CIK${String(cik).padStart(10, '0')}.json`)).json()
  const f = sub.filings.recent
  const filings: { acc: string; doc: string; report: string }[] = []
  for (let i = 0; i < f.form.length && filings.length < 12; i++) {
    if (f.form[i] !== '10-K') continue
    filings.push({
      acc: f.accessionNumber[i],
      doc: f.primaryDocument[i],
      report: f.reportDate?.[i]?.slice(0, 4) ?? '?',
    })
  }

  console.log(sym, 'CIK', cik, '—', filings.length, '10-K\n')

  const kategorieMaps = new Map<string, Map<number, unknown[]>>()
  const kategorieMeta = new Map<string, Map<number, number>>()

  for (const fil of filings) {
    const html = await pickHtml(cik, fil.acc, fil.doc)
    const details = extrahiereAlleDetailBloeckeAus10kHtml(html)
    const reportJahr = parseInt(fil.report, 10) || 0
    for (const kat of details) {
      mergeDetailInMap(kategorieMaps as never, kat, reportJahr, kategorieMeta as never)
    }
    const ums = details.find((d) => d.def.id === 'umsatz_detail')
    console.log(
      `report ${fil.report} | disagg in filing: [${ums?.jahre.map((j) => j.jahr).join(', ') ?? '—'}]`,
    )
  }

  const merged = kategorieMaps.get('umsatz_detail')
  console.log('\nMerged disagg years:', merged ? [...merged.keys()].sort((a, b) => a - b).join(', ') : '—')
  console.log('Merged count:', merged?.size ?? 0)

  // Neuestes 10-K: alle Revenue-Tags
  const htmlNew = await pickHtml(cik, filings[0]!.acc, filings[0]!.doc)
  const tags = new Set<string>()
  for (const m of htmlNew.matchAll(/name="(?:[a-zA-Z0-9_-]+:)?([A-Za-z0-9]+TableTextBlock)"/gi)) {
    tags.add(m[1]!)
  }
  console.log('\nLatest 10-K revenue-related tags:')
  for (const t of [...tags].sort().filter((t) => /revenue|disaggregat|segment|product|service|customer/i.test(t))) {
    console.log(' ', t)
  }

  const block = extrahiereIxbrlTextBlock(htmlNew, 'DisaggregationOfRevenueTableTextBlock')
  console.log('\nDisagg block length:', block.length)
  console.log('block preview:', block.slice(0, 500).replace(/\s+/g, ' '))
  const idx = htmlNew.indexOf('DisaggregationOfRevenueTableTextBlock')
  if (idx >= 0) console.log('context:', htmlNew.slice(idx - 80, idx + 400).replace(/\s+/g, ' ').slice(0, 500))
  const det = parseMehrjahresSegmenteDetail(block, 'produkt', 'umsatz')
  const std = parseMehrjahresSegmente(block, 'produkt', 'umsatz')
  console.log('parse detail years:', det.map((j) => j.jahr).join(', '))
  console.log('parse std years:', std.map((j) => j.jahr).join(', '))
  if (det[0]) console.log('sample segments:', det[0].segmente.map((s) => s.name).join(' | '))
}

main().catch(console.error)
