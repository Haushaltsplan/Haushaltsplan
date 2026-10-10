import { cikFuerTicker, padCik, secFetch } from '../lib/portfolio-analyse/sec-edgar-common-server'
import { leseAlsJson } from '../lib/http/safe-json-response'

async function main() {
  const cik = (await cikFuerTicker('SPGI'))!
  const sub = await leseAlsJson<any>(await secFetch('https://data.sec.gov/submissions/CIK' + padCik(cik) + '.json'))
  const r = sub.filings.recent
  let accession='', primaryDocument=''
  for (let i=0;i<r.form.length;i++) if (r.form[i]==='10-K') { accession=r.accessionNumber[i]; primaryDocument=r.primaryDocument[i]; break }
  const acc = accession.replace(/-/g,'')
  const text = await (await secFetch('https://www.sec.gov/Archives/edgar/data/'+cik+'/'+acc+'/'+primaryDocument)).text()
  const re = /<table[\s\S]*?<\/table>/gi
  let m, n=0
  while ((m = re.exec(text))) {
    const tab = m[0]
    const p = tab.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ')
    if (!/Market Intelligence/i.test(p) || !/Ratings/i.test(p)) continue
    if (!/operating profit/i.test(p)) continue
    n++
    console.log('==== TABLE', n, 'len', tab.length)
    // extract rows roughly
    const rows = tab.split(/<\/tr>/i)
    for (const row of rows) {
      const cells = row.replace(/<script[\s\S]*?<\/script>/gi,'').replace(/<style[\s\S]*?<\/style>/gi,'')
        .split(/<\/t[dh]>/i).map(c => c.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim()).filter(Boolean)
      if (cells.length < 2) continue
      if (/operating|revenue|income|profit|market intelligence|total/i.test(cells[0]) || cells.length>=5) {
        console.log(cells.slice(0,8).join(' || '))
      }
    }
    if (n>=2) break
  }
}
main()
