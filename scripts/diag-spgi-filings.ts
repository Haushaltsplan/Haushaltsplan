import { cikFuerTicker, padCik, secFetch } from '../lib/portfolio-analyse/sec-edgar-common-server'
import { leseAlsJson } from '../lib/http/safe-json-response'
import { ladeLesbarenBerichtText } from '../lib/portfolio-analyse/sec-edgar-bericht-text-server'
import { extrahiereOperatingIncomeHistorieAus10kHtml, extrahiereSegmentHistorieAus10kHtml } from '../lib/portfolio-analyse/sec-edgar-segment-extraktion'

async function main() {
  const cik = (await cikFuerTicker('SPGI'))!
  const sub = await leseAlsJson<any>(await secFetch('https://data.sec.gov/submissions/CIK' + padCik(cik) + '.json'))
  const r = sub.filings.recent
  let count = 0
  for (let i=0;i<r.form.length && count<5;i++) {
    if (r.form[i] !== '10-K') continue
    const accession = r.accessionNumber[i]
    const primaryDocument = r.primaryDocument[i]
    const rd = r.reportDate[i]
    const g = await ladeLesbarenBerichtText(cik, accession, '10-K', primaryDocument)
    const t = g?.text ?? ''
    const tables = (t.match(/<table/gi)||[]).length
    const hist = extrahiereSegmentHistorieAus10kHtml(t)
    const oi = extrahiereOperatingIncomeHistorieAus10kHtml(t)
    console.log(rd, 'tables', tables, 'html', t.length, 'revYears', hist.produkt?.jahre?.map(j=>j.jahr).join(',') ?? '-', 'oiYears', oi.map(j=>j.jahr).join(',') || '-', 'oiSample', oi[0]?.segmente?.slice(0,3).map(s=>s.name+'='+s.operatingIncomeMio).join('|') ?? '')
    count++
  }
}
main()
