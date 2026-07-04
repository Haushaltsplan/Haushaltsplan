/**
 * Test SEC Segment-Extraktion gegen Live-10-K
 * npx tsx scripts/test-sec-segmente.ts [TICKER...]
 */
import { extrahiereSegmenteAus10kHtml } from '@/lib/portfolio-analyse/sec-edgar-segment-extraktion'

const UA = process.env.SEC_EDGAR_USER_AGENT || 'Omnia Haushalt test@example.com'
const TICKERS = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ['MSFT', 'NOW', 'MA', 'GOOGL', 'V', 'UNH', 'MCD', 'HD', 'WMT', 'WM', 'UNP', 'ROL', 'MSCI', 'RMD', 'ZTS', 'DDOG', 'ODFL', 'CTAS', 'LIN', 'SPGI', 'TMO']

async function secFetch(url: string) {
  return fetch(url, { headers: { 'User-Agent': UA, Accept: '*/*' }, cache: 'no-store' })
}

async function lade10kHtml(sym: string): Promise<string | null> {
  const tickers = await (await secFetch('https://www.sec.gov/files/company_tickers.json')).json()
  let cik: number | undefined
  for (const row of Object.values(tickers) as { ticker: string; cik_str: number }[]) {
    if (row.ticker === sym.toUpperCase()) cik = row.cik_str
  }
  if (!cik) return null

  const sub = await (
    await secFetch(`https://data.sec.gov/submissions/CIK${String(cik).padStart(10, '0')}.json`)
  ).json()
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
  const accPath = acc.replace(/-/g, '')
  let pick = doc
  const idxRes = await secFetch(`https://www.sec.gov/Archives/edgar/data/${cik}/${accPath}/${acc}-index.json`)
  if (idxRes.ok) {
    try {
      const items = (await idxRes.json()).directory?.item ?? []
      const sorted = items
        .filter(
          (i: { name: string }) =>
            /\.(htm|html)$/i.test(i.name) &&
            !/-index\.htm/i.test(i.name) &&
            !/\.xsd|_cal|_def|_lab|_pre|filingsummary/i.test(i.name),
        )
        .sort(
          (a: { size: string }, b: { size: string }) =>
            parseInt(String(b.size || 0).replace(/,/g, '')) - parseInt(String(a.size || 0).replace(/,/g, '')),
        )
      if (sorted[0]?.name) pick = sorted[0].name
    } catch {
      /* index.htm fallback */
    }
  }
  const url = `https://www.sec.gov/Archives/edgar/data/${cik}/${accPath}/${pick}`
  const res = await secFetch(url)
  if (!res.ok) return null
  return res.text()
}

async function main() {
  let ok = 0
  let fail = 0
  for (const sym of TICKERS) {
    const html = await lade10kHtml(sym)
    if (!html) {
      console.log(`\n${sym}: KEIN 10-K`)
      fail++
      continue
    }
    const r = extrahiereSegmenteAus10kHtml(html)
    const status = r.segmente.length >= 2 ? 'OK' : 'FAIL'
    if (status === 'OK') ok++
    else fail++
    console.log(`\n${sym}: ${status} | ${r.art ?? '-'} | ${r.quelle ?? '-'}`)
    for (const s of r.segmente) {
      console.log(`  - ${s.name}: ${s.umsatzMio} Mio. (${s.anteilPct}%)`)
    }
  }
  console.log(`\n=== ${ok}/${TICKERS.length} mit Segmenten ===`)
  process.exit(fail > TICKERS.length / 2 ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
