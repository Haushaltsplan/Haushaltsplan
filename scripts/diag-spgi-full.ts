import { cikFuerTicker, padCik, secFetch } from '../lib/portfolio-analyse/sec-edgar-common-server'
import { leseAlsJson } from '../lib/http/safe-json-response'

async function main() {
  const cik = (await cikFuerTicker('SPGI'))!
  const sub = await leseAlsJson<any>(await secFetch('https://data.sec.gov/submissions/CIK' + padCik(cik) + '.json'))
  const r = sub.filings.recent
  let accession='', primaryDocument=''
  for (let i=0;i<r.form.length;i++) if (r.form[i]==='10-K') { accession=r.accessionNumber[i]; primaryDocument=r.primaryDocument[i]; break }
  const acc = accession.replace(/-/g,'')
  const url = 'https://www.sec.gov/Archives/edgar/data/'+cik+'/'+acc+'/'+primaryDocument
  const res = await secFetch(url)
  const text = await res.text()
  console.log('full len', text.length)
  console.log('table count', (text.match(/<table/gi)||[]).length)
  const note = text.toLowerCase().indexOf('segment and geographic information')
  console.log('note idx', note)
  const op = text.toLowerCase().indexOf('segment operating profit')
  console.log('seg op profit idx', op)
  // find Market Intelligence in a table context near operating
  const slice = text.slice(Math.max(0, note), note + 80000)
  console.log('tables in note slice', (slice.match(/<table/gi)||[]).length)
  const plain = slice.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ')
  const m = plain.match(/Market Intelligence.{0,80}\d[\d,\.]{2,}.{0,200}Operating profit.{0,200}/i)
  console.log('sample', m?.[0]?.slice(0,400))
}
main()
