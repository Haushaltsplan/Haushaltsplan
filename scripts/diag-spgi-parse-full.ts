import { cikFuerTicker, padCik, secFetch } from '../lib/portfolio-analyse/sec-edgar-common-server'
import { leseAlsJson } from '../lib/http/safe-json-response'
import { parseMehrjahresOperatingIncome, parseMehrjahresSegmente, extrahiereOperatingIncomeHistorieAus10kHtml, extrahiereSegmentHistorieAus10kHtml } from '../lib/portfolio-analyse/sec-edgar-segment-extraktion'

async function main() {
  const cik = (await cikFuerTicker('SPGI'))!
  const sub = await leseAlsJson<any>(await secFetch('https://data.sec.gov/submissions/CIK' + padCik(cik) + '.json'))
  const r = sub.filings.recent
  let accession='', primaryDocument=''
  for (let i=0;i<r.form.length;i++) if (r.form[i]==='10-K') { accession=r.accessionNumber[i]; primaryDocument=r.primaryDocument[i]; break }
  const acc = accession.replace(/-/g,'')
  const url = 'https://www.sec.gov/Archives/edgar/data/'+cik+'/'+acc+'/'+primaryDocument
  const text = await (await secFetch(url)).text()

  // Take a window around segment operating profit
  const op = text.toLowerCase().indexOf('segment operating profit is defined')
  const win = text.slice(op - 5000, op + 80000)
  console.log('win tables', (win.match(/<table/gi)||[]).length, 'len', win.length)
  const plain = win.replace(/<[^>]+>/g,'|').replace(/\|+/g,'|')
  // show structure
  console.log(plain.slice(0,1500))

  // Try parsing a larger financial note chunk (from Note 12)
  const note = text.toLowerCase().indexOf('item 8')
  console.log('item8', note)
  // Search for Revenue followed by Market Intelligence in tables
  let found = 0
  const re = /<table[\s\S]*?<\/table>/gi
  let m
  while ((m = re.exec(text)) && found < 8) {
    const tab = m[0]
    const p = tab.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').toLowerCase()
    if (p.includes('market intelligence') && p.includes('ratings') && (p.includes('operating profit') || p.includes('revenue'))) {
      found++
      console.log('TABLE', found, 'len', tab.length, p.slice(0,300))
      const oi = parseMehrjahresOperatingIncome(tab)
      const rev = parseMehrjahresSegmente(tab, 'produkt')
      console.log('  oi', oi.map(j=>j.jahr+':'+j.segmente.map(s=>s.name+'='+s.operatingIncomeMio).join('|')))
      console.log('  rev', rev.map(j=>j.jahr+':'+j.segmente.map(s=>s.name+'='+s.umsatzMio).join('|')))
    }
  }
  console.log('found', found)

  // Full-doc parse without truncate
  const hist = extrahiereSegmentHistorieAus10kHtml(text)
  const oiAll = extrahiereOperatingIncomeHistorieAus10kHtml(text)
  console.log('full hist', hist.produkt?.jahre?.map(j=>j.jahr))
  console.log('full oi', oiAll.map(j=>j.jahr+':'+j.segmente.map(s=>s.name+'='+s.operatingIncomeMio).join('|')))
}
main()
