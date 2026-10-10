import { cikFuerTicker, padCik, secFetch } from '../lib/portfolio-analyse/sec-edgar-common-server'
import { leseAlsJson } from '../lib/http/safe-json-response'

async function main() {
  const cik = (await cikFuerTicker('SPGI'))!
  const sub = await leseAlsJson<any>(await secFetch('https://data.sec.gov/submissions/CIK' + padCik(cik) + '.json'))
  const r = sub.filings.recent
  let accession=''
  for (let i=0;i<r.form.length;i++) if (r.form[i]==='10-K') { accession=r.accessionNumber[i]; break }
  const acc = accession.replace(/-/g,'')
  const idxUrl = 'https://www.sec.gov/Archives/edgar/data/'+cik+'/'+acc+'/index.json'
  const idx = await leseAlsJson<any>(await secFetch(idxUrl))
  const items = idx?.directory?.item ?? []
  for (const it of items) {
    const n = String(it.name||'')
    if (/\.(htm|html|xml)$/i.test(n) && !/xsl|xsd|pre|cal|def|lab|R\d/i.test(n)) {
      console.log(n, it.size)
    }
  }
}
main()
