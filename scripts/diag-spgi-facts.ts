import { cikFuerTicker } from '../lib/portfolio-analyse/sec-edgar-common-server'
import { ladeCompanyFactsJson } from '../lib/portfolio-analyse/sec-edgar-companyfacts-server'
import { ladeSecSegmentHistorie } from '../lib/portfolio-analyse/sec-edgar-segment-historie-server'
import { extrahiereAlleDetailBloeckeAus10kHtml } from '../lib/portfolio-analyse/sec-edgar-detail-extraktion'
import { cikFuerTicker as cik2, padCik, secFetch } from '../lib/portfolio-analyse/sec-edgar-common-server'
import { leseAlsJson } from '../lib/http/safe-json-response'
import { ladeLesbarenBerichtText } from '../lib/portfolio-analyse/sec-edgar-bericht-text-server'

async function main() {
  const cik = (await cikFuerTicker('SPGI'))!
  const facts = await ladeCompanyFactsJson(cik)
  const gaap = facts?.facts?.['us-gaap'] ?? {}
  const keys = Object.keys(gaap).filter(k => /OperatingIncome|Segment|Profit/i.test(k))
  console.log('fact keys sample', keys.slice(0,40))
  // Look for dimensional data
  for (const k of ['OperatingIncomeLoss', 'GrossProfit', 'RevenueFromContractWithCustomerExcludingAssessedTax']) {
    const u = gaap[k]?.units
    if (!u) { console.log(k, 'none'); continue }
    const usd = u.USD ?? []
    const withSeg = usd.filter((x: any) => x.segment).slice(0,5)
    console.log(k, 'total', usd.length, 'withSeg', usd.filter((x:any)=>x.segment).length, 'sample', JSON.stringify(withSeg[0]))
  }

  // How does SPGI get revenue segments today?
  const sub = await leseAlsJson<any>(await secFetch('https://data.sec.gov/submissions/CIK' + padCik(cik) + '.json'))
  const r = sub.filings.recent
  let accession='', primaryDocument=''
  for (let i=0;i<r.form.length;i++) if (r.form[i]==='10-K') { accession=r.accessionNumber[i]; primaryDocument=r.primaryDocument[i]; break }
  const g = await ladeLesbarenBerichtText(cik, accession, '10-K', primaryDocument)
  const details = extrahiereAlleDetailBloeckeAus10kHtml(g!.text)
  console.log('detail blocks', details.map(d => d.def.id + ' jahre=' + d.jahre.length + ' segs=' + (d.jahre[0]?.segmente?.map((s:any)=>s.name).join(',')??'')))
}
main()
