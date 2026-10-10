import { cikFuerTicker } from '../lib/portfolio-analyse/sec-edgar-common-server'
import { ladeCompanyFactsJson } from '../lib/portfolio-analyse/sec-edgar-companyfacts-server'

async function main() {
  const cik = (await cikFuerTicker('SPGI'))!
  const facts = await ladeCompanyFactsJson(cik)
  const gaap = facts?.facts?.['us-gaap'] ?? {}
  for (const k of [
    'SegmentReportingInformationOperatingIncomeLoss',
    'SegmentReportingInformationRevenueFromExternalCustomer',
    'SegmentReportingInformationRevenueFromExternalCustomers',
  ]) {
    const node = gaap[k]
    if (!node) { console.log(k, 'MISSING'); continue }
    const units = node.units ?? {}
    for (const [unit, arr] of Object.entries(units)) {
      const list = arr as any[]
      console.log(k, unit, 'n=', list.length)
      // show unique keys
      const keys = new Set<string>()
      for (const x of list.slice(0, 20)) Object.keys(x).forEach(kk => keys.add(kk))
      console.log('  keys', [...keys])
      // show a few annual entries
      const annual = list.filter(x => x.form === '10-K' || x.fp === 'FY').slice(-8)
      for (const x of annual) {
        console.log(' ', JSON.stringify({ end: x.end, val: x.val, fp: x.fp, form: x.form, frame: x.frame, segment: x.segment }))
      }
      // any with segment-like nested?
      const weird = list.find(x => JSON.stringify(x).toLowerCase().includes('rating') || JSON.stringify(x).includes('Member'))
      if (weird) console.log(' weird', JSON.stringify(weird).slice(0,300))
    }
  }
  // DEI / dimensions elsewhere?
  const dims = Object.keys(facts?.facts ?? {})
  console.log('fact namespaces', dims)
}
main()
