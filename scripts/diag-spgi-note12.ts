import { cikFuerTicker, padCik, secFetch } from '../lib/portfolio-analyse/sec-edgar-common-server'
import { leseAlsJson } from '../lib/http/safe-json-response'
import { ladeLesbarenBerichtText } from '../lib/portfolio-analyse/sec-edgar-bericht-text-server'

async function main() {
  const cik = (await cikFuerTicker('SPGI'))!
  const subRes = await secFetch('https://data.sec.gov/submissions/CIK' + padCik(cik) + '.json')
  const sub = await leseAlsJson<any>(subRes)
  const r = sub.filings.recent
  let accession='', primaryDocument=''
  for (let i=0;i<r.form.length;i++) if (r.form[i]==='10-K') { accession=r.accessionNumber[i]; primaryDocument=r.primaryDocument[i]; break }
  const g = await ladeLesbarenBerichtText(cik, accession, '10-K', primaryDocument)
  const t = g!.text
  // find Note 12 segment section
  const noteIdx = t.toLowerCase().indexOf('segment and geographic information')
  console.log('note idx', noteIdx)
  const chunk = t.slice(noteIdx, noteIdx + 25000)
  // list lines with Ratings and numbers
  const lines = chunk.split(/\n|<tr|<td|<th/i)
  let hits = 0
  for (const line of lines) {
    const s = line.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim()
    if (/Ratings|Market Intelligence|Operating profit|Revenue|Engineering/i.test(s) && /\d/.test(s) && s.length < 220) {
      console.log(s)
      hits++
      if (hits > 40) break
    }
  }
}
main()
