import { extrahiereIxbrlTextBlock } from '../lib/portfolio-analyse/sec-edgar-segment-extraktion.ts'

const UA = 'Omnia Haushalt test@example.com'

async function secFetch(url: string) {
  return fetch(url, { headers: { 'User-Agent': UA }, cache: 'no-store' })
}

async function ladeHtml(cik: number, acc: string, doc: string) {
  const accPath = acc.replace(/-/g, '')
  let pick = doc
  try {
    const idx = await (await secFetch(`https://www.sec.gov/Archives/edgar/data/${cik}/${accPath}/${acc}-index.json`)).json()
    const sorted = (idx.directory?.item ?? [])
      .filter((i: { name: string }) => /\.htm/i.test(i.name) && !/index/i.test(i.name))
      .sort((a: { size: string }, b: { size: string }) => parseInt(b.size || '0') - parseInt(a.size || '0'))
    if (sorted[0]?.name) pick = sorted[0].name
  } catch { /* optional */ }
  return await (await secFetch(`https://www.sec.gov/Archives/edgar/data/${cik}/${accPath}/${pick}`)).text()
}

const sym = process.argv[2] ?? 'UNH'
const tickers = await (await secFetch('https://www.sec.gov/files/company_tickers.json')).json()
let cik: number | undefined
for (const r of Object.values(tickers) as { ticker: string; cik_str: number }[]) {
  if (r.ticker === sym.toUpperCase()) cik = r.cik_str
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
const html = await ladeHtml(cik!, acc, doc)
const block = extrahiereIxbrlTextBlock(html, 'ScheduleOfSegmentReportingInformationBySegmentTextBlock')
const rows = [...block.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)]
let n = 0
for (const row of rows) {
  const text = row[1]!.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  if (/202[0-9]|revenue|optum|unitedhealth/i.test(text)) {
    console.log(text.slice(0, 220))
    if (++n >= 25) break
  }
}
