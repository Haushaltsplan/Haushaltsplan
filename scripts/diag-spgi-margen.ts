import { ladeSecSegmentHistorie } from '../lib/portfolio-analyse/sec-edgar-segment-historie-server'

async function main() {
  const p = await ladeSecSegmentHistorie('SPGI')
  for (const j of p?.produkt?.jahre ?? []) {
    if (j.jahr < 2022) continue
    console.log('YEAR', j.jahr)
    for (const s of j.segmente) {
      console.log(' ', s.name, 'umsatz', s.umsatzMio, 'oi', s.operatingIncomeMio, 'marge', s.margePct)
    }
  }
  console.log('oiMap years from kategorien?', p?.kategorien?.map(k => k.id + ':' + k.historie.anzahlJahre).join(', '))
}
main()
