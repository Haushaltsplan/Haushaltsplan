/**
 * Diagnose SEC Segment-Extraktion
 * npx tsx scripts/diag-sec-segmente.ts [TICKER...]
 */
import { ladeLesbarenBerichtText } from '@/lib/portfolio-analyse/sec-edgar-bericht-text-server'
import { cikFuerTicker, ladeSecSubmissionsRecent, secFetch } from '@/lib/portfolio-analyse/sec-edgar-common-server'

const TICKERS = process.argv.slice(2).length ? process.argv.slice(2) : ['MSFT', 'NOW', 'MA', 'GOOGL', 'V', 'UNH']

async function neuestes10k(cik: number) {
  const recent = await ladeSecSubmissionsRecent(cik)
  if (!recent?.form?.length) return null
  for (let i = 0; i < recent.form.length; i++) {
    if (recent.form[i] !== '10-K') continue
    const accession = recent.accessionNumber?.[i]
    const doc = recent.primaryDocument?.[i]
    if (!accession || !doc) continue
    return { accession, primaryDocument: doc, reportDate: recent.reportDate?.[i] ?? null }
  }
  return null
}

function findeSectionHits(html: string) {
  const patterns = [
    'net revenue by geographic',
    'revenues by geographic',
    'revenue by geographic',
    'segment information',
    'information about geographic',
    'revenue by segment',
    'revenues by segment',
    'operating segments',
    'reportable segments',
    'revenue by product',
    'disaggregation of revenue',
    'entitygeographical',
    'SegmentReporting',
    'RevenueFromExternalCustomersByGeographicAreas',
  ]
  return patterns.filter((p) => html.toLowerCase().includes(p.toLowerCase()))
}

async function main() {
  for (const sym of TICKERS) {
    console.log('\n' + '='.repeat(60))
    console.log(sym)
    const cik = await cikFuerTicker(sym)
    if (!cik) {
      console.log('  no CIK')
      continue
    }
    const f = await neuestes10k(cik)
    if (!f) {
      console.log('  no 10-K')
      continue
    }
    const hit = await ladeLesbarenBerichtText(cik, f.accession, '10-K', f.primaryDocument)
    if (!hit?.url) {
      console.log('  no readable doc')
      continue
    }
    console.log('  doc:', hit.documentName, 'report:', f.reportDate)
    const html = await (await secFetch(hit.url)).text()
    console.log('  html len:', html.length)
    const hits = findeSectionHits(html)
    console.log('  section hits:', hits.join(' | ') || 'NONE')

    // sample ix facts for segments
    const ixFacts = [...html.matchAll(/name="([^"]*(?:Segment|Geograph|RevenueMember)[^"]*)"/gi)]
      .map((m) => m[1])
      .filter((v, i, a) => a.indexOf(v) === i)
      .slice(0, 15)
    if (ixFacts.length) console.log('  ix names:', ixFacts.join('; '))
  }
}

main().catch(console.error)
