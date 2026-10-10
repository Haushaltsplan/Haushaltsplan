/**
 * npx tsx --conditions=react-server --require ./scripts/mock-server-only.cjs scripts/diag-spgi-oi.ts
 */
import { leseAlsJson } from '../lib/http/safe-json-response'
import { cikFuerTicker, padCik, secFetch } from '../lib/portfolio-analyse/sec-edgar-common-server'
import { ladeLesbarenBerichtText } from '../lib/portfolio-analyse/sec-edgar-bericht-text-server'
import {
  extrahiereIxbrlTextBlock,
  extrahiereOperatingIncomeHistorieAus10kHtml,
  parseMehrjahresOperatingIncome,
} from '../lib/portfolio-analyse/sec-edgar-segment-extraktion'

async function main() {
  const cik = await cikFuerTicker('SPGI')
  if (!cik) throw new Error('no cik')
  const subRes = await secFetch(`https://data.sec.gov/submissions/CIK${padCik(cik)}.json`)
  const sub =
    (await leseAlsJson<{
      filings?: {
        recent?: {
          form?: string[]
          accessionNumber?: string[]
          primaryDocument?: string[]
          reportDate?: string[]
        }
      }
    }>(subRes)) ?? {}
  const r = sub.filings?.recent
  let accession = ''
  let primaryDocument = ''
  let reportDate = ''
  for (let i = 0; i < (r?.form?.length ?? 0); i++) {
    if (r!.form![i] !== '10-K') continue
    accession = r!.accessionNumber?.[i] ?? ''
    primaryDocument = r!.primaryDocument?.[i] ?? ''
    reportDate = r!.reportDate?.[i] ?? ''
    if (accession && primaryDocument) break
  }
  console.log({ reportDate, accession, primaryDocument })
  const geladen = await ladeLesbarenBerichtText(cik, accession, '10-K', primaryDocument)
  console.log('html len', geladen?.text?.length ?? 0, geladen?.documentName)
  const text = geladen?.text ?? ''
  for (const n of [
    'operating profit',
    'Segment operating profit',
    'Income before taxes',
    'Adjusted Segment Operating',
  ]) {
    const idx = text.toLowerCase().indexOf(n.toLowerCase())
    console.log(n, idx)
    if (idx >= 0) console.log(JSON.stringify(text.slice(idx, idx + 280).replace(/\s+/g, ' ')))
  }
  const oi = extrahiereOperatingIncomeHistorieAus10kHtml(text)
  console.log(
    'oi',
    oi.map((j) => `${j.jahr}:${j.segmente.map((s) => `${s.name}=${s.operatingIncomeMio}`).join('|')}`),
  )

  // Probe common XBRL block tags
  for (const tag of [
    'us-gaap:ScheduleOfSegmentReportingInformationBySegmentTextBlock',
    'us-gaap:DisclosureOfEntitiesOperatingSegmentsTextBlock',
    'us-gaap:ReconciliationOfOperatingProfitLossFromSegmentsToConsolidatedTextBlock',
  ]) {
    try {
      const block = extrahiereIxbrlTextBlock(text, tag)
      console.log(tag, 'len', block.length)
      if (block.length > 500) {
        const p = parseMehrjahresOperatingIncome(block)
        console.log(
          '  parsed',
          p.map((j) => `${j.jahr}:${j.segmente.length}`).join(', '),
        )
      }
    } catch (e) {
      console.log(tag, e)
    }
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
