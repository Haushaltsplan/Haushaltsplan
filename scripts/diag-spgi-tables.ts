import { cikFuerTicker, padCik, secFetch } from '../lib/portfolio-analyse/sec-edgar-common-server'
import { leseAlsJson } from '../lib/http/safe-json-response'
import { ladeLesbarenBerichtText } from '../lib/portfolio-analyse/sec-edgar-bericht-text-server'
import { parseMehrjahresOperatingIncome, parseMehrjahresSegmente } from '../lib/portfolio-analyse/sec-edgar-segment-extraktion'

async function main() {
  const cik = (await cikFuerTicker('SPGI'))!
  const subRes = await secFetch('https://data.sec.gov/submissions/CIK' + padCik(cik) + '.json')
  const sub = await leseAlsJson<any>(subRes)
  const r = sub.filings.recent
  let accession='', primaryDocument=''
  for (let i=0;i<r.form.length;i++) if (r.form[i]==='10-K') { accession=r.accessionNumber[i]; primaryDocument=r.primaryDocument[i]; break }
  const g = await ladeLesbarenBerichtText(cik, accession, '10-K', primaryDocument)
  const t = g!.text

  // split by table tags and find ones mentioning Ratings + Operating
  const tables = t.split(/<table\b/i)
  console.log('tables', tables.length)
  let n = 0
  for (let i=1;i<tables.length;i++) {
    const tab = '<table' + tables[i].slice(0, tables[i].indexOf('</table>')+8)
    const plain = tab.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').toLowerCase()
    if (plain.includes('ratings') && (plain.includes('operating profit') || plain.includes('operating income')) && plain.includes('2024')) {
      n++
      console.log('--- TABLE', n, 'len', tab.length)
      console.log(plain.slice(0, 500))
      const oi = parseMehrjahresOperatingIncome(tab)
      const rev = parseMehrjahresSegmente(tab, 'produkt')
      console.log('oi', JSON.stringify(oi).slice(0,400))
      console.log('rev years', rev.map(j=>j.jahr+':'+j.segmente.length))
    }
  }
  console.log('matching tables', n)

  // Also try whole document for OI after expanding regex
  const idx = t.toLowerCase().indexOf('year ended december')
  console.log('year ended idx sample around ratings operating')
  const i2 = t.toLowerCase().indexOf('ratings')
  // find all 'ratings' near 'operating profit' within 2000 chars
  let pos = 0
  for (let k=0;k<8;k++) {
    const p = t.toLowerCase().indexOf('ratings', pos)
    if (p < 0) break
    const win = t.slice(Math.max(0,p-80), p+400).replace(/<[^>]+>/g,' ').replace(/\s+/g,' ')
    if (/operating/i.test(win)) console.log('WIN', k, win.slice(0,300))
    pos = p+7
  }
}
main()
