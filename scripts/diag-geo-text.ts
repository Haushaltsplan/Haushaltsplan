/** npx tsx scripts/diag-geo-text.ts CTAS UNH */
const UA = process.env.SEC_EDGAR_USER_AGENT || 'test@example.com'

async function scan(sym: string) {
  const tickers = await (await fetch('https://www.sec.gov/files/company_tickers.json', { headers: { 'User-Agent': UA } })).json()
  let cik = 0
  for (const r of Object.values(tickers) as { ticker: string; cik_str: number }[]) {
    if (r.ticker === sym.toUpperCase()) cik = r.cik_str
  }
  const sub = await (await fetch(`https://data.sec.gov/submissions/CIK${String(cik).padStart(10, '0')}.json`, { headers: { 'User-Agent': UA } })).json()
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
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')

  const hits = [
    ...text.matchAll(/(?:over|more than|approximately|about)\s+(\d{1,3})\s*(?:%|percent)[^.]{0,100}(?:united states|u\.s\.|domestic)/gi),
    ...text.matchAll(/less\s+than\s+(\d{1,2})\s*(?:%|percent)[^.]{0,100}(?:foreign|international)/gi),
    ...text.matchAll(/(\d{1,3})\s*(?:%|percent)\s+of\s+(?:our\s+|its\s+)?(?:consolidated\s+)?revenu[e]?[^.]{0,80}(?:united states|u\.s\.|foreign|international)/gi),
    ...text.matchAll(/substantially all[^.]{0,80}revenu[e]?/gi),
  ]
  console.log('\n===', sym, '===')
  for (const h of hits.slice(0, 8)) console.log(' ', (h[0] ?? h).toString().slice(0, 160))
}

async function main() {
  for (const s of process.argv.slice(2).length ? process.argv.slice(2) : ['CTAS', 'UNH']) {
    await scan(s.toUpperCase())
  }
}
main().catch(console.error)
