import { cikFuerTicker, padCik, secFetch } from '../lib/portfolio-analyse/sec-edgar-common-server'
import { leseAlsJson } from '../lib/http/safe-json-response'
import { ladeLesbarenBerichtText } from '../lib/portfolio-analyse/sec-edgar-bericht-text-server'

async function main() {
  const cik = await cikFuerTicker('SPGI')!
  const subRes = await secFetch('https://data.sec.gov/submissions/CIK' + padCik((await cikFuerTicker('SPGI'))!) + '.json')
  const sub = await leseAlsJson<any>(subRes)
  const r = sub.filings.recent
  let accession='', primaryDocument=''
  for (let i=0;i<r.form.length;i++) if (r.form[i]==='10-K') { accession=r.accessionNumber[i]; primaryDocument=r.primaryDocument[i]; break }
  const g = await ladeLesbarenBerichtText((await cikFuerTicker('SPGI'))!, accession, '10-K', primaryDocument)
  const t = g!.text
  const idx = t.toLowerCase().indexOf('segment operating profit')
  // find table around ratings / market intelligence with operating profit
  const idx2 = t.toLowerCase().indexOf('market intelligence')
  console.log('MI idx', idx2)
  // show a chunk with years and numbers near Segment operating profit table
  const re = /Segment operating profit[\s\S]{0,2500}/i
  const m = t.match(re)
  console.log(m?.[0]?.replace(/\s+/g,' ').slice(0,1200))
}
main()
