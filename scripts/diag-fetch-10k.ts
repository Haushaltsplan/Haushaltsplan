/**
 * Fetch latest 10-K HTML for one ticker (saves locally for offline analysis)
 * npx tsx scripts/diag-fetch-10k.ts ODFL
 */
import { writeFileSync } from 'fs'

const UA = process.env.SEC_EDGAR_USER_AGENT || 'Omnia Haushalt diag/1.0 (contact@example.com)'
const CIKS: Record<string, string> = {
  ODFL: '0000878927',
  UNP: '0000100885',
  KNSL: '0001669162',
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms))
}

async function secFetch(url: string) {
  await sleep(1200)
  const res = await fetch(url, { headers: { 'User-Agent': UA }, cache: 'no-store' })
  if (!res.ok) throw new Error(`${res.status} ${url}`)
  return res
}

async function main() {
  const sym = (process.argv[2] ?? 'ODFL').toUpperCase()
  const cik = parseInt(CIKS[sym] ?? '', 10)
  if (!cik) throw new Error('unknown sym')

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
  const base = `https://www.sec.gov/Archives/edgar/data/${cik}/${accPath}/`

  let pick = doc
  try {
    const idx = await (await secFetch(`${base}${acc}-index.json`)).json()
    const sorted = (idx.directory?.item ?? [])
      .filter((i: { name: string }) => /\.htm/i.test(i.name) && !/index/i.test(i.name))
      .sort((a: { size: string }, b: { size: string }) => parseInt(b.size || '0') - parseInt(a.size || '0'))
    if (sorted[0]?.name) pick = sorted[0].name
  } catch {
    console.log('index.json failed, using primary', doc)
  }

  const html = await (await secFetch(`${base}${pick}`)).text()
  const out = `scripts/.cache-${sym}.html`
  writeFileSync(out, html)
  console.log(sym, 'saved', out, 'len', html.length, 'file', pick, 'acc', acc)
}

main().catch(console.error)
