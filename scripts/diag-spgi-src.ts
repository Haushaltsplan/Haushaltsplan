import { cikFuerTicker, padCik, secFetch } from '../lib/portfolio-analyse/sec-edgar-common-server'
import { leseAlsJson } from '../lib/http/safe-json-response'
import { ladeLesbarenBerichtText } from '../lib/portfolio-analyse/sec-edgar-bericht-text-server'
import { extrahiereUmsatzAusIxbrlDimensionen } from '../lib/portfolio-analyse/sec-edgar-ixbrl-dimensionen'
import { extrahiereNarrativeSegmentTabellen } from '../lib/portfolio-analyse/sec-edgar-narrative-tabellen'
import { extrahiereSegmentHistorieAus10kHtml, extrahiereBeideSegmentartenAus10kHtml } from '../lib/portfolio-analyse/sec-edgar-segment-extraktion'

async function main() {
  const cik = (await cikFuerTicker('SPGI'))!
  const sub = await leseAlsJson<any>(await secFetch('https://data.sec.gov/submissions/CIK' + padCik(cik) + '.json'))
  const r = sub.filings.recent
  let accession='', primaryDocument=''
  for (let i=0;i<r.form.length;i++) if (r.form[i]==='10-K') { accession=r.accessionNumber[i]; primaryDocument=r.primaryDocument[i]; break }
  const g = await ladeLesbarenBerichtText(cik, accession, '10-K', primaryDocument)
  const t = g!.text
  const ix = extrahiereUmsatzAusIxbrlDimensionen(t)
  console.log('ix produkt', ix.produkt.map(j => j.jahr+':'+j.segmente.map(s=>s.name+'='+s.umsatzMio).join('|')))
  const narr = extrahiereNarrativeSegmentTabellen(t)
  console.log('narr produkt', narr.produkt.map(j => j.jahr+':'+j.segmente.map(s=>s.name).join(',')))
  const hist = extrahiereSegmentHistorieAus10kHtml(t)
  console.log('hist produkt', hist.produkt?.jahre.map(j => j.jahr+':'+j.segmente.map(s=>s.name).join(',')))
  const beide = extrahiereBeideSegmentartenAus10kHtml(t)
  console.log('beide', beide.produkt.segmente.map(s=>s.name+'='+s.umsatzMio))

  // count table-like structures
  console.log('table tags', (t.match(/<table/gi)||[]).length)
  console.log('role=table', (t.match(/role=\"table\"/gi)||[]).length)
  console.log('ix:nonNumeric', (t.match(/ix:nonNumeric/gi)||[]).length)
  // find Revenue near Market Intelligence in plain
  const p = t.replace(/<[^>]+>/g, '\n')
  const lines = p.split(/\n/).map(s=>s.trim()).filter(Boolean)
  let hit=0
  for (let i=0;i<lines.length;i++) {
    if (/^(Market Intelligence|Ratings|Revenue|Operating profit|Segment operating)/i.test(lines[i]) ||
        (/Market Intelligence|Ratings/i.test(lines[i]) && /\d{3,}/.test(lines[i]))) {
      console.log(i, lines[i].slice(0,160))
      hit++
      if (hit>50) break
    }
  }
}
main()
